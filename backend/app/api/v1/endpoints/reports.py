"""
Reports API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.schemas.schemas import ReportCreate, ReportUpdate, ReportResponse
from app.crud import reports
from app.models.models import Lead, Opportunity

router = APIRouter()


@router.get("/analytics", response_model=dict)
def get_reports_analytics(
    months: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db)
):
    """Aggregated analytics for Reports & Analytics page."""

    # Sales performance by rep (based on opportunities)
    rep_rows = (
        db.query(
            Opportunity.owner.label('owner'),
            func.count(Opportunity.id).label('deals'),
            func.sum(Opportunity.value).label('revenue')
        )
        .filter(Opportunity.owner.isnot(None))
        .group_by(Opportunity.owner)
        .order_by(func.sum(Opportunity.value).desc())
        .limit(10)
        .all()
    )
    sales_by_rep = [
        {
            'name': owner,
            'deals': int(deals or 0),
            'revenue': float(revenue or 0),
        }
        for owner, deals, revenue in rep_rows
    ]

    # Lead sources distribution
    source_rows = (
        db.query(Lead.source.label('source'), func.count(Lead.id).label('count'))
        .filter(Lead.source.isnot(None))
        .group_by(Lead.source)
        .order_by(func.count(Lead.id).desc())
        .all()
    )
    total_sources = sum(int(c or 0) for _, c in source_rows) or 1
    lead_source_data = [
        {
            'name': source,
            'value': round(int(count or 0) * 100 / total_sources, 2),
        }
        for source, count in source_rows
    ]

    # Conversion funnel derived from lead status
    funnel_stages = [
        ('New', 'Leads'),
        ('Qualified', 'Qualified'),
        ('Proposal', 'Proposal'),
        ('Negotiation', 'Negotiation'),
        ('Closed Won', 'Closed Won'),
    ]
    funnel = []
    for lead_status, label in funnel_stages:
        count = db.query(Lead).filter(Lead.status == lead_status).count()
        funnel.append({'stage': label, 'count': int(count)})

    # Monthly trends
    lead_month = func.date_trunc('month', Lead.created_at)
    lead_rows = (
        db.query(lead_month.label('month'), func.count(Lead.id).label('newLeads'))
        .group_by(lead_month)
        .order_by(lead_month.desc())
        .limit(months)
        .all()
    )
    opp_month = func.date_trunc('month', Opportunity.created_at)
    opp_rows = (
        db.query(
            opp_month.label('month'),
            func.count(Opportunity.id).label('closedDeals'),
            func.sum(Opportunity.value).label('revenue'),
        )
        .filter(Opportunity.stage == 'Closed Won')
        .group_by(opp_month)
        .order_by(opp_month.desc())
        .limit(months)
        .all()
    )
    by_month = {}
    for m, v in lead_rows:
        key = m.strftime('%Y-%m') if m else None
        if key:
            by_month.setdefault(key, {})
            by_month[key]['newLeads'] = int(v or 0)
    for m, deals, revenue in opp_rows:
        key = m.strftime('%Y-%m') if m else None
        if key:
            by_month.setdefault(key, {})
            by_month[key]['closedDeals'] = int(deals or 0)
            by_month[key]['revenue'] = float(revenue or 0)

    sorted_keys = sorted(by_month.keys())
    monthly_trends = []
    for key in sorted_keys[-months:]:
        dt = datetime.strptime(key, '%Y-%m')
        monthly_trends.append({
            'month': dt.strftime('%b'),
            'month_key': key,
            'newLeads': by_month.get(key, {}).get('newLeads', 0),
            'closedDeals': by_month.get(key, {}).get('closedDeals', 0),
            'revenue': by_month.get(key, {}).get('revenue', 0),
        })

    return {
        'salesByRep': sales_by_rep,
        'leadSourceData': lead_source_data,
        'conversionFunnel': funnel,
        'monthlyTrends': monthly_trends,
    }


@router.get("/", response_model=List[ReportResponse])
def get_reports(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Get all reports"""
    return reports.get_reports(db, skip=skip, limit=limit)


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    """Get a report by ID"""
    db_report = reports.get_report(db, report_id)
    if db_report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return db_report


@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(report: ReportCreate, db: Session = Depends(get_db)):
    """Create a new report"""
    return reports.create_report(db, report)


@router.put("/{report_id}", response_model=ReportResponse)
def update_report(report_id: int, report: ReportUpdate, db: Session = Depends(get_db)):
    """Update a report"""
    db_report = reports.update_report(db, report_id, report)
    if db_report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return db_report


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_id: int, db: Session = Depends(get_db)):
    """Delete a report"""
    if not reports.delete_report(db, report_id):
        raise HTTPException(status_code=404, detail="Report not found")
    return None
