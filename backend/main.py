"""
FastAPI Backend for CRM Dashboard
Main application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import sys
from pathlib import Path
import os
import logging

# Add backend directory to Python path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.database import engine, init_database, refresh_oauth_token, start_token_refresh_task
from app.models import models
from app.api.v1 import api_router


logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting CRM Dashboard API")

    if settings.is_production and not settings.SECRET_KEY:
        raise RuntimeError("SECRET_KEY must be set when ENV=production")
    
    # Show authentication mode
    if settings.USE_OAUTH:
        logger.info("Authentication: OAuth (Databricks Workspace)")
    else:
        logger.info("Authentication: Password (Local Development)")
    
    # Initialize password/token
    logger.info("Initializing authentication")
    refresh_oauth_token()
    
    # Initialize database schema
    logger.info("Initializing database")
    if init_database():
        logger.info("Database schema initialized")
    else:
        logger.warning("Database initialization had issues, but continuing")
    
    # Create tables using SQLAlchemy
    logger.info("Creating/verifying tables")
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")
    
    # Start background token refresh (only for OAuth mode)
    start_token_refresh_task()
    
    logger.info("CRM Dashboard API is ready")
    
    yield
    # Shutdown
    logger.info("Shutting down CRM Dashboard API")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise CRM Dashboard API - A comprehensive Customer Relationship Management system with PostgreSQL backend.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {
            "name": "Contacts",
            "description": "Manage customer contacts. Supports CRUD operations, bulk upload via Excel, and advanced filtering."
        },
        {
            "name": "Leads",
            "description": "Track and manage sales leads. Includes lead scoring, status tracking, and bulk import capabilities."
        },
        {
            "name": "Opportunities",
            "description": "Manage sales opportunities through pipeline stages. Track deal values and conversion rates."
        },
        {
            "name": "Accounts",
            "description": "Manage companies and organizations. Link contacts and opportunities to accounts."
        },
        {
            "name": "Tasks",
            "description": "Task management with priority ordering and status tracking. Supports drag-and-drop reordering."
        },
        {
            "name": "Calendar",
            "description": "Event scheduling and calendar management. Create and track meetings and appointments."
        },
        {
            "name": "Email Campaigns",
            "description": "Email campaign management and performance tracking."
        },
        {
            "name": "Reports",
            "description": "Generate custom reports and analytics across all CRM modules."
        },
        {
            "name": "Dashboard",
            "description": "Real-time dashboard with KPIs, metrics, and trend analysis."
        },
        {
            "name": "Authentication",
            "description": "Authentication status and token management."
        },
        {
            "name": "User",
            "description": "User profile and settings management."
        },
        {
            "name": "Test Databricks",
            "description": "Databricks connection testing and diagnostics."
        }
    ]
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")

# Serve static files (frontend build)
static_dir = Path(__file__).resolve().parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")


@app.get("/")
async def root():
    """Serve the frontend application"""
    static_dir = Path(__file__).resolve().parent / "static"
    index_file = static_dir / "index.html"
    
    if index_file.exists():
        return FileResponse(index_file)
    else:
        return {
            "message": f"Welcome to {settings.APP_NAME}",
            "version": settings.APP_VERSION,
            "docs": "/docs",
            "redoc": "/redoc",
            "note": "Frontend not built. Run 'cd frontend && npm run build' to build the UI."
        }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
