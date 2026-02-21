# CRM Dashboard Backend API

FastAPI-based backend for the CRM Dashboard application with PostgreSQL database.

## � Quick Commands

### One-Command Start
```bash
./start.sh
```

### Manual Start
```bash
# Setup
python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# Database
python init_db.py --seed

# Start Server
python main.py
```

### Kill Port 8000
```bash
lsof -ti:8000 | xargs kill -9
```

### Access Points
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## � Authentication Modes

This application supports two authentication modes:

- **🏠 Local Development:** Password-based authentication using `PGPASSWORD` or `DATABRICKS_PASSWORD`
- **☁️ Databricks Deployment:** OAuth-based authentication with automatic token refresh

The application automatically detects which environment it's running in and uses the appropriate authentication method.

**📖 See [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md) for detailed setup instructions.**

## 🚀 Features

- **RESTful API** with FastAPI
- **PostgreSQL Database** for persistent storage
- **SQLAlchemy ORM** for database operations
- **Pydantic** for data validation
- **Auto-generated API Documentation** (Swagger UI & ReDoc)
- **CORS Support** for frontend integration
- **Comprehensive CRUD Operations** for all CRM entities

## 📋 Prerequisites

- Python 3.9 or higher
- PostgreSQL 12 or higher
- pip (Python package installer)

## 🛠️ Installation

### 1. Clone and Navigate

```bash
cd backend
```

### 2. Create Virtual Environment

```bash
python -m venv venv

# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Set Up PostgreSQL Database

Create a PostgreSQL database:

```sql
CREATE DATABASE crm_db;
CREATE USER crm_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm_user;
```

### 5. Configure Environment Variables

Copy the example environment file and update it:

```bash
cp .env.example .env
```

Edit `.env` and update the database connection string:

```env
DATABASE_URL=postgresql://crm_user:your_password@localhost:5432/crm_db
```

### 6. Initialize Database

Create tables:

```bash
python init_db.py
```

Or create tables and seed with sample data:

```bash
python init_db.py --seed
```

## 🏃 Running the Application

### Quick Start (Recommended)

```bash
# One-command setup and run
./start.sh
```

### Development Mode

```bash
# Method 1: Using main.py
python main.py

# Method 2: Using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Method 3: Using uvicorn module
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Alternative Setup Methods

#### Using Setup Script
```bash
# Complete setup with virtual environment
./setup.sh

# Then run the server
source venv/bin/activate
python main.py
```

#### Manual Setup Commands
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate     # On Windows

# Install dependencies
pip install -r requirements.txt

# Initialize database
python init_db.py --seed

# Start server
python main.py
```

### Killing Existing Processes

```bash
# Kill processes on port 8000
lsof -ti:8000 | xargs kill -9

