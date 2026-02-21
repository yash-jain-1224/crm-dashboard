"""
Dashboard API Routes - Aggregated statistics and metrics
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from app.core.database import get_db
from app.models.models import Contact, Lead, Opportunity, Account, Task, CalendarEvent, EmailCampaign

router = APIRouter()


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    
    # Count entities
    total_contacts = db.query(Contact).count()
    total_leads = db.query(Lead).count()
    total_opportunities = db.query(Opportunity).count()
    total_accounts = db.query(Account).count()
    total_tasks = db.query(Task).count()
    
    # Calculate opportunity value
    total_opportunity_value = db.query(func.sum(Opportunity.value)).scalar() or 0
    
    # Count by status
    active_contacts = db.query(Contact).filter(Contact.status == "Active").count()
    qualified_leads = db.query(Lead).filter(Lead.status == "Qualified").count()
    active_accounts = db.query(Account).filter(Account.status == "Active").count()
    
    # Task breakdown
    tasks_todo = db.query(Task).filter(Task.status == "To Do").count()
    tasks_in_progress = db.query(Task).filter(Task.status == "In Progress").count()
    tasks_completed = db.query(Task).filter(Task.status == "Done").count()
    
    # Opportunities by stage
    opportunities_by_stage = db.query(
        Opportunity.stage,
        func.count(Opportunity.id).label('count'),
        func.sum(Opportunity.value).label('total_value')
    ).group_by(Opportunity.stage).all()
    
    # Recent activities
    recent_contacts = db.query(Contact).order_by(Contact.created_at.desc()).limit(5).all()
    recent_leads = db.query(Lead).order_by(Lead.created_at.desc()).limit(5).all()

    # Recent opportunities (for dashboard table)
    recent_opportunities = (
        db.query(Opportunity, Contact)
        .outerjoin(Contact, Opportunity.contact_id == Contact.id)
        .order_by(Opportunity.created_at.desc())
        .limit(10)
        .all()
    )
    
    return {
        "summary": {
            "total_contacts": total_contacts,
            "active_contacts": active_contacts,
            "total_leads": total_leads,
            "qualified_leads": qualified_leads,
            "total_opportunities": total_opportunities,
            "total_opportunity_value": float(total_opportunity_value),
            "total_accounts": total_accounts,
            "active_accounts": active_accounts,
            "total_tasks": total_tasks,
        },
        "tasks": {
            "todo": tasks_todo,
            "in_progress": tasks_in_progress,
            "completed": tasks_completed,
        },
        "opportunities_by_stage": [
            {
                "stage": item.stage,
                "count": item.count,
                "total_value": float(item.total_value or 0)
            }
            for item in opportunities_by_stage
        ],
        "recent_activities": {
            "contacts": [
                {
                    "id": c.id,
                    "name": c.name,
                    "company": c.company,
                    "created_at": c.created_at.isoformat() if c.created_at else None
                }
                for c in recent_contacts
            ],
            "leads": [
                {
                    "id": l.id,
                    "name": l.name,
                    "company": l.company,
                    "score": l.score,
                    "created_at": l.created_at.isoformat() if l.created_at else None
                }
                for l in recent_leads
            ],
        }
        ,
        "recent_opportunities": [
            {
                "id": opp.id,
                "company": opp.account,
                "contact": contact.name if contact else None,
                "value": opp.value,
                "stage": opp.stage,
                "probability": opp.probability,
                "created_at": opp.created_at.isoformat() if opp.created_at else None,
            }
            for opp, contact in recent_opportunities
        ]
    }


@router.get("/trends")
def get_dashboard_trends(
    months: int = 6,
    db: Session = Depends(get_db)
):
    """Return monthly trend series used by the dashboard charts."""
    months = max(1, min(months, 24))

    # Postgres-friendly monthly bucket
    lead_month = func.date_trunc('month', Lead.created_at)
    lead_rows = (
        db.query(lead_month.label('month'), func.count(Lead.id).label('leads'))
        .group_by(lead_month)
        .order_by(lead_month.desc())
        .limit(months)
        .all()
    )

    opp_month = func.date_trunc('month', Opportunity.created_at)
    revenue_rows = (
        db.query(opp_month.label('month'), func.sum(Opportunity.value).label('revenue'))
        .group_by(opp_month)
        .order_by(opp_month.desc())
        .limit(months)
        .all()
    )

    by_month = {}
    for m, leads in lead_rows:
        key = m.strftime('%Y-%m') if m else None
        if key:
            by_month.setdefault(key, {})
            by_month[key]['leads'] = int(leads or 0)
    for m, revenue in revenue_rows:
        key = m.strftime('%Y-%m') if m else None
        if key:
            by_month.setdefault(key, {})
            by_month[key]['revenue'] = float(revenue or 0)

    # Sort ascending for charting
    sorted_keys = sorted(by_month.keys())
    series = []
    for key in sorted_keys[-months:]:
        dt = datetime.strptime(key, '%Y-%m')
        series.append({
            'month': dt.strftime('%b'),
            'month_key': key,
            'revenue': by_month.get(key, {}).get('revenue', 0),
            'leads': by_month.get(key, {}).get('leads', 0),
        })

    return {
        'months': months,
        'series': series,
    }


@router.get("/revenue")
def get_revenue_metrics(db: Session = Depends(get_db)):
    """Get revenue metrics and trends"""
    
    total_value = db.query(func.sum(Opportunity.value)).scalar() or 0
    
    opportunities_by_stage = db.query(
        Opportunity.stage,
        func.sum(Opportunity.value).label('value'),
        func.avg(Opportunity.probability).label('avg_probability')
    ).group_by(Opportunity.stage).all()
    
    return {
        "total_pipeline_value": float(total_value),
        "by_stage": [
            {
                "stage": item.stage,
                "value": float(item.value or 0),
                "avg_probability": float(item.avg_probability or 0),
                "weighted_value": float((item.value or 0) * (item.avg_probability or 0) / 100)
            }
            for item in opportunities_by_stage
        ]
    }
