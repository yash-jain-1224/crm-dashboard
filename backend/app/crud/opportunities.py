"""
CRUD Operations for Opportunities
"""

from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi import HTTPException

from app.models.models import Opportunity, Contact
from app.schemas.schemas import OpportunityCreate, OpportunityUpdate


def get_opportunity(db: Session, opportunity_id: int) -> Optional[Opportunity]:
    """Get a single opportunity by ID"""
    return db.query(Opportunity).filter(Opportunity.id == opportunity_id).first()


def get_opportunities(db: Session, skip: int = 0, limit: int = 100) -> List[Opportunity]:
    """Get all opportunities with pagination"""
    return db.query(Opportunity).offset(skip).limit(limit).all()


def get_opportunities_count(db: Session) -> int:
    """Get total count of opportunities"""
    return db.query(Opportunity).count()


def create_opportunity(db: Session, opportunity: OpportunityCreate) -> Opportunity:
    """Create a new opportunity"""
    # Validate contact_id if provided
    if opportunity.contact_id is not None:
        contact = db.query(Contact).filter(Contact.id == opportunity.contact_id).first()
        if not contact:
            raise HTTPException(
                status_code=400,
                detail=f"Contact with id {opportunity.contact_id} does not exist"
            )
    
    db_opportunity = Opportunity(**opportunity.model_dump())
    db.add(db_opportunity)
    db.commit()
    db.refresh(db_opportunity)
    return db_opportunity


def update_opportunity(db: Session, opportunity_id: int, opportunity: OpportunityUpdate) -> Optional[Opportunity]:
    """Update an opportunity"""
    db_opportunity = get_opportunity(db, opportunity_id)
    if db_opportunity:
        update_data = opportunity.model_dump(exclude_unset=True)
        
        # Validate contact_id if being updated
        if 'contact_id' in update_data and update_data['contact_id'] is not None:
            contact = db.query(Contact).filter(Contact.id == update_data['contact_id']).first()
            if not contact:
                raise HTTPException(
                    status_code=400,
                    detail=f"Contact with id {update_data['contact_id']} does not exist"
                )
        
        for key, value in update_data.items():
            setattr(db_opportunity, key, value)
        db.commit()
        db.refresh(db_opportunity)
    return db_opportunity


def delete_opportunity(db: Session, opportunity_id: int) -> bool:
    """Delete an opportunity"""
    db_opportunity = get_opportunity(db, opportunity_id)
    if db_opportunity:
        db.delete(db_opportunity)
        db.commit()
        return True
    return False


def get_opportunities_by_stage(db: Session, stage: str, skip: int = 0, limit: int = 100) -> List[Opportunity]:
    """Get opportunities by stage"""
    return db.query(Opportunity).filter(Opportunity.stage == stage).offset(skip).limit(limit).all()


def bulk_create_opportunities(db: Session, opportunities_data: List) -> int:
    """
    Bulk create opportunities in a single transaction.
    Inserts all rows in a single batch for maximum throughput.

    Args:
        db: Database session
        opportunities_data: List of OpportunityCreate objects

    Returns:
        Number of opportunities created
    """
    from sqlalchemy.exc import IntegrityError, OperationalError
    
    if not opportunities_data:
        return 0
    
    db_opportunities = [Opportunity(**opp.model_dump()) for opp in opportunities_data]
    
    try:
        # Insert all rows in a single batch for maximum throughput
        db.bulk_save_objects(db_opportunities, return_defaults=False)
        db.commit()
        return len(db_opportunities)
    except (IntegrityError, OperationalError):
        db.rollback()
        # If batch fails, try individual inserts to handle duplicates
        count = 0
        for opp in db_opportunities:
            try:
                db.add(opp)
                db.commit()
                count += 1
            except (IntegrityError, OperationalError):
                db.rollback()
                continue
        return count


def delete_all_opportunities(db: Session) -> int:
    """
    Delete all opportunities from the database
    Thread-safe implementation that handles concurrent requests
    
    Args:
        db: Database session
    
    Returns:
        Number of opportunities deleted
    """
    try:
        # Use synchronize_session=False for better concurrency
        # The delete query returns the number of rows affected
        count = db.query(Opportunity).delete(synchronize_session=False)
        db.commit()
        return count
    except Exception as e:
        db.rollback()
        raise e


