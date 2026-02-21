"""
Calendar Events API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import io
import asyncio
import math

from app.core.database import get_db
from app.models.models import CalendarEvent
from app.schemas.schemas import CalendarEventCreate, CalendarEventUpdate, CalendarEventResponse, PaginatedResponse
from app.crud import calendar_events
from app.utils.excel_utils import (
    ExcelValidator, 
    ExcelTemplateGenerator, 
    CALENDAR_EVENT_SCHEMA
)
from app.core.background_tasks import task_manager

router = APIRouter()


def _process_calendar_events_bulk_upload(task_id: str, data_list: list, db_engine):
    """Process bulk calendar event upload in background thread"""
    from sqlalchemy.orm import sessionmaker
    
    # Create a new database session for this thread
    SessionLocal = sessionmaker(bind=db_engine)
    db = SessionLocal()
    
    try:
        CHUNK_SIZE = 50000  # Process upload in 10K record chunks
        BATCH_SIZE = 10000   # Process each chunk in 1K batches for better progress tracking
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
                batch_events = []
                
                # Validate and prepare batch
                for idx, event_data in enumerate(batch, start=actual_idx+2):
                    try:
                        event_create = CalendarEventCreate(**event_data)
                        batch_events.append(event_create)
                    except Exception as e:
                        failed_count += 1
                        failed_records.append({
                            'row': idx,
                            'title': event_data.get('title', 'N/A'),
                            'error': str(e)
                        })
                
                # Bulk insert valid events
                if batch_events:
                    try:
                        count = calendar_events.bulk_create_events(db, batch_events)
                        success_count += count
                    except Exception as e:
                        # If batch fails, fall back to individual inserts
                        for idx_in_batch, event_create in enumerate(batch_events, start=actual_idx+2):
                            try:
                                calendar_events.create_event(db, event_create)
                                success_count += 1
                            except Exception as individual_error:
                                failed_count += 1
                                failed_records.append({
                                    'row': idx_in_batch,
                                    'title': event_create.title,
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


def _process_calendar_events_sync(data_list: list, db: Session) -> dict:
    """Process calendar events synchronously (for small uploads)"""
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
            batch_events = []
            
            # Validate and prepare batch
            for idx, event_data in enumerate(batch, start=actual_idx+2):
                try:
                    event_create = CalendarEventCreate(**event_data)
                    batch_events.append(event_create)
                except Exception as e:
                    failed_count += 1
                    failed_records.append({
                        'row': idx,
                        'title': event_data.get('title', 'N/A'),
                        'error': str(e)
                    })
        
        # Bulk insert valid events
        if batch_events:
            try:
                count = calendar_events.bulk_create_events(db, batch_events)
                success_count += count
            except Exception as e:
                # If batch fails, fall back to individual inserts
                for idx_in_batch, event_create in enumerate(batch_events, start=actual_idx+2):
                    try:
                        calendar_events.create_event(db, event_create)
                        success_count += 1
                    except Exception as individual_error:
                        failed_count += 1
                        failed_records.append({
                            'row': idx_in_batch,
                            'title': event_create.title,
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
async def download_event_template():
    """Download Excel template for bulk calendar event upload"""
    template_bytes = ExcelTemplateGenerator.generate_template(
        CALENDAR_EVENT_SCHEMA, 
        "Calendar Events Template"
    )
    
    return StreamingResponse(
        io.BytesIO(template_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=calendar_events_template.xlsx"
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
async def bulk_upload_events(
    file: UploadFile = File(...),
    async_mode: bool = Query(False, description="Process upload in background (recommended for >5000 rows)"),
    db: Session = Depends(get_db)
):
    """
    Bulk upload calendar events from Excel file
    
    For large files (>5000 rows), use async_mode=true to process in background.
    Returns task_id for progress tracking.
    
    Returns:
        Dictionary with success count, failed count, and error details (sync mode)
        OR task_id for progress tracking (async mode)
    """
    validator = ExcelValidator(CALENDAR_EVENT_SCHEMA)
    
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
                _process_calendar_events_bulk_upload,
                data_list,
                db.get_bind()  # Pass connection string instead of session
            )
        )
        
        return {
            "success": True,
            "async": True,
            "task_id": task_id,
            "message": f"Processing {len(data_list)} records in background. Use /api/v1/calendar/upload-progress/{task_id} to check status."
        }
    
    # For small uploads, process synchronously
    return _process_calendar_events_sync(data_list, db)


@router.get("/", response_model=PaginatedResponse[CalendarEventResponse])
def get_events(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str = Query(None, description="Search query"),
    start_date: str = Query(None, description="Filter by start date (YYYY-MM-DD)"),
    end_date: str = Query(None, description="Filter by end date (YYYY-MM-DD)"),
    event_type: str = Query(None, description="Filter by event type"),
    status: str = Query(None, description="Filter by status"),
    db: Session = Depends(get_db)
):
    """Get all calendar events with pagination and optional filters"""
    from datetime import datetime
    
    skip = (page - 1) * page_size
    
    # Build query with all filters
    query = db.query(CalendarEvent)
    
    # Apply event_type filter
    if event_type:
        query = query.filter(CalendarEvent.event_type == event_type)
    
    # Apply status filter
    if status:
        query = query.filter(CalendarEvent.status == status)
    
    # Apply date filtering if provided
    if start_date:
        query = query.filter(CalendarEvent.start_time >= start_date)
    if end_date:
        # Add one day to end_date to include events on that day
        from datetime import datetime, timedelta
        end_datetime = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        query = query.filter(CalendarEvent.start_time < end_datetime.strftime("%Y-%m-%d"))
    
    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (CalendarEvent.title.ilike(search_filter)) |
            (CalendarEvent.description.ilike(search_filter)) |
            (CalendarEvent.location.ilike(search_filter))
        )
    
    # If no date filter is provided, show only upcoming events (today onwards)
    if not start_date and not end_date:
        today = datetime.now().strftime("%Y-%m-%d")
        query = query.filter(CalendarEvent.start_time >= today)
    
    # Order by start_time
    query = query.order_by(CalendarEvent.start_time)
    
    # Get total count
    total = query.count()
    
    # Get paginated items
    items = query.offset(skip).limit(page_size).all()
    
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{event_id}", response_model=CalendarEventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    """Get a calendar event by ID"""
    db_event = calendar_events.get_event(db, event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return db_event


@router.post("/", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_event(event: CalendarEventCreate, db: Session = Depends(get_db)):
    """Create a new calendar event"""
    return calendar_events.create_event(db, event)


@router.put("/{event_id}", response_model=CalendarEventResponse)
def update_event(event_id: int, event: CalendarEventUpdate, db: Session = Depends(get_db)):
    """Update a calendar event"""
    db_event = calendar_events.update_event(db, event_id, event)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return db_event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """Delete a calendar event"""
    if not calendar_events.delete_event(db, event_id):
        raise HTTPException(status_code=404, detail="Event not found")
    return None


@router.delete("/", response_model=dict)
def delete_all_events(db: Session = Depends(get_db)):
    """
    Delete all calendar events from the database
    
    ⚠️ WARNING: This will permanently delete ALL calendar events!
    Use with caution, primarily for testing and development.
    
    This endpoint is thread-safe and handles concurrent requests.
    
    Returns:
        Dictionary with the count of deleted events
    """
    try:
        count = calendar_events.delete_all_events(db)
        return {
            "success": True,
            "message": "Deleted all calendar events",
            "deleted_count": count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete calendar events: {str(e)}"
        )
