"""
CRUD Operations for Reports
"""

from sqlalchemy.orm import Session
from typing import List, Optional

from app.models.models import Report
from app.schemas.schemas import ReportCreate, ReportUpdate


def get_report(db: Session, report_id: int) -> Optional[Report]:
    """Get a single report by ID"""
    return db.query(Report).filter(Report.id == report_id).first()


def get_reports(db: Session, skip: int = 0, limit: int = 100) -> List[Report]:
    """Get all reports with pagination"""
    return db.query(Report).offset(skip).limit(limit).all()


def create_report(db: Session, report: ReportCreate) -> Report:
    """Create a new report"""
    db_report = Report(**report.model_dump())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def update_report(db: Session, report_id: int, report: ReportUpdate) -> Optional[Report]:
    """Update a report"""
    db_report = get_report(db, report_id)
    if db_report:
        update_data = report.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_report, key, value)
        db.commit()
        db.refresh(db_report)
    return db_report


def delete_report(db: Session, report_id: int) -> bool:
    """Delete a report"""
    db_report = get_report(db, report_id)
    if db_report:
        db.delete(db_report)
        db.commit()
        return True
    return False