def search_opportunities(db: Session, query: str, skip: int = 0, limit: int = 100) -> List[Opportunity]:
    """
    Search opportunities by name, account, or stage
    
    Args:
        db: Database session
        query: Search query string
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of opportunities matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(Opportunity).filter(
        (Opportunity.name.ilike(search_pattern)) |
        (Opportunity.account.ilike(search_pattern)) |
        (Opportunity.stage.ilike(search_pattern))
    ).offset(skip).limit(limit).all()


def search_opportunities_count(db: Session, query: str) -> int:
    """
    Get count of opportunities matching the search query
    
    Args:
        db: Database session
        query: Search query string
    
    Returns:
        Count of opportunities matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(Opportunity).filter(
        (Opportunity.name.ilike(search_pattern)) |
        (Opportunity.account.ilike(search_pattern)) |
        (Opportunity.stage.ilike(search_pattern))
    ).count()


def filter_opportunities(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    stage: List[str] = None,
    account: List[str] = None,
    owner: List[str] = None,
    value_min: float = None,
    value_max: float = None,
    probability_min: int = None,
    probability_max: int = None
) -> List[Opportunity]:
    """
    Get opportunities with optional filters and search
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        search: Search query string
        stage: List of stage values to filter by
        account: List of account values to filter by
        owner: List of owner values to filter by
        value_min: Minimum value
        value_max: Maximum value
        probability_min: Minimum probability
        probability_max: Maximum probability
    
    Returns:
        List of filtered opportunities
    """
    query = db.query(Opportunity)
    
    # Apply search if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Opportunity.name.ilike(search_pattern)) |
            (Opportunity.account.ilike(search_pattern)) |
            (Opportunity.stage.ilike(search_pattern))
        )
    
    # Apply filters
    if stage:
        query = query.filter(Opportunity.stage.in_(stage))
    if account:
        query = query.filter(Opportunity.account.in_(account))
    if owner:
        query = query.filter(Opportunity.owner.in_(owner))
    if value_min is not None:
        query = query.filter(Opportunity.amount >= value_min)
    if value_max is not None:
        query = query.filter(Opportunity.amount <= value_max)
    if probability_min is not None:
        query = query.filter(Opportunity.probability >= probability_min)
    if probability_max is not None:
        query = query.filter(Opportunity.probability <= probability_max)
    
    return query.offset(skip).limit(limit).all()


def filter_opportunities_count(
    db: Session,
    search: str = None,
    stage: List[str] = None,
    account: List[str] = None,
    owner: List[str] = None,
    value_min: float = None,
    value_max: float = None,
    probability_min: int = None,
    probability_max: int = None
) -> int:
    """
    Get count of opportunities matching filters and search
    
    Args:
        db: Database session
        search: Search query string
        stage: List of stage values to filter by
        account: List of account values to filter by
        owner: List of owner values to filter by
        value_min: Minimum value
        value_max: Maximum value
        probability_min: Minimum probability
        probability_max: Maximum probability
    
    Returns:
        Count of filtered opportunities
    """
    query = db.query(Opportunity)
    
    # Apply search if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Opportunity.name.ilike(search_pattern)) |
            (Opportunity.account.ilike(search_pattern)) |
            (Opportunity.stage.ilike(search_pattern))
        )
    
    # Apply filters
    if stage:
        query = query.filter(Opportunity.stage.in_(stage))
    if account:
        query = query.filter(Opportunity.account.in_(account))
    if owner:
        query = query.filter(Opportunity.owner.in_(owner))
    if value_min is not None:
        query = query.filter(Opportunity.amount >= value_min)
    if value_max is not None:
        query = query.filter(Opportunity.amount <= value_max)
    if probability_min is not None:
        query = query.filter(Opportunity.probability >= probability_min)
    if probability_max is not None:
        query = query.filter(Opportunity.probability <= probability_max)
    
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
    stages = db.query(Opportunity.stage).distinct().filter(Opportunity.stage.isnot(None)).all()
    accounts = db.query(Opportunity.account).distinct().filter(Opportunity.account.isnot(None)).all()
    owners = db.query(Opportunity.owner).distinct().filter(Opportunity.owner.isnot(None)).all()
    
    return {
        "stage": sorted([s[0] for s in stages if s[0]]),
        "account": sorted([a[0] for a in accounts if a[0]])[:100],  # Limit to 100 accounts
        "owner": sorted([o[0] for o in owners if o[0]])
    }
