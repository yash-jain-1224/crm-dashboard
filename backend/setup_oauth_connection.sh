#!/bin/bash

# OAuth Database Connection Setup Script
# This script helps you set up the OAuth-based database connection

echo "🚀 Setting up OAuth Database Connection for CRM App"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the backend directory
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}❌ Error: Please run this script from the backend directory${NC}"
    exit 1
fi

echo "📦 Step 1: Installing Python dependencies..."
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

echo "🔐 Step 2: Setting up Databricks authentication..."
echo ""
echo "Choose your authentication method:"
echo "1) Azure CLI (recommended)"
echo "2) Databricks CLI"
echo "3) Configuration file (~/.databrickscfg)"
echo "4) Skip (already configured)"
echo ""
read -p "Enter choice [1-4]: " auth_choice

case $auth_choice in
    1)
        echo ""
        echo "Checking Azure CLI..."
        if ! command -v az &> /dev/null; then
            echo -e "${YELLOW}⚠️  Azure CLI not found. Please install it first:${NC}"
            echo "   brew install azure-cli  # macOS"
            echo "   https://docs.microsoft.com/cli/azure/install-azure-cli"
            exit 1
        fi
        
        echo "Running: az login"
        az login
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Azure CLI authenticated${NC}"
        else
            echo -e "${RED}❌ Azure CLI authentication failed${NC}"
            exit 1
        fi
        ;;
    2)
        echo ""
        echo "Checking Databricks CLI..."
        if ! command -v databricks &> /dev/null; then
            echo -e "${YELLOW}⚠️  Databricks CLI not found. Installing...${NC}"
            pip install databricks-cli
        fi
        
        echo "Running: databricks configure --token"
        databricks configure --token
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Databricks CLI configured${NC}"
        else
            echo -e "${RED}❌ Databricks CLI configuration failed${NC}"
            exit 1
        fi
        ;;
    3)
        echo ""
        echo "Please create ~/.databrickscfg with the following content:"
        echo ""
        echo "[DEFAULT]"
        echo "host = https://your-workspace.azuredatabricks.net"
        echo "token = dapi-your-token-here"
        echo ""
        read -p "Press Enter when done..."
        ;;
    4)
        echo -e "${GREEN}✅ Skipping authentication setup${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac
echo ""

echo "🧪 Step 3: Testing database connection..."
python test_oauth_connection.py

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Database connection test passed!${NC}"
    echo ""
    echo "🎉 Setup complete! You can now start the application:"
    echo "   uvicorn main:app --reload"
    echo ""
    echo "📚 For more information, see OAUTH_DATABASE_SETUP.md"
else
    echo ""
    echo -e "${RED}❌ Database connection test failed${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Check your .env file configuration"
    echo "2. Verify Databricks credentials"
    echo "3. Ensure network connectivity to Databricks"
    echo "4. See OAUTH_DATABASE_SETUP.md for detailed help"
    exit 1
fi
