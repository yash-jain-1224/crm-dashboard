import React, { useState, useEffect } from 'react'
import { Plus, DollarSign, TrendingUp, X, Upload, Filter, Building2, Users, Target, Percent, Edit, Trash2 } from 'lucide-react'
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
import { opportunitiesApi } from '../services'
import './Opportunities.css'
import '../components/ErrorState.css'

const Opportunities = () => {
  const toast = useToast()
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [opportunityToDelete, setOpportunityToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [filters, setFilters] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTimeout, setSearchTimeout] = useState(null)
  const [editingOpportunity, setEditingOpportunity] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    account: '',
    value: '',
    stage: 'Prospecting',
    probability: '10',
    close_date: '',
    owner: '',
    contact_id: ''
  })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchOpportunities()
  }, [currentPage, pageSize, searchQuery, filters])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  const fetchOpportunities = async () => {
    try {
      // Only show full loader on initial load
      if (opportunities.length === 0 && !searchQuery) {
        setLoading(true)
      } else {
        setSearching(true)
      }
      
      setError(null)
      const params = { page: currentPage, page_size: pageSize }
      if (searchQuery) {
        params.search = searchQuery
      }
      
      // Apply filters
      if (filters.stage && filters.stage.length > 0) {
        params.stage = filters.stage.join(',')
      }
      if (filters.account && filters.account.length > 0) {
        params.account = filters.account.join(',')
      }
      if (filters.owner && filters.owner.length > 0) {
        params.owner = filters.owner.join(',')
      }
      if (filters.value?.min) {
        params.value_min = filters.value.min
      }
      if (filters.value?.max) {
        params.value_max = filters.value.max
      }
      if (filters.probability?.min) {
        params.probability_min = filters.probability.min
      }
      if (filters.probability?.max) {
        params.probability_max = filters.probability.max
      }
      
      const response = await opportunitiesApi.getAll(params)
      setOpportunities(response.items || [])
      setTotalPages(response.total_pages || 0)
      setTotalItems(response.total || 0)
    } catch (err) {
      console.error('Error fetching opportunities:', err)
      setError('Failed to load opportunities. Please try again.')
    } finally {
      setLoading(false)
      setSearching(false)
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
    setCurrentPage(1)
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
    
    if (!formData.name.trim()) {
      errors.name = 'Opportunity name is required'
    }
    
    if (!formData.account.trim()) {
      errors.account = 'Account is required'
    }
    
    if (!formData.value || parseFloat(formData.value) <= 0) {
      errors.value = 'Value must be greater than 0'
    }
    
    if (formData.probability && (parseInt(formData.probability) < 0 || parseInt(formData.probability) > 100)) {
      errors.probability = 'Probability must be between 0 and 100'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setSubmitting(true)
    
    try {
      const opportunityData = {
        name: formData.name.trim(),
        account: formData.account.trim(),
        value: parseFloat(formData.value),
        stage: formData.stage,
        probability: parseInt(formData.probability),
        close_date: formData.close_date || null,
        owner: formData.owner.trim() || null,
        contact_id: formData.contact_id ? parseInt(formData.contact_id) : null
      }
      
      await opportunitiesApi.create(opportunityData)
      
      // Reset form and close modal
      setFormData({
        name: '',
        account: '',
        value: '',
        stage: 'Prospecting',
        probability: '10',
        close_date: '',
        owner: '',
        contact_id: ''
      })
      setFormErrors({})
      setShowModal(false)
      
      // Show success toast
      toast.success('Opportunity created successfully!')
      
      // Refresh opportunities list
      await fetchOpportunities()
    } catch (err) {
      console.error('Error creating opportunity:', err)
      toast.error(err.message || 'Failed to create opportunity')
      setFormErrors({ submit: err.message || 'Failed to create opportunity' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setFormData({
      name: '',
      account: '',
      value: '',
      stage: 'Prospecting',
      probability: '10',
      close_date: '',
      owner: '',
      contact_id: ''
    })
    setFormErrors({})
  }

  const handleExcelUpload = async (file, asyncMode = false) => {
    try {
      const result = await opportunitiesApi.bulkUpload(file, asyncMode)
      
      // Only refresh immediately for synchronous uploads
      if (!result.async) {
        await fetchOpportunities()
      }
      
      return result
    } catch (err) {
      console.error('Error uploading Excel file:', err)
      throw err
    }
  }

  const handleGetUploadProgress = async (taskId) => {
    try {
      const progress = await opportunitiesApi.getUploadProgress(taskId)
      
      // Refresh opportunities list when upload completes
      if (progress.status === 'completed') {
        await fetchOpportunities()
      }
      
      return progress
    } catch (err) {
      console.error('Error getting upload progress:', err)
      throw err
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await opportunitiesApi.downloadTemplate()
    } catch (err) {
      console.error('Error downloading template:', err)
      throw err
    }
  }

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  const handleEditOpportunity = (opportunity) => {
    setEditingOpportunity(opportunity.id)
    setEditFormData({
      name: opportunity.name || '',
      account: opportunity.account || '',
      value: opportunity.value || '',
      stage: opportunity.stage || 'Prospecting',
      probability: opportunity.probability || '10',
      close_date: opportunity.close_date || '',
      owner: opportunity.owner || '',
      contact_id: opportunity.contact_id || ''
    })
  }

  const handleCancelEdit = () => {
    setEditingOpportunity(null)
    setEditFormData({})
  }

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveOpportunity = async (opportunityId) => {
    // Validate required fields
    if (!editFormData.name || !editFormData.name.trim()) {
      alert('Opportunity name is required')
      return
    }
    
    if (!editFormData.account || !editFormData.account.trim()) {
      alert('Account is required')
      return
    }
    
    if (!editFormData.value || parseFloat(editFormData.value) <= 0) {
      alert('Value must be greater than 0')
      return
    }

    // Validate probability
    const probability = parseInt(editFormData.probability)
    if (isNaN(probability) || probability < 0 || probability > 100) {
      alert('Probability must be between 0 and 100')
      return
    }
    
    setSaving(true)
    try {
      const opportunityData = {
        name: editFormData.name.trim(),
        account: editFormData.account.trim(),
        value: parseFloat(editFormData.value),
        stage: editFormData.stage,
        probability: parseInt(editFormData.probability),
        close_date: editFormData.close_date || null,
        owner: editFormData.owner.trim() || null,
        contact_id: editFormData.contact_id ? parseInt(editFormData.contact_id) : null
      }
      
      const updatedOpportunity = await opportunitiesApi.update(opportunityId, opportunityData)
      
      // Update the opportunities list with the updated opportunity
      setOpportunities(opportunities.map(o => 
        o.id === opportunityId ? { ...o, ...updatedOpportunity } : o
      ))
      
      setEditingOpportunity(null)
      setEditFormData({})
      toast.success('Opportunity updated successfully!')
    } catch (err) {
      console.error('Error updating opportunity:', err)
      toast.error(err.message || 'Failed to update opportunity')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOpportunity = async (id) => {
    const opportunity = opportunities.find(o => o.id === id)
    setOpportunityToDelete(opportunity)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteOpportunity = async () => {
    if (!opportunityToDelete) return

    setDeleting(true)
    try {
      await opportunitiesApi.delete(opportunityToDelete.id)
      setOpportunities(opportunities.filter(o => o.id !== opportunityToDelete.id))
      setTotalItems(prev => prev - 1)
      setShowDeleteConfirm(false)
      setOpportunityToDelete(null)
      toast.success('Opportunity deleted successfully!')
    } catch (err) {
      console.error('Error deleting opportunity:', err)
      toast.error('Failed to delete opportunity. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const cancelDeleteOpportunity = () => {
    setShowDeleteConfirm(false)
    setOpportunityToDelete(null)
  }

  // Shared filter options cache to avoid multiple API calls
  let filterOptionsCache = null
  const getFilterOptions = async () => {
    if (!filterOptionsCache) {
      filterOptionsCache = await opportunitiesApi.getFilterOptions()
    }
    return filterOptionsCache
  }

  const filterConfigs = [
    {
      key: 'stage',
      label: 'Stage',
      type: 'multiselect',
      icon: <Target size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.stage || []
      }
    },
    {
      key: 'account',
      label: 'Account',
      type: 'multiselect',
      icon: <Building2 size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.account || []
      }
    },
    {
      key: 'owner',
      label: 'Owner',
      type: 'multiselect',
      icon: <Users size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.owner || []
      }
    },
    {
      key: 'value',
      label: 'Value',
      type: 'range',
      icon: <DollarSign size={16} />
    },
    {
      key: 'probability',
      label: 'Probability (%)',
      type: 'range',
      icon: <Percent size={16} />
    }
  ]

  const stageColors = {
    'Prospecting': '#64748b',
    'Qualification': '#64748b',
    'Proposal': '#3b82f6',
    'Negotiation': '#f59e0b',
    'Closed Won': '#10b981',
    'Closed Lost': '#ef4444'
  }

  const totalValue = opportunities.reduce((acc, opp) => {
    const amount = typeof opp.amount === 'number' ? opp.amount : parseFloat(String(opp.amount).replace(/[$,]/g, '')) || 0
    return acc + amount
  }, 0)

  const weightedValue = opportunities.reduce((acc, opp) => {
    const amount = typeof opp.amount === 'number' ? opp.amount : parseFloat(String(opp.amount).replace(/[$,]/g, '')) || 0
    const probability = opp.probability || 0
    return acc + (amount * probability / 100)
  }, 0)

  const formatCurrency = (value) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[$,]/g, '')) || 0
    return `$${num.toLocaleString()}`
  }

  return (
    <div className="opportunities-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Opportunities</h1>
          <p className="page-subtitle">Manage sales opportunities and track deals through your pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button 
            icon={<Upload size={18} />} 
            onClick={() => setShowExcelModal(true)}
            variant="outline"
          >
            Upload Excel
          </Button>
          <Button icon={<Plus size={18} />} onClick={() => setShowModal(true)}>
            Add Opportunity
          </Button>
        </div>
      </div>

      {loading ? (
        <CardListSkeleton count={6} size="large" />
      ) : error ? (
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchOpportunities} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="opp-metrics">
        <div className="metric-card">
          <div className="metric-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>
            <TrendingUp size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Total Pipeline</div>
            <div className="metric-value">
              $<AnimatedCounter value={totalValue} duration={1200} separator="," />
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: '#10b98120', color: '#10b981' }}>
            <DollarSign size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Weighted Pipeline</div>
            <div className="metric-value">
              $<AnimatedCounter value={Math.round(weightedValue)} duration={1200} separator="," />
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
            <TrendingUp size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-label">Open Opportunities</div>
            <div className="metric-value">
              <AnimatedCounter value={opportunities.filter(o => !String(o.stage).includes('Closed')).length} duration={1200} />
            </div>
          </div>
        </div>
      </div>

      <Card title="All Opportunities">
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '8px' }}>
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Search opportunities..." 
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
                <th>Opportunity Name</th>
                <th>Account</th>
                <th>Stage</th>
                <th>Amount</th>
                <th>Probability</th>
                <th>Expected Revenue</th>
                <th>Close Date</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                    {searchQuery ? 'No opportunities found matching your search.' : 'No opportunities found. Click "Add Opportunity" to create one.'}
                  </td>
                </tr>
              ) : (
                opportunities.map((opp) => {
                  const amount = typeof opp.amount === 'number' ? opp.amount : parseFloat(String(opp.amount).replace(/[$,]/g, '')) || 0
                  const expectedRevenue = Math.round(amount * (opp.probability || 0) / 100)
                  
                  return (
                    <tr key={opp.id}>
                      <td className="font-semibold">{opp.name}</td>
                      <td>{opp.account_name || opp.account || 'N/A'}</td>
                      <td>
                        <span 
                          className="stage-badge"
                          style={{
                            background: `${stageColors[opp.stage] || '#64748b'}20`,
                            color: stageColors[opp.stage] || '#64748b'
                          }}
                        >
                          {opp.stage}
                        </span>
                      </td>
                      <td className="font-semibold">{formatCurrency(amount)}</td>
                      <td>
                        <div className="probability-cell">
                          <div className="probability-bar-bg">
                            <div 
                              className="probability-bar"
                              style={{ 
                                width: `${opp.probability || 0}%`,
                                background: stageColors[opp.stage] || '#64748b'
                              }}
                            />
                          </div>
                          <span>{opp.probability || 0}%</span>
                        </div>
                      </td>
                      <td className="text-success font-semibold">
                        {formatCurrency(expectedRevenue)}
                      </td>
                      <td>{opp.close_date ? new Date(opp.close_date).toLocaleDateString() : 'N/A'}</td>
                      <td>{opp.owner || 'Unassigned'}</td>
                      <td className="actions-cell">
                        <button 
                          className="action-btn" 
                          title="Edit" 
                          onClick={() => handleEditOpportunity(opp)}
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className="action-btn danger" 
                          title="Delete" 
                          onClick={() => handleDeleteOpportunity(opp.id)}
                          disabled={deleting && opportunityToDelete?.id === opp.id}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })
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

      {/* Add Opportunity Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Opportunity</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">
                    Opportunity Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={formErrors.name ? 'error' : ''}
                    placeholder="Enter opportunity name"
                  />
                  {formErrors.name && <span className="error-message">{formErrors.name}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="account">
                    Account <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="account"
                    name="account"
                    value={formData.account}
                    onChange={handleInputChange}
                    className={formErrors.account ? 'error' : ''}
                    placeholder="Enter account name"
                  />
                  {formErrors.account && <span className="error-message">{formErrors.account}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="value">
                    Value ($) <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    id="value"
                    name="value"
                    value={formData.value}
                    onChange={handleInputChange}
                    className={formErrors.value ? 'error' : ''}
                    placeholder="Enter opportunity value"
                    step="0.01"
                    min="0"
                  />
                  {formErrors.value && <span className="error-message">{formErrors.value}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="stage">Stage</label>
                  <select
                    id="stage"
                    name="stage"
                    value={formData.stage}
                    onChange={handleInputChange}
                  >
                    <option value="Prospecting">Prospecting</option>
                    <option value="Qualification">Qualification</option>
                    <option value="Proposal">Proposal</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Closed Won">Closed Won</option>
                    <option value="Closed Lost">Closed Lost</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="probability">Probability (%)</label>
                  <input
                    type="number"
                    id="probability"
                    name="probability"
                    value={formData.probability}
                    onChange={handleInputChange}
                    className={formErrors.probability ? 'error' : ''}
                    placeholder="Enter probability (0-100)"
                    min="0"
                    max="100"
                  />
                  {formErrors.probability && <span className="error-message">{formErrors.probability}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="close_date">Expected Close Date</label>
                  <input
                    type="date"
                    id="close_date"
                    name="close_date"
                    value={formData.close_date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="owner">Owner</label>
                  <input
                    type="text"
                    id="owner"
                    name="owner"
                    value={formData.owner}
                    onChange={handleInputChange}
                    placeholder="Enter owner name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contact_id">Contact ID (Optional)</label>
                  <input
                    type="number"
                    id="contact_id"
                    name="contact_id"
                    value={formData.contact_id}
                    onChange={handleInputChange}
                    placeholder="Enter contact ID"
                    min="1"
                  />
                </div>
              </div>

              {formErrors.submit && (
                <div className="error-message submit-error">{formErrors.submit}</div>
              )}

              <div className="modal-actions">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Opportunity'}
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
        title="Upload Opportunities from Excel"
        entityName="opportunities"
      />

      {/* Filter Panel */}
      <MUIFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        onApply={handleApplyFilters}
        filters={filters}
        filterConfigs={filterConfigs}
      />

      {/* Edit Opportunity Modal */}
      {editingOpportunity && (
        <div className="edit-opportunity-overlay" onClick={handleCancelEdit}>
          <div className="edit-opportunity-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-opportunity-header">
              <h2 className="edit-opportunity-title">Edit Opportunity</h2>
              <button className="modal-close" onClick={handleCancelEdit}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleSaveOpportunity(editingOpportunity) }} className="edit-opportunity-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit_name">
                    Opportunity Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="edit_name"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditInputChange}
                    placeholder="Enter opportunity name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit_account">
                    Account <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    id="edit_account"
                    name="account"
                    value={editFormData.account}
                    onChange={handleEditInputChange}
                    placeholder="Enter account name"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit_value">
                    Value ($) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    id="edit_value"
                    name="value"
                    value={editFormData.value}
                    onChange={handleEditInputChange}
                    placeholder="Enter opportunity value"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit_stage">Stage</label>
                  <select
                    id="edit_stage"
                    name="stage"
                    value={editFormData.stage}
                    onChange={handleEditInputChange}
                  >
                    <option value="Prospecting">Prospecting</option>
                    <option value="Qualification">Qualification</option>
                    <option value="Proposal">Proposal</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Closed Won">Closed Won</option>
                    <option value="Closed Lost">Closed Lost</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit_probability">
                    Probability (%) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    id="edit_probability"
                    name="probability"
                    value={editFormData.probability}
                    onChange={handleEditInputChange}
                    placeholder="Enter probability (0-100)"
                    min="0"
                    max="100"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit_close_date">Expected Close Date</label>
                  <input
                    type="date"
                    id="edit_close_date"
                    name="close_date"
                    value={editFormData.close_date}
                    onChange={handleEditInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit_owner">Owner</label>
                  <input
                    type="text"
                    id="edit_owner"
                    name="owner"
                    value={editFormData.owner}
                    onChange={handleEditInputChange}
                    placeholder="Enter owner name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit_contact_id">Contact ID (Optional)</label>
                  <input
                    type="number"
                    id="edit_contact_id"
                    name="contact_id"
                    value={editFormData.contact_id}
                    onChange={handleEditInputChange}
                    placeholder="Enter contact ID"
                    min="1"
                  />
                </div>
              </div>

              <div className="edit-opportunity-footer">
                <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={saving}>
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
        onClose={cancelDeleteOpportunity}
        onConfirm={confirmDeleteOpportunity}
        title="Delete Opportunity"
        message={
          opportunityToDelete 
            ? `Are you sure you want to delete "${opportunityToDelete.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this opportunity?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      />
    </div>
  )
}

export default Opportunities
