"""
Pydantic Schemas for Request/Response Validation
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Generic, TypeVar
from datetime import datetime

# Generic type for paginated responses
T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response schema"""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    
    class Config:
        from_attributes = True


# Contact Schemas
class ContactBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    location: Optional[str] = None
    status: str = "Active"
    last_contact: Optional[str] = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    position: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    last_contact: Optional[str] = None


class ContactResponse(ContactBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Lead Schemas
class LeadBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    company: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = None
    source: Optional[str] = None
    status: str = "New"
    score: int = Field(default=0, ge=0, le=100)
    value: Optional[str] = None
    assigned_to: Optional[str] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    status: Optional[str] = None
    score: Optional[int] = Field(None, ge=0, le=100)
    value: Optional[str] = None
    assigned_to: Optional[str] = None


class LeadResponse(LeadBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Opportunity Schemas
class OpportunityBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    account: str = Field(..., min_length=1, max_length=100)
    value: float = Field(..., gt=0)
    stage: str = "Prospecting"
    probability: int = Field(default=10, ge=0, le=100)
    close_date: Optional[str] = None
    owner: Optional[str] = None
    contact_id: Optional[int] = None


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    name: Optional[str] = None
    account: Optional[str] = None
    value: Optional[float] = Field(None, gt=0)
    stage: Optional[str] = None
    probability: Optional[int] = Field(None, ge=0, le=100)
    close_date: Optional[str] = None
    owner: Optional[str] = None
    contact_id: Optional[int] = None


class OpportunityResponse(OpportunityBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Account Schemas
class AccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    industry: Optional[str] = None
    revenue: Optional[str] = None
    employees: Optional[int] = Field(None, ge=0)
    location: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    account_owner: Optional[str] = None
    status: str = "Active"


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    revenue: Optional[str] = None
    employees: Optional[int] = Field(None, ge=0)
    location: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    account_owner: Optional[str] = None
    status: Optional[str] = None


class AccountResponse(AccountBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Task Schemas
class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    priority: str = "Medium"
    status: str = "To Do"
    due_date: Optional[str] = None
    assigned_to: Optional[str] = None
    related_to: Optional[str] = None
    contact_id: Optional[int] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[str] = None
    assigned_to: Optional[str] = None
    related_to: Optional[str] = None
    contact_id: Optional[int] = None


class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Calendar Event Schemas
class CalendarEventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    event_type: str = "Meeting"
    start_time: str
    end_time: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[str] = None
    status: str = "Scheduled"


class CalendarEventCreate(CalendarEventBase):
    pass


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    attendees: Optional[str] = None
    status: Optional[str] = None


class CalendarEventResponse(CalendarEventBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Email Campaign Schemas
class EmailCampaignBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    subject: str = Field(..., min_length=1, max_length=200)
    status: str = "Draft"
    sent_count: int = Field(default=0, ge=0)
    open_rate: float = Field(default=0.0, ge=0, le=100)
    click_rate: float = Field(default=0.0, ge=0, le=100)
    conversion_rate: float = Field(default=0.0, ge=0, le=100)
    scheduled_date: Optional[str] = None


class EmailCampaignCreate(EmailCampaignBase):
    pass


class EmailCampaignUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    status: Optional[str] = None
    sent_count: Optional[int] = Field(None, ge=0)
    open_rate: Optional[float] = Field(None, ge=0, le=100)
    click_rate: Optional[float] = Field(None, ge=0, le=100)
    conversion_rate: Optional[float] = Field(None, ge=0, le=100)
    scheduled_date: Optional[str] = None


class EmailCampaignResponse(EmailCampaignBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Report Schemas
class ReportBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    report_type: str
    description: Optional[str] = None
    data: Optional[str] = None
    created_by: Optional[str] = None
    is_public: bool = False


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseModel):
    name: Optional[str] = None
    report_type: Optional[str] = None
    description: Optional[str] = None
    data: Optional[str] = None
    created_by: Optional[str] = None
    is_public: Optional[bool] = None


class ReportResponse(ReportBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
