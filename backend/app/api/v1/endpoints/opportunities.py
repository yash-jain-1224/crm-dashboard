"""
Opportunities API Routes
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
from app.models.models import Opportunity
from app.schemas.schemas import OpportunityCreate, OpportunityUpdate, OpportunityResponse, PaginatedResponse
from app.crud import opportunities
from app.utils.excel_utils import (
    ExcelValidator, 
    ExcelTemplateGenerator, 
    OPPORTUNITY_SCHEMA
)
from app.core.background_tasks import task_manager

router = APIRouter()

logger = logging.getLogger(__name__)


def _process_opportunities_bulk_upload(task_id: str, data_list: list, db_engine):
    """Process bulk opportunity upload in background thread"""
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
        
        # Process upload in chunks of 10,000 records
        for chunk_start in range(0, len(data_list), CHUNK_SIZE):
            chunk_end = min(chunk_start + CHUNK_SIZE, len(data_list))
            chunk_data = data_list[chunk_start:chunk_end]
            
            # Refresh OAuth token periodically for long uploads
            if settings.USE_OAUTH and chunk_start > 0:
                try:
                    refresh_oauth_token()
                    logger.debug("[OPPORTUNITIES] Token refreshed at record %s", chunk_start)
                except Exception as token_err:
                    logger.warning("Token refresh failed (continuing): %s", str(token_err))
            
            # Process each chunk in smaller batches
            for i in range(0, len(chunk_data), BATCH_SIZE):
                batch = chunk_data[i:i + BATCH_SIZE]
                actual_idx = chunk_start + i  # Absolute index in original data_list
                batch_opportunities = []
                
                # Validate and prepare batch
                for idx, opportunity_data in enumerate(batch, start=actual_idx+2):
                    try:
                        opportunity_create = OpportunityCreate(**opportunity_data)
                        batch_opportunities.append(opportunity_create)
                    except Exception as e:
                        failed_count += 1
                        failed_records.append({
                            'row': idx,
                            'name': opportunity_data.get('name', 'N/A'),
                            'error': str(e)
                        })
                
                # Bulk insert valid opportunities
            if batch_opportunities:
                try:
                    count = opportunities.bulk_create_opportunities(db, batch_opportunities)
                    success_count += count
                except Exception as e:
                    # If batch fails, fall back to individual inserts
                    for idx_in_batch, opportunity_create in enumerate(batch_opportunities, start=actual_idx+2):
                        try:
                            opportunities.create_opportunity(db, opportunity_create)
                            success_count += 1
                        except Exception as individual_error:
                            failed_count += 1
                            failed_records.append({
                                'row': idx_in_batch,
                                'name': opportunity_create.name,
                                'error': str(individual_error)
                            })
                
                # Update progress
                task_manager.update_task(
                    task_id,
                    processed=actual_idx + len(batch),
                    success=success_count,
                    failed=failed_count,
                    errors=failed_records[-10:]  # Keep last 10 errors
                )
        
        # Return final result
        return {
            "success": True,
            "message": f"Processed {len(data_list)} records",
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_records": failed_records[:100]  # Limit to first 100
        }
    
    finally:
        db.close()


def _process_opportunities_sync(data_list: list, db: Session) -> dict:
    """Process opportunities synchronously (for small uploads)"""
    CHUNK_SIZE = 50000  # Process upload in 10K record chunks
    BATCH_SIZE = 10000   # Process each chunk in 1K batches
    success_count = 0
    failed_count = 0
    failed_records = []
    
    # Process upload in chunks of 10,000 records
    for chunk_start in range(0, len(data_list), CHUNK_SIZE):
        chunk_end = min(chunk_start + CHUNK_SIZE, len(data_list))
        chunk_data = data_list[chunk_start:chunk_end]
        
        # Process each chunk in smaller batches
        for i in range(0, len(chunk_data), BATCH_SIZE):
            batch = chunk_data[i:i + BATCH_SIZE]
            actual_idx = chunk_start + i  # Absolute index in original data_list
            batch_opportunities = []
            
            # Validate and prepare batch
            for idx, opportunity_data in enumerate(batch, start=actual_idx+2):
                try:
                    opportunity_create = OpportunityCreate(**opportunity_data)
                    batch_opportunities.append(opportunity_create)
                except Exception as e:
                    failed_count += 1
                    failed_records.append({
                        'row': idx,
                        'name': opportunity_data.get('name', 'N/A'),
                        'error': str(e)
                    })
        
        # Bulk insert valid opportunities
        if batch_opportunities:
            try:
                count = opportunities.bulk_create_opportunities(db, batch_opportunities)
                success_count += count
            except Exception as e:
                # If batch fails, fall back to individual inserts
                for idx_in_batch, opportunity_create in enumerate(batch_opportunities, start=actual_idx+2):
                    try:
                        opportunities.create_opportunity(db, opportunity_create)
                        success_count += 1
                    except Exception as individual_error:
                        failed_count += 1
                        failed_records.append({
                            'row': idx_in_batch,
                            'name': opportunity_create.name,
                            'error': str(individual_error)
                        })
    
    return {
        "success": True,
        "message": f"Processed {len(data_list)} records",
        "success_count": success_count,
        "failed_count": failed_count,
        "failed_records": failed_records
    }

router = APIRouter()


@router.get("/template")
async def download_opportunity_template():
    """Download Excel template for bulk opportunity upload"""
    template_bytes = ExcelTemplateGenerator.generate_template(
        OPPORTUNITY_SCHEMA, 
        "Opportunities Template"
    )
    
    return StreamingResponse(
        io.BytesIO(template_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=opportunities_template.xlsx"
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


@router.post("/bulk-upload", response_model=dict)
async def bulk_upload_opportunities(
    file: UploadFile = File(...),
    async_mode: bool = Query(False, description="Process upload in background (recommended for >5000 rows)"),
    db: Session = Depends(get_db)
):
    """
    Bulk upload opportunities from Excel file
    
    For large files (>5000 rows), use async_mode=true to process in background.
    Returns task_id for progress tracking.
    
    Returns:
        Dictionary with success count, failed count, and error details (sync mode)
        OR task_id for progress tracking (async mode)
    """
    validator = ExcelValidator(OPPORTUNITY_SCHEMA)
    
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
                _process_opportunities_bulk_upload,
                data_list,
                db.get_bind()  # Pass connection string instead of session
            )
        )
        
        return {
            "success": True,
            "async": True,
            "task_id": task_id,
            "message": f"Processing {len(data_list)} records in background. Use /api/v1/opportunities/upload-progress/{task_id} to check status."
        }
    
    # For small uploads, process synchronously
    return _process_opportunities_sync(data_list, db)


@router.get("/", response_model=PaginatedResponse[OpportunityResponse])
def get_opportunities(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str = Query(None, description="Search query"),
    stage: str = Query(None, description="Comma-separated stage values"),
    account: str = Query(None, description="Comma-separated account values"),
    owner: str = Query(None, description="Comma-separated owner values"),
    value_min: float = Query(None, description="Minimum value"),
    value_max: float = Query(None, description="Maximum value"),
    probability_min: int = Query(None, description="Minimum probability"),
    probability_max: int = Query(None, description="Maximum probability"),
    db: Session = Depends(get_db)
):
    """Get all opportunities with pagination, optional search, and filters"""
    skip = (page - 1) * page_size
    
    # Parse comma-separated filter values
    stage_list = stage.split(',') if stage else None
    account_list = account.split(',') if account else None
    owner_list = owner.split(',') if owner else None
    
    # Use filter function with all parameters
    items = opportunities.filter_opportunities(
        db,
        skip=skip,
        limit=page_size,
        search=search,
        stage=stage_list,
        account=account_list,
        owner=owner_list,
        value_min=value_min,
        value_max=value_max,
        probability_min=probability_min,
        probability_max=probability_max
    )
    
    total = opportunities.filter_opportunities_count(
        db,
        search=search,
        stage=stage_list,
        account=account_list,
        owner=owner_list,
        value_min=value_min,
        value_max=value_max,
        probability_min=probability_min,
        probability_max=probability_max
    )
    
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/stage/{stage}", response_model=List[OpportunityResponse])
def get_opportunities_by_stage(
    stage: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get opportunities by stage"""
    return opportunities.get_opportunities_by_stage(db, stage=stage, skip=skip, limit=limit)


