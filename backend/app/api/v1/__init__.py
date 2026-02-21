"""
API v1 Router
"""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    contacts,
    leads,
    opportunities,
    accounts,
    tasks,
    calendar,
    email_campaigns,
    reports,
    dashboard,
    test_databricks,
    token_status,
    user,
)

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(contacts.router, prefix="/contacts", tags=["Contacts"])
api_router.include_router(leads.router, prefix="/leads", tags=["Leads"])
api_router.include_router(opportunities.router, prefix="/opportunities", tags=["Opportunities"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks"])
api_router.include_router(calendar.router, prefix="/calendar", tags=["Calendar"])
api_router.include_router(email_campaigns.router, prefix="/email-campaigns", tags=["Email Campaigns"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(test_databricks.router, prefix="/test-databricks", tags=["Test Databricks"])
api_router.include_router(token_status.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(user.router, prefix="/user", tags=["User"])
