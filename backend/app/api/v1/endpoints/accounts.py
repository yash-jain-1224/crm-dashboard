"""
Accounts API Routes
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
from app.models.models import Account
from app.schemas.schemas import AccountCreate, AccountUpdate, AccountResponse, PaginatedResponse
from app.crud import accounts
from app.utils.excel_utils import (
    ExcelValidator, 
    ExcelTemplateGenerator, 
    ACCOUNT_SCHEMA
)
from app.core.background_tasks import task_manager

router = APIRouter()

logger = logging.getLogger(__name__)


def _process_accounts_bulk_upload(task_id: str, data_list: list, db_engine):
    """Process bulk account upload in background thread with optimized batching"""
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import insert
    from sqlalchemy.exc import OperationalError
    from app.models.models import Account
    from app.core.database import refresh_oauth_token
    from app.core.config import settings
    
    logger.debug("[ACCOUNTS] Starting bulk upload for task %s with %s records", task_id, len(data_list))
    
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
    
    # Initialize counters
    success_count = 0
    failed_count = 0
    failed_records = []
    
    try:
        CHUNK_SIZE = 5000  # Process upload in 5K record chunks (was 50K)
        BATCH_SIZE = 1000   # Process each chunk in 1K batches for faster progress (was 10K)
        
        # Update task with initial progress
        task_manager.update_task(
            task_id,
            processed=0,
            success=0,
            failed=0,
            errors=[]
        )
        logger.debug("[ACCOUNTS] Task %s initialized with %s total records", task_id, len(data_list))
        
        # Process upload in chunks of 10,000 records
        for chunk_start in range(0, len(data_list), CHUNK_SIZE):
            chunk_end = min(chunk_start + CHUNK_SIZE, len(data_list))
            chunk_data = data_list[chunk_start:chunk_end]
            logger.debug(
                "[ACCOUNTS] Processing chunk %s: records %s to %s",
                chunk_start // CHUNK_SIZE + 1,
                chunk_start,
                chunk_end,
            )
            
            # Refresh OAuth token periodically for long uploads
            if settings.USE_OAUTH and chunk_start > 0:
                try:
                    refresh_oauth_token()
                    logger.debug("[ACCOUNTS] Token refreshed at record %s", chunk_start)
                except Exception as token_err:
                    logger.warning("Token refresh failed (continuing): %s", str(token_err))
            
            # Process each chunk in smaller batches
            for i in range(0, len(chunk_data), BATCH_SIZE):
                logger.debug(
                    "[ACCOUNTS] Processing batch %s, records %s to %s",
                    i // BATCH_SIZE + 1,
                    i,
                    min(i + BATCH_SIZE, len(chunk_data)),
                )
                batch = chunk_data[i:i + BATCH_SIZE]
                actual_idx = chunk_start + i  # Absolute index in original data_list
                batch_data = []
                
                # Validate and prepare batch with minimal processing
                for idx, account_data in enumerate(batch, start=actual_idx+2):
                    try:
                        # Basic validation
                        if not account_data.get('name'):
                            failed_count += 1
                            failed_records.append({
                                'row': idx,
                                'name': 'N/A',
                                'error': 'Missing required field: name'
                            })
                            continue
                        
                        # Prepare data dict for bulk insert
                        batch_data.append({
                            'name': account_data['name'],
                            'industry': account_data.get('industry'),
                            'revenue': account_data.get('revenue'),
                            'employees': account_data.get('employees'),
                            'location': account_data.get('location'),
                            'phone': account_data.get('phone'),
                            'website': account_data.get('website'),
                            'account_owner': account_data.get('account_owner'),
                            'status': account_data.get('status', 'Active')
                        })
                    except Exception as e:
                        failed_count += 1
                        failed_records.append({
                            'row': idx,
                            'name': account_data.get('name', 'N/A'),
                            'error': str(e)
                        })
                
                # Bulk insert using SQLAlchemy core for maximum performance
            if batch_data:
                try:
                    # Use bulk insert ignore duplicates
                    stmt = insert(Account).values(batch_data)
                    # PostgreSQL/MySQL specific: on conflict do nothing
                    # For SQLite, we'll catch the error and continue
                    db.execute(stmt)
                    db.commit()
                    success_count += len(batch_data)
                except Exception as e:
                    db.rollback()
                    # Fall back to individual inserts for this batch
                    for idx, data in enumerate(batch_data, start=actual_idx+2):
                        try:
                            # Check if account exists (by name)
                            existing = db.query(Account).filter(Account.name == data['name']).first()
                            if existing:
                                failed_count += 1
                                failed_records.append({
                                    'row': idx,
                                    'name': data['name'],
                                    'error': 'Duplicate account name'
                                })
                                continue
                            
                            new_account = Account(**data)
                            db.add(new_account)
                            db.commit()
                            success_count += 1
                        except Exception as individual_error:
                            db.rollback()
                            failed_count += 1
                            failed_records.append({
                                'row': idx,
                                'name': data['name'],
                                'error': str(individual_error)
                            })
            
                # Update progress after processing each batch
                task_manager.update_task(
                    task_id,
                    processed=actual_idx + len(batch),
                    success=success_count,
                    failed=failed_count,
                    errors=failed_records[-10:]  # Keep last 10 errors
                )
                logger.debug(
                    "[ACCOUNTS] Progress update: %s/%s processed, %s success, %s failed",
                    actual_idx + len(batch),
                    len(data_list),
                    success_count,
                    failed_count,
                )
        
        # Return final result (run_task_async will call complete_task)
        return {
            "success": True,
            "message": f"Processed {len(data_list)} records",
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_records": failed_records[:100]  # Limit to first 100
        }
    
    except Exception as e:
        # Log error and update task
        task_manager.fail_task(task_id, str(e))
        return {
            "success": False,
            "message": f"Upload failed: {str(e)}",
            "success_count": success_count,
            "failed_count": failed_count,
            "failed_records": failed_records[:100]
        }
    finally:
        db.close()


def _process_accounts_sync(data_list: list, db: Session) -> dict:
    """Process accounts synchronously with optimized batching (for small uploads)"""
    from sqlalchemy import insert
    from app.models.models import Account
    
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
            batch_data = []
            
            # Validate and prepare batch
            for idx, account_data in enumerate(batch, start=actual_idx+2):
                try:
                    if not account_data.get('name'):
                        failed_count += 1
                        failed_records.append({
                            'row': idx,
                            'name': 'N/A',
                            'error': 'Missing required field: name'
                        })
                        continue
                    
                    batch_data.append({
                        'name': account_data['name'],
                        'industry': account_data.get('industry'),
                        'revenue': account_data.get('revenue'),
                        'employees': account_data.get('employees'),
                        'location': account_data.get('location'),
                        'phone': account_data.get('phone'),
                        'website': account_data.get('website'),
                        'account_owner': account_data.get('account_owner'),
                        'status': account_data.get('status', 'Active')
                    })
                except Exception as e:
                    failed_count += 1
                    failed_records.append({
                        'row': idx,
                        'name': account_data.get('name', 'N/A'),
                        'error': str(e)
                    })
        
        # Bulk insert valid accounts
        if batch_data:
            try:
                stmt = insert(Account).values(batch_data)
                db.execute(stmt)
                db.commit()
                success_count += len(batch_data)
            except Exception as e:
                db.rollback()
                # Fall back to individual inserts
                for idx, data in enumerate(batch_data, start=actual_idx+2):
                    try:
                        existing = db.query(Account).filter(Account.name == data['name']).first()
                        if existing:
                            failed_count += 1
                            failed_records.append({
                                'row': idx,
                                'name': data['name'],
                                'error': 'Duplicate account name'
                            })
                            continue
                        
                        new_account = Account(**data)
                        db.add(new_account)
                        db.commit()
                        success_count += 1
                    except Exception as individual_error:
                        db.rollback()
                        failed_count += 1
                        failed_records.append({
                            'row': idx,
                            'name': data['name'],
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
async def download_account_template():
    """Download Excel template for bulk account upload"""
    template_bytes = ExcelTemplateGenerator.generate_template(
        ACCOUNT_SCHEMA, 
        "Accounts Template"
    )
    
    return StreamingResponse(
        io.BytesIO(template_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=accounts_template.xlsx"
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
async def bulk_upload_accounts(
    file: UploadFile = File(...),
    async_mode: bool = Query(False, description="Process upload in background (recommended for >5000 rows)"),
    db: Session = Depends(get_db)
):
    """
    Bulk upload accounts from Excel file
    
    For large files (>5000 rows), use async_mode=true to process in background.
    Returns task_id for progress tracking.
    
    Returns:
        Dictionary with success count, failed count, and error details (sync mode)
        OR task_id for progress tracking (async mode)
    """
    validator = ExcelValidator(ACCOUNT_SCHEMA)
    
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
                _process_accounts_bulk_upload,
                data_list,
                db.get_bind()  # Pass connection string instead of session
            )
        )
        
        return {
            "success": True,
            "async": True,
            "task_id": task_id,
            "message": f"Processing {len(data_list)} records in background. Use /api/v1/accounts/upload-progress/{task_id} to check status."
        }
    
    # For small uploads, process synchronously
    return _process_accounts_sync(data_list, db)


@router.get("/", response_model=PaginatedResponse[AccountResponse])
def get_accounts(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str = Query(None, description="Search query"),
    status: str = Query(None, description="Comma-separated status values"),
    industry: str = Query(None, description="Comma-separated industry values"),
    location: str = Query(None, description="Comma-separated location values"),
    account_owner: str = Query(None, description="Comma-separated account_owner values"),
    employees_min: int = Query(None, description="Minimum employees"),
    employees_max: int = Query(None, description="Maximum employees"),
    db: Session = Depends(get_db)
):
    """Get all accounts with pagination, optional search, and filters"""
    skip = (page - 1) * page_size
    
    # Parse comma-separated filter values
    status_list = status.split(',') if status else None
    industry_list = industry.split(',') if industry else None
    location_list = location.split(',') if location else None
    account_owner_list = account_owner.split(',') if account_owner else None
    
    # Use filter function with all parameters
    items = accounts.filter_accounts(
        db,
        skip=skip,
        limit=page_size,
        search=search,
        status=status_list,
        industry=industry_list,
        location=location_list,
        account_owner=account_owner_list,
        employees_min=employees_min,
        employees_max=employees_max
    )
    
    total = accounts.filter_accounts_count(
        db,
        search=search,
        status=status_list,
        industry=industry_list,
        location=location_list,
        account_owner=account_owner_list,
        employees_min=employees_min,
        employees_max=employees_max
    )
    
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/filters/options", response_model=dict)
def get_filter_options(db: Session = Depends(get_db)):
    """Get unique values for each filterable field"""
    return accounts.get_filter_options(db)


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(account_id: int, db: Session = Depends(get_db)):
    """Get an account by ID"""
    db_account = accounts.get_account(db, account_id)
    if db_account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return db_account


@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(account: AccountCreate, db: Session = Depends(get_db)):
    """Create a new account"""
    return accounts.create_account(db, account)


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(account_id: int, account: AccountUpdate, db: Session = Depends(get_db)):
    """Update an account"""
    db_account = accounts.update_account(db, account_id, account)
    if db_account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return db_account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    """Delete an account"""
    if not accounts.delete_account(db, account_id):
        raise HTTPException(status_code=404, detail="Account not found")
    return None


@router.delete("/", response_model=dict)
def delete_all_accounts(db: Session = Depends(get_db)):
    """
    Delete all accounts from the database
    
    ⚠️ WARNING: This will permanently delete ALL accounts!
    Use with caution, primarily for testing and development.
    
    This endpoint is thread-safe and handles concurrent requests.
    
    Returns:
        Dictionary with the count of deleted accounts
    """
    try:
        count = accounts.delete_all_accounts(db)
        return {
            "success": True,
            "message": "Deleted all accounts",
            "deleted_count": count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete accounts: {str(e)}"
        )
