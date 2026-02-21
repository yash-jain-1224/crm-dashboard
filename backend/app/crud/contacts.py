"""
CRUD Operations for Contacts
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional

from app.models.models import Contact
from app.schemas.schemas import ContactCreate, ContactUpdate


def get_contact(db: Session, contact_id: int) -> Optional[Contact]:
    """Get a single contact by ID"""
    return db.query(Contact).filter(Contact.id == contact_id).first()


def get_contacts(db: Session, skip: int = 0, limit: int = 100) -> List[Contact]:
    """Get all contacts with pagination"""
    return db.query(Contact).offset(skip).limit(limit).all()


def get_contacts_count(db: Session) -> int:
    """Get total count of contacts"""
    return db.query(Contact).count()


def get_contact_by_email(db: Session, email: str) -> Optional[Contact]:
    """Get a contact by email"""
    return db.query(Contact).filter(Contact.email == email).first()


def create_contact(db: Session, contact: ContactCreate) -> Contact:
    """Create a new contact"""
    db_contact = Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact


def update_contact(db: Session, contact_id: int, contact: ContactUpdate) -> Optional[Contact]:
    """Update a contact"""
    db_contact = get_contact(db, contact_id)
    if db_contact:
        update_data = contact.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_contact, key, value)
        db.commit()
        db.refresh(db_contact)
    return db_contact


def delete_contact(db: Session, contact_id: int) -> bool:
    """Delete a contact"""
    db_contact = get_contact(db, contact_id)
    if db_contact:
        db.delete(db_contact)
        db.commit()
        return True
    return False


def search_contacts(db: Session, query: str, skip: int = 0, limit: int = 100) -> List[Contact]:
    """Search contacts by name, email, company, or phone"""
    search_pattern = f"%{query}%"
    return db.query(Contact).filter(
        (Contact.name.ilike(search_pattern)) |
        (Contact.email.ilike(search_pattern)) |
        (Contact.company.ilike(search_pattern)) |
        (Contact.phone.ilike(search_pattern))
    ).offset(skip).limit(limit).all()


def search_contacts_count(db: Session, query: str) -> int:
    """
    Get count of contacts matching the search query

    Args:
        db: Database session
        query: Search query string

    Returns:
        Count of contacts matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(Contact).filter(
        (Contact.name.ilike(search_pattern)) |
        (Contact.email.ilike(search_pattern)) |
        (Contact.company.ilike(search_pattern)) |
        (Contact.phone.ilike(search_pattern))
    ).count()


def filter_contacts(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    status: List[str] = None,
    company: List[str] = None,
    position: List[str] = None,
    location: List[str] = None
) -> List[Contact]:
    """
    Get contacts with optional filters and search
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        search: Search query string
        status: List of status values to filter by
        company: List of company values to filter by
        position: List of position values to filter by
        location: List of location values to filter by
    
    Returns:
        List of filtered contacts
    """
    query = db.query(Contact)
    
    # Apply search if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Contact.name.ilike(search_pattern)) |
            (Contact.email.ilike(search_pattern)) |
            (Contact.company.ilike(search_pattern)) |
            (Contact.phone.ilike(search_pattern))
        )
    
    # Apply filters
    if status:
        query = query.filter(Contact.status.in_(status))
    if company:
        query = query.filter(Contact.company.in_(company))
    if position:
        query = query.filter(Contact.position.in_(position))
    if location:
        query = query.filter(Contact.location.in_(location))
    
    return query.offset(skip).limit(limit).all()


def filter_contacts_count(
    db: Session,
    search: str = None,
    status: List[str] = None,
    company: List[str] = None,
    position: List[str] = None,
    location: List[str] = None
) -> int:
    """
    Get count of contacts matching filters and search
    
    Args:
        db: Database session
        search: Search query string
        status: List of status values to filter by
        company: List of company values to filter by
        position: List of position values to filter by
        location: List of location values to filter by
    
    Returns:
        Count of filtered contacts
    """
    query = db.query(Contact)
    
    # Apply search if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Contact.name.ilike(search_pattern)) |
            (Contact.email.ilike(search_pattern)) |
            (Contact.company.ilike(search_pattern)) |
            (Contact.phone.ilike(search_pattern))
        )
    
    # Apply filters
    if status:
        query = query.filter(Contact.status.in_(status))
    if company:
        query = query.filter(Contact.company.in_(company))
    if position:
        query = query.filter(Contact.position.in_(position))
    if location:
        query = query.filter(Contact.location.in_(location))
    
    return query.count()


