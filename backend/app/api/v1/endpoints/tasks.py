"""
Tasks API Routes
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
from app.models.models import Task
from app.schemas.schemas import TaskCreate, TaskUpdate, TaskResponse, PaginatedResponse
from app.crud import tasks
from app.utils.excel_utils import (
    ExcelValidator, 
    ExcelTemplateGenerator, 
    TASK_SCHEMA
)
from app.core.background_tasks import task_manager

router = APIRouter()

logger = logging.getLogger(__name__)


def _process_tasks_bulk_upload(task_id: str, data_list: list, db_engine):
    """Process bulk task upload in background thread"""
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.exc import OperationalError
    import time
    
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
            
            # Process each chunk in smaller batches
            for i in range(0, len(chunk_data), BATCH_SIZE):
                batch = chunk_data[i:i + BATCH_SIZE]
                actual_idx = chunk_start + i  # Absolute index in original data_list
                batch_tasks = []
                
                # Validate and prepare batch
                for idx, task_data in enumerate(batch, start=actual_idx+2):
                    try:
                        task_create = TaskCreate(**task_data)
                        batch_tasks.append(task_create)
                    except Exception as e:
                        failed_count += 1
                        failed_records.append({
                            'row': idx,
                            'title': task_data.get('title', 'N/A'),
                            'error': str(e)
                        })
                
                # Bulk insert valid tasks
            # Bulk insert valid tasks with retry logic
            if batch_tasks:
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        count = tasks.bulk_create_tasks(db, batch_tasks)
                        success_count += count
                        break  # Success, exit retry loop
                        
                    except OperationalError as e:
                        error_msg = str(e).lower()
                        is_connection_error = any(keyword in error_msg for keyword in 
                                                 ['ssl', 'tls', 'connection', 'rolled back'])
                        
                        if is_connection_error and attempt < max_retries - 1:
                            logger.warning(
                                "Batch insert failed (attempt %s/%s), retrying",
                                attempt + 1,
                                max_retries,
                            )
                            time.sleep(2 ** attempt)  # Exponential backoff
                            
                            # Recreate session
                            try:
                                db.close()
                                db = SessionLocal()
                            except Exception as session_error:
                                logger.warning("Session recreate error: %s", session_error)
                            
                            continue
                        else:
                            # Max retries reached or non-retryable error
                            # Fall back to individual inserts
                            logger.warning("Batch insert failed after retries, using individual inserts")
                            for idx_in_batch, task_create in enumerate(batch_tasks, start=actual_idx+2):
                                try:
                                    tasks.create_task(db, task_create)
                                    success_count += 1
                                except Exception as individual_error:
                                    failed_count += 1
                                    failed_records.append({
                                        'row': idx_in_batch,
                                        'title': task_create.title,
                                        'error': str(individual_error)
                                    })
                            break
                            
                    except Exception as e:
                        # Non-connection error, fall back to individual inserts
                        logger.warning("Batch error (%s), using individual inserts", str(e))
                        for idx_in_batch, task_create in enumerate(batch_tasks, start=actual_idx+2):
                            try:
                                tasks.create_task(db, task_create)
                                success_count += 1
                            except Exception as individual_error:
                                failed_count += 1
                                failed_records.append({
                                    'row': idx_in_batch,
                                    'title': task_create.title,
                                    'error': str(individual_error)
                                })
                        break
                
                # Update progress
                task_manager.update_task(
                    task_id,
                    processed=min(actual_idx + len(batch), len(data_list)),
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
    
    except Exception as e:
        logger.exception("Critical error in bulk upload")
        raise
    
    finally:
        try:
            db.close()
        except Exception as close_error:
            logger.warning("Error closing session: %s", close_error)


def _process_tasks_sync(data_list: list, db: Session) -> dict:
    """Process tasks synchronously (for small uploads)"""
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
            batch_tasks = []
            
            # Validate and prepare batch
            for idx, task_data in enumerate(batch, start=actual_idx+2):
                try:
                    task_create = TaskCreate(**task_data)
                    batch_tasks.append(task_create)
                except Exception as e:
                    failed_count += 1
                    failed_records.append({
                        'row': idx,
                        'title': task_data.get('title', 'N/A'),
                        'error': str(e)
                    })
        
        # Bulk insert valid tasks
        # Bulk insert valid tasks
        if batch_tasks:
            try:
                count = tasks.bulk_create_tasks(db, batch_tasks)
                success_count += count
            except Exception as e:
                # If batch fails, fall back to individual inserts
                for idx_in_batch, task_create in enumerate(batch_tasks, start=actual_idx+2):
                    try:
                        tasks.create_task(db, task_create)
                        success_count += 1
                    except Exception as individual_error:
                        failed_count += 1
                        failed_records.append({
                            'row': idx_in_batch,
                            'title': task_create.title,
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
async def download_task_template():
    """Download Excel template for bulk task upload"""
    template_bytes = ExcelTemplateGenerator.generate_template(
        TASK_SCHEMA, 
        "Tasks Template"
    )
    
    return StreamingResponse(
        io.BytesIO(template_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=tasks_template.xlsx"
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
async def bulk_upload_tasks(
    file: UploadFile = File(...),
    async_mode: bool = Query(False, description="Process upload in background (recommended for >5000 rows)"),
    db: Session = Depends(get_db)
):
    """
    Bulk upload tasks from Excel file
    
    For large files (>5000 rows), use async_mode=true to process in background.
    Returns task_id for progress tracking.
    
    Returns:
        Dictionary with success count, failed count, and error details (sync mode)
        OR task_id for progress tracking (async mode)
    """
    validator = ExcelValidator(TASK_SCHEMA)
    
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
                _process_tasks_bulk_upload,
                data_list,
                db.get_bind()  # Pass connection string instead of session
            )
        )
        
        return {
            "success": True,
            "async": True,
            "task_id": task_id,
            "message": f"Processing {len(data_list)} records in background. Use /api/v1/tasks/upload-progress/{task_id} to check status."
        }
    
    # For small uploads, process synchronously
    return _process_tasks_sync(data_list, db)


@router.get("/", response_model=PaginatedResponse[TaskResponse])
def get_tasks(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str = Query(None, description="Search query"),
    status: str = Query(None, description="Filter by status (comma-separated)"),
    priority: str = Query(None, description="Filter by priority (comma-separated)"),
    assigned_to: str = Query(None, description="Filter by assignee (comma-separated)"),
    related_to: str = Query(None, description="Filter by related entity (comma-separated)"),
    due_date_start: str = Query(None, description="Filter by due date start (YYYY-MM-DD)"),
    due_date_end: str = Query(None, description="Filter by due date end (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """Get all tasks with pagination, search, and filters"""
    skip = (page - 1) * page_size
    
    # Build filter dictionary
    filters = {}
    if status:
        filters['status'] = [s.strip() for s in status.split(',')]
    if priority:
        filters['priority'] = [p.strip() for p in priority.split(',')]
    if assigned_to:
        filters['assigned_to'] = [a.strip() for a in assigned_to.split(',')]
    if related_to:
        filters['related_to'] = [r.strip() for r in related_to.split(',')]
    if due_date_start:
        filters['due_date_start'] = due_date_start
    if due_date_end:
        filters['due_date_end'] = due_date_end
    
    if search or filters:
        # Use filtered/search functionality
        total = tasks.get_filtered_tasks_count(db, search=search, filters=filters)
        items = tasks.get_filtered_tasks(db, search=search, filters=filters, skip=skip, limit=page_size)
    else:
        # Get all tasks
        total = tasks.get_tasks_count(db)
        items = tasks.get_tasks(db, skip=skip, limit=page_size)
    
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/status/{status}", response_model=List[TaskResponse])
def get_tasks_by_status(
    status: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get tasks by status"""
    return tasks.get_tasks_by_status(db, status=status, skip=skip, limit=limit)


@router.get("/filters/options", response_model=dict)
def get_filter_options(db: Session = Depends(get_db)):
    """
    Get available filter options for tasks
    
    Returns distinct values for filterable fields
    """
    try:
        options = tasks.get_filter_options(db)
        return options
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get filter options: {str(e)}"
        )


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get a task by ID"""
    db_task = tasks.get_task(db, task_id)
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    """Create a new task"""
    return tasks.create_task(db, task)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task: TaskUpdate, db: Session = Depends(get_db)):
    """Update a task"""
    db_task = tasks.update_task(db, task_id, task)
    if db_task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return db_task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a task"""
    if not tasks.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    return None


@router.delete("/", response_model=dict)
def delete_all_tasks(db: Session = Depends(get_db)):
    """
    Delete all tasks from the database
    
    ⚠️ WARNING: This will permanently delete ALL tasks!
    Use with caution, primarily for testing and development.
    
    This endpoint is thread-safe and handles concurrent requests.
    
    Returns:
        Dictionary with the count of deleted tasks
    """
    try:
        count = tasks.delete_all_tasks(db)
        return {
            "success": True,
            "message": "Deleted all tasks",
            "deleted_count": count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete tasks: {str(e)}"
        )
