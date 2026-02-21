#!/bin/bash

# Build and Deploy Script for Databricks Apps
# This script builds the frontend and prepares the backend for deployment

set -e  # Exit on error

echo "🚀 Building CRM Dashboard for Databricks Deployment"
echo "=================================================="

# Step 1: Build Frontend
echo ""
echo "📦 Step 1: Building Frontend..."
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📥 Installing frontend dependencies..."
    npm install
fi

# Build the frontend
echo "🏗️  Building production bundle..."
npm run build

# Verify build output
if [ ! -f "../backend/static/index.html" ]; then
    echo "❌ Error: Frontend build failed - index.html not found"
    exit 1
fi

echo "✅ Frontend built successfully!"
echo "   Output: backend/static/"

# Step 2: Verify Backend
echo ""
echo "🔍 Step 2: Verifying Backend Setup..."
cd ../backend

# Check if requirements.txt exists
if [ ! -f "requirements.txt" ]; then
    echo "❌ Error: requirements.txt not found"
    exit 1
fi

# Check if main.py exists
if [ ! -f "main.py" ]; then
    echo "❌ Error: main.py not found"
    exit 1
fi

# Check if app.yaml exists
if [ ! -f "app.yaml" ]; then
    echo "⚠️  Warning: app.yaml not found (needed for Databricks deployment)"
    echo "   Creating app.yaml..."
    cat > app.yaml << 'EOF'
name: crm-dashboard
description: Enterprise CRM Dashboard with FastAPI Backend

command:
  - uvicorn
  - main:app
  - --host
  - "0.0.0.0"
  - --port
  - "8000"

resources:
  cpu: "2"
  memory: 4Gi

permissions:
  service_principal: true
  workspace_access: true
EOF
    echo "✅ Created app.yaml"
fi

echo "✅ Backend verified!"

# Step 3: Test Local Build (optional)
echo ""
echo "🧪 Step 3: Testing Local Build..."
echo ""
echo "To test the production build locally, run:"
echo "  cd backend"
echo "  python -m uvicorn main:app --host 0.0.0.0 --port 8000"
echo ""
echo "Then open http://localhost:8000 in your browser"

# Step 4: Deployment Instructions
echo ""
echo "📋 Step 4: Deployment to Databricks"
echo "=================================================="
echo ""
echo "To deploy to Databricks Apps:"
echo ""
echo "1. Install Databricks CLI (if not already installed):"
echo "   brew tap databricks/tap         # macOS"
echo "   brew install databricks"
echo ""
echo "2. Configure Databricks CLI:"
echo "   databricks configure"
echo ""
echo "3. Deploy the app:"
echo "   cd backend"
echo "   databricks apps deploy"
echo ""
echo "4. Follow the prompts to complete deployment"
echo ""
echo "✨ Build complete! Ready for deployment."
echo ""
