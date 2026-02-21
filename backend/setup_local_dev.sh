#!/bin/bash
# Setup script for local development with password authentication

set -e

echo "🔧 CRM App - Local Development Setup"
echo "===================================="
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found in current directory"
    echo "Please run this script from the backend directory"
    exit 1
fi

# Check if password is already set
if grep -q "PGPASSWORD=your-password-here" .env || grep -q "PGPASSWORD=$" .env || ! grep -q "PGPASSWORD=" .env; then
    echo "⚠️  PGPASSWORD not set in .env file"
    echo ""
    echo "Please enter your Databricks PostgreSQL password:"
    read -s password
    echo ""
    
    # Update .env file
    if grep -q "PGPASSWORD=" .env; then
        # Replace existing PGPASSWORD line
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|PGPASSWORD=.*|PGPASSWORD=$password|" .env
        else
            # Linux
            sed -i "s|PGPASSWORD=.*|PGPASSWORD=$password|" .env
        fi
    else
        # Add PGPASSWORD line
        echo "PGPASSWORD=$password" >> .env
    fi
    
    # Also update DATABRICKS_PASSWORD
    if grep -q "DATABRICKS_PASSWORD=" .env; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|DATABRICKS_PASSWORD=.*|DATABRICKS_PASSWORD=$password|" .env
        else
            sed -i "s|DATABRICKS_PASSWORD=.*|DATABRICKS_PASSWORD=$password|" .env
        fi
    else
        echo "DATABRICKS_PASSWORD=$password" >> .env
    fi
    
    echo "✅ Password configured in .env file"
else
    echo "✅ PGPASSWORD already configured"
fi

# Ensure USE_OAUTH is set to False for local development
if grep -q "USE_OAUTH=True" .env; then
    echo "🔄 Setting USE_OAUTH=False for local development..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|USE_OAUTH=True|USE_OAUTH=False|" .env
    else
        sed -i "s|USE_OAUTH=True|USE_OAUTH=False|" .env
    fi
    echo "✅ USE_OAUTH set to False"
elif ! grep -q "USE_OAUTH=" .env; then
    echo "USE_OAUTH=False" >> .env
    echo "✅ USE_OAUTH added and set to False"
else
    echo "✅ USE_OAUTH already configured"
fi

echo ""
echo "🎉 Local development setup complete!"
echo ""
echo "Authentication mode: Password-based (USE_OAUTH=False)"
echo ""
echo "Next steps:"
echo "  1. Install dependencies: pip install -r requirements.txt"
echo "  2. Run the application: python main.py"
echo ""
echo "📖 For more information, see AUTHENTICATION_GUIDE.md"
