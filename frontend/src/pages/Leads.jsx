import React, { useState, useEffect } from 'react'
import { Plus, TrendingUp, Filter, Star, X, Upload, Users, Building2, Mail, Target, Award, Edit, Trash2, DollarSign } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Loader from '../components/Loader'
import { CardListSkeleton } from '../components/SkeletonLoader'
import ExcelUploadModal from '../components/ExcelUploadModal'
import ConfirmationModal from '../components/ConfirmationModal'
import MUIFilterPanel from '../components/MUIFilterPanel'
import Pagination from '../components/Pagination'
import { useToast } from '../components/Toast'
import AnimatedCounter from '../components/AnimatedCounter'
import { leadsApi } from '../services'
import './Leads.css'
import '../components/ErrorState.css'

// Utility function to format numbers in K, M, B notation
const formatNumber = (num) => {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B'
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return num.toString()
}

const Leads = () => {
  const toast = useToast()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [filters, setFilters] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTimeout, setSearchTimeout] = useState(null)
  const [editingLead, setEditingLead] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    source: '',
    status: 'New',
    score: 0,
    value: '',
    assigned_to: ''
  })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState({
    total_leads: 0,
    qualified_leads: 0,
    avg_score: 0,
    total_value: 0
  })

  useEffect(() => {
    fetchLeads()
    fetchSummary()
  }, [currentPage, pageSize, searchQuery, filters])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  const fetchLeads = async () => {
    try {
      // Only show full loader on initial load
      if (leads.length === 0 && !searchQuery) {
        setLoading(true)
      } else {
        setSearching(true)
      }
      
      const params = { page: currentPage, page_size: pageSize }
      if (searchQuery) {
        params.search = searchQuery
      }
      
      // Apply filters - join array values with commas
      if (filters.status && filters.status.length > 0) {
        params.status = filters.status.join(',')
      }
      if (filters.source && filters.source.length > 0) {
        params.source = filters.source.join(',')
      }
      if (filters.assigned_to && filters.assigned_to.length > 0) {
        params.assigned_to = filters.assigned_to.join(',')
      }
      if (filters.score?.min) {
        params.score_min = filters.score.min
      }
      if (filters.score?.max) {
        params.score_max = filters.score.max
      }
      
      const response = await leadsApi.getAll(params)
      setLeads(response.items || [])
      setTotalPages(response.total_pages || 0)
      setTotalItems(response.total || 0)
      setError(null)
    } catch (err) {
      console.error('Error fetching leads:', err)
      setError('Failed to load leads. Please try again.')
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }

  const fetchSummary = async () => {
    try {
      const summaryData = await leadsApi.getSummary()
      setSummary(summaryData)
    } catch (err) {
      console.error('Error fetching summary:', err)
      // Don't show error for summary, just use default values
    }
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

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
  }

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    setCurrentPage(1) // Reset to first page when changing page size
  }

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981'
    if (score >= 60) return '#f59e0b'
    return '#ef4444'
  }

  const getStatusColor = (status) => {
    const colors = {
      'New': '#3b82f6',
      'Contacted': '#8b5cf6',
      'Qualified': '#10b981',
      'Nurturing': '#f59e0b'
    }
    return colors[status] || '#64748b'
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
    if (!formData.name.trim()) errors.name = 'Name is required'
    if (!formData.company.trim()) errors.company = 'Company is required'
    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid'
    }
    if (formData.score < 0 || formData.score > 100) {
      errors.score = 'Score must be between 0 and 100'
    }
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
      await leadsApi.create(formData)
      await fetchLeads() // Refresh the leads list
      await fetchSummary() // Refresh summary stats
      setShowModal(false)
      resetForm()
      toast.success('Lead created successfully!')
    } catch (err) {
      console.error('Error creating lead:', err)
      toast.error(err.message || 'Failed to create lead')
      setFormErrors({ submit: err.message || 'Failed to create lead. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      source: '',
      status: 'New',
      score: 0,
      value: '',
      assigned_to: ''
    })
    setFormErrors({})
  }

  const openModal = () => {
    resetForm()
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    resetForm()
  }

  const handleExcelUpload = async (file, asyncMode = false) => {
    try {
      const result = await leadsApi.bulkUpload(file, asyncMode)
      
      // Only refresh immediately for synchronous uploads
      if (!result.async) {
        await fetchLeads()
        await fetchSummary() // Refresh summary stats
      }
      
      return result
    } catch (err) {
      console.error('Error uploading Excel file:', err)
      throw err
    }
  }

  const handleGetUploadProgress = async (taskId) => {
    try {
      const progress = await leadsApi.getUploadProgress(taskId)
      
      // Refresh leads list when upload completes
      if (progress.status === 'completed') {
        await fetchLeads()
        await fetchSummary() // Refresh summary stats
      }
      
      return progress
    } catch (err) {
      console.error('Error getting upload progress:', err)
      throw err
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await leadsApi.downloadTemplate()
    } catch (err) {
      console.error('Error downloading template:', err)
      throw err
    }
  }

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters)
    setCurrentPage(1) // Reset to first page when filters change
  }

  const handleEditLead = (lead) => {
    setEditingLead(lead.id)
    setEditFormData({
      name: lead.name || '',
      company: lead.company || '',
      email: lead.email || '',
      phone: lead.phone || '',
      source: lead.source || '',
      status: lead.status || 'New',
      score: lead.score || 0,
      value: lead.value || '',
      assigned_to: lead.assigned_to || ''
    })
  }

  const handleCancelEdit = () => {
    setEditingLead(null)
    setEditFormData({})
  }

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveLead = async (leadId) => {
    // Validate required fields
    if (!editFormData.name || !editFormData.name.trim()) {
      alert('Name is required')
      return
    }
    
    if (!editFormData.email || !editFormData.email.trim()) {
      alert('Email is required')
      return
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(editFormData.email)) {
      alert('Please enter a valid email address')
      return
    }

    // Validate score
    const score = parseInt(editFormData.score)
    if (isNaN(score) || score < 0 || score > 100) {
      alert('Score must be between 0 and 100')
      return
    }
    
    setSaving(true)
    try {
      const updatedLead = await leadsApi.update(leadId, editFormData)
      
      // Update the leads list with the updated lead
      setLeads(leads.map(l => 
        l.id === leadId ? { ...l, ...updatedLead } : l
      ))
      
      await fetchSummary() // Refresh summary stats
      setEditingLead(null)
      setEditFormData({})
      toast.success('Lead updated successfully!')
    } catch (err) {
      console.error('Error updating lead:', err)
      toast.error(err.message || 'Failed to update lead')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLead = async (id) => {
    const lead = leads.find(l => l.id === id)
    setLeadToDelete(lead)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteLead = async () => {
    if (!leadToDelete) return

    setDeleting(true)
    try {
      await leadsApi.delete(leadToDelete.id)
      setLeads(leads.filter(l => l.id !== leadToDelete.id))
      setTotalItems(prev => prev - 1)
      await fetchSummary() // Refresh summary stats
      setShowDeleteConfirm(false)
      setLeadToDelete(null)
      toast.success('Lead deleted successfully!')
    } catch (err) {
      console.error('Error deleting lead:', err)
      toast.error('Failed to delete lead. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const cancelDeleteLead = () => {
    setShowDeleteConfirm(false)
    setLeadToDelete(null)
  }

  // Shared filter options cache to avoid multiple API calls
  let filterOptionsCache = null
  const getFilterOptions = async () => {
    if (!filterOptionsCache) {
      filterOptionsCache = await leadsApi.getFilterOptions()
    }
    return filterOptionsCache
  }

  // Filter configuration
  const filterConfigs = [
    {
      key: 'status',
      label: 'Status',
      type: 'multiselect',
      icon: <Target size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.status || []
      }
    },
    {
      key: 'source',
      label: 'Source',
      type: 'multiselect',
      icon: <TrendingUp size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.source || []
      }
    },
    {
      key: 'assigned_to',
      label: 'Assigned To',
      type: 'multiselect',
      icon: <Users size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.assigned_to || []
      }
    },
    {
      key: 'score',
      label: 'Lead Score',
      type: 'range',
      icon: <Award size={16} />
    }
  ]

  // Use summary data for metrics (overall totals, not page-wise)
  const totalLeads = summary.total_leads
  const qualifiedLeads = summary.qualified_leads
  const avgScore = summary.avg_score
  const totalValue = summary.total_value

  return (
    <div className="leads-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">Track and convert potential customers into opportunities</p>
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
            Add Lead
          </Button>
        </div>
      </div>

      {loading ? (
        <CardListSkeleton count={6} size="large" />
      ) : error ? (
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchLeads} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="leads-metrics">
            <div className="metric-card">
              <div className="metric-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>
                <Users size={24} />
              </div>
              <div className="metric-content">
                <div className="metric-label">Total Leads</div>
                <div className="metric-value">
                  <AnimatedCounter value={totalLeads} duration={1200} />
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ background: '#10b98120', color: '#10b981' }}>
                <Target size={24} />
              </div>
              <div className="metric-content">
                <div className="metric-label">Qualified Leads</div>
                <div className="metric-value">
                  <AnimatedCounter value={qualifiedLeads} duration={1200} />
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
                <Award size={24} />
              </div>
              <div className="metric-content">
                <div className="metric-label">Avg. Score</div>
                <div className="metric-value">
                  <AnimatedCounter value={avgScore} duration={1200} />
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
                <DollarSign size={24} />
              </div>
              <div className="metric-content">
                <div className="metric-label">Total Value</div>
                <div className="metric-value">
                  ${formatNumber(totalValue)}
                </div>
              </div>
            </div>
          </div>

      <Card>
        <div className="leads-toolbar">
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Search leads..." 
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
          </form>
          <Button 
            variant="outline" 
            icon={<Filter size={18} />}
            onClick={() => setShowFilterPanel(true)}
          >
            Filter
            {Object.keys(filters).length > 0 && (
              <span style={{ 
                marginLeft: '6px', 
                padding: '2px 6px', 
                background: '#3b82f6', 
                color: 'white', 
                borderRadius: '10px', 
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {Object.keys(filters).length}
              </span>
            )}
          </Button>
        </div>

        <div className="table-container">
          {searching ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <Loader />
              <div style={{ marginTop: '8px' }}>Searching...</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lead Name</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Est. Value</th>
                  <th>Assigned To</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                      {searchQuery ? 'No leads found matching your search.' : 'No leads found. Click "Add Lead" to create one.'}
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="font-semibold">{lead.name}</td>
                    <td>{lead.company}</td>
                    <td>
                      <div className="contact-cell">
                        <div>{lead.email}</div>
                        <div className="phone-text">{lead.phone}</div>
                      </div>
                    </td>
                    <td>{lead.source}</td>
                    <td>
                      <span 
                        className="status-pill" 
                        style={{ 
                          background: `${getStatusColor(lead.status)}20`,
                          color: getStatusColor(lead.status)
                        }}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td>
                      <div className="score-cell">
                        <div 
                          className="score-bar" 
                          style={{ 
                            width: `${lead.score}%`,
                            background: getScoreColor(lead.score)
                          }}
                        />
                        <span className="score-text">{lead.score}</span>
                      </div>
                    </td>
                    <td className="font-semibold text-success">{lead.value}</td>
                    <td>{lead.assigned_to}</td>
                    <td className="actions-cell">
                      <button 
                        className="action-btn" 
                        title="Edit" 
                        onClick={() => handleEditLead(lead)}
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        className="action-btn danger" 
                        title="Delete" 
                        onClick={() => handleDeleteLead(lead.id)}
                        disabled={deleting && leadToDelete?.id === lead.id}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination */}
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
      </Card>
        </>
      )}

      {/* Add Lead Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Lead</h2>
              <button className="modal-close" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="name">Name <span className="required">*</span></label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={formErrors.name ? 'error' : ''}
                    placeholder="Enter lead name"
                  />
                  {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="company">Company <span className="required">*</span></label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    className={formErrors.company ? 'error' : ''}
                    placeholder="Enter company name"
                  />
                  {formErrors.company && <span className="error-text">{formErrors.company}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email <span className="required">*</span></label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={formErrors.email ? 'error' : ''}
                    placeholder="email@example.com"
                  />
                  {formErrors.email && <span className="error-text">{formErrors.email}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="phone">Phone</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="source">Source</label>
                  <select
                    id="source"
                    name="source"
                    value={formData.source}
                    onChange={handleInputChange}
                  >
                    <option value="">Select source</option>
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Event">Event</option>
                    <option value="Email Campaign">Email Campaign</option>
                    <option value="Other">Other</option>
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
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Nurturing">Nurturing</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="score">Lead Score (0-100)</label>
                  <input
                    type="number"
                    id="score"
                    name="score"
                    min="0"
                    max="100"
                    value={formData.score}
                    onChange={handleInputChange}
                    className={formErrors.score ? 'error' : ''}
                  />
                  {formErrors.score && <span className="error-text">{formErrors.score}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="value">Estimated Value</label>
                  <input
                    type="text"
                    id="value"
                    name="value"
                    value={formData.value}
                    onChange={handleInputChange}
                    placeholder="$50,000"
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="assigned_to">Assigned To</label>
                  <input
                    type="text"
                    id="assigned_to"
                    name="assigned_to"
                    value={formData.assigned_to}
                    onChange={handleInputChange}
                    placeholder="Enter assignee name"
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
                  {submitting ? 'Creating...' : 'Create Lead'}
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
        title="Upload Leads from Excel"
        entityName="leads"
      />

      {/* Filter Panel */}
      <MUIFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        onApply={handleApplyFilters}
        filters={filters}
        filterConfigs={filterConfigs}
      />

      {/* Edit Lead Modal */}
      {editingLead && (
        <div className="edit-lead-overlay" onClick={handleCancelEdit}>
          <div className="edit-lead-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-lead-header">
              <h2 className="edit-lead-title">Edit Lead</h2>
              <button className="modal-close" onClick={handleCancelEdit}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveLead(editingLead) }} className="edit-lead-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="edit_name">
                    Lead Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="edit_name"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditInputChange}
                    placeholder="Enter lead name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit_company">Company</label>
                  <input
                    type="text"
                    id="edit_company"
                    name="company"
                    value={editFormData.company}
                    onChange={handleEditInputChange}
                    placeholder="Enter company name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit_email">
                    Email <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    id="edit_email"
                    name="email"
                    value={editFormData.email}
                    onChange={handleEditInputChange}
                    placeholder="email@example.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit_phone">Phone</label>
                  <input
                    type="text"
                    id="edit_phone"
                    name="phone"
                    value={editFormData.phone}
                    onChange={handleEditInputChange}
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit_source">Source</label>
                  <select
                    id="edit_source"
                    name="source"
                    value={editFormData.source}
                    onChange={handleEditInputChange}
                  >
                    <option value="">Select source</option>
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Email Campaign">Email Campaign</option>
                    <option value="Event">Event</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit_status">Status</label>
                  <select
                    id="edit_status"
                    name="status"
                    value={editFormData.status}
                    onChange={handleEditInputChange}
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Unqualified">Unqualified</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit_score">
                    Score (0-100) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    id="edit_score"
                    name="score"
                    value={editFormData.score}
                    onChange={handleEditInputChange}
                    min="0"
                    max="100"
                    placeholder="0-100"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit_value">Estimated Value</label>
                  <input
                    type="text"
                    id="edit_value"
                    name="value"
                    value={editFormData.value}
                    onChange={handleEditInputChange}
                    placeholder="$50,000"
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="edit_assigned_to">Assigned To</label>
                  <input
                    type="text"
                    id="edit_assigned_to"
                    name="assigned_to"
                    value={editFormData.assigned_to}
                    onChange={handleEditInputChange}
                    placeholder="Enter assignee name"
                  />
                </div>
              </div>

              <div className="edit-lead-footer">
                <Button type="button" onClick={handleCancelEdit} variant="outline" disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={cancelDeleteLead}
        onConfirm={confirmDeleteLead}
        title="Delete Lead"
        message={
          leadToDelete 
            ? `Are you sure you want to delete "${leadToDelete.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this lead?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      />
    </div>
  )
}

export default Leads