# Or find and kill manually
lsof -ti:8000
kill -9 <PID>
```

### Access Points

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs (Swagger UI)**: http://localhost:8000/docs
- **Alternative Docs (ReDoc)**: http://localhost:8000/redoc
- **OpenAPI Spec**: http://localhost:8000/openapi.json

## 📚 API Endpoints

### Contacts
- `GET /api/v1/contacts` - List all contacts
- `GET /api/v1/contacts/{id}` - Get contact by ID
- `GET /api/v1/contacts/search?query=` - Search contacts
- `POST /api/v1/contacts` - Create new contact
- `PUT /api/v1/contacts/{id}` - Update contact
- `DELETE /api/v1/contacts/{id}` - Delete contact

### Leads
- `GET /api/v1/leads` - List all leads
- `GET /api/v1/leads/{id}` - Get lead by ID
- `GET /api/v1/leads/status/{status}` - Get leads by status
- `POST /api/v1/leads` - Create new lead
- `PUT /api/v1/leads/{id}` - Update lead
- `DELETE /api/v1/leads/{id}` - Delete lead

### Opportunities
- `GET /api/v1/opportunities` - List all opportunities
- `GET /api/v1/opportunities/{id}` - Get opportunity by ID
- `GET /api/v1/opportunities/stage/{stage}` - Get opportunities by stage
- `POST /api/v1/opportunities` - Create new opportunity
- `PUT /api/v1/opportunities/{id}` - Update opportunity
- `DELETE /api/v1/opportunities/{id}` - Delete opportunity

### Accounts
- `GET /api/v1/accounts` - List all accounts
- `GET /api/v1/accounts/{id}` - Get account by ID
- `POST /api/v1/accounts` - Create new account
- `PUT /api/v1/accounts/{id}` - Update account
- `DELETE /api/v1/accounts/{id}` - Delete account

### Tasks
- `GET /api/v1/tasks` - List all tasks
- `GET /api/v1/tasks/{id}` - Get task by ID
- `GET /api/v1/tasks/status/{status}` - Get tasks by status
- `POST /api/v1/tasks` - Create new task
- `PUT /api/v1/tasks/{id}` - Update task
- `DELETE /api/v1/tasks/{id}` - Delete task

### Calendar Events
- `GET /api/v1/calendar` - List all events
- `GET /api/v1/calendar/{id}` - Get event by ID
- `POST /api/v1/calendar` - Create new event
- `PUT /api/v1/calendar/{id}` - Update event
- `DELETE /api/v1/calendar/{id}` - Delete event

### Email Campaigns
- `GET /api/v1/email-campaigns` - List all campaigns
- `GET /api/v1/email-campaigns/{id}` - Get campaign by ID
- `POST /api/v1/email-campaigns` - Create new campaign
- `PUT /api/v1/email-campaigns/{id}` - Update campaign
- `DELETE /api/v1/email-campaigns/{id}` - Delete campaign

### Reports
- `GET /api/v1/reports` - List all reports
- `GET /api/v1/reports/{id}` - Get report by ID
- `POST /api/v1/reports` - Create new report
- `PUT /api/v1/reports/{id}` - Update report
- `DELETE /api/v1/reports/{id}` - Delete report

### Dashboard
- `GET /api/v1/dashboard/stats` - Get dashboard statistics
- `GET /api/v1/dashboard/revenue` - Get revenue metrics

## 🏗️ Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── contacts.py
│   │       │   ├── leads.py
│   │       │   ├── opportunities.py
│   │       │   ├── accounts.py
│   │       │   ├── tasks.py
│   │       │   ├── calendar.py
│   │       │   ├── email_campaigns.py
│   │       │   ├── reports.py
│   │       │   └── dashboard.py
│   │       └── __init__.py
│   ├── core/
│   │   ├── config.py
│   │   └── database.py
│   ├── crud/
│   │   ├── contacts.py
│   │   ├── leads.py
│   │   ├── opportunities.py
│   │   ├── accounts.py
│   │   ├── tasks.py
│   │   ├── calendar_events.py
│   │   ├── email_campaigns.py
│   │   └── reports.py
│   ├── models/
│   │   └── models.py
│   └── schemas/
│       └── schemas.py
├── static/
│   ├── assets/
│   └── index.html
├── main.py
├── init_db.py
├── seed_data.py
├── generate_excel_data.py
├── setup.sh
├── start.sh
├── setup_local_dev.sh
├── setup_oauth_connection.sh
├── requirements.txt
├── .env.example
├── Dockerfile
├── app.yaml
└── README.md
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/crm_db` |
| `APP_NAME` | Application name | `CRM Dashboard API` |
| `DEBUG` | Debug mode | `True` |
| `SECRET_KEY` | Secret key for security | Change in production |
| `CORS_ORIGINS` | Allowed CORS origins | `["http://localhost:5173"]` |

## 🧪 Testing the API

### Using cURL

```bash
# Get all contacts
curl http://localhost:8000/api/v1/contacts

# Create a new contact
curl -X POST http://localhost:8000/api/v1/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "company": "Example Corp"
  }'
```

### Using Python

```python
import requests

# Get dashboard stats
response = requests.get("http://localhost:8000/api/v1/dashboard/stats")
print(response.json())
```

## 🗄️ Database Schema

The application uses the following main tables:

- **contacts** - Customer contact information
- **leads** - Potential customer leads
- **opportunities** - Sales opportunities
- **accounts** - Business accounts
- **tasks** - Task management
- **calendar_events** - Calendar events and meetings
- **email_campaigns** - Email marketing campaigns
- **reports** - Saved reports and analytics

## 🔐 Security Considerations

For production deployment:

1. Change `SECRET_KEY` to a strong random value
2. Set `DEBUG=False`
3. Use environment-specific `.env` files
4. Enable HTTPS
5. Configure proper CORS origins
6. Use strong database passwords
7. Implement authentication and authorization

## � Troubleshooting

### Common Issues

#### Port 8000 Already in Use
```bash
# Kill existing processes
lsof -ti:8000 | xargs kill -9

# Or find and kill manually
lsof -ti:8000
kill -9 <PID>
```

#### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection
psql -h localhost -U crm_user -d crm_db
```

#### Virtual Environment Issues
```bash
# Remove and recreate venv
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### Module Import Errors
```bash
# Ensure you're in the backend directory
cd backend

# Install in development mode
pip install -e .
```

#### Permission Issues with Scripts
```bash
# Make scripts executable
chmod +x setup.sh start.sh
```

### Health Check
```bash
# Check if API is running
curl http://localhost:8000/health

# Check API docs
curl http://localhost:8000/docs
```

### Logs and Debugging
```bash
# Run with verbose logging
uvicorn main:app --reload --log-level debug

# Check database tables
python -c "from app.core.database import engine; from app.models.models import Base; print(Base.metadata.create_all(engine))"
```

## �🚢 Deployment

### Using Docker (Optional)

Create a `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:

```bash
docker build -t crm-api .
docker run -p 8000:8000 crm-api
```

## 📝 License

This project is part of the CRM Dashboard application.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📧 Support

For support, please contact the development team.
