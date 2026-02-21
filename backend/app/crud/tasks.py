"""
CRUD Operations for Tasks
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict
import logging

from app.models.models import Task
from app.schemas.schemas import TaskCreate, TaskUpdate

logger = logging.getLogger(__name__)


def get_task(db: Session, task_id: int) -> Optional[Task]:
    """Get a single task by ID"""
    return db.query(Task).filter(Task.id == task_id).first()


def get_tasks(db: Session, skip: int = 0, limit: int = 100) -> List[Task]:
    """Get all tasks with pagination"""
    return db.query(Task).offset(skip).limit(limit).all()


def get_tasks_count(db: Session) -> int:
    """Get total count of tasks"""
    return db.query(Task).count()


def create_task(db: Session, task: TaskCreate) -> Task:
    """Create a new task"""
    db_task = Task(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_task(db: Session, task_id: int, task: TaskUpdate) -> Optional[Task]:
    """Update a task"""
    db_task = get_task(db, task_id)
    if db_task:
        update_data = task.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_task, key, value)
        db.commit()
        db.refresh(db_task)
    return db_task


def delete_task(db: Session, task_id: int) -> bool:
    """Delete a task"""
    db_task = get_task(db, task_id)
    if db_task:
        db.delete(db_task)
        db.commit()
        return True
    return False


def get_tasks_by_status(db: Session, status: str, skip: int = 0, limit: int = 100) -> List[Task]:
    """Get tasks by status"""
    return db.query(Task).filter(Task.status == status).offset(skip).limit(limit).all()


def bulk_create_tasks(db: Session, tasks_data: List[TaskCreate]) -> int:
    """
    Bulk create tasks in a single transaction with retry logic

    Args:
        db: Database session
        tasks_data: List of TaskCreate objects

    Returns:
        Number of tasks created
    """
    import time
    from sqlalchemy.exc import OperationalError
    
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            # Insert all rows in a single batch for maximum throughput
            db_tasks = [Task(**task.model_dump()) for task in tasks_data]
            db.bulk_save_objects(db_tasks)
            db.commit()
            return len(db_tasks)
            
        except OperationalError as e:
            db.rollback()  # Critical: rollback the failed transaction
            
            if _is_connection_error(e) and attempt < max_retries - 1:
                logger.warning(
                    "Connection error on attempt %s/%s (%s). Retrying in %s seconds",
                    attempt + 1,
                    max_retries,
                    str(e)[:100],
                    retry_delay,
                )
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
                continue
            else:
                logger.error("Database error after %s attempts: %s", attempt + 1, str(e))
                raise
        except Exception as e:
            db.rollback()
            logger.exception("Unexpected error in bulk_create_tasks")
            raise
    
    return 0


def _is_connection_error(error: Exception) -> bool:
    """Check if the error is a connection-related error that can be retried"""
    error_msg = str(error).lower()
    connection_keywords = ['ssl', 'tls', 'connection', 'timeout', 'broken pipe', 'bad record mac']
    return any(keyword in error_msg for keyword in connection_keywords)


def delete_all_tasks(db: Session) -> int:
    """
    Delete all tasks from the database
    Thread-safe implementation that handles concurrent requests
    
    Args:
        db: Database session
    
    Returns:
        Number of tasks deleted
    """
    try:
        # Use synchronize_session=False for better concurrency
        # The delete query returns the number of rows affected
        count = db.query(Task).delete(synchronize_session=False)
        db.commit()
        return count
    except Exception as e:
        db.rollback()
        raise e


def search_tasks(db: Session, query: str, skip: int = 0, limit: int = 100) -> List[Task]:
    """
    Search tasks by title, description, or assigned_to
    
    Args:
        db: Database session
        query: Search query string
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of tasks matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(Task).filter(
        (Task.title.ilike(search_pattern)) |
        (Task.description.ilike(search_pattern)) |
        (Task.assigned_to.ilike(search_pattern))
    ).offset(skip).limit(limit).all()


