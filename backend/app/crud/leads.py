"""
CRUD Operations for Leads
"""

from sqlalchemy.orm import Session
from typing import List, Optional

from app.models.models import Lead
from app.schemas.schemas import LeadCreate, LeadUpdate


def get_lead(db: Session, lead_id: int) -> Optional[Lead]:
    """Get a single lead by ID"""
    return db.query(Lead).filter(Lead.id == lead_id).first()


def get_leads(db: Session, skip: int = 0, limit: int = 100) -> List[Lead]:
    """Get all leads with pagination"""
    return db.query(Lead).offset(skip).limit(limit).all()


def get_leads_count(db: Session) -> int:
    """Get total count of leads"""
    return db.query(Lead).count()


def create_lead(db: Session, lead: LeadCreate) -> Lead:
    """Create a new lead"""
    db_lead = Lead(**lead.model_dump())
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead


def update_lead(db: Session, lead_id: int, lead: LeadUpdate) -> Optional[Lead]:
    """Update a lead"""
    db_lead = get_lead(db, lead_id)
    if db_lead:
        update_data = lead.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_lead, key, value)
        db.commit()
        db.refresh(db_lead)
    return db_lead


def delete_lead(db: Session, lead_id: int) -> bool:
    """Delete a lead"""
    db_lead = get_lead(db, lead_id)
    if db_lead:
        db.delete(db_lead)
        db.commit()
        return True
    return False


def get_leads_by_status(db: Session, status: str, skip: int = 0, limit: int = 100) -> List[Lead]:
    """Get leads by status"""
    return db.query(Lead).filter(Lead.status == status).offset(skip).limit(limit).all()


def bulk_create_leads(db: Session, leads_data: List) -> int:
    """
    Bulk create leads in a single transaction.
    Inserts all rows in a single batch for maximum throughput.

    Args:
        db: Database session
        leads_data: List of LeadCreate objects

    Returns:
        Number of leads created
    """
    from sqlalchemy.exc import IntegrityError, OperationalError
    
    if not leads_data:
        return 0
    
    db_leads = [Lead(**lead.model_dump()) for lead in leads_data]
    
    try:
        # Insert all rows in a single batch for maximum throughput
        db.bulk_save_objects(db_leads, return_defaults=False)
        db.commit()
        return len(db_leads)
    except (IntegrityError, OperationalError):
        db.rollback()
        # If batch fails, try individual inserts to handle duplicates
        count = 0
        for lead in db_leads:
            try:
                db.add(lead)
                db.commit()
                count += 1
            except (IntegrityError, OperationalError):
                db.rollback()
                continue
        return count


def delete_all_leads(db: Session) -> int:
    """
    Delete all leads from the database
    Thread-safe implementation that handles concurrent requests
    
    Args:
        db: Database session
    
    Returns:
        Number of leads deleted
    """
    try:
        # Use synchronize_session=False for better concurrency
        # The delete query returns the number of rows affected
        count = db.query(Lead).delete(synchronize_session=False)
        db.commit()
        return count
    except Exception as e:
        db.rollback()
        raise e


def search_leads(db: Session, query: str, skip: int = 0, limit: int = 100) -> List[Lead]:
    """
    Search leads by name, company, email, phone, or source
    
    Args:
        db: Database session
        query: Search query string
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of leads matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(Lead).filter(
        (Lead.name.ilike(search_pattern)) |
        (Lead.company.ilike(search_pattern)) |
        (Lead.email.ilike(search_pattern)) |
        (Lead.phone.ilike(search_pattern)) |
        (Lead.source.ilike(search_pattern))
    ).offset(skip).limit(limit).all()


def search_leads_count(db: Session, query: str) -> int:
    """
    Get count of leads matching the search query
    
    Args:
        db: Database session
        query: Search query string
    
    Returns:
        Count of leads matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(Lead).filter(
        (Lead.name.ilike(search_pattern)) |
        (Lead.company.ilike(search_pattern)) |
        (Lead.email.ilike(search_pattern)) |
        (Lead.phone.ilike(search_pattern)) |
        (Lead.source.ilike(search_pattern))
    ).count()


def filter_leads(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    status: List[str] = None,
    source: List[str] = None,
    assigned_to: List[str] = None,
    score_min: int = None,
    score_max: int = None
) -> List[Lead]:
    """
    Get leads with optional filters and search
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        search: Search query string
        status: List of status values to filter by
        source: List of source values to filter by
        assigned_to: List of assigned_to values to filter by
        score_min: Minimum score value
        score_max: Maximum score value
    
    Returns:
        List of filtered leads
    """
    query = db.query(Lead)
    
    # Apply search if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Lead.name.ilike(search_pattern)) |
            (Lead.company.ilike(search_pattern)) |
            (Lead.email.ilike(search_pattern)) |
            (Lead.phone.ilike(search_pattern)) |
            (Lead.source.ilike(search_pattern))
        )
    
    # Apply filters
    if status:
        query = query.filter(Lead.status.in_(status))
    if source:
        query = query.filter(Lead.source.in_(source))
    if assigned_to:
        query = query.filter(Lead.assigned_to.in_(assigned_to))
    if score_min is not None:
        query = query.filter(Lead.score >= score_min)
    if score_max is not None:
        query = query.filter(Lead.score <= score_max)
    
    return query.offset(skip).limit(limit).all()


def filter_leads_count(
    db: Session,
    search: str = None,
    status: List[str] = None,
    source: List[str] = None,
    assigned_to: List[str] = None,
    score_min: int = None,
    score_max: int = None
) -> int:
    """
    Get count of leads matching filters and search
    
    Args:
        db: Database session
        search: Search query string
        status: List of status values to filter by
        source: List of source values to filter by
        assigned_to: List of assigned_to values to filter by
        score_min: Minimum score value
        score_max: Maximum score value
    
    Returns:
        Count of filtered leads
    """
    query = db.query(Lead)
    
    # Apply search if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Lead.name.ilike(search_pattern)) |
            (Lead.company.ilike(search_pattern)) |
            (Lead.email.ilike(search_pattern)) |
            (Lead.phone.ilike(search_pattern)) |
            (Lead.source.ilike(search_pattern))
        )
    
    # Apply filters
    if status:
        query = query.filter(Lead.status.in_(status))
    if source:
        query = query.filter(Lead.source.in_(source))
    if assigned_to:
        query = query.filter(Lead.assigned_to.in_(assigned_to))
    if score_min is not None:
        query = query.filter(Lead.score >= score_min)
    if score_max is not None:
        query = query.filter(Lead.score <= score_max)
    
    return query.count()


def get_filter_options(db: Session) -> dict:
    """
    Get unique values for filterable fields
    
    Args:
        db: Database session
    
    Returns:
        Dictionary with unique values for each filterable field
    """
    # Get distinct values for each filterable field
    statuses = db.query(Lead.status).distinct().filter(Lead.status.isnot(None)).all()
    sources = db.query(Lead.source).distinct().filter(Lead.source.isnot(None)).all()
    assigned_to = db.query(Lead.assigned_to).distinct().filter(Lead.assigned_to.isnot(None)).all()
    
    return {
        "status": sorted([s[0] for s in statuses if s[0]]),
        "source": sorted([s[0] for s in sources if s[0]]),
        "assigned_to": sorted([a[0] for a in assigned_to if a[0]])
    }
