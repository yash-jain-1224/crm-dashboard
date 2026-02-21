import React, { useState } from 'react'
import { Search, Bell, Settings, HelpCircle } from 'lucide-react'
import './Header.css'

const Header = () => {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <header className="header">
      <div className="header-search">
        <Search size={18} className="search-icon" />
        <input
          type="text"
          placeholder="Search contacts, leads, opportunities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>
      
      <div className="header-actions">
        <button className="icon-btn" title="Help">
          <HelpCircle size={20} />
        </button>
        <button className="icon-btn notification-btn" title="Notifications">
          <Bell size={20} />
          <span className="notification-badge">3</span>
        </button>
        <button className="icon-btn" title="Settings">
          <Settings size={20} />
        </button>
      </div>
    </header>
  )
}

export default Header
