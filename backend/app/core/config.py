"""
Application Configuration
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import os
import logging

logger = logging.getLogger(__name__)


def is_running_on_databricks() -> bool:
    """
    Detect if the application is running on Databricks.
    Checks for Databricks-specific environment variables.
    """
    return any([
        os.getenv("DATABRICKS_RUNTIME_VERSION"),
        os.getenv("DB_IS_DRIVER"),
        os.getenv("SPARK_HOME") and "databricks" in os.getenv("SPARK_HOME", "").lower()
    ])


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "CRM Dashboard API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    ENV: str = "development"  # development|staging|production
    
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/crm_db"
    PGPASSWORD: str = ""  # Used for local development
    
    # Databricks PostgreSQL Connection
    DATABRICKS_HOST: str = ""  # e.g., your-workspace.cloud.databricks.com
    DATABRICKS_PORT: int = 5432
    DATABRICKS_DATABASE: str = "lakebase_postgres_catalog"
    DATABRICKS_USER: str = ""  # Your Databricks username
    DATABRICKS_PASSWORD: str = ""  # Used for local development
    DATABRICKS_SCHEMA: str = "demo-crm-app_schema_2cb9b701be3a450f89875f57ade64796"
    
    # Databricks OAuth (alternative to password)
    DATABRICKS_HOST_URL: str = ""  # Full workspace URL for OAuth
    USE_OAUTH: bool = False  # Set to True to use OAuth, False to use password
    
    # Connection Pool Settings
    DB_POOL_MIN_SIZE: int = 2
    DB_POOL_MAX_SIZE: int = 10
    TOKEN_REFRESH_INTERVAL: int = 900  # 15 minutes in seconds
    
    # Security
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        if v is None:
            return v
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            raw = v.strip()
            if not raw:
                return []
            if raw.startswith("["):
                return v
            return [item.strip() for item in raw.split(",") if item.strip()]
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"


# Create settings instance
settings = Settings()

# Auto-detect Databricks environment and override USE_OAUTH if needed
if is_running_on_databricks():
    logger.info("Detected Databricks runtime environment - enabling OAuth")
    settings.USE_OAUTH = True
elif settings.USE_OAUTH and not os.getenv("DATABRICKS_HOST_URL"):
    logger.warning("USE_OAUTH is True but not on Databricks - switching to password auth")
    settings.USE_OAUTH = False

logger.info("Authentication mode: %s", "OAuth" if settings.USE_OAUTH else "Password")
