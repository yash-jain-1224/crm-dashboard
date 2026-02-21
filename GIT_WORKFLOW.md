# Git Workflow & Branch Structure

## Repository Structure

This repository follows an environment-based branch structure to separate frontend and backend deployments across different environments.

## Branch Naming Convention

```
{environment}/{service}
```

- **environment**: `dev`, `test`, `uat`, `prod`
- **service**: `frontend`, `backend`

## Branches

### Backend Branches (Python FastAPI)
- `dev/backend` - Development environment
- `test/backend` - Testing environment  
- `uat/backend` - User Acceptance Testing environment
- `prod/backend` - Production environment

### Frontend Branches (React)
- `dev/frontend` - Development environment
- `test/frontend` - Testing environment
- `uat/frontend` - User Acceptance Testing environment
- `prod/frontend` - Production environment

### Main Branch
- `main` - Contains the complete codebase (both frontend and backend)

## Deployment Workflow

### Initial Setup
✅ **Complete**: All branches created and pushed to remote repository

### Development Workflow
1. **Feature Development**: Create feature branches from appropriate environment branches
   ```bash
   git checkout dev/backend
   git checkout -b feature/new-api-endpoint
   ```

2. **Testing & Review**: Test changes in dev environment
3. **Promotion**: Merge to higher environments through pull requests
   ```bash
   # Promote from dev to test
   git checkout test/backend
   git merge dev/backend
   git push origin test/backend
   ```

### Environment Promotion Path
```
dev → test → uat → prod
```

## Deployment Commands

### Backend Deployment
```bash
# Development
git checkout dev/backend
git pull origin dev/backend
# Deploy backend code to dev environment

# Production  
git checkout prod/backend
git pull origin prod/backend
# Deploy backend code to production
```

### Frontend Deployment
```bash
# Development
git checkout dev/frontend
git pull origin dev/frontend
# Deploy frontend code to dev environment

# Production
git checkout prod/frontend  
git pull origin prod/frontend
# Deploy frontend code to production
```

## Code Separation

### Backend Structure
- **Technology**: Python FastAPI
- **Database**: PostgreSQL
- **Location**: `/backend/` directory
- **Entry Point**: `backend/main.py`

### Frontend Structure  
- **Technology**: React + Vite
- **Styling**: CSS Components
- **Location**: `/frontend/` directory
- **Entry Point**: `frontend/src/main.jsx`

## CI/CD Pipeline Recommendations

### Backend Pipeline
1. **Build**: Install dependencies, run tests
2. **Test**: Unit tests, integration tests, API tests
3. **Security**: Vulnerability scanning
4. **Deploy**: Deploy to appropriate environment

### Frontend Pipeline
1. **Build**: `npm install && npm run build`
2. **Test**: Unit tests, component tests, E2E tests
3. **Security**: Dependency scanning
4. **Deploy**: Deploy static assets to hosting

## Environment Configuration

### Backend Environment Variables
- `DATABASE_URL` - PostgreSQL connection
- `DATABRICKS_HOST` - Databricks workspace
- `DATABRICKS_USER` - Databricks username
- `DATABRICKS_PASSWORD` - Databricks password
- `USE_OAUTH` - OAuth authentication flag

### Frontend Environment Variables
- `VITE_API_BASE_URL` - Backend API endpoint
- `VITE_ENVIRONMENT` - Environment identifier

## Best Practices

1. **Always pull latest changes** before starting work
2. **Create descriptive commit messages** with environment/service context
3. **Use pull requests** for environment promotions
4. **Test thoroughly** in each environment before promotion
5. **Keep branches synchronized** with main for latest features
6. **Separate concerns** - frontend changes only in frontend branches, backend changes only in backend branches

## Quick Start

### Clone and Setup
```bash
git clone https://github.com/yash-jain-1224/crm-dashboard.git
cd crm-dashboard

# Backend Development
git checkout dev/backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py

# Frontend Development  
git checkout dev/frontend
cd frontend
npm install
npm run dev
```

## Repository Status

- ✅ Git repository initialized
- ✅ Remote origin configured
- ✅ Main branch populated with complete codebase
- ✅ All environment branches created and pushed
- ✅ Branch structure ready for deployment
