#!/bin/bash

# CRM Backend Setup and Run Script

echo "🚀 Setting up CRM Backend with Databricks PostgreSQL..."

# Navigate to backend directory
cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing dependencies..."
pip3 install --user -r requirements.txt
pip3 install --user email-validator

# Run database migrations and seed data
echo "🌱 Initializing database and seeding data..."
python3 seed_data.py

# Start the server
echo "✅ Starting FastAPI server..."
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
