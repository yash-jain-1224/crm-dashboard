"""
CRUD Operations for Calendar Events
"""

from sqlalchemy.orm import Session
from typing import List, Optional

from app.models.models import CalendarEvent
from app.schemas.schemas import CalendarEventCreate, CalendarEventUpdate


def get_event(db: Session, event_id: int) -> Optional[CalendarEvent]:
    """Get a single event by ID"""
    return db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()


def get_events(db: Session, skip: int = 0, limit: int = 100) -> List[CalendarEvent]:
    """Get all events with pagination"""
    return db.query(CalendarEvent).offset(skip).limit(limit).all()


def get_events_count(db: Session) -> int:
    """Get total count of calendar events"""
    return db.query(CalendarEvent).count()


def create_event(db: Session, event: CalendarEventCreate) -> CalendarEvent:
    """Create a new calendar event"""
    db_event = CalendarEvent(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


def update_event(db: Session, event_id: int, event: CalendarEventUpdate) -> Optional[CalendarEvent]:
    """Update a calendar event"""
    db_event = get_event(db, event_id)
    if db_event:
        update_data = event.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_event, key, value)
        db.commit()
        db.refresh(db_event)
    return db_event


def delete_event(db: Session, event_id: int) -> bool:
    """Delete a calendar event"""
    db_event = get_event(db, event_id)
    if db_event:
        db.delete(db_event)
        db.commit()
        return True
    return False


def bulk_create_events(db: Session, events_data: List[CalendarEventCreate]) -> int:
    """
    Bulk create calendar events in a single transaction.
    Inserts all rows in a single batch for maximum throughput.

    Args:
        db: Database session
        events_data: List of CalendarEventCreate objects

    Returns:
        Number of events created
    """
    from sqlalchemy.exc import IntegrityError, OperationalError
    
    if not events_data:
        return 0
    
    db_events = [CalendarEvent(**event.model_dump()) for event in events_data]
    
    try:
        # Insert all rows in a single batch for maximum throughput
        db.bulk_save_objects(db_events, return_defaults=False)
        db.commit()
        return len(db_events)
    except (IntegrityError, OperationalError):
        db.rollback()
        # If batch fails, try individual inserts to handle duplicates
        count = 0
        for event in db_events:
            try:
                db.add(event)
                db.commit()
                count += 1
            except (IntegrityError, OperationalError):
                db.rollback()
                continue
        return count


def delete_all_events(db: Session) -> int:
    """
    Delete all calendar events from the database
    Thread-safe implementation that handles concurrent requests
    
    Args:
        db: Database session
    
    Returns:
        Number of events deleted
    """
    try:
        # Use synchronize_session=False for better concurrency
        # The delete query returns the number of rows affected
        count = db.query(CalendarEvent).delete(synchronize_session=False)
        db.commit()
        return count
    except Exception as e:
        db.rollback()
        raise e


def search_calendar_events(db: Session, query: str, skip: int = 0, limit: int = 100) -> List[CalendarEvent]:
    """
    Search calendar events by title, description, or location
    
    Args:
        db: Database session
        query: Search query string
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of calendar events matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(CalendarEvent).filter(
        (CalendarEvent.title.ilike(search_pattern)) |
        (CalendarEvent.description.ilike(search_pattern)) |
        (CalendarEvent.location.ilike(search_pattern))
    ).offset(skip).limit(limit).all()


def search_calendar_events_count(db: Session, query: str) -> int:
    """
    Get count of calendar events matching the search query
    
    Args:
        db: Database session
        query: Search query string
    
    Returns:
        Count of calendar events matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(CalendarEvent).filter(
        (CalendarEvent.title.ilike(search_pattern)) |
        (CalendarEvent.description.ilike(search_pattern)) |
        (CalendarEvent.location.ilike(search_pattern))
    ).count()


