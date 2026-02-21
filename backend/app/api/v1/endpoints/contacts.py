"""
Contacts API Routes
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
from app.models.models import Contact
from app.schemas.schemas import ContactCreate, ContactUpdate, ContactResponse, PaginatedResponse
from app.crud import contacts
from app.utils.excel_utils import (
    ExcelValidator, 
    ExcelTemplateGenerator, 
    CONTACT_SCHEMA
)
from app.core.background_tasks import task_manager

router = APIRouter()

logger = logging.getLogger(__name__)


def _process_contacts_bulk_upload(task_id: str, data_list: list, db_engine):
    """Process bulk contact upload in background thread - Optimized for performance"""
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
        CHUNK_SIZE = 50000  # Process upload in 50K record chunks
        BATCH_SIZE = 5000  # Process each chunk in 5K batches for better progress tracking
        success_count = 0
        failed_count = 0
        failed_records = []
        
        # Query all existing emails ONCE for better performance
        logger.debug("[CONTACTS] Querying existing emails")
        try:
            existing_emails_query = db.query(Contact.email).all()
            existing_emails = {email[0] for email in existing_emails_query}
            logger.debug("[CONTACTS] Found %s existing emails in database", len(existing_emails))
        except Exception as e:
            logger.warning("[CONTACTS] Could not query existing emails: %s", str(e))
            existing_emails = set()
        
        # Process upload in chunks of 10,000 records
        for chunk_start in range(0, len(data_list), CHUNK_SIZE):
            chunk_end = min(chunk_start + CHUNK_SIZE, len(data_list))
            chunk_data = data_list[chunk_start:chunk_end]
            logger.debug(
                "[CONTACTS] Processing chunk %s: records %s to %s",
                chunk_start // CHUNK_SIZE + 1,
                chunk_start,
                chunk_end,
            )
            
            # Refresh OAuth token periodically for long uploads
            if settings.USE_OAUTH and chunk_start > 0:
                try:
                    refresh_oauth_token()
                    logger.debug("[CONTACTS] Token refreshed at record %s", chunk_start)
                except Exception as token_err:
                    logger.warning("Token refresh failed (continuing): %s", str(token_err))
            
            # Process each chunk in smaller batches
            for i in range(0, len(chunk_data), BATCH_SIZE):
                batch = chunk_data[i:i + BATCH_SIZE]
                actual_idx = chunk_start + i  # Absolute index in original data_list
                batch_contacts = []
                
                # Validate and prepare batch
                for idx, contact_data in enumerate(batch, start=actual_idx+2):
                    try:
                        contact_create = ContactCreate(**contact_data)
                        batch_contacts.append(contact_create)
                    except Exception as e:
                        failed_count += 1
                        failed_records.append({
                            'row': idx,
                            'error': str(e),
                            'data': contact_data  # Include the actual data that failed
                        })
                
                # Bulk insert valid contacts (pass existing_emails to avoid repeated queries)
                if batch_contacts:
                    try:
                        count, bulk_failed = contacts.bulk_create_contacts(db, batch_contacts, existing_emails)
                        success_count += count
                        
                        # Track failed records from bulk operation (duplicates, etc.)
                        for bulk_fail in bulk_failed:
                            # Find the original row number
                            for idx, contact_create in enumerate(batch_contacts, start=actual_idx+2):
                                if contact_create.email == bulk_fail['email']:
                                    failed_count += 1
                                    failed_records.append({
                                        'row': idx,
                                        'error': bulk_fail['error'],
                                        'data': bulk_fail['data']
                                    })
                                    break
                        
                        # Note: We don't query DB here for performance - duplicates are handled in CRUD
                        
                    except OperationalError as e:
                        # Connection error during bulk insert
                        db.rollback()
                        task = task_manager.get_task(task_id)
                        if task:
                            task.fail(f"Connection error: {str(e)}")
                        return {
                            "success": False,
                            "message": f"Connection error at row {actual_idx}. Please refresh your token and try again.",
                            "error": str(e),
                            "success_count": success_count,
                            "failed_count": failed_count
                        }
                    except Exception as e:
                        # Ensure session is rolled back
                        db.rollback()
                        # If batch fails, fall back to individual inserts
                        for idx_in_batch, contact_create in enumerate(batch_contacts, start=actual_idx+2):
                            try:
                                contacts.create_contact(db, contact_create)
                                success_count += 1
                            except OperationalError as conn_error:
                                # Connection error during individual insert
                                db.rollback()
                                task = task_manager.get_task(task_id)
                                if task:
                                    task.fail(f"Connection error: {str(conn_error)}")
                                return {
                                    "success": False,
                                    "message": f"Connection error at row {idx_in_batch}. Token may be expired.",
                                    "error": str(conn_error),
                                    "success_count": success_count,
                                    "failed_count": failed_count
                                }
                            except Exception as individual_error:
                                db.rollback()
                                failed_count += 1
                                failed_records.append({
                                    'row': idx_in_batch,
                                    'error': str(individual_error),
                                    'data': contact_create.dict()  # Include the actual data that failed
                                })
                
                # Update progress more frequently
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
            "failed_records": failed_records  # Return all failed records (removed limit)
        }
    
    finally:
        db.close()


def _process_contacts_sync(data_list: list, db: Session) -> dict:
    """Process contacts synchronously (for small uploads) - Optimized for performance"""
    from sqlalchemy.exc import OperationalError

    CHUNK_SIZE = 50000  # Process upload in 50K record chunks
    BATCH_SIZE = 5000   # Process each chunk in 5K batches
    success_count = 0
    failed_count = 0
    failed_records = []
    
    # Query all existing emails ONCE for better performance
    logger.debug("[CONTACTS] Querying existing emails")
    try:
        existing_emails_query = db.query(Contact.email).all()
        existing_emails = {email[0] for email in existing_emails_query}
        logger.debug("[CONTACTS] Found %s existing emails in database", len(existing_emails))
    except Exception as e:
        logger.warning("[CONTACTS] Could not query existing emails: %s", str(e))
        existing_emails = set()
    
    # Process upload in chunks of 10,000 records
    for chunk_start in range(0, len(data_list), CHUNK_SIZE):
        chunk_end = min(chunk_start + CHUNK_SIZE, len(data_list))
        chunk_data = data_list[chunk_start:chunk_end]
        
        # Process each chunk in smaller batches
        for i in range(0, len(chunk_data), BATCH_SIZE):
            batch = chunk_data[i:i + BATCH_SIZE]
            actual_idx = chunk_start + i  # Absolute index in original data_list
            batch_contacts = []
            
            # Validate and prepare batch
            for idx, contact_data in enumerate(batch, start=actual_idx+2):
                try:
                    contact_create = ContactCreate(**contact_data)
                    batch_contacts.append(contact_create)
                except Exception as e:
                    failed_count += 1
                    failed_records.append({
                        'row': idx,
                        'error': str(e),
                        'data': contact_data  # Include the actual data that failed
                    })
            
            # Bulk insert valid contacts (pass existing_emails to avoid repeated queries)
            if batch_contacts:
                try:
                    count, bulk_failed = contacts.bulk_create_contacts(db, batch_contacts, existing_emails)
                    success_count += count
                    
                    # Track failed records from bulk operation (duplicates, etc.)
                    for bulk_fail in bulk_failed:
                        # Find the original row number
                        for idx, contact_create in enumerate(batch_contacts, start=actual_idx+2):
                            if contact_create.email == bulk_fail['email']:
                                failed_count += 1
                                failed_records.append({
                                    'row': idx,
                                    'error': bulk_fail['error'],
                                    'data': bulk_fail['data']
                                })
                                break
                    
                    # Note: We don't query DB here for performance - duplicates are handled in CRUD
                    
                except OperationalError as e:
                    # Connection error during bulk insert
                    db.rollback()
                    return {
                        "success": False,
                        "message": "Connection error. Token may be expired. Please refresh and try again.",
                        "error": str(e),
                        "success_count": success_count,
                        "failed_count": failed_count + len(batch_contacts),
                        "failed_records": failed_records
                    }
                except Exception as e:
                    # Ensure session is rolled back
                    db.rollback()
                    # If batch fails, fall back to individual inserts
                    for idx_in_batch, contact_create in enumerate(batch_contacts, start=actual_idx+2):
                        try:
                            contacts.create_contact(db, contact_create)
                            success_count += 1
                        except OperationalError as conn_error:
                            # Connection error during individual insert
                            db.rollback()
                            return {
                                "success": False,
                                "message": f"Connection error at row {idx_in_batch}. Token may be expired.",
                                "error": str(conn_error),
                                "success_count": success_count,
                                "failed_count": failed_count + len(batch_contacts) - (idx_in_batch - actual_idx),
                                "failed_records": failed_records
                            }
                        except Exception as individual_error:
                            db.rollback()
                            failed_count += 1
                            failed_records.append({
                                'row': idx_in_batch,
                                'error': str(individual_error),
                                'data': contact_create.dict()  # Include the actual data that failed
                            })
    
    return {
        "success": True,
        "message": f"Processed {len(data_list)} records",
        "success_count": success_count,
        "failed_count": failed_count,
        "failed_records": failed_records
    }


@router.get("/template", 
    summary="Download Contacts Excel Template",
    description="""
    Download a pre-formatted Excel template for bulk contact upload.
    
    The template includes:
    - All required and optional fields
    - Field validation rules
    - Example data for reference
    - Column headers matching the API schema
    
    Use this template to ensure your data is formatted correctly before upload.
    """,
    responses={
        200: {
            "description": "Excel template file",
            "content": {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}
            }
        }
    }
)
async def download_contact_template():
    """Download Excel template for bulk contact upload"""
    template_bytes = ExcelTemplateGenerator.generate_template(
        CONTACT_SCHEMA, 
        "Contacts Template"
    )
    
    return StreamingResponse(
        io.BytesIO(template_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=contacts_template.xlsx"
        }
    )


@router.get("/upload-progress/{task_id}", 
    response_model=dict,
    summary="Check Bulk Upload Progress",
    description="""
    Monitor the progress of an asynchronous bulk upload operation.
    
    Returns:
    - **status**: 'pending', 'processing', 'completed', or 'failed'
    - **total**: Total number of records to process
    - **processed**: Number of records processed so far
    - **success**: Number of successfully imported records
    - **failed**: Number of failed records
    - **errors**: List of recent errors (last 10)
    - **progress**: Percentage complete (0-100)
    
    **Note**: Tasks expire 1 hour after completion.
    """,
    responses={
        200: {"description": "Task progress information"},
        404: {"description": "Task not found or expired"}
    }
)
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
    summary="Bulk Upload Contacts from Excel",
    description="""
    Import multiple contacts from an Excel file.
    
    ### Features:
    - ✅ **High Performance**: Handles 50,000+ records efficiently
    - ✅ **Async Processing**: Background processing for large files (>5000 rows)
    - ✅ **Progress Tracking**: Real-time progress monitoring
    - ✅ **Error Reporting**: Detailed error messages for failed records
    - ✅ **Chunked Processing**: Memory-efficient batch processing
    
    ### Parameters:
    - **file**: Excel file (.xlsx) with contact data
    - **async_mode**: Set to `true` for background processing (recommended for >5000 rows)
    
    ### Upload Process:
    1. Download template from `/template` endpoint
    2. Fill in contact data
    3. Upload file with optional `async_mode=true`
    4. If async, use returned `task_id` to monitor progress
    
    ### Response:
    **Sync Mode** (small files):
    ```json
    {
        "success": true,
        "message": "Processed N records",
        "success_count": 950,
        "failed_count": 50,
        "failed_records": [...]
    }
    ```
    
    **Async Mode** (large files):
    ```json
    {
        "success": true,
        "async": true,
        "task_id": "abc-123",
        "message": "Processing N records in background..."
    }
    ```
    """,
    responses={
        200: {"description": "Upload initiated or completed successfully"},
        400: {"description": "Invalid file format or validation errors"}
    }
)
async def bulk_upload_contacts(
    file: UploadFile = File(...),
    async_mode: bool = Query(False, description="Process upload in background (recommended for >5000 rows)"),
    db: Session = Depends(get_db)
):
    """
    Bulk upload contacts from Excel file
    
    For large files (>5000 rows), use async_mode=true to process in background.
    Returns task_id for progress tracking.
    
    Returns:
        Dictionary with success count, failed count, and error details (sync mode)
        OR task_id for progress tracking (async mode)
    """
    validator = ExcelValidator(CONTACT_SCHEMA)
    
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
                _process_contacts_bulk_upload,
                data_list,
                db.get_bind()  # Pass connection string instead of session
            )
        )
        
        return {
            "success": True,
            "async": True,
            "task_id": task_id,
            "message": f"Processing {len(data_list)} records in background. Use /api/v1/contacts/upload-progress/{task_id} to check status."
        }
    
    # For small uploads, process synchronously
    return _process_contacts_sync(data_list, db)


@router.get("/", 
    response_model=PaginatedResponse[ContactResponse],
    summary="List All Contacts",
    description="""
    Retrieve paginated list of contacts with advanced filtering.
    
    ### Features:
    - ✅ **Pagination**: Efficient data loading with customizable page sizes (1-100)
    - ✅ **Search**: Full-text search across name, email, phone, and company
    - ✅ **Multi-Filter**: Filter by status, company, position, and location
    - ✅ **Sorting**: Results are sorted by creation date (newest first)
    
    ### Filters:
    All filters support comma-separated values for multiple selections:
    - **status**: e.g., `?status=Active,Inactive`
    - **company**: e.g., `?company=Acme Inc,Tech Corp`
    - **position**: e.g., `?position=Manager,Director`
    - **location**: e.g., `?location=New York,London`
    
    ### Examples:
    - Get page 1: `/api/v1/contacts/?page=1&page_size=20`
    - Search: `/api/v1/contacts/?search=john`
    - Filter: `/api/v1/contacts/?status=Active&company=Acme`
    - Combined: `/api/v1/contacts/?page=2&search=manager&status=Active`
    """,
    responses={
        200: {"description": "Paginated list of contacts with total count and page info"}
    }
)
def get_contacts(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str = Query(None, description="Search query"),
    status: str = Query(None, description="Comma-separated status values"),
    company: str = Query(None, description="Comma-separated company values"),
    position: str = Query(None, description="Comma-separated position values"),
    location: str = Query(None, description="Comma-separated location values"),
    db: Session = Depends(get_db)
):
    """Get all contacts with pagination, optional search, and filters"""
    skip = (page - 1) * page_size
    
    # Parse comma-separated filter values
    status_list = status.split(',') if status else None
    company_list = company.split(',') if company else None
    position_list = position.split(',') if position else None
    location_list = location.split(',') if location else None
    
    # Use filter function with all parameters
    items = contacts.filter_contacts(
        db,
        skip=skip,
        limit=page_size,
        search=search,
        status=status_list,
        company=company_list,
        position=position_list,
        location=location_list
    )
    
    total = contacts.filter_contacts_count(
        db,
        search=search,
        status=status_list,
        company=company_list,
        position=position_list,
        location=location_list
    )
    
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/search", response_model=List[ContactResponse])
def search_contacts(
    query: str = Query(..., min_length=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Search contacts by name, email, or company"""
    return contacts.search_contacts(db, query=query, skip=skip, limit=limit)