@router.get("/filters/options", response_model=dict)
def get_filter_options(db: Session = Depends(get_db)):
    """Get unique values for each filterable field"""
    return opportunities.get_filter_options(db)


@router.get("/{opportunity_id}", response_model=OpportunityResponse)
def get_opportunity(opportunity_id: int, db: Session = Depends(get_db)):
    """Get an opportunity by ID"""
    db_opportunity = opportunities.get_opportunity(db, opportunity_id)
    if db_opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return db_opportunity


@router.post("/", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
def create_opportunity(opportunity: OpportunityCreate, db: Session = Depends(get_db)):
    """Create a new opportunity"""
    return opportunities.create_opportunity(db, opportunity)


@router.put("/{opportunity_id}", response_model=OpportunityResponse)
def update_opportunity(
    opportunity_id: int,
    opportunity: OpportunityUpdate,
    db: Session = Depends(get_db)
):
    """Update an opportunity"""
    db_opportunity = opportunities.update_opportunity(db, opportunity_id, opportunity)
    if db_opportunity is None:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return db_opportunity


@router.delete("/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opportunity(opportunity_id: int, db: Session = Depends(get_db)):
    """Delete an opportunity"""
    if not opportunities.delete_opportunity(db, opportunity_id):
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return None


@router.delete("/", response_model=dict)
def delete_all_opportunities(db: Session = Depends(get_db)):
    """
    Delete all opportunities from the database
    
    ⚠️ WARNING: This will permanently delete ALL opportunities!
    Use with caution, primarily for testing and development.
    
    This endpoint is thread-safe and handles concurrent requests.
    
    Returns:
        Dictionary with the count of deleted opportunities
    """
    try:
        count = opportunities.delete_all_opportunities(db)
        return {
            "success": True,
            "message": "Deleted all opportunities",
            "deleted_count": count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete opportunities: {str(e)}"
        )
