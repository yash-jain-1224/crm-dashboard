"""
Leads API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import io
import asyncio
import math
import logging

from app.core.database import get_db
from app.models.models import Lead
from app.schemas.schemas import LeadCreate, LeadUpdate, LeadResponse, PaginatedResponse
from app.crud import leads
from app.utils.excel_utils import (
    ExcelValidator, 
    ExcelTemplateGenerator, 
    LEAD_SCHEMA
)
from app.core.background_tasks import task_manager

router = APIRouter()

logger = logging.getLogger(__name__)


def _process_leads_bulk_upload(task_id: str, data_list: list, db_engine):
    """Process bulk lead upload in background thread"""
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.exc import OperationalError
    from app.core.database import refresh_oauth_token
    from app.core.config import settings
    
    # Refresh OAuth token if needed before creating session
    if settings.USE_OAUTH:
        try:
            refresh_oauth_token()
        except Exception as e:
            logger.exception("Failed to refresh OAuth token")
            task = task_manager.get_task(task_id)
            if task:
                task.fail(f"Authentication error: {str(e)}")
            return {
                "success": False,
                "message": "Authentication error. Please refresh the page and try again.",
                "error": str(e),
                "success_count": 0,
                "failed_count": 0
            }
    
    # Create a new database session for this thread
    SessionLocal = sessionmaker(bind=db_engine)
    db = SessionLocal()
    
    try:
        CHUNK_SIZE = 5000  # Process upload in 5K record chunks (was 50K)
        BATCH_SIZE = 1000   # Process each chunk in 1K batches for faster progress (was 10K)
        success_count = 0
        failed_count = 0
        failed_records = []
        
        # Don't load all emails - use database for duplicate checking (much faster)
        logger.debug("[LEADS] Starting upload of %s records", len(data_list))
        
        # Process upload in chunks of 50,000 records
        for chunk_start in range(0, len(data_list), CHUNK_SIZE):
            chunk_end = min(chunk_start + CHUNK_SIZE, len(data_list))
            chunk_data = data_list[chunk_start:chunk_end]
            logger.debug(
                "[LEADS] Processing chunk %s: records %s to %s",
                chunk_start // CHUNK_SIZE + 1,
                chunk_start,
                chunk_end,
            )
            
            # Refresh OAuth token periodically for long uploads
            if settings.USE_OAUTH and chunk_start > 0:
                try:
                    refresh_oauth_token()
                    logger.debug("[LEADS] Token refreshed at record %s", chunk_start)
                except Exception as token_err:
                    logger.warning("Token refresh failed (continuing): %s", str(token_err))
            
            # Process each chunk in smaller batches
            for i in range(0, len(chunk_data), BATCH_SIZE):
                batch = chunk_data[i:i + BATCH_SIZE]
                actual_idx = chunk_start + i  # Absolute index in original data_list
                batch_leads = []
                batch_emails = []
                
                # Validate and prepare batch (no duplicate checking yet - do it in bulk)
                for idx, lead_data in enumerate(batch, start=actual_idx+2):
                    try:
                        lead_create = LeadCreate(**lead_data)
                        batch_leads.append(lead_create)
                        email = lead_data.get('email', '')
                        if email:
                            batch_emails.append(email.lower())
                    except Exception as e:
                        failed_count += 1
                        failed_records.append({
                            'row': idx,
                            'error': str(e),
                            'data': lead_data
                        })
                
                # Bulk check for duplicates in database (much faster than loading all)
                if batch_leads:
                    try:
                        # Check which emails already exist in ONE query
                        existing_emails = set()
                        if batch_emails:
                            existing = db.query(Lead.email).filter(
                                Lead.email.in_(batch_emails)
                            ).all()
                            existing_emails = {e[0].lower() for e in existing if e[0]}
                        
                        # Filter out duplicates
                        leads_to_insert = []
                        for idx, lead in enumerate(batch_leads, start=actual_idx+2):
                            email = lead.email.lower() if lead.email else None
                            if email and email in existing_emails:
                                failed_count += 1
                                failed_records.append({
                                    'row': idx,
                                    'error': 'Email already exists',
                                    'data': lead.model_dump()
                                })
                            else:
                                leads_to_insert.append(lead)
                                if email:
                                    existing_emails.add(email)
                        
                        # Bulk insert using raw SQL for maximum speed
                        if leads_to_insert:
                            from sqlalchemy import insert
                            insert_data = [lead.model_dump() for lead in leads_to_insert]
                            db.execute(insert(Lead), insert_data)
                            db.commit()
                            success_count += len(insert_data)
                            
                    except Exception as e:
                        db.rollback()
                        logger.warning("[LEADS] Batch insert failed, trying individually: %s", str(e))
                        # If batch fails, fall back to individual inserts
                        for idx_in_batch, lead_create in enumerate(batch_leads, start=actual_idx+2):
                            try:
                                leads.create_lead(db, lead_create)
                                success_count += 1
                            except Exception as individual_error:
                                failed_count += 1
                                failed_records.append({
                                    'row': idx_in_batch,
                                    'error': str(individual_error),
                                    'data': lead_create.model_dump()
                                })
                
                # Update progress after each batch
                task_manager.update_task(
                    task_id,
                    processed=actual_idx + len(batch),
                    success=success_count,
                    failed=failed_count,
                    errors=failed_records[-10:]  # Keep last 10 errors
                )
                logger.debug(
                    "[LEADS] Progress: %s/%s - Success: %s, Failed: %s",
                    actual_idx + len(batch),
                    len(data_list),
                    success_count,
                    failed_count,
                )
        
        # Return final result
        return {
            "success": True,
            "message": f"Processed {len(data_list)} records",
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_records": failed_records  # Return all failed records (removed limit)
        }
    
    finally:
        db.close()


def _process_leads_sync(data_list: list, db: Session) -> dict:
    """Process leads synchronously (for small uploads) - Optimized"""
    CHUNK_SIZE = 50000  # Process upload in 50K record chunks
    BATCH_SIZE = 10000    # Process each chunk in 5K batches for speed
    success_count = 0
    failed_count = 0
    failed_records = []
    
    logger.debug("[LEADS SYNC] Starting sync upload of %s records", len(data_list))
    
    # Process upload in chunks
    for chunk_start in range(0, len(data_list), CHUNK_SIZE):
        chunk_end = min(chunk_start + CHUNK_SIZE, len(data_list))
        chunk_data = data_list[chunk_start:chunk_end]
        
        # Process each chunk in smaller batches
        for i in range(0, len(chunk_data), BATCH_SIZE):
            batch = chunk_data[i:i + BATCH_SIZE]
            actual_idx = chunk_start + i  # Absolute index in original data_list
            batch_leads = []
            batch_emails = []
            
            # Validate and prepare batch
            for idx, lead_data in enumerate(batch, start=actual_idx+2):
                try:
                    lead_create = LeadCreate(**lead_data)
                    batch_leads.append(lead_create)
                    email = lead_data.get('email', '')
                    if email:
                        batch_emails.append(email.lower())
                except Exception as e:
                    failed_count += 1
                    failed_records.append({
                        'row': idx,
                        'error': str(e),
                        'data': lead_data
                    })
            
            # Bulk insert with duplicate checking
            if batch_leads:
                try:
                    # Check which emails already exist in ONE query
                    existing_emails = set()
                    if batch_emails:
                        existing = db.query(Lead.email).filter(
                            Lead.email.in_(batch_emails)
                        ).all()
                        existing_emails = {e[0].lower() for e in existing if e[0]}
                    
                    # Filter out duplicates
                    leads_to_insert = []
                    for idx, lead in enumerate(batch_leads, start=actual_idx+2):
                        email = lead.email.lower() if lead.email else None
                        if email and email in existing_emails:
                            failed_count += 1
                            failed_records.append({
                                'row': idx,
                                'error': 'Email already exists',
                                'data': lead.model_dump()
                            })
                        else:
                            leads_to_insert.append(lead)
                            if email:
                                existing_emails.add(email)
                    
                    # Bulk insert using raw SQL for maximum speed
                    if leads_to_insert:
                        from sqlalchemy import insert
                        insert_data = [lead.model_dump() for lead in leads_to_insert]
                        db.execute(insert(Lead), insert_data)
                        db.commit()
                        success_count += len(insert_data)
                        
                except Exception as e:
                    db.rollback()
                    logger.warning("[LEADS SYNC] Batch insert failed, trying individually: %s", str(e))
                    # If batch fails, fall back to individual inserts
                    for idx_in_batch, lead_create in enumerate(batch_leads, start=actual_idx+2):
                        try:
                            leads.create_lead(db, lead_create)
                            success_count += 1
                        except Exception as individual_error:
                            failed_count += 1
                            failed_records.append({
                                'row': idx_in_batch,
                                'error': str(individual_error),
                                'data': lead_create.model_dump()
                            })
    
    logger.debug("[LEADS SYNC] Completed: Success: %s, Failed: %s", success_count, failed_count)
    return {
        "success": True,
        "message": f"Processed {len(data_list)} records",
        "success_count": success_count,
        "failed_count": failed_count,
        "failed_records": failed_records
    }


@router.get("/template",
    summary="Download Leads Excel Template",
    description="""
    Download a pre-formatted Excel template for bulk lead upload.
    
    The template includes:
    - Required fields: name, email, phone, company
    - Optional fields: status, source, assigned_to, score
    - Field validation rules and data types
    - Example lead data
    
    **Best Practice**: Always use this template to ensure data compatibility.
    """,
    responses={
        200: {
            "description": "Excel template file (leads_template.xlsx)",
            "content": {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}
            }
        }
    }
)
async def download_lead_template():
    """Download Excel template for bulk lead upload"""
    template_bytes = ExcelTemplateGenerator.generate_template(
        LEAD_SCHEMA, 
        "Leads Template"
    )
    
    return StreamingResponse(
        io.BytesIO(template_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=leads_template.xlsx"
        }
    )


@router.get("/upload-progress/{task_id}", response_model=dict)
async def get_upload_progress(task_id: str):
    """
    Get progress of a background upload task
    
    Returns:
        Task progress with status, counts, and any errors
    """
    task = task_manager.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found. It may have expired (tasks are kept for 1 hour after completion)."
        )
    
    return task.to_dict()


@router.post("/bulk-upload", 
    response_model=dict,
    summary="Bulk Upload Leads from Excel",
    description="""
    Import multiple leads from an Excel file with high-performance processing.
    
    ### Features:
    - ✅ **Scalable**: Handles 50,000+ leads efficiently
    - ✅ **Async Processing**: Background mode for large files
    - ✅ **Duplicate Detection**: Checks for existing emails
    - ✅ **Lead Scoring**: Automatic score calculation
    - ✅ **Error Handling**: Detailed validation and error reporting
    
    ### Process:
    1. Download template via `/template` endpoint
    2. Add lead data (name, email, phone, company, etc.)
    3. Upload with `async_mode=true` for files >10000 rows
    4. Monitor progress with returned `task_id`
    
    ### Performance:
    - **Sync Mode**: Up to 5,000 leads (returns immediately with results)
    - **Async Mode**: 5,000+ leads (background processing with progress tracking)
    - **Batch Size**: 10,000 records per batch for optimal performance
    
    ### Response Formats:
    **Sync** (small files):
    ```json
    {
        "success": true,
        "message": "Processed 1000 records",
        "success_count": 980,
        "failed_count": 20,
        "failed_records": [...]
    }
    ```
    
    **Async** (large files):
    ```json
    {
        "success": true,
        "async": true,
        "task_id": "task-xyz-123",
        "message": "Processing 50000 records in background..."
    }
    ```
    """,
    responses={
        200: {"description": "Upload initiated or completed"},
        400: {"description": "Invalid file or data format"}
    }
)
async def bulk_upload_leads(
    file: UploadFile = File(...),
    async_mode: bool = Query(False, description="Process upload in background (recommended for >10000 rows)"),
    db: Session = Depends(get_db)
):
    """
    Bulk upload leads from Excel file

    For large files (>10000 rows), use async_mode=true to process in background.
    Returns task_id for progress tracking.
    
    Returns:
        Dictionary with success count, failed count, and error details (sync mode)
        OR task_id for progress tracking (async mode)
    """
    validator = ExcelValidator(LEAD_SCHEMA)
    
    # Validate and parse Excel file
    is_valid, data_list, errors = await validator.validate_and_parse(file)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Invalid Excel format",
                "errors": errors
            }
        )
    
    # For large uploads, use background processing
    if async_mode or len(data_list) > 5000:
        task_id = task_manager.create_task(total=len(data_list))
        
        # Process in background (keep task reference to prevent GC)
        _background_task = asyncio.create_task(
            task_manager.run_task_async(
                task_id,
                _process_leads_bulk_upload,
                data_list,
                db.get_bind()  # Pass connection string instead of session
            )
        )
        
        return {
            "success": True,
            "async": True,
            "task_id": task_id,
            "message": f"Processing {len(data_list)} records in background. Use /api/v1/leads/upload-progress/{task_id} to check status."
        }
    
    # For small uploads, process synchronously
    return _process_leads_sync(data_list, db)


@router.get("/", response_model=PaginatedResponse[LeadResponse])
def get_leads(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str = Query(None, description="Search query"),
    status: str = Query(None, description="Comma-separated status values"),
    source: str = Query(None, description="Comma-separated source values"),
    assigned_to: str = Query(None, description="Comma-separated assigned_to values"),
    score_min: int = Query(None, description="Minimum score"),
    score_max: int = Query(None, description="Maximum score"),
    db: Session = Depends(get_db)
):
    """Get all leads with pagination, optional search, and filters"""
    skip = (page - 1) * page_size
    
    # Parse comma-separated filter values
    status_list = status.split(',') if status else None
    source_list = source.split(',') if source else None
    assigned_to_list = assigned_to.split(',') if assigned_to else None
    
    # Use filter function with all parameters
    items = leads.filter_leads(
        db,
        skip=skip,
        limit=page_size,
        search=search,
        status=status_list,
        source=source_list,
        assigned_to=assigned_to_list,
        score_min=score_min,
        score_max=score_max
    )
    
    total = leads.filter_leads_count(
        db,
        search=search,
        status=status_list,
        source=source_list,
        assigned_to=assigned_to_list,
        score_min=score_min,
        score_max=score_max
    )
    
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/status/{status}", response_model=List[LeadResponse])
def get_leads_by_status(
    status: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get leads by status"""
    return leads.get_leads_by_status(db, status=status, skip=skip, limit=limit)


