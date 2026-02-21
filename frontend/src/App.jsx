import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Contacts from './pages/Contacts'
import Leads from './pages/Leads'
import Opportunities from './pages/Opportunities'
import Accounts from './pages/Accounts'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import Reports from './pages/Reports'
import Pipeline from './pages/Pipeline'
import EmailCampaigns from './pages/EmailCampaigns'
import './App.css'

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <ToastProvider>
      <Router>
        <div className="app">
          <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
          <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Header />
            <div className="page-content">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/opportunities" element={<Opportunities />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/email-campaigns" element={<EmailCampaigns />} />
              </Routes>
            </div>
          </div>
        </div>
      </Router>
    </ToastProvider>
  )
}

export default App
