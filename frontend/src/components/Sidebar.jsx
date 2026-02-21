import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  TrendingUp, 
  Building2,
  CheckSquare,
  Calendar,
  BarChart3,
  GitBranch,
  Mail,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { userApi } from '../services'
import './Sidebar.css'

const Sidebar = ({ collapsed, setCollapsed }) => {
  const [user, setUser] = useState({
    name: 'User',
    role: 'Administrator',
    avatar_initials: 'U'
  })

  useEffect(() => {
    // Fetch current user data
    const fetchUser = async () => {
      try {
        const userData = await userApi.getCurrentUser()
        setUser(userData)
      } catch (error) {
        console.error('Error fetching user data:', error)
        // Keep default values on error
      }
    }
    
    fetchUser()
  }, [])

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/contacts', icon: Users, label: 'Contacts' },
    { path: '/leads', icon: UserPlus, label: 'Leads' },
    { path: '/opportunities', icon: TrendingUp, label: 'Opportunities' },
    { path: '/accounts', icon: Building2, label: 'Accounts' },
    { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' },
    { path: '/pipeline', icon: GitBranch, label: 'Sales Pipeline' },
    { path: '/email-campaigns', icon: Mail, label: 'Email Campaigns' },
    { path: '/reports', icon: BarChart3, label: 'Reports & Analytics' },
  ]

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <h1 className="sidebar-title">CRM Dashboard</h1>}
        <button 
          className="collapse-btn" 
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={collapsed ? item.label : ''}
          >
            <item.icon size={20} className="nav-icon" />
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      
      {!collapsed && (
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user.avatar_initials}</div>
            <div className="user-details">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar
