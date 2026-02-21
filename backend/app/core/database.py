"""
Database Configuration and Session Management with OAuth Token Refresh
"""

import time
import os
import logging
from contextlib import contextmanager
from typing import Optional, Generator
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool, QueuePool
from psycopg_pool import ConnectionPool
import psycopg
from psycopg import sql

from app.core.config import settings

logger = logging.getLogger(__name__)

# Try to import Databricks SDK for OAuth
try:
    from databricks import sdk
    DATABRICKS_SDK_AVAILABLE = True
except ImportError:
    DATABRICKS_SDK_AVAILABLE = False
    logger.warning("Databricks SDK not available. OAuth token refresh disabled.")


# Global variables for token management
workspace_client: Optional[object] = None
postgres_password: Optional[str] = None
last_password_refresh: float = 0
connection_pool: Optional[ConnectionPool] = None


def _get_sslmode() -> str:
    """Return appropriate sslmode for the configured host.

    Local PostgreSQL typically doesn't use SSL by default, so requiring SSL will
    fail. For remote (Databricks) connections, SSL is required.
    """
    host = (settings.DATABRICKS_HOST or "").strip().lower()
    if host in {"localhost", "127.0.0.1"}:
        return "disable"
    return "require"


def _get_local_db_params_from_url() -> dict:
    """Parse DATABASE_URL for local password-based connections."""
    url = make_url(settings.DATABASE_URL)

    password = settings.PGPASSWORD or url.password or ""

    return {
        "dbname": (url.database or "").lstrip("/"),
        "user": url.username or "",
        "password": password,
        "host": url.host or "localhost",
        "port": int(url.port or 5432),
    }


def init_databricks_client():
    """Initialize Databricks workspace client for OAuth."""
    global workspace_client
    if DATABRICKS_SDK_AVAILABLE and workspace_client is None:
        try:
            workspace_client = sdk.WorkspaceClient()
            logger.info("Databricks workspace client initialized")
        except Exception as e:
            logger.warning("Failed to initialize Databricks client: %s", e)
            workspace_client = None


def refresh_oauth_token() -> bool:
    """
    Refresh OAuth token if expired (when USE_OAUTH is True).
    For local development with USE_OAUTH=False, uses DATABRICKS_PASSWORD/PGPASSWORD.
    Returns True if token/password is valid, False otherwise.
    """
    global postgres_password, last_password_refresh
    
    # If OAuth is disabled, use static password
    if not settings.USE_OAUTH:
        if postgres_password is None:
            postgres_password = settings.DATABRICKS_PASSWORD or settings.PGPASSWORD
            last_password_refresh = time.time()
            if postgres_password:
                logger.info("Using static password for local development")
            else:
                logger.warning("No password found in DATABRICKS_PASSWORD or PGPASSWORD")
        return bool(postgres_password)
    
    # OAuth mode: Check if token needs refresh (every 15 minutes or if not set)
    if postgres_password is None or time.time() - last_password_refresh > settings.TOKEN_REFRESH_INTERVAL:
        logger.info("Refreshing PostgreSQL OAuth token")
        
        if not DATABRICKS_SDK_AVAILABLE:
            # Fall back to environment variable password
            logger.warning("Databricks SDK not available, using static password from environment")
            postgres_password = settings.DATABRICKS_PASSWORD or settings.PGPASSWORD
            last_password_refresh = time.time()
            return bool(postgres_password)
        
        try:
            init_databricks_client()
            if workspace_client is None:
                raise ConnectionError("Workspace client not available")
            
            # Get OAuth token
            postgres_password = workspace_client.config.oauth_token().access_token
            last_password_refresh = time.time()
            logger.info("OAuth token refreshed successfully")
            
            return True
            
        except Exception as e:
            logger.error("Failed to refresh OAuth token: %s", str(e))
            # Fall back to static password
            postgres_password = settings.DATABRICKS_PASSWORD or settings.PGPASSWORD
            last_password_refresh = time.time()
            if postgres_password:
                logger.warning("Falling back to static password")
            return bool(postgres_password)
    
    return True


def get_connection_pool() -> ConnectionPool:
    """
    Get or create the psycopg connection pool with OAuth support.
    """
    global connection_pool
    
    if connection_pool is None:
        logger.info("Creating new connection pool")
        refresh_oauth_token()
        
        # Build connection string - escape app name for connection string
        app_name = settings.APP_NAME.replace(" ", "_")  # Replace spaces with underscores

        if not settings.USE_OAUTH:
            local = _get_local_db_params_from_url()
            sslmode = "disable" if (local["host"] or "").lower() in {"localhost", "127.0.0.1"} else "require"
            conn_string = (
                f"dbname={local['dbname']} "
                f"user={local['user']} "
                f"password={local['password']} "
                f"host={local['host']} "
                f"port={local['port']} "
                f"sslmode={sslmode} "
                f"application_name={app_name}"
            )
        else:
            sslmode = _get_sslmode()
            conn_string = (
                f"dbname={settings.DATABRICKS_DATABASE} "
                f"user={settings.DATABRICKS_USER} "
                f"password={postgres_password} "
                f"host={settings.DATABRICKS_HOST} "
                f"port={settings.DATABRICKS_PORT} "
                f"sslmode={sslmode} "
                f"application_name={app_name}"
            )
        
        try:
            connection_pool = ConnectionPool(
                conn_string,
                min_size=settings.DB_POOL_MIN_SIZE,
                max_size=settings.DB_POOL_MAX_SIZE,
                timeout=30
            )
            logger.info(
                "Connection pool created (min=%s, max=%s)",
                settings.DB_POOL_MIN_SIZE,
                settings.DB_POOL_MAX_SIZE,
            )
        except Exception as e:
            logger.exception("Failed to create connection pool")
            raise
    
    return connection_pool


@contextmanager
def get_psycopg_connection():
    """
    Get a psycopg connection from the pool with automatic token refresh.
    Use this for raw SQL operations.
    """
    global connection_pool
    
    # For OAuth mode: Check if token needs refresh and recreate pool if necessary
    # For password mode: No need to refresh
    if settings.USE_OAUTH:
        if postgres_password is None or time.time() - last_password_refresh > settings.TOKEN_REFRESH_INTERVAL:
            logger.info("Token expired, recreating connection pool")
            if connection_pool:
                try:
                    connection_pool.close()
                except Exception as e:
                    logger.warning("Error closing pool: %s", e)
                connection_pool = None
    
    pool = get_connection_pool()
    
    try:
        with pool.connection() as conn:
            yield conn
    except Exception as e:
        logger.exception("Error in connection")
        raise


def get_schema_name() -> str:
    """Get the schema name from settings."""
    return settings.DATABRICKS_SCHEMA


def init_database() -> bool:
    """
    Initialize database schema and tables using raw psycopg.
    This ensures the schema and tables exist before SQLAlchemy operations.
    """
    try:
        logger.info("Starting database initialization")
        
        with get_psycopg_connection() as conn:
            with conn.cursor() as cur:
                schema_name = get_schema_name()
                logger.info("Using schema: %s", schema_name)
                
                # Create schema if it doesn't exist
                create_schema_query = sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(
                    sql.Identifier(schema_name)
                )
                cur.execute(create_schema_query)
                logger.info("Schema '%s' created/verified", schema_name)
                
                # Set search path
                cur.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema_name)))
                
                conn.commit()
                logger.info("Database initialization completed successfully")
                return True
                
    except Exception as e:
        logger.exception("Database initialization error")
        return False


# SQLAlchemy setup for ORM operations
def create_sqlalchemy_engine():
    """Create SQLAlchemy engine with dynamic password handling and connection retry."""
    
    # For SQLAlchemy, we'll use a creator function that always gets fresh credentials
    def get_conn():
        refresh_oauth_token()
        if not settings.USE_OAUTH:
            local = _get_local_db_params_from_url()
            sslmode = "disable" if (local["host"] or "").lower() in {"localhost", "127.0.0.1"} else "require"
        else:
            local = None
            sslmode = _get_sslmode()
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                conn = psycopg.connect(
                    dbname=local["dbname"] if local else settings.DATABRICKS_DATABASE,
                    user=local["user"] if local else settings.DATABRICKS_USER,
                    password=local["password"] if local else postgres_password,
                    host=local["host"] if local else settings.DATABRICKS_HOST,
                    port=local["port"] if local else settings.DATABRICKS_PORT,
                    sslmode=sslmode,
                    options=f"-c search_path={settings.DATABRICKS_SCHEMA}",
                    connect_timeout=30  # 30 second timeout
                )
                return conn
            except Exception as e:
                error_msg = str(e).lower()
                is_connection_error = any(keyword in error_msg for keyword in 
                                         ['ssl', 'tls', 'connection', 'timeout', 'refused'])
                
                if is_connection_error and attempt < max_retries - 1:
                    logger.warning(
                        "Connection attempt %s failed (%s). Retrying in %ss",
                        attempt + 1,
                        str(e)[:80],
                        retry_delay,
                    )
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    # Refresh token before retry
                    refresh_oauth_token()
                    continue
                else:
                    logger.error("Failed to connect after %s attempts", attempt + 1)
                    raise
        
        raise ConnectionError("Failed to establish database connection")
    
    engine = create_engine(
        "postgresql+psycopg://",  # Use psycopg3 driver
        creator=get_conn,
        poolclass=NullPool,  # Disable SQLAlchemy's pool, use our custom pool
        echo=settings.DEBUG,
        pool_pre_ping=True,  # Verify connections before using them
    )
    
    return engine


# Create engine and session
engine = create_sqlalchemy_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency function to get database session for FastAPI.
    Automatically handles token refresh in OAuth mode.
    """
    # Ensure token/password is available before creating session
    if settings.USE_OAUTH:
        refresh_oauth_token()
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Token refresh background task
def start_token_refresh_task():
    """
    Start a background task to refresh tokens periodically.
    Only runs when USE_OAUTH is True (i.e., on Databricks).
    Call this from your FastAPI startup event.
    """
    if not settings.USE_OAUTH:
        logger.info("Token refresh task disabled (using static password for local development)")
        return
    
    import threading
    
    def refresh_loop():
        while True:
            try:
                time.sleep(settings.TOKEN_REFRESH_INTERVAL - 60)  # Refresh 1 min before expiry
                refresh_oauth_token()
            except Exception as e:
                logger.exception("Error in token refresh loop")
                time.sleep(60)  # Wait 1 minute on error
    
    thread = threading.Thread(target=refresh_loop, daemon=True)
    thread.start()
    logger.info("OAuth token refresh background task started")