def search_tasks_count(db: Session, query: str) -> int:
    """
    Get count of tasks matching the search query
    
    Args:
        db: Database session
        query: Search query string
    
    Returns:
        Count of tasks matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(Task).filter(
        (Task.title.ilike(search_pattern)) |
        (Task.description.ilike(search_pattern)) |
        (Task.assigned_to.ilike(search_pattern))
    ).count()


def get_filter_options(db: Session) -> dict:
    """
    Get available filter options for tasks
    
    Returns:
        Dictionary with distinct values for filterable fields
    """
    from sqlalchemy import func
    
    # Get distinct values for each filterable field
    statuses = db.query(Task.status).filter(Task.status.isnot(None)).distinct().all()
    priorities = db.query(Task.priority).filter(Task.priority.isnot(None)).distinct().all()
    assigned_to = db.query(Task.assigned_to).filter(Task.assigned_to.isnot(None)).distinct().all()
    related_to = db.query(Task.related_to).filter(Task.related_to.isnot(None)).distinct().all()
    
    return {
        'status': sorted([s[0] for s in statuses if s[0]]),
        'priority': sorted([p[0] for p in priorities if p[0]]),
        'assigned_to': sorted([a[0] for a in assigned_to if a[0]]),
        'related_to': sorted([r[0] for r in related_to if r[0]])
    }


def get_filtered_tasks(
    db: Session, 
    search: Optional[str] = None,
    filters: dict = None,
    skip: int = 0, 
    limit: int = 100
) -> List[Task]:
    """
    Get tasks with optional search and filters
    
    Args:
        db: Database session
        search: Search query string
        filters: Dictionary of filters to apply
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of tasks matching the search and filters
    """
    query = db.query(Task)
    
    # Apply search
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Task.title.ilike(search_pattern)) |
            (Task.description.ilike(search_pattern)) |
            (Task.assigned_to.ilike(search_pattern))
        )
    
    # Apply filters
    if filters:
        if 'status' in filters and filters['status']:
            query = query.filter(Task.status.in_(filters['status']))
        
        if 'priority' in filters and filters['priority']:
            query = query.filter(Task.priority.in_(filters['priority']))
        
        if 'assigned_to' in filters and filters['assigned_to']:
            query = query.filter(Task.assigned_to.in_(filters['assigned_to']))
        
        if 'related_to' in filters and filters['related_to']:
            query = query.filter(Task.related_to.in_(filters['related_to']))
        
        if 'due_date_start' in filters and filters['due_date_start']:
            query = query.filter(Task.due_date >= filters['due_date_start'])
        
        if 'due_date_end' in filters and filters['due_date_end']:
            query = query.filter(Task.due_date <= filters['due_date_end'])
    
    return query.offset(skip).limit(limit).all()


def get_filtered_tasks_count(
    db: Session, 
    search: Optional[str] = None,
    filters: dict = None
) -> int:
    """
    Get count of tasks matching search and filters
    
    Args:
        db: Database session
        search: Search query string
        filters: Dictionary of filters to apply
    
    Returns:
        Count of tasks matching the search and filters
    """
    query = db.query(Task)
    
    # Apply search
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Task.title.ilike(search_pattern)) |
            (Task.description.ilike(search_pattern)) |
            (Task.assigned_to.ilike(search_pattern))
        )
    
    # Apply filters
    if filters:
        if 'status' in filters and filters['status']:
            query = query.filter(Task.status.in_(filters['status']))
        
        if 'priority' in filters and filters['priority']:
            query = query.filter(Task.priority.in_(filters['priority']))
        
        if 'assigned_to' in filters and filters['assigned_to']:
            query = query.filter(Task.assigned_to.in_(filters['assigned_to']))
        
        if 'related_to' in filters and filters['related_to']:
            query = query.filter(Task.related_to.in_(filters['related_to']))
        
        if 'due_date_start' in filters and filters['due_date_start']:
            query = query.filter(Task.due_date >= filters['due_date_start'])
        
        if 'due_date_end' in filters and filters['due_date_end']:
            query = query.filter(Task.due_date <= filters['due_date_end'])
    
    return query.count()