def get_events_by_date_range(
    db: Session, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0, 
    limit: int = 100
) -> List[CalendarEvent]:
    """
    Get calendar events filtered by date range with optional search
    
    Args:
        db: Database session
        start_date: Start date in YYYY-MM-DD format (inclusive)
        end_date: End date in YYYY-MM-DD format (inclusive)
        search: Optional search query
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of calendar events within the date range
    """
    query = db.query(CalendarEvent)
    
    # Apply date filters on start_time field (which contains datetime as string)
    if start_date:
        # Match dates that start with the start_date pattern
        query = query.filter(CalendarEvent.start_time.like(f"{start_date}%"))
    
    if end_date and start_date != end_date:
        # For date ranges, filter between start and end dates
        query = query.filter(CalendarEvent.start_time.between(f"{start_date} 00:00:00", f"{end_date} 23:59:59"))
    
    # Apply search filter if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (CalendarEvent.title.ilike(search_pattern)) |
            (CalendarEvent.description.ilike(search_pattern)) |
            (CalendarEvent.location.ilike(search_pattern))
        )
    
    return query.offset(skip).limit(limit).all()


def get_events_by_date_range_count(
    db: Session, 
    start_date: Optional[str] = None, 
    end_date: Optional[str] = None,
    search: Optional[str] = None
) -> int:
    """
    Get count of calendar events within date range with optional search
    
    Args:
        db: Database session
        start_date: Start date in YYYY-MM-DD format (inclusive)
        end_date: End date in YYYY-MM-DD format (inclusive)
        search: Optional search query
    
    Returns:
        Count of calendar events within the date range
    """
    query = db.query(CalendarEvent)
    
    # Apply date filters on start_time field (which contains datetime as string)
    if start_date:
        # Match dates that start with the start_date pattern
        query = query.filter(CalendarEvent.start_time.like(f"{start_date}%"))
    
    if end_date and start_date != end_date:
        # For date ranges, filter between start and end dates
        query = query.filter(CalendarEvent.start_time.between(f"{start_date} 00:00:00", f"{end_date} 23:59:59"))
    
    # Apply search filter if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (CalendarEvent.title.ilike(search_pattern)) |
            (CalendarEvent.description.ilike(search_pattern)) |
            (CalendarEvent.location.ilike(search_pattern))
        )
    
    return query.count()


def get_upcoming_events(
    db: Session,
    today: str,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[CalendarEvent]:
    """
    Get upcoming calendar events (today and future) with optional search
    
    Args:
        db: Database session
        today: Today's date in YYYY-MM-DD format
        search: Optional search query
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of upcoming calendar events
    """
    query = db.query(CalendarEvent)
    
    # Filter events from today onwards (start_time >= today)
    query = query.filter(CalendarEvent.start_time >= f"{today} 00:00:00")
    
    # Apply search filter if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (CalendarEvent.title.ilike(search_pattern)) |
            (CalendarEvent.description.ilike(search_pattern)) |
            (CalendarEvent.location.ilike(search_pattern))
        )
    
    # Order by start_time ascending (earliest events first)
    query = query.order_by(CalendarEvent.start_time.asc())
    
    return query.offset(skip).limit(limit).all()


def get_upcoming_events_count(
    db: Session,
    today: str,
    search: Optional[str] = None
) -> int:
    """
    Get count of upcoming calendar events (today and future)
    
    Args:
        db: Database session
        today: Today's date in YYYY-MM-DD format
        search: Optional search query
    
    Returns:
        Count of upcoming calendar events
    """
    query = db.query(CalendarEvent)
    
    # Filter events from today onwards (start_time >= today)
    query = query.filter(CalendarEvent.start_time >= f"{today} 00:00:00")
    
    # Apply search filter if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (CalendarEvent.title.ilike(search_pattern)) |
            (CalendarEvent.description.ilike(search_pattern)) |
            (CalendarEvent.location.ilike(search_pattern))
        )
    
    return query.count()