def bulk_create_contacts(db: Session, contacts_data: List[ContactCreate], existing_emails: set = None) -> tuple:
    """
    Bulk create contacts in a single transaction.
    Skips contacts with duplicate emails and returns detailed information.
    Optimized for performance with large datasets.

    Args:
        db: Database session
        contacts_data: List of ContactCreate objects
        existing_emails: Optional set of existing emails to avoid querying DB multiple times

    Returns:
        Tuple of (success_count, failed_records_list)
        where failed_records_list contains dicts with 'email', 'error', 'data'
    """
    from sqlalchemy.exc import IntegrityError, OperationalError
    
    if not contacts_data:
        return 0, []
    
    failed_records = []
    
    # Only query for existing emails if not provided (for first batch or small uploads)
    if existing_emails is None:
        # Extract emails from the batch to check only those
        batch_emails = [contact.email for contact in contacts_data]
        
        # Check only the emails in this batch (much faster than querying all)
        try:
            existing_emails_query = set(
                db.query(Contact.email)
                .filter(Contact.email.in_(batch_emails))
                .all()
            )
            existing_emails = {email[0] for email in existing_emails_query}
        except OperationalError as e:
            # Handle connection errors (expired tokens, SSL issues, etc.)
            db.rollback()
            raise e
    
    # Filter out contacts with duplicate emails
    unique_contacts = []
    seen_emails = set()
    
    for contact in contacts_data:
        # Skip if email already exists in DB
        if contact.email in existing_emails:
            failed_records.append({
                'email': contact.email,
                'error': 'Email already exists in database',
                'data': contact.model_dump()
            })
            continue
        
        # Skip if email seen in this batch (duplicate within upload)
        if contact.email in seen_emails:
            failed_records.append({
                'email': contact.email,
                'error': 'Duplicate email within uploaded file',
                'data': contact.model_dump()
            })
            continue
            
        unique_contacts.append(Contact(**contact.model_dump()))
        seen_emails.add(contact.email)
        # Add to existing_emails to avoid duplicates in subsequent batches
        existing_emails.add(contact.email)
    
    if unique_contacts:
        try:
            # Insert all rows in a single batch for maximum throughput
            db.bulk_save_objects(unique_contacts, return_defaults=False)
            db.commit()
            return len(unique_contacts), failed_records
        except (IntegrityError, OperationalError):
            db.rollback()
            # If batch fails, try individual inserts to handle duplicates
            count = 0
            for contact in unique_contacts:
                try:
                    db.add(contact)
                    db.commit()
                    count += 1
                except (IntegrityError, OperationalError) as e:
                    db.rollback()
                    failed_records.append({
                        'email': contact.email,
                        'error': f'Database error: {str(e)}',
                        'data': contact.__dict__
                    })
                    continue
            return count, failed_records
    return 0, failed_records


def delete_all_contacts(db: Session) -> int:
    try:
        # First get the count before deleting
        count = db.query(Contact).count()
        
        db.query(Contact).delete()
        db.commit()
        
        return count
    except Exception as e:
        db.rollback()
        raise e


def get_filter_options(db: Session) -> dict:
    """
    Get unique values for filterable fields
    
    Args:
        db: Database session
    
    Returns:
        Dictionary with unique values for each filterable field
    """
    # Get distinct values for each filterable field
    statuses = db.query(Contact.status).distinct().filter(Contact.status.isnot(None)).all()
    companies = db.query(Contact.company).distinct().filter(Contact.company.isnot(None)).all()
    positions = db.query(Contact.position).distinct().filter(Contact.position.isnot(None)).all()
    locations = db.query(Contact.location).distinct().filter(Contact.location.isnot(None)).all()
    
    return {
        "status": sorted([s[0] for s in statuses if s[0]]),
        "company": sorted([c[0] for c in companies if c[0]])[:100],  # Limit to 100 companies
        "position": sorted([p[0] for p in positions if p[0]])[:50],  # Limit to 50 positions
        "location": sorted([l[0] for l in locations if l[0]])[:100]  # Limit to 100 locations
    }