@router.get("/filters/options", response_model=dict)
def get_filter_options(db: Session = Depends(get_db)):
    """Get unique values for each filterable field"""
    return contacts.get_filter_options(db)


@router.get("/{contact_id}", response_model=ContactResponse)
def get_contact(contact_id: int, db: Session = Depends(get_db)):
    """Get a contact by ID"""
    db_contact = contacts.get_contact(db, contact_id)
    if db_contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return db_contact


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def create_contact(contact: ContactCreate, db: Session = Depends(get_db)):
    """Create a new contact"""
    db_contact = contacts.get_contact_by_email(db, contact.email)
    if db_contact:
        raise HTTPException(status_code=400, detail="Email already registered")
    return contacts.create_contact(db, contact)


@router.put("/{contact_id}", response_model=ContactResponse)
def update_contact(contact_id: int, contact: ContactUpdate, db: Session = Depends(get_db)):
    """Update a contact"""
    db_contact = contacts.update_contact(db, contact_id, contact)
    if db_contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return db_contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    """Delete a contact"""
    if not contacts.delete_contact(db, contact_id):
        raise HTTPException(status_code=404, detail="Contact not found")
    return None


@router.delete("/", response_model=dict)
def delete_all_contacts(db: Session = Depends(get_db)):
    """
    Delete all contacts from the database
    
    ⚠️ WARNING: This will permanently delete ALL contacts!
    Use with caution, primarily for testing and development.
    
    This endpoint uses DELETE operation which works with standard database user permissions.
    The operation is thread-safe and handles concurrent requests.
    Note: Auto-increment IDs will not be reset after deletion.
    
    Returns:
        Dictionary with the count of deleted contacts
        
    Raises:
        500: If database error occurs during deletion
    """
    try:
        count = contacts.delete_all_contacts(db)
        return {
            "success": True,
            "message": "Deleted all contacts",
            "deleted_count": count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete contacts: {str(e)}"
        )
