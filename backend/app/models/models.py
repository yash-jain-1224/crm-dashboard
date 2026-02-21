"""
Database Models
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base
from app.core.config import settings


# Get schema name from settings
SCHEMA = getattr(settings, 'DATABRICKS_SCHEMA', None)


class Contact(Base):
    """Contact model for customer contacts"""
    __tablename__ = "contacts"
    __table_args__ = {'schema': SCHEMA} if SCHEMA else {}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    phone = Column(String)
    company = Column(String, index=True)
    position = Column(String)
    location = Column(String)
    status = Column(String, default="Active")
    last_contact = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    opportunities = relationship("Opportunity", back_populates="contact")
    tasks = relationship("Task", back_populates="contact")


class Lead(Base):
    """Lead model for potential customers"""
    __tablename__ = "leads"
    __table_args__ = {'schema': SCHEMA} if SCHEMA else {}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    company = Column(String, nullable=False, index=True)
    email = Column(String, nullable=False)
    phone = Column(String)
    source = Column(String)
    status = Column(String, default="New")
    score = Column(Integer, default=0)
    value = Column(String)
    assigned_to = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Opportunity(Base):
    """Opportunity model for sales opportunities"""
    __tablename__ = "opportunities"
    __table_args__ = {'schema': SCHEMA} if SCHEMA else {}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    account = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    stage = Column(String, default="Prospecting")
    probability = Column(Integer, default=10)
    close_date = Column(String)
    owner = Column(String)
    contact_id = Column(Integer, ForeignKey(f'{SCHEMA}.contacts.id' if SCHEMA else 'contacts.id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    contact = relationship("Contact", back_populates="opportunities")


class Account(Base):
    """Account model for business accounts"""
    __tablename__ = "accounts"
    __table_args__ = {'schema': SCHEMA} if SCHEMA else {}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    industry = Column(String)
    revenue = Column(String)
    employees = Column(Integer)
    location = Column(String)
    phone = Column(String)
    website = Column(String)
    account_owner = Column(String)
    status = Column(String, default="Active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Task(Base):
    """Task model for task management"""
    __tablename__ = "tasks"
    __table_args__ = {'schema': SCHEMA} if SCHEMA else {}
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    priority = Column(String, default="Medium")
    status = Column(String, default="To Do")
    due_date = Column(String)
    assigned_to = Column(String)
    related_to = Column(String)
    contact_id = Column(Integer, ForeignKey(f'{SCHEMA}.contacts.id' if SCHEMA else 'contacts.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    contact = relationship("Contact", back_populates="tasks")


class CalendarEvent(Base):
    """Calendar event model"""
    __tablename__ = "calendar_events"
    __table_args__ = {'schema': SCHEMA} if SCHEMA else {}
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    event_type = Column(String, default="Meeting")
    start_time = Column(String, nullable=False)
    end_time = Column(String)
    location = Column(String)
    attendees = Column(String)
    status = Column(String, default="Scheduled")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailCampaign(Base):
    """Email campaign model"""
    __tablename__ = "email_campaigns"
    __table_args__ = {'schema': SCHEMA} if SCHEMA else {}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    status = Column(String, default="Draft")
    sent_count = Column(Integer, default=0)
    open_rate = Column(Float, default=0.0)
    click_rate = Column(Float, default=0.0)
    conversion_rate = Column(Float, default=0.0)
    scheduled_date = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Report(Base):
    """Report model for analytics"""
    __tablename__ = "reports"
    __table_args__ = {'schema': SCHEMA} if SCHEMA else {}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    report_type = Column(String, nullable=False)
    description = Column(Text)
    data = Column(Text)  # JSON data stored as text
    created_by = Column(String)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
