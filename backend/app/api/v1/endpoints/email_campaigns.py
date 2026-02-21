"""
Email Campaigns API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import io
import asyncio
import math

from app.core.database import get_db
from app.models.models import EmailCampaign
from app.schemas.schemas import EmailCampaignCreate, EmailCampaignUpdate, EmailCampaignResponse, PaginatedResponse
from app.crud import email_campaigns
from app.utils.excel_utils import (
    ExcelValidator, 
    ExcelTemplateGenerator, 
    EMAIL_CAMPAIGN_SCHEMA
)
from app.core.background_tasks import task_manager

router = APIRouter()


def _process_email_campaigns_bulk_upload(task_id: str, data_list: list, db_engine):
    """Process bulk email campaign upload in background thread"""
    from sqlalchemy.orm import sessionmaker
    
    # Create a new database session for this thread
    SessionLocal = sessionmaker(bind=db_engine)
    db = SessionLocal()
    
    try:
        CHUNK_SIZE = 10000  # Process upload in 10K record chunks
        BATCH_SIZE = 5000   # Process each chunk in 1K batches for better progress tracking
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
                batch_campaigns = []
                
                # Validate and prepare batch
                for idx, campaign_data in enumerate(batch, start=actual_idx+2):
                    try:
                        campaign_create = EmailCampaignCreate(**campaign_data)
                        batch_campaigns.append(campaign_create)
                    except Exception as e:
                        failed_count += 1
                        failed_records.append({
                            'row': idx,
                            'name': campaign_data.get('name', 'N/A'),
                            'error': str(e)
                        })
                
                # Bulk insert valid campaigns
            # Bulk insert valid campaigns
            if batch_campaigns:
                try:
                    count = email_campaigns.bulk_create_campaigns(db, batch_campaigns)
                    success_count += count
                except Exception as e:
                    # If batch fails, fall back to individual inserts
                    for idx_in_batch, campaign_create in enumerate(batch_campaigns, start=actual_idx+2):
                        try:
                            email_campaigns.create_campaign(db, campaign_create)
                            success_count += 1
                        except Exception as individual_error:
                            failed_count += 1
                            failed_records.append({
                                'row': idx_in_batch,
                                'name': campaign_create.name,
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


def _process_email_campaigns_sync(data_list: list, db: Session) -> dict:
    """Process email campaigns synchronously (for small uploads)"""
    CHUNK_SIZE = 10000  # Process upload in 10K record chunks
    BATCH_SIZE = 5000   # Process each chunk in 1K batches
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
            batch_campaigns = []
            
            # Validate and prepare batch
            for idx, campaign_data in enumerate(batch, start=actual_idx+2):
                try:
                    campaign_create = EmailCampaignCreate(**campaign_data)
                    batch_campaigns.append(campaign_create)
                except Exception as e:
                    failed_count += 1
                    failed_records.append({
                        'row': idx,
                        'name': campaign_data.get('name', 'N/A'),
                        'error': str(e)
                    })
        
        # Bulk insert valid campaigns        
        # Bulk insert valid campaigns
        if batch_campaigns:
            try:
                count = email_campaigns.bulk_create_campaigns(db, batch_campaigns)
                success_count += count
            except Exception as e:
                # If batch fails, fall back to individual inserts
                for idx_in_batch, campaign_create in enumerate(batch_campaigns, start=actual_idx+2):
                    try:
                        email_campaigns.create_campaign(db, campaign_create)
                        success_count += 1
                    except Exception as individual_error:
                        failed_count += 1
                        failed_records.append({
                            'row': idx_in_batch,
                            'name': campaign_create.name,
                            'error': str(individual_error)
                        })
    
    return {
        "success": True,
        "message": f"Processed {len(data_list)} records",
        "success_count": success_count,
        "failed_count": failed_count,
        "failed_records": failed_records
    }


@router.get("/template")
async def download_campaign_template():
    """Download Excel template for bulk email campaign upload"""
    template_bytes = ExcelTemplateGenerator.generate_template(
        EMAIL_CAMPAIGN_SCHEMA, 
        "Email Campaigns Template"
    )
    
    return StreamingResponse(
        io.BytesIO(template_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=email_campaigns_template.xlsx"
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
async def bulk_upload_campaigns(
    file: UploadFile = File(...),
    async_mode: bool = Query(False, description="Process upload in background (recommended for >5000 rows)"),
    db: Session = Depends(get_db)
):
    """
    Bulk upload email campaigns from Excel file
    
    For large files (>5000 rows), use async_mode=true to process in background.
    Returns task_id for progress tracking.
    
    Returns:
        Dictionary with success count, failed count, and error details (sync mode)
        OR task_id for progress tracking (async mode)
    """
    validator = ExcelValidator(EMAIL_CAMPAIGN_SCHEMA)
    
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
                _process_email_campaigns_bulk_upload,
                data_list,
                db.get_bind()  # Pass connection string instead of session
            )
        )
        
        return {
            "success": True,
            "async": True,
            "task_id": task_id,
            "message": f"Processing {len(data_list)} records in background. Use /api/v1/email-campaigns/upload-progress/{task_id} to check status."
        }
    
    # For small uploads, process synchronously
    return _process_email_campaigns_sync(data_list, db)


@router.get("/", response_model=PaginatedResponse[EmailCampaignResponse])
def get_campaigns(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str = Query(None, description="Search query"),
    db: Session = Depends(get_db)
):
    """Get all email campaigns with pagination and optional search"""
    skip = (page - 1) * page_size
    
    if search:
        # Use search functionality
        total = email_campaigns.search_email_campaigns_count(db, search)
        items = email_campaigns.search_email_campaigns(db, search, skip=skip, limit=page_size)
    else:
        # Get all email campaigns
        total = email_campaigns.get_campaigns_count(db)
        items = email_campaigns.get_campaigns(db, skip=skip, limit=page_size)
    
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/summary", response_model=dict)
def get_campaigns_summary(db: Session = Depends(get_db)):
    """Get overall email campaign statistics (not paginated)"""
    from sqlalchemy import func
    
    # Get total count
    total_campaigns = db.query(func.count(EmailCampaign.id)).scalar() or 0
    
    # Get total sent
    total_sent = db.query(func.sum(EmailCampaign.sent_count)).scalar() or 0
    
    # Get average open rate
    avg_open_rate = db.query(func.avg(EmailCampaign.open_rate)).filter(
        EmailCampaign.open_rate.isnot(None)
    ).scalar() or 0
    
    # Get average click rate
    avg_click_rate = db.query(func.avg(EmailCampaign.click_rate)).filter(
        EmailCampaign.click_rate.isnot(None)
    ).scalar() or 0
    
    # Get average conversion rate
    avg_conversion_rate = db.query(func.avg(EmailCampaign.conversion_rate)).filter(
        EmailCampaign.conversion_rate.isnot(None)
    ).scalar() or 0
    
    return {
        "total_campaigns": total_campaigns,
        "total_sent": int(total_sent),
        "avg_open_rate": round(avg_open_rate, 2) if avg_open_rate else 0,
        "avg_click_rate": round(avg_click_rate, 2) if avg_click_rate else 0,
        "avg_conversion_rate": round(avg_conversion_rate, 2) if avg_conversion_rate else 0
    }


@router.get("/{campaign_id}", response_model=EmailCampaignResponse)
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """Get an email campaign by ID"""
    db_campaign = email_campaigns.get_campaign(db, campaign_id)
    if db_campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return db_campaign


@router.post("/", response_model=EmailCampaignResponse, status_code=status.HTTP_201_CREATED)
def create_campaign(campaign: EmailCampaignCreate, db: Session = Depends(get_db)):
    """Create a new email campaign"""
    return email_campaigns.create_campaign(db, campaign)


@router.put("/{campaign_id}", response_model=EmailCampaignResponse)
def update_campaign(
    campaign_id: int,
    campaign: EmailCampaignUpdate,
    db: Session = Depends(get_db)
):
    """Update an email campaign"""
    db_campaign = email_campaigns.update_campaign(db, campaign_id, campaign)
    if db_campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return db_campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    """Delete an email campaign"""
    if not email_campaigns.delete_campaign(db, campaign_id):
        raise HTTPException(status_code=404, detail="Campaign not found")
    return None


@router.delete("/", response_model=dict)
def delete_all_campaigns(db: Session = Depends(get_db)):
    """
    Delete all email campaigns from the database
    
    ⚠️ WARNING: This will permanently delete ALL email campaigns!
    Use with caution, primarily for testing and development.
    
    This endpoint is thread-safe and handles concurrent requests.
    
    Returns:
        Dictionary with the count of deleted campaigns
    """
    try:
        count = email_campaigns.delete_all_campaigns(db)
        return {
            "success": True,
            "message": "Deleted all email campaigns",
            "deleted_count": count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete email campaigns: {str(e)}"
        )
