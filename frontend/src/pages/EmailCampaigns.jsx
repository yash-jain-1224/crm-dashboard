import React, { useState, useEffect } from 'react'
import { Plus, Send, Users, TrendingUp, X, Upload, Edit, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Loader from '../components/Loader'
import { EmailCampaignsSkeleton } from '../components/SkeletonLoader'
import ExcelUploadModal from '../components/ExcelUploadModal'
import ConfirmationModal from '../components/ConfirmationModal'
import Pagination from '../components/Pagination'
import AnimatedCounter from '../components/AnimatedCounter'
import { useToast } from '../components/Toast'
import { emailCampaignsApi } from '../services'
import './EmailCampaigns.css'
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

const EmailCampaigns = () => {
  const toast = useToast()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTimeout, setSearchTimeout] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    status: 'Draft',
    sent_count: 0,
    open_rate: 0.0,
    click_rate: 0.0,
    conversion_rate: 0.0,
    scheduled_date: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [summary, setSummary] = useState({
    total_campaigns: 0,
    total_sent: 0,
    avg_open_rate: 0,
    avg_click_rate: 0,
    avg_conversion_rate: 0
  })

  useEffect(() => {
    fetchCampaigns()
    fetchSummary()
  }, [currentPage, pageSize, searchQuery])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  const fetchCampaigns = async () => {
    try {
      // Only show full loader on initial load
      if (campaigns.length === 0 && !searchQuery) {
        setLoading(true)
      } else {
        setSearching(true)
      }
      
      setError(null)
      const params = { page: currentPage, page_size: pageSize }
      if (searchQuery) {
        params.search = searchQuery
      }
      const response = await emailCampaignsApi.getAll(params)
      setCampaigns(response.items || [])
      setTotalPages(response.total_pages || 0)
      setTotalItems(response.total || 0)
    } catch (err) {
      console.error('Error fetching campaigns:', err)
      setError('Failed to load campaigns. Please try again.')
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }

  const fetchAllCampaignsForStats = async () => {
    try {
      const summaryData = await emailCampaignsApi.getSummary()
      setSummary(summaryData)
    } catch (err) {
      console.error('Error fetching summary:', err)
      // Don't show error for summary, just use default values
    }
  }

  // Keep for backwards compatibility, but now just calls fetchSummary
  const fetchSummary = fetchAllCampaignsForStats

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

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const handleDelete = async (id) => {
    const campaign = campaigns.find(c => c.id === id)
    setCampaignToDelete(campaign)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!campaignToDelete) return

    setDeleting(true)
    try {
      await emailCampaignsApi.delete(campaignToDelete.id)
      // Remove from local state immediately
      setCampaigns(campaigns.filter(c => c.id !== campaignToDelete.id))
      // Update total items
      setTotalItems(prev => prev - 1)
      
      // Refresh stats with all campaigns
      await fetchSummary()
      
      // Close the modal
      setShowDeleteConfirm(false)
      setCampaignToDelete(null)
      toast.success('Campaign deleted successfully!')
    } catch (err) {
      console.error('Error deleting campaign:', err)
      toast.error('Failed to delete campaign. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setCampaignToDelete(null)
  }

  const handleEditCampaign = (campaign) => {
    setIsEditMode(true)
    setEditingCampaign(campaign)
    setFormData({
      name: campaign.name || '',
      subject: campaign.subject || '',
      status: campaign.status || 'Draft',
      sent_count: campaign.sent_count || 0,
      open_rate: campaign.open_rate || 0.0,
      click_rate: campaign.click_rate || 0.0,
      conversion_rate: campaign.conversion_rate || 0.0,
      scheduled_date: campaign.scheduled_date || ''
    })
    setShowModal(true)
    setFormError(null)
  }

  const handleOpenModal = () => {
    setIsEditMode(false)
    setEditingCampaign(null)
    setShowModal(true)
    setFormData({
      name: '',
      subject: '',
      status: 'Draft',
      sent_count: 0,
      open_rate: 0.0,
      click_rate: 0.0,
      conversion_rate: 0.0,
      scheduled_date: ''
    })
    setFormError(null)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setIsEditMode(false)
    setEditingCampaign(null)
    setFormData({
      name: '',
      subject: '',
      status: 'Draft',
      sent_count: 0,
      open_rate: 0.0,
      click_rate: 0.0,
      conversion_rate: 0.0,
      scheduled_date: ''
    })
    setFormError(null)
  }

  const handleInputChange = (e) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    // Validate required fields
    if (!formData.name.trim()) {
      setFormError('Campaign name is required')
      return
    }
    if (!formData.subject.trim()) {
      setFormError('Subject is required')
      return
    }

    try {
      setSubmitting(true)
      
      if (isEditMode && editingCampaign) {
        // Update existing campaign
        const updatedCampaign = await emailCampaignsApi.update(editingCampaign.id, formData)
        
        // Update the campaigns list with the updated campaign
        setCampaigns(campaigns.map(c => 
          c.id === editingCampaign.id ? { ...c, ...updatedCampaign } : c
        ))
        
        // Refresh stats with all campaigns
        await fetchSummary()
        
        toast.success('Campaign updated successfully!')
      } else {
        // Create new campaign
        await emailCampaignsApi.create(formData)
        await fetchCampaigns()
        
        // Refresh stats with all campaigns
        await fetchSummary()
        
        toast.success('Campaign created successfully!')
      }
      
      handleCloseModal()
    } catch (err) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} campaign:`, err)
      setFormError(err.message || `Failed to ${isEditMode ? 'update' : 'create'} campaign`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleExcelUpload = async (file, asyncMode = false) => {
    try {
      const result = await emailCampaignsApi.bulkUpload(file, asyncMode)
      
      // Only refresh immediately for synchronous uploads
      if (!result.async) {
        await fetchCampaigns()
        await fetchSummary()
      }
      
      return result
    } catch (err) {
      console.error('Error uploading email campaigns:', err)
      throw err
    }
  }

  const handleGetUploadProgress = async (taskId) => {
    try {
      const progress = await emailCampaignsApi.getUploadProgress(taskId)
      
      // Refresh campaigns list when upload completes
      if (progress.status === 'completed') {
        await fetchCampaigns()
        await fetchSummary()
      }
      
      return progress
    } catch (err) {
      console.error('Error getting upload progress:', err)
      throw err
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await emailCampaignsApi.downloadTemplate()
    } catch (err) {
      console.error('Error downloading template:', err)
      throw err
    }
  }

  const getOpenRate = (campaign) => {
    return (campaign.open_rate || 0).toFixed(1)
  }

  const getClickRate = (campaign) => {
    return (campaign.click_rate || 0).toFixed(1)
  }

  const getConversionRate = (campaign) => {
    return (campaign.conversion_rate || 0).toFixed(1)
  }

  const statusColors = {
    'Active': '#10b981',
    'Completed': '#64748b',
    'Scheduled': '#3b82f6',
    'Draft': '#f59e0b'
  }

  // Calculate stats from all campaigns, not just current page
  const totalStats = {
    sent: summary.total_sent || 0,
    avgOpenRate: summary.avg_open_rate || 0,
    avgClickRate: summary.avg_click_rate || 0,
    totalCampaigns: summary.total_campaigns || 0,
  }

  // Calculate total converted from sent * avg conversion rate
  // Note: We need conversion rate from backend for accurate calculation
  const totalConverted = Math.round(totalStats.sent * (summary.avg_conversion_rate || 0) / 100)

  return (
    <div className="email-campaigns-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Email Campaigns</h1>
          <p className="page-subtitle">Create and track email marketing campaigns to engage your leads</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button 
            icon={<Upload size={18} />} 
            onClick={() => setShowExcelModal(true)}
            variant="outline"
          >
            Upload Excel
          </Button>
          <Button icon={<Plus size={18} />} onClick={handleOpenModal}>Create Campaign</Button>
        </div>
      </div>

      {loading ? (
        <EmailCampaignsSkeleton />
      ) : error ? (
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchCampaigns} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="campaign-stats">
        <div className="stat-card-email">
          <div className="stat-icon-email" style={{ background: '#3b82f620', color: '#3b82f6' }}>
            <Send size={24} />
          </div>
          <div className="stat-info-email">
            <div className="stat-value-email">
              {formatNumber(totalStats.sent)}
            </div>
            <div className="stat-label-email">Total Sent</div>
          </div>
        </div>
        <div className="stat-card-email">
          <div className="stat-icon-email" style={{ background: '#10b98120', color: '#10b981' }}>
            <Users size={24} />
          </div>
          <div className="stat-info-email">
            <div className="stat-value-email">
              <AnimatedCounter 
                value={totalStats.avgOpenRate} 
                duration={1200} 
                decimals={1}
                suffix="%"
              />
            </div>
            <div className="stat-label-email">Avg. Open Rate</div>
          </div>
        </div>
        <div className="stat-card-email">
          <div className="stat-icon-email" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
            <TrendingUp size={24} />
          </div>
          <div className="stat-info-email">
            <div className="stat-value-email">
              <AnimatedCounter 
                value={totalStats.avgClickRate} 
                duration={1200} 
                decimals={1}
                suffix="%"
              />
            </div>
            <div className="stat-label-email">Avg. Click Rate</div>
          </div>
        </div>
        <div className="stat-card-email">
          <div className="stat-icon-email" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
            <TrendingUp size={24} />
          </div>
          <div className="stat-info-email">
            <div className="stat-value-email">
              {formatNumber(totalConverted)}
            </div>
            <div className="stat-label-email">Total Conversions</div>
          </div>
        </div>
      </div>

      <Card title="All Campaigns">
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '8px' }}>
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Search campaigns..." 
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
                <th>Campaign Name</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Open Rate</th>
                <th>Click Rate</th>
                <th>Conversions</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                    {searchQuery ? 'No campaigns found matching your search.' : 'No campaigns found. Click "Create Campaign" to create one.'}
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="font-semibold">{campaign.name}</td>
                    <td>{campaign.subject}</td>
                    <td>
                      <span 
                        className="campaign-status"
                        style={{
                          background: `${statusColors[campaign.status] || '#64748b'}20`,
                          color: statusColors[campaign.status] || '#64748b'
                        }}
                      >
                        {campaign.status}
                      </span>
                    </td>
                    <td>{(campaign.sent_count || 0).toLocaleString()}</td>
                    <td>
                      <div className="rate-cell">
                        <div className="rate-bar-bg">
                          <div 
                            className="rate-bar"
                            style={{ 
                              width: `${getOpenRate(campaign)}%`,
                              background: '#10b981'
                            }}
                          />
                        </div>
                        <span>{getOpenRate(campaign)}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="rate-cell">
                        <div className="rate-bar-bg">
                          <div 
                            className="rate-bar"
                            style={{ 
                              width: `${getClickRate(campaign)}%`,
                              background: '#3b82f6'
                            }}
                          />
                        </div>
                        <span>{getClickRate(campaign)}%</span>
                      </div>
                    </td>
                    <td className="font-semibold">{Math.round((campaign.sent_count || 0) * (campaign.conversion_rate || 0) / 100)}</td>
                    <td>{campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="action-btn"
                          onClick={() => handleEditCampaign(campaign)}
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="action-btn danger"
                          onClick={() => handleDelete(campaign.id)}
                          title="Delete"
                          disabled={deleting && campaignToDelete?.id === campaign.id}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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

      {/* Create/Edit Campaign Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditMode ? 'Edit Campaign' : 'Create New Campaign'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="form-error">
                    {formError}
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="name">Campaign Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter campaign name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Email Subject *</label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    placeholder="Enter email subject"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="scheduled_date">Scheduled Date</label>
                  <input
                    type="datetime-local"
                    id="scheduled_date"
                    name="scheduled_date"
                    value={formData.scheduled_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="sent_count">Sent Count</label>
                    <input
                      type="number"
                      id="sent_count"
                      name="sent_count"
                      value={formData.sent_count}
                      onChange={handleInputChange}
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="open_rate">Open Rate (%)</label>
                    <input
                      type="number"
                      id="open_rate"
                      name="open_rate"
                      value={formData.open_rate}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="click_rate">Click Rate (%)</label>
                    <input
                      type="number"
                      id="click_rate"
                      name="click_rate"
                      value={formData.click_rate}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="conversion_rate">Conversion Rate (%)</label>
                    <input
                      type="number"
                      id="conversion_rate"
                      name="conversion_rate"
                      value={formData.conversion_rate}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <Button type="button" onClick={handleCloseModal} style={{ background: '#64748b' }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting 
                    ? (isEditMode ? 'Updating...' : 'Creating...') 
                    : (isEditMode ? 'Update Campaign' : 'Create Campaign')
                  }
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      {showExcelModal && (
        <ExcelUploadModal
          isOpen={showExcelModal}
          onClose={() => setShowExcelModal(false)}
          onUpload={handleExcelUpload}
          onDownloadTemplate={handleDownloadTemplate}
          onGetProgress={handleGetUploadProgress}
          title="Upload Email Campaigns from Excel"
          entityName="campaigns"
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && campaignToDelete && (
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          title="Delete Campaign"
          message={`Are you sure you want to delete the campaign "${campaignToDelete.name}"? This action cannot be undone.`}
          confirmText="Delete Campaign"
          cancelText="Cancel"
          type="danger"
          loading={deleting}
        />
      )}
    </div>
  )
}

export default EmailCampaigns