@router.get("/filters/options", response_model=dict)
def get_filter_options(db: Session = Depends(get_db)):
    """Get unique values for each filterable field"""
    return leads.get_filter_options(db)


@router.get("/summary", response_model=dict)
def get_leads_summary(db: Session = Depends(get_db)):
    """Get overall lead statistics (not paginated)"""
    from sqlalchemy import func
    from app.models.models import Lead
    
    # Get total count
    total_leads = db.query(func.count(Lead.id)).scalar() or 0
    
    # Get qualified count
    qualified_count = db.query(func.count(Lead.id)).filter(Lead.status == 'Qualified').scalar() or 0
    
    # Get average score
    avg_score = db.query(func.avg(Lead.score)).scalar() or 0
    
    # Get total value - handle both string and numeric values
    all_leads = db.query(Lead.value).filter(Lead.value.isnot(None)).all()
    total_value = 0
    for lead in all_leads:
        try:
            # Remove $ and , and convert to int
            value_str = str(lead.value).replace('$', '').replace(',', '')
            total_value += int(float(value_str))
        except (ValueError, AttributeError):
            pass
    
    return {
        "total_leads": total_leads,
        "qualified_leads": qualified_count,
        "avg_score": round(avg_score) if avg_score else 0,
        "total_value": total_value
    }


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    """Get a lead by ID"""
    db_lead = leads.get_lead(db, lead_id)
    if db_lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    return db_lead


@router.post("/", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(lead: LeadCreate, db: Session = Depends(get_db)):
    """Create a new lead"""
    return leads.create_lead(db, lead)


@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: int, lead: LeadUpdate, db: Session = Depends(get_db)):
    """Update a lead"""
    db_lead = leads.update_lead(db, lead_id, lead)
    if db_lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    return db_lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    """Delete a lead"""
    if not leads.delete_lead(db, lead_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    return None


@router.delete("/", response_model=dict)
def delete_all_leads(db: Session = Depends(get_db)):
    """
    Delete all leads from the database
    
    ⚠️ WARNING: This will permanently delete ALL leads!
    Use with caution, primarily for testing and development.
    
    This endpoint is thread-safe and handles concurrent requests.
    
    Returns:
        Dictionary with the count of deleted leads
    """
    try:
        count = leads.delete_all_leads(db)
        return {
            "success": True,
            "message": "Deleted all leads",
            "deleted_count": count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete leads: {str(e)}"
        )
