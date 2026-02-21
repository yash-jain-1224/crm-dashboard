#!/bin/bash

# Backend Setup Script for CRM Dashboard
# This script sets up the Python FastAPI backend with PostgreSQL

set -e  # Exit on error

echo "🚀 CRM Dashboard Backend Setup"
echo "================================"

# Check Python version
echo "📋 Checking Python version..."
python3 --version

# Create virtual environment
echo "🔨 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "✅ Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env with your database credentials!"
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🎉 Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Update the .env file with your PostgreSQL credentials"
echo "2. Create a PostgreSQL database named 'crm_db'"
echo "3. Run: python init_db.py --seed"
echo "4. Run: python main.py"
echo ""
echo "The API will be available at: http://localhost:8000"
echo "API Documentation: http://localhost:8000/docs"
echo ""
