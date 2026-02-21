# CRM Dashboard Frontend

React-based frontend for the CRM Dashboard application with Vite build tool.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Backend API running (see [../backend/README.md](../backend/README.md))

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your backend API URL:
   ```env
   VITE_API_URL=http://localhost:8000/api/v1
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   Navigate to http://localhost:5173

## 📦 Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload

# Production
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
```

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Header.jsx
│   │   └── Sidebar.jsx
│   ├── pages/           # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Contacts.jsx
│   │   ├── Leads.jsx
│   │   ├── Opportunities.jsx
│   │   ├── Accounts.jsx
│   │   ├── Tasks.jsx
│   │   ├── Calendar.jsx
│   │   ├── Pipeline.jsx
│   │   ├── EmailCampaigns.jsx
│   │   └── Reports.jsx
│   ├── services/        # API integration
│   │   ├── api.js       # API client
│   │   └── index.js     # API services
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── index.html
├── package.json
├── vite.config.js
├── .env.example
└── README.md
```

## 🔌 API Integration

The frontend integrates with the FastAPI backend through service modules:

### Example Usage

```javascript
import { contactsApi, leadsApi, dashboardApi } from './services'

// Fetch contacts
const contacts = await contactsApi.getAll()

// Create a new lead
const newLead = await leadsApi.create({
  name: 'John Doe',
  company: 'Acme Corp',
  email: 'john@acme.com',
  status: 'New',
  score: 75
})

// Get dashboard stats
const stats = await dashboardApi.getStats()
```

### Available Services

- **contactsApi** - Contact management
- **leadsApi** - Lead tracking
- **opportunitiesApi** - Opportunities management
- **accountsApi** - Account management
- **tasksApi** - Task management
- **calendarApi** - Calendar events
- **emailCampaignsApi** - Email campaigns
- **reportsApi** - Reports
- **dashboardApi** - Dashboard statistics

## 🎨 Features

### Implemented
✅ Dashboard with real-time statistics
✅ Contact management with backend integration
✅ Lead tracking and scoring
✅ Opportunity pipeline
✅ Account management
✅ Task management
✅ Calendar events
✅ Email campaign tracking
✅ Reports and analytics
✅ Responsive design
✅ Modern UI with Lucide icons

### API Integration Status
✅ Dashboard - Connected to backend
✅ Contacts - Full CRUD with backend
✅ Leads - Full CRUD with backend
⏳ Opportunities - Ready for integration
⏳ Accounts - Ready for integration
⏳ Tasks - Ready for integration
⏳ Calendar - Ready for integration
⏳ Email Campaigns - Ready for integration
⏳ Reports - Ready for integration

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the frontend directory:

```env
# Backend API URL
VITE_API_URL=http://localhost:8000/api/v1

# App Configuration
VITE_APP_NAME=CRM Dashboard
VITE_APP_VERSION=1.0.0
```

### API Client Configuration

The API client is configured in `src/services/api.js` and includes:
- Automatic JSON serialization
- Error handling
- Request/response interceptors
- Base URL configuration from environment variables

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

The build artifacts will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

### Deploy to Databricks Apps

See the main README.md for Databricks deployment instructions.

## 🧪 Development Tips

### Hot Module Replacement (HMR)
Vite provides fast HMR during development. Changes are reflected instantly.

### API Endpoint Testing
Use the browser's Network tab to monitor API calls, or use the backend's Swagger UI at http://localhost:8000/docs

### Error Handling
All API calls include try-catch blocks with user-friendly error messages.

## 🐛 Troubleshooting

### Backend Connection Issues
```bash
# Check if backend is running
curl http://localhost:8000/health

# Verify API URL in .env
cat .env
```

### CORS Errors
Ensure the backend CORS configuration includes your frontend URL:
```python
# backend/app/core/config.py
CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]
```

### Port Already in Use
```bash
# Run on different port
npm run dev -- --port 3000
```

## 📚 Technologies

- **React 18** - UI library
- **Vite 5** - Build tool and dev server
- **React Router 6** - Client-side routing
- **Recharts 2** - Charts and visualizations
- **Lucide React** - Icon library
- **CSS3** - Styling with custom properties

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test with the backend
4. Submit a pull request

## 📞 Support

- Check the main [README.md](../README.md)
- Review backend API docs at http://localhost:8000/docs
- See backend setup guide at [../backend/QUICKSTART.md](../backend/QUICKSTART.md)
