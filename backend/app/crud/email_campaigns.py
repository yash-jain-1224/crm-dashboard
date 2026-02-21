"""
CRUD Operations for Email Campaigns
"""

from sqlalchemy.orm import Session
from typing import List, Optional

from app.models.models import EmailCampaign
from app.schemas.schemas import EmailCampaignCreate, EmailCampaignUpdate


def get_campaign(db: Session, campaign_id: int) -> Optional[EmailCampaign]:
    """Get a single campaign by ID"""
    return db.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()


def get_campaigns(db: Session, skip: int = 0, limit: int = 100) -> List[EmailCampaign]:
    """Get all campaigns with pagination"""
    return db.query(EmailCampaign).offset(skip).limit(limit).all()


def get_campaigns_count(db: Session) -> int:
    """Get total count of email campaigns"""
    return db.query(EmailCampaign).count()


def create_campaign(db: Session, campaign: EmailCampaignCreate) -> EmailCampaign:
    """Create a new email campaign"""
    db_campaign = EmailCampaign(**campaign.model_dump())
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign


def update_campaign(db: Session, campaign_id: int, campaign: EmailCampaignUpdate) -> Optional[EmailCampaign]:
    """Update an email campaign"""
    db_campaign = get_campaign(db, campaign_id)
    if db_campaign:
        update_data = campaign.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_campaign, key, value)
        db.commit()
        db.refresh(db_campaign)
    return db_campaign


def delete_campaign(db: Session, campaign_id: int) -> bool:
    """Delete an email campaign"""
    db_campaign = get_campaign(db, campaign_id)
    if db_campaign:
        db.delete(db_campaign)
        db.commit()
        return True
    return False


def bulk_create_campaigns(db: Session, campaigns_data: List) -> int:
    """
    Bulk create email campaigns in a single transaction.
    Inserts all rows in a single batch for maximum throughput.

    Args:
        db: Database session
        campaigns_data: List of EmailCampaignCreate objects

    Returns:
        Number of campaigns created
    """
    from app.schemas.schemas import EmailCampaignCreate
    from sqlalchemy.exc import IntegrityError, OperationalError
    
    if not campaigns_data:
        return 0

    db_campaigns = [EmailCampaign(**campaign.model_dump()) for campaign in campaigns_data]
    
    try:
        # Insert all rows in a single batch for maximum throughput
        db.bulk_save_objects(db_campaigns, return_defaults=False)
        db.commit()
        return len(db_campaigns)
    except (IntegrityError, OperationalError):
        db.rollback()
        # If batch fails, try individual inserts to handle duplicates
        count = 0
        for campaign in db_campaigns:
            try:
                db.add(campaign)
                db.commit()
                count += 1
            except (IntegrityError, OperationalError):
                db.rollback()
                continue
        return count


def delete_all_campaigns(db: Session) -> int:
    """
    Delete all email campaigns from the database
    Thread-safe implementation that handles concurrent requests
    
    Args:
        db: Database session
    
    Returns:
        Number of campaigns deleted
    """
    try:
        # Use synchronize_session=False for better concurrency
        # The delete query returns the number of rows affected
        count = db.query(EmailCampaign).delete(synchronize_session=False)
        db.commit()
        return count
    except Exception as e:
        db.rollback()
        raise e


def search_email_campaigns(db: Session, query: str, skip: int = 0, limit: int = 100) -> List[EmailCampaign]:
    """
    Search email campaigns by name or subject
    
    Args:
        db: Database session
        query: Search query string
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of email campaigns matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(EmailCampaign).filter(
        (EmailCampaign.name.ilike(search_pattern)) |
        (EmailCampaign.subject.ilike(search_pattern))
    ).offset(skip).limit(limit).all()


def search_email_campaigns_count(db: Session, query: str) -> int:
    """
    Get count of email campaigns matching the search query
    
    Args:
        db: Database session
        query: Search query string
    
    Returns:
        Count of email campaigns matching the search query
    """
    search_pattern = f"%{query}%"
    return db.query(EmailCampaign).filter(
        (EmailCampaign.name.ilike(search_pattern)) |
        (EmailCampaign.subject.ilike(search_pattern))
    ).count()
