import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, Upload, X, Edit2, Trash2, Filter, RotateCcw } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Loader from '../components/Loader'
import { CalendarSkeleton } from '../components/SkeletonLoader'
import ExcelUploadModal from '../components/ExcelUploadModal'
import Pagination from '../components/Pagination'
import { calendarApi } from '../services'
import './Calendar.css'
import '../components/ErrorState.css'

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date()) // Set to today by default
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [deletingEventId, setDeletingEventId] = useState(null)
  const [eventToDelete, setEventToDelete] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTimeout, setSearchTimeout] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    event_type: '',
    status: '',
    start_date: '',
    end_date: ''
  })
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'Meeting',
    start_time: '',
    end_time: '',
    location: '',
    attendees: '',
    status: 'Scheduled'
  })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [currentPage, pageSize, searchQuery, selectedDate, filters])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  const fetchEvents = async () => {
    try {
      // Only show full loader on initial load (when there are no events yet)
      if (events.length === 0 && !searchQuery && !selectedDate) {
        setLoading(true)
      } else {
        // Show searching loader in the events card for all other cases
        setSearching(true)
      }
      
      setError(null)
      const params = { page: currentPage, page_size: pageSize }
      
      if (searchQuery) {
        params.search = searchQuery
      }
      
      // Add filter parameters
      if (filters.event_type) {
        params.event_type = filters.event_type
      }
      if (filters.status) {
        params.status = filters.status
      }
      
      // Date filtering logic - prioritize selectedDate over filter dates
      if (selectedDate) {
        const year = selectedDate.getFullYear()
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
        const day = String(selectedDate.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        params.start_date = dateStr
        params.end_date = dateStr
      } else {
        // Use filter date range if no specific date is selected
        if (filters.start_date) {
          params.start_date = filters.start_date
        }
        if (filters.end_date) {
          params.end_date = filters.end_date
        }
      }

      const response = await calendarApi.getAll(params)
      setEvents(response.items || [])
      setTotalPages(response.total_pages || 0)
      setTotalItems(response.total || 0)
    } catch (err) {
      console.error('Error fetching calendar events:', err)
      setError('Failed to load events. Please try again.')
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
  }

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchInput(value)
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    
    // Set new timeout for debounced search (500ms after user stops typing)
    const timeout = setTimeout(() => {
      setSearchQuery(value)
      if (currentPage !== 1) {
        setCurrentPage(1)
      }
    }, 500)
    
    setSearchTimeout(timeout)
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    
    // Clear timeout if exists
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    
    // Trigger search immediately
    setSearchQuery(searchInput)
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
    
    // Clear timeout if exists
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFilters(prev => ({
      ...prev,
      [name]: value
    }))
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }

  const handleClearFilters = () => {
    setFilters({
      event_type: '',
      status: '',
      start_date: '',
      end_date: ''
    })
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }

  const hasActiveFilters = () => {
    return filters.event_type || filters.status || filters.start_date || filters.end_date
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.title.trim()) errors.title = 'Title is required'
    if (!formData.start_time.trim()) errors.start_time = 'Start time is required'
    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      setSubmitting(true)
      if (editingEvent) {
        await calendarApi.update(editingEvent.id, formData)
      } else {
        await calendarApi.create(formData)
      }
      await fetchEvents() // Refresh the events list
      setShowModal(false)
      setEditingEvent(null)
      resetForm()
    } catch (err) {
      console.error('Error saving calendar event:', err)
      setFormErrors({ submit: err.message || 'Failed to save event. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      event_type: 'Meeting',
      start_time: '',
      end_time: '',
      location: '',
      attendees: '',
      status: 'Scheduled'
    })
    setFormErrors({})
  }

  const openModal = () => {
    resetForm()
    setEditingEvent(null)
    setShowModal(true)
  }

  const openEditModal = (event) => {
    setEditingEvent(event)
    setFormData({
      title: event.title || '',
      description: event.description || '',
      event_type: event.event_type || 'Meeting',
      start_time: event.start_time ? event.start_time.slice(0, 16) : '',
      end_time: event.end_time ? event.end_time.slice(0, 16) : '',
      location: event.location || '',
      attendees: event.attendees || '',
      status: event.status || 'Scheduled'
    })
    setFormErrors({})
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingEvent(null)
    resetForm()
  }

  const openDeleteModal = (event) => {
    setEventToDelete(event)
    setShowDeleteModal(true)
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
    setEventToDelete(null)
  }

  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return

    try {
      setSubmitting(true)
      await calendarApi.delete(eventToDelete.id)
      await fetchEvents() // Refresh the events list
      setShowDeleteModal(false)
      setEventToDelete(null)
    } catch (err) {
      console.error('Error deleting calendar event:', err)
      // Keep modal open to show error or retry
      alert('Failed to delete event. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExcelUpload = async (file, asyncMode = false) => {
    try {
      const result = await calendarApi.bulkUpload(file, asyncMode)
      
      // Only refresh immediately for synchronous uploads
      if (!result.async) {
        await fetchEvents()
      }
      
      return result
    } catch (err) {
      console.error('Error uploading Excel file:', err)
      throw err
    }
  }

  const handleGetUploadProgress = async (taskId) => {
    try {
      const progress = await calendarApi.getUploadProgress(taskId)
      
      // Refresh events list when upload completes
      if (progress.status === 'completed') {
        await fetchEvents()
      }
      
      return progress
    } catch (err) {
      console.error('Error getting upload progress:', err)
      throw err
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await calendarApi.downloadTemplate()
    } catch (err) {
      console.error('Error downloading template:', err)
      throw err
    }
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    return { daysInMonth, startingDayOfWeek }
  }

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate)
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const handleDateClick = (day) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    setSelectedDate(clickedDate)
    // Reset to page 1 when selecting a new date
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }

  const handleViewAll = () => {
    setSelectedDate(null)
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }

  const handleViewToday = () => {
    const today = new Date()
    setSelectedDate(today)
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1))
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }

  const typeColors = {
    'Meeting': '#3b82f6',
    'Call': '#10b981',
    'Task': '#f59e0b',
    'Event': '#8b5cf6'
  }

  return (
    <div className="calendar-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Schedule and manage your meetings and activities</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button 
            icon={<Upload size={18} />} 
            onClick={() => setShowExcelModal(true)}
            variant="outline"
          >
            Upload Excel
          </Button>
          <Button icon={<Plus size={18} />} onClick={openModal}>
            Add Events
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', maxWidth: '600px' }}>
          <input 
            type="text" 
            placeholder="Search events..." 
            className="search-input-compact"
            value={searchInput}
            onChange={handleSearchChange}
            style={{ flex: 1 }}
          />
          {searchInput && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClearSearch}
              style={{ padding: '0 12px' }}
            >
              <X size={18} />
            </Button>
          )}
          <Button type="submit" variant="outline" disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            icon={<Filter size={18} />}
            style={{ 
              background: hasActiveFilters() ? 'var(--primary-color)' : 'transparent',
              color: hasActiveFilters() ? 'white' : 'var(--text-primary)',
              borderColor: hasActiveFilters() ? 'var(--primary-color)' : 'var(--border-color)'
            }}
          >
            Filters {hasActiveFilters() && `(${Object.values(filters).filter(v => v).length})`}
          </Button>
        </form>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Filter Events</h3>
            {hasActiveFilters() && (
              <Button 
                variant="outline" 
                onClick={handleClearFilters}
                icon={<RotateCcw size={16} />}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                Clear All
              </Button>
            )}
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px' 
          }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="filter-event-type" style={{ fontSize: '13px', marginBottom: '6px', display: 'block' }}>Event Type</label>
              <select
                id="filter-event-type"
                name="event_type"
                value={filters.event_type}
                onChange={handleFilterChange}
                style={{ width: '100%' }}
              >
                <option value="">All Types</option>
                <option value="Meeting">Meeting</option>
                <option value="Call">Call</option>
                <option value="Demo">Demo</option>
                <option value="Conference">Conference</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="filter-status" style={{ fontSize: '13px', marginBottom: '6px', display: 'block' }}>Status</label>
              <select
                id="filter-status"
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                style={{ width: '100%' }}
              >
                <option value="">All Statuses</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Rescheduled">Rescheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="filter-start-date" style={{ fontSize: '13px', marginBottom: '6px', display: 'block' }}>From Date</label>
              <input
                type="date"
                id="filter-start-date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="filter-end-date" style={{ fontSize: '13px', marginBottom: '6px', display: 'block' }}>To Date</label>
              <input
                type="date"
                id="filter-end-date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <CalendarSkeleton />
      ) : error ? (
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchEvents} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      ) : (
        <div className="calendar-layout">
        <Card title="Calendar View" className="calendar-card">
          <div className="calendar-controls">
            <button className="nav-btn" onClick={previousMonth}>
              <ChevronLeft size={20} />
            </button>
            <h2 className="calendar-month">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button className="nav-btn" onClick={nextMonth}>
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="calendar-grid">
            {dayNames.map(day => (
              <div key={day} className="calendar-day-header">{day}</div>
            ))}
            
            {[...Array(startingDayOfWeek)].map((_, i) => (
              <div key={`empty-${i}`} className="calendar-day empty" />
            ))}
            
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1
              const isToday = day === new Date().getDate() && 
                            currentDate.getMonth() === new Date().getMonth() &&
                            currentDate.getFullYear() === new Date().getFullYear()
              
              const isSelected = selectedDate &&
                              day === selectedDate.getDate() &&
                              currentDate.getMonth() === selectedDate.getMonth() &&
                              currentDate.getFullYear() === selectedDate.getFullYear()
              
              return (
                <div 
                  key={day} 
                  className={`calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleDateClick(day)}
                >
                  <span className="day-number">{day}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card 
          title={selectedDate 
            ? `Events on ${selectedDate.getDate().toString().padStart(2, '0')}/${(selectedDate.getMonth() + 1).toString().padStart(2, '0')}/${selectedDate.getFullYear()}`
            : "All Upcoming Events"
          }
          action={
            <button 
              onClick={selectedDate ? handleViewAll : handleViewToday}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                background: selectedDate ? 'var(--background)' : 'var(--primary-color)',
                border: selectedDate ? '1px solid var(--border-color)' : '1px solid var(--primary-color)',
                borderRadius: '6px',
                cursor: 'pointer',
                color: selectedDate ? 'var(--text-secondary)' : 'white',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (selectedDate) {
                  e.target.style.background = 'var(--surface)'
                  e.target.style.color = 'var(--primary-color)'
                } else {
                  e.target.style.background = '#2563eb'
                }
              }}
              onMouseLeave={(e) => {
                if (selectedDate) {
                  e.target.style.background = 'var(--background)'
                  e.target.style.color = 'var(--text-secondary)'
                } else {
                  e.target.style.background = 'var(--primary-color)'
                }
              }}
            >
              {selectedDate ? 'View All' : 'Today'}
            </button>
          }
          className="events-card"
        >
          {searching ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <Loader />
              <div style={{ marginTop: '8px' }}>Searching...</div>
            </div>
          ) : events.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
              {searchQuery 
                ? 'No events found matching your search.' 
                : selectedDate 
                  ? 'No events scheduled for this date.' 
                  : 'No upcoming events'
              }
            </div>
          ) : (
            <div className="events-list">
              {events.map(event => (
                <div key={event.id} className="event-item">
                  <div 
                    className="event-indicator"
                    style={{ background: typeColors[event.event_type || event.type] || '#8b5cf6' }}
                  />
                  <div className="event-details">
                    <h4 className="event-title">{event.title || event.subject}</h4>
                    <div className="event-meta">
                      <span className="event-date">
                        {event.start_time ? (() => {
                          const date = new Date(event.start_time);
                          return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
                        })() : 'N/A'}
                      </span>
                      <span className="event-time">
                        {event.start_time ? (() => {
                          const date = new Date(event.start_time);
                          return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        })() : 'All day'}
                      </span>
                      <span 
                        className="event-type"
                        style={{ 
                          background: `${typeColors[event.event_type || event.type] || '#8b5cf6'}20`,
                          color: typeColors[event.event_type || event.type] || '#8b5cf6'
                        }}
                      >
                        {event.event_type || event.type || 'Event'}
                      </span>
                    </div>
                    {event.description && (
                      <p className="event-description">{event.description}</p>
                    )}
                    {event.location && (
                      <p className="event-location">📍 {event.location}</p>
                    )}
                  </div>

                  {/* Icon-only Edit and Delete buttons */}
                  <div className="event-actions">
                    <button
                      onClick={() => openEditModal(event)}
                      className="event-action-btn edit-btn"
                      title="Edit event"
                      aria-label="Edit event"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => openDeleteModal(event)}
                      className="event-action-btn delete-btn"
                      title="Delete event"
                      aria-label="Delete event"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      )}

      {!loading && !error && !searching && totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          total={totalItems}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* Add/Edit Calendar Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEvent ? 'Edit Calendar Event' : 'Add New Calendar Event'}</h2>
              <button className="modal-close" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label htmlFor="title">Title <span className="required">*</span></label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={formErrors.title ? 'error' : ''}
                    placeholder="Enter event title"
                  />
                  {formErrors.title && <span className="error-text">{formErrors.title}</span>}
                </div>

                <div className="form-group full-width">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter event description"
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="event_type">Event Type</label>
                  <select
                    id="event_type"
                    name="event_type"
                    value={formData.event_type}
                    onChange={handleInputChange}
                  >
                    <option value="Meeting">Meeting</option>
                    <option value="Call">Call</option>
                    <option value="Task">Task</option>
                    <option value="Event">Event</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="start_time">Start Time <span className="required">*</span></label>
                  <input
                    type="datetime-local"
                    id="start_time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleInputChange}
                    className={formErrors.start_time ? 'error' : ''}
                  />
                  {formErrors.start_time && <span className="error-text">{formErrors.start_time}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="end_time">End Time</label>
                  <input
                    type="datetime-local"
                    id="end_time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location">Location</label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="Enter location or meeting link"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="attendees">Attendees</label>
                  <input
                    type="text"
                    id="attendees"
                    name="attendees"
                    value={formData.attendees}
                    onChange={handleInputChange}
                    placeholder="Comma-separated emails or names"
                  />
                </div>
              </div>

              {formErrors.submit && (
                <div className="error-message">{formErrors.submit}</div>
              )}

              <div className="modal-actions">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (editingEvent ? 'Updating...' : 'Creating...') : (editingEvent ? 'Update Event' : 'Create Event')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      <ExcelUploadModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onUpload={handleExcelUpload}
        onDownloadTemplate={handleDownloadTemplate}
        onGetProgress={handleGetUploadProgress}
        title="Upload Calendar Events from Excel"
        entityName="calendar events"
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Event</h2>
              <button className="modal-close" onClick={handleDeleteCancel}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this event?</p>
              <p style={{ fontWeight: 600, marginTop: '12px' }}>
                {eventToDelete?.title}
              </p>
              {eventToDelete?.start_time && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                  {(() => {
                    const date = new Date(eventToDelete.start_time);
                    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
                  })()}
                </p>
              )}
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '12px' }}>
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="outline" onClick={handleDeleteCancel}>
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleDeleteConfirm}
                disabled={submitting}
                style={{ background: '#ef4444', borderColor: '#ef4444' }}
              >
                {submitting ? 'Deleting...' : 'Delete Event'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Calendar
