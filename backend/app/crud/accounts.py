"""
CRUD Operations for Accounts
"""

from sqlalchemy.orm import Session
from typing import List, Optional

from app.models.models import Account
from app.schemas.schemas import AccountCreate, AccountUpdate


def get_account(db: Session, account_id: int) -> Optional[Account]:
    """Get a single account by ID"""
    return db.query(Account).filter(Account.id == account_id).first()


def get_accounts(db: Session, skip: int = 0, limit: int = 100) -> List[Account]:
    """Get all accounts with pagination"""
    return db.query(Account).offset(skip).limit(limit).all()


def get_accounts_count(db: Session) -> int:
    """Get total count of accounts"""
    return db.query(Account).count()


def create_account(db: Session, account: AccountCreate) -> Account:
    """Create a new account"""
    db_account = Account(**account.model_dump())
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


def update_account(db: Session, account_id: int, account: AccountUpdate) -> Optional[Account]:
    """Update an account"""
    db_account = get_account(db, account_id)
    if db_account:
        update_data = account.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_account, key, value)
        db.commit()
        db.refresh(db_account)
    return db_account


def delete_account(db: Session, account_id: int) -> bool:
    """Delete an account"""
    db_account = get_account(db, account_id)
    if db_account:
        db.delete(db_account)
        db.commit()
        return True
    return False


def bulk_create_accounts(db: Session, accounts_data: List) -> int:
    """
    Bulk create accounts in a single transaction.
    Skips accounts with duplicate names.
    Optimized for performance with large datasets.

    Args:
        db: Database session
        accounts_data: List of AccountCreate objects

    Returns:
        Number of accounts created
    """
    from app.schemas.schemas import AccountCreate
    from sqlalchemy.exc import IntegrityError
    
    if not accounts_data:
        return 0
    
    # Extract names from the batch to check only those
    batch_names = [account.name for account in accounts_data]
    
    # Check only the names in this batch (much faster than querying all)
    existing_names = set(
        db.query(Account.name)
        .filter(Account.name.in_(batch_names))
        .all()
    )
    existing_names = {name[0] for name in existing_names}
    
    # Filter out accounts with duplicate names
    unique_accounts = []
    seen_names = set()
    
    for account in accounts_data:
        # Skip if name already exists in DB or seen in this batch
        if account.name in existing_names or account.name in seen_names:
            continue
        unique_accounts.append(Account(**account.model_dump()))
        seen_names.add(account.name)
    
    if unique_accounts:
        try:
            # Insert all rows in a single batch for maximum throughput
            db.bulk_save_objects(unique_accounts, return_defaults=False)
            db.commit()
            return len(unique_accounts)
        except IntegrityError:
            db.rollback()
            # If batch fails, try individual inserts to handle duplicates
            count = 0
            for account in unique_accounts:
                try:
                    db.add(account)
                    db.commit()
                    count += 1
                except IntegrityError:
                    db.rollback()
                    continue
            return count
    return 0


def delete_all_accounts(db: Session) -> int:
    """
    Delete all accounts from the database
    Thread-safe implementation that handles concurrent requests
    
    Args:
        db: Database session
    
    Returns:
        Number of accounts deleted
    """
    try:
        # Use synchronize_session=False for better concurrency
        # The delete query returns the number of rows affected
        count = db.query(Account).delete(synchronize_session=False)
        db.commit()
        return count
    except Exception as e:
        db.rollback()
        raise e


def search_accounts(db: Session, query: str, skip: int = 0, limit: int = 100) -> List[Account]:
    """
    Search accounts by name, industry, or location
    
    Args:
        db: Database session
        query: Search query string
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of accounts matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(Account).filter(
        (Account.name.ilike(search_pattern)) |
        (Account.industry.ilike(search_pattern)) |
        (Account.location.ilike(search_pattern))
    ).offset(skip).limit(limit).all()


def search_accounts_count(db: Session, query: str) -> int:
    """
    Get count of accounts matching the search query
    
    Args:
        db: Database session
        query: Search query string
    
    Returns:
        Count of accounts matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(Account).filter(
        (Account.name.ilike(search_pattern)) |
        (Account.industry.ilike(search_pattern)) |
        (Account.location.ilike(search_pattern))
    ).count()


def filter_accounts(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: str = None,
    status: List[str] = None,
    industry: List[str] = None,
    location: List[str] = None,
    account_owner: List[str] = None,
    employees_min: int = None,
    employees_max: int = None
) -> List[Account]:
    """
    Get accounts with optional filters and search
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        search: Search query string
        status: List of status values to filter by
        industry: List of industry values to filter by
        location: List of location values to filter by
        account_owner: List of account_owner values to filter by
        employees_min: Minimum number of employees
        employees_max: Maximum number of employees
    
    Returns:
        List of filtered accounts
    """
    query = db.query(Account)
    
    # Apply search if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Account.name.ilike(search_pattern)) |
            (Account.industry.ilike(search_pattern)) |
            (Account.location.ilike(search_pattern))
        )
    
    # Apply filters
    if status:
        query = query.filter(Account.status.in_(status))
    if industry:
        query = query.filter(Account.industry.in_(industry))
    if location:
        query = query.filter(Account.location.in_(location))
    if account_owner:
        query = query.filter(Account.account_owner.in_(account_owner))
    if employees_min is not None:
        query = query.filter(Account.employees >= employees_min)
    if employees_max is not None:
        query = query.filter(Account.employees <= employees_max)
    
    return query.offset(skip).limit(limit).all()


def filter_accounts_count(
    db: Session,
    search: str = None,
    status: List[str] = None,
    industry: List[str] = None,
    location: List[str] = None,
    account_owner: List[str] = None,
    employees_min: int = None,
    employees_max: int = None
) -> int:
    """
    Get count of accounts matching filters and search
    
    Args:
        db: Database session
        search: Search query string
        status: List of status values to filter by
        industry: List of industry values to filter by
        location: List of location values to filter by
        account_owner: List of account_owner values to filter by
        employees_min: Minimum number of employees
        employees_max: Maximum number of employees
    
    Returns:
        Count of filtered accounts
    """
    query = db.query(Account)
    
    # Apply search if provided
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Account.name.ilike(search_pattern)) |
            (Account.industry.ilike(search_pattern)) |
            (Account.location.ilike(search_pattern))
        )
    
    # Apply filters
    if status:
        query = query.filter(Account.status.in_(status))
    if industry:
        query = query.filter(Account.industry.in_(industry))
    if location:
        query = query.filter(Account.location.in_(location))
    if account_owner:
        query = query.filter(Account.account_owner.in_(account_owner))
    if employees_min is not None:
        query = query.filter(Account.employees >= employees_min)
    if employees_max is not None:
        query = query.filter(Account.employees <= employees_max)
    
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
    statuses = db.query(Account.status).distinct().filter(Account.status.isnot(None)).all()
    industries = db.query(Account.industry).distinct().filter(Account.industry.isnot(None)).all()
    locations = db.query(Account.location).distinct().filter(Account.location.isnot(None)).all()
    owners = db.query(Account.account_owner).distinct().filter(Account.account_owner.isnot(None)).all()
    
    return {
        "status": sorted([s[0] for s in statuses if s[0]]),
        "industry": sorted([i[0] for i in industries if i[0]])[:50],  # Limit to 50 industries
        "location": sorted([l[0] for l in locations if l[0]])[:100],  # Limit to 100 locations
        "account_owner": sorted([o[0] for o in owners if o[0]])
    }
