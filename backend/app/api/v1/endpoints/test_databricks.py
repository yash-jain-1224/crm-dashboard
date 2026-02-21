"""Test Databricks API Routes

Safe diagnostics for connectivity and configuration.
"""

import logging

from fastapi import APIRouter

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
def get_databricks_status():
    """Return non-sensitive diagnostics about Databricks-related configuration."""
    try:
        from databricks import sdk  # noqa: F401

        sdk_available = True
    except Exception:
        sdk_available = False

    host_present = bool((settings.DATABRICKS_HOST or "").strip())
    host_url_present = bool((settings.DATABRICKS_HOST_URL or "").strip())
    user_present = bool((settings.DATABRICKS_USER or "").strip())

    return {
        "use_oauth": bool(settings.USE_OAUTH),
        "databricks_sdk_available": sdk_available,
        "databricks_host_present": host_present,
        "databricks_host_url_present": host_url_present,
        "databricks_user_present": user_present,
    }


@router.get("/oauth-token")
def get_oauth_token_status():
    """Attempt to acquire an OAuth token using the Databricks SDK.

    This endpoint never returns the token itself.
    """
    if not settings.USE_OAUTH:
        return {
            "use_oauth": False,
            "ok": False,
            "message": "USE_OAUTH is disabled",
        }

    try:
        from databricks import sdk

        client = sdk.WorkspaceClient()
        token = client.config.oauth_token().access_token
        return {
            "use_oauth": True,
            "ok": bool(token),
        }
    except Exception as e:
        logger.exception("OAuth token fetch failed")
        return {
            "use_oauth": True,
            "ok": False,
            "error": str(e),
        }
