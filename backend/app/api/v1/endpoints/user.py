"""
User API Routes
"""

from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()


@router.get("/me")
def get_current_user():
    """
    Get current user information from environment configuration
    """
    # Extract name from email
    email = settings.DATABRICKS_USER
    name_part = email.split('@')[0] if email else "User"
    
    # Convert email username to display name (e.g., "janvi" -> "Janvi")
    display_name = name_part.capitalize()
    
    return {
        "email": email,
        "name": display_name,
        "full_name": display_name,
        "role": "Administrator",
        "avatar_initials": display_name[0].upper() if display_name else "U",
        "workspace": settings.DATABRICKS_HOST_URL if settings.DATABRICKS_HOST_URL else None
    }
