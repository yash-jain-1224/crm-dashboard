#!/bin/bash

# CRM Dashboard - Complete Setup Script
# This script sets up both frontend and backend

set -e  # Exit on error

echo "🚀 CRM Dashboard - Complete Setup"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo -e "${BLUE}📦 Step 1: Setting up Backend${NC}"
echo "================================"
cd backend

# Check Python version
echo "Checking Python version..."
python3 --version

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please update backend/.env with your database credentials${NC}"
else
    echo "✅ .env file already exists"
fi

cd ..

echo ""
echo -e "${BLUE}📦 Step 2: Setting up Frontend${NC}"
echo "================================"
cd frontend

# Check Node version
echo "Checking Node.js version..."
node --version

# Install Node dependencies
echo "Installing Node.js dependencies..."
npm install --silent

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
else
    echo "✅ .env file already exists"
fi

cd ..

echo ""
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "===================="
echo ""
echo "Next steps:"
echo ""
echo "1. ${YELLOW}Configure Backend Database:${NC}"
echo "   - Edit backend/.env with your PostgreSQL credentials"
echo "   - Or use Docker: docker run --name crm-postgres -e POSTGRES_DB=crm_db -e POSTGRES_USER=crm_user -e POSTGRES_PASSWORD=your_password -p 5432:5432 -d postgres:15"
echo ""
echo "2. ${YELLOW}Initialize Database:${NC}"
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python init_db.py --seed"
echo ""
echo "3. ${YELLOW}Start Backend:${NC}"
echo "   cd backend"
echo "   python main.py"
echo "   (Backend will run on http://localhost:8000)"
echo ""
echo "4. ${YELLOW}Start Frontend (new terminal):${NC}"
echo "   cd frontend"
echo "   npm run dev"
echo "   (Frontend will run on http://localhost:5173)"
echo ""
echo "5. ${YELLOW}Access the Application:${NC}"
echo "   Frontend: http://localhost:5173"
echo "   Backend API: http://localhost:8000/docs"
echo ""
echo "📚 Documentation:"
echo "   - Quick Start: backend/QUICKSTART.md"
echo "   - Integration: INTEGRATION_GUIDE.md"
echo "   - Docker Setup: DOCKER_SETUP.md"
echo ""
