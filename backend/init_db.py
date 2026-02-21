#!/usr/bin/env python3
"""
Database initialization script
Creates all tables and optionally seeds with sample data
"""

import sys
from app.core.database import engine
from app.models import models
from seed_data import seed_database


def init_db():
    """Initialize the database"""
    print("🔧 Initializing database...")
    
    try:
        # Create all tables
        print("📊 Creating database tables...")
        models.Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully!")
        
        # Ask user if they want to seed data
        if len(sys.argv) > 1 and sys.argv[1] == "--seed":
            seed_database()
        else:
            print("\n💡 Tip: Run with --seed flag to populate with sample data")
            print("   Example: python init_db.py --seed")
        
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        sys.exit(1)


if __name__ == "__main__":
    init_db()
