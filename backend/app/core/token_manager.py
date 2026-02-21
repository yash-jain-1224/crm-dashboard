"""
OAuth Token Manager for Databricks Authentication
Handles automatic token fetching and refresh
"""

import time
import threading
import logging
from typing import Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Try to import Databricks SDK for OAuth
try:
    from databricks import sdk
    DATABRICKS_SDK_AVAILABLE = True
except ImportError:
    DATABRICKS_SDK_AVAILABLE = False
    logger.warning("Databricks SDK not available. Install with: pip install databricks-sdk")


class TokenManager:
    """
    Manages OAuth tokens for Databricks authentication.
    Automatically fetches and refreshes tokens as needed.
    """
    
    def __init__(self, refresh_interval: int = 900, fallback_password: str = ""):
        """
        Initialize the token manager.
        
        Args:
            refresh_interval: Time in seconds before token refresh (default: 15 minutes)
            fallback_password: Static password to use if OAuth fails
        """
        self.refresh_interval = refresh_interval
        self.fallback_password = fallback_password
        self._token: Optional[str] = None
        self._last_refresh: float = 0
        self._workspace_client: Optional[object] = None
        self._lock = threading.Lock()
        self._refresh_thread: Optional[threading.Thread] = None
        self._stop_refresh = False
        
    def _init_workspace_client(self):
        """Initialize Databricks workspace client for OAuth."""
        if not DATABRICKS_SDK_AVAILABLE:
            return False
            
        with self._lock:
            if self._workspace_client is None:
                try:
                    self._workspace_client = sdk.WorkspaceClient()
                    logger.info("Databricks workspace client initialized")
                    return True
                except Exception as e:
                    logger.warning("Failed to initialize Databricks client: %s", e)
                    self._workspace_client = None
                    return False
            return True
    
    def _fetch_oauth_token(self) -> Optional[str]:
        """
        Fetch a fresh OAuth token from Databricks.
        
        Returns:
            The OAuth token string, or None if fetch failed
        """
        if not DATABRICKS_SDK_AVAILABLE:
            return None
            
        try:
            if not self._init_workspace_client():
                return None
                
            if self._workspace_client is None:
                return None
                
            token = self._workspace_client.config.oauth_token().access_token
            return token
            
        except Exception as e:
            logger.exception("Failed to fetch OAuth token")
            return None
    
    def get_token(self, force_refresh: bool = False) -> str:
        """
        Get the current valid token, refreshing if necessary.
        
        Args:
            force_refresh: Force a token refresh even if current token is still valid
            
        Returns:
            A valid authentication token
            
        Raises:
            ConnectionError: If unable to obtain a valid token
        """
        with self._lock:
            current_time = time.time()
            time_since_refresh = current_time - self._last_refresh
            
            # Check if token needs refresh
            needs_refresh = (
                force_refresh or
                self._token is None or
                time_since_refresh > self.refresh_interval
            )
            
            if needs_refresh:
                logger.info("Refreshing OAuth token")
                
                # Try to fetch OAuth token
                new_token = self._fetch_oauth_token()
                
                if new_token:
                    self._token = new_token
                    self._last_refresh = current_time
                    expires_in = datetime.now() + timedelta(seconds=self.refresh_interval)
                    logger.info("OAuth token refreshed successfully (expires at ~%s)", expires_in.strftime('%H:%M:%S'))
                else:
                    # Fall back to static password if OAuth fails
                    if self.fallback_password:
                        logger.warning("OAuth failed, using fallback password")
                        self._token = self.fallback_password
                        self._last_refresh = current_time
                    else:
                        raise ConnectionError(
                            "Failed to obtain authentication token. "
                            "Please ensure Databricks authentication is configured "
                            "(Azure CLI, Databricks CLI, or ~/.databrickscfg)"
                        )
            
            return self._token
    
    def is_token_valid(self) -> bool:
        """
        Check if the current token is still valid (not expired).
        
        Returns:
            True if token is valid, False otherwise
        """
        if self._token is None:
            return False
            
        time_since_refresh = time.time() - self._last_refresh
        return time_since_refresh < self.refresh_interval
    
    def start_background_refresh(self):
        """
        Start a background thread that automatically refreshes the token.
        The token will be refreshed 60 seconds before expiry.
        """
        if self._refresh_thread is not None and self._refresh_thread.is_alive():
            logger.warning("Background refresh thread already running")
            return
            
        self._stop_refresh = False
        
        def refresh_loop():
            while not self._stop_refresh:
                try:
                    # Sleep until 60 seconds before expiry
                    sleep_time = max(60, self.refresh_interval - 60)
                    time.sleep(sleep_time)
                    
                    if not self._stop_refresh:
                        self.get_token(force_refresh=True)
                        
                except Exception as e:
                    logger.exception("Error in token refresh loop")
                    time.sleep(60)  # Wait 1 minute on error
        
        self._refresh_thread = threading.Thread(target=refresh_loop, daemon=True)
        self._refresh_thread.start()
        logger.info("Background token refresh started (interval: %ss)", self.refresh_interval)
    
    def stop_background_refresh(self):
        """Stop the background refresh thread."""
        self._stop_refresh = True
        if self._refresh_thread:
            self._refresh_thread.join(timeout=5)
            logger.info("Background token refresh stopped")
    
    def get_token_info(self) -> dict:
        """
        Get information about the current token.
        
        Returns:
            Dictionary with token status information
        """
        time_since_refresh = time.time() - self._last_refresh
        time_until_expiry = max(0, self.refresh_interval - time_since_refresh)
        
        return {
            "has_token": self._token is not None,
            "is_valid": self.is_token_valid(),
            "last_refresh": datetime.fromtimestamp(self._last_refresh).isoformat() if self._last_refresh > 0 else None,
            "time_since_refresh_seconds": int(time_since_refresh),
            "time_until_expiry_seconds": int(time_until_expiry),
            "using_oauth": DATABRICKS_SDK_AVAILABLE and self._workspace_client is not None,
            "token_preview": f"{self._token[:20]}..." if self._token else None
        }


# Global token manager instance
_token_manager: Optional[TokenManager] = None


def get_token_manager(refresh_interval: int = 900, fallback_password: str = "") -> TokenManager:
    """
    Get or create the global token manager instance.
    
    Args:
        refresh_interval: Token refresh interval in seconds (default: 15 minutes)
        fallback_password: Fallback password if OAuth fails
        
    Returns:
        The global TokenManager instance
    """
    global _token_manager
    
    if _token_manager is None:
        _token_manager = TokenManager(
            refresh_interval=refresh_interval,
            fallback_password=fallback_password
        )
    
    return _token_manager
