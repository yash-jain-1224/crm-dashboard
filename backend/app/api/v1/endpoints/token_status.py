"""
Token Status Endpoint
Provides information about the current authentication token status
"""

from fastapi import APIRouter, HTTPException
from app.core.token_manager import get_token_manager
from app.core.config import settings

router = APIRouter()


@router.get("/token-status")
async def get_token_status():
    """
    Get the current token status and information.
    Useful for debugging authentication issues.
    """
    try:
        token_manager = get_token_manager(
            refresh_interval=settings.TOKEN_REFRESH_INTERVAL,
            fallback_password=settings.DATABRICKS_PASSWORD or settings.PGPASSWORD or ""
        )
        
        token_info = token_manager.get_token_info()
        
        return {
            "status": "healthy" if token_info["is_valid"] else "expired",
            "authentication": {
                "using_oauth": token_info["using_oauth"],
                "has_token": token_info["has_token"],
                "is_valid": token_info["is_valid"],
            },
            "token_details": {
                "last_refresh": token_info["last_refresh"],
                "time_since_refresh_seconds": token_info["time_since_refresh_seconds"],
                "time_until_expiry_seconds": token_info["time_until_expiry_seconds"],
                "refresh_interval_seconds": settings.TOKEN_REFRESH_INTERVAL,
            },
            "token_preview": token_info["token_preview"] if settings.DEBUG else "[hidden in production]"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting token status: {str(e)}")


@router.post("/token-refresh")
async def force_token_refresh():
    """
    Force a token refresh.
    Useful for testing or if you suspect the token is invalid.
    """
    try:
        token_manager = get_token_manager(
            refresh_interval=settings.TOKEN_REFRESH_INTERVAL,
            fallback_password=settings.DATABRICKS_PASSWORD or settings.PGPASSWORD or ""
        )
        
        # Force refresh
        token = token_manager.get_token(force_refresh=True)
        
        return {
            "status": "success",
            "message": "Token refreshed successfully",
            "token_preview": f"{token[:20]}..." if settings.DEBUG else "[hidden in production]"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error refreshing token: {str(e)}")
