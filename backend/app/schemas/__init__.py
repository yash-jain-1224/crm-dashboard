"""
Schemas package
"""

from app.schemas.schemas import (
    ContactCreate, ContactUpdate, ContactResponse,
    LeadCreate, LeadUpdate, LeadResponse,
    OpportunityCreate, OpportunityUpdate, OpportunityResponse,
    AccountCreate, AccountUpdate, AccountResponse,
    TaskCreate, TaskUpdate, TaskResponse,
    CalendarEventCreate, CalendarEventUpdate, CalendarEventResponse,
    EmailCampaignCreate, EmailCampaignUpdate, EmailCampaignResponse,
    ReportCreate, ReportUpdate, ReportResponse,
)

__all__ = [
    "ContactCreate", "ContactUpdate", "ContactResponse",
    "LeadCreate", "LeadUpdate", "LeadResponse",
    "OpportunityCreate", "OpportunityUpdate", "OpportunityResponse",
    "AccountCreate", "AccountUpdate", "AccountResponse",
    "TaskCreate", "TaskUpdate", "TaskResponse",
    "CalendarEventCreate", "CalendarEventUpdate", "CalendarEventResponse",
    "EmailCampaignCreate", "EmailCampaignUpdate", "EmailCampaignResponse",
    "ReportCreate", "ReportUpdate", "ReportResponse",
]
