import React, { useState, useEffect } from 'react'
import { Plus, Building2, Users, DollarSign, MapPin, X, Upload, Filter, Target, User, Globe, Edit, Trash2, Eye } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Loader from '../components/Loader'
import { CardListSkeleton } from '../components/SkeletonLoader'
import ExcelUploadModal from '../components/ExcelUploadModal'
import MUIFilterPanel from '../components/MUIFilterPanel'
import Pagination from '../components/Pagination'
import ConfirmationModal from '../components/ConfirmationModal'
import { useToast } from '../components/Toast'
import { accountsApi } from '../services'
import './Accounts.css'
import '../components/ErrorState.css'

const Accounts = () => {
  const toast = useToast()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filters, setFilters] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTimeout, setSearchTimeout] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    revenue: '',
    employees: '',
    location: '',
    phone: '',
    website: '',
    account_owner: '',
    status: 'Active'
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [editingAccount, setEditingAccount] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [accountToDelete, setAccountToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState(null)

  useEffect(() => {
    fetchAccounts()
  }, [currentPage, pageSize, searchQuery, filters])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  const fetchAccounts = async () => {
    try {
      // Only show full loader on initial load
      if (accounts.length === 0 && !searchQuery) {
        setLoading(true)
      } else {
        setSearching(true)
      }
      
      setError(null)
      const params = { page: currentPage, page_size: pageSize }
      if (searchQuery) {
        params.search = searchQuery
      }
      
      // Apply filters - join array values with commas
      if (filters.status && filters.status.length > 0) {
        params.status = filters.status.join(',')
      }
      if (filters.industry && filters.industry.length > 0) {
        params.industry = filters.industry.join(',')
      }
      if (filters.location && filters.location.length > 0) {
        params.location = filters.location.join(',')
      }
      if (filters.account_owner && filters.account_owner.length > 0) {
        params.account_owner = filters.account_owner.join(',')
      }
      if (filters.employees?.min) {
        params.employees_min = filters.employees.min
      }
      if (filters.employees?.max) {
        params.employees_max = filters.employees.max
      }
      
      const response = await accountsApi.getAll(params)
      setAccounts(response.items || [])
      setTotalPages(response.total_pages || 0)
      setTotalItems(response.total || 0)
    } catch (err) {
      console.error('Error fetching accounts:', err)
      setError('Failed to load accounts. Please try again.')
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

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize)
    setCurrentPage(1)
  }

  const handleOpenModal = () => {
    setShowModal(true)
    setFormError(null)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setFormData({
      name: '',
      industry: '',
      revenue: '',
      employees: '',
      location: '',
      phone: '',
      website: '',
      account_owner: '',
      status: 'Active'
    })
    setFormError(null)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.name.trim()) {
      setFormError('Account name is required')
      return
    }

    try {
      setSubmitting(true)
      
      // Prepare data - convert empty strings to null for optional fields
      const submitData = {
        name: formData.name.trim(),
        industry: formData.industry.trim() || null,
        revenue: formData.revenue.trim() || null,
        employees: formData.employees ? parseInt(formData.employees) : null,
        location: formData.location.trim() || null,
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
        account_owner: formData.account_owner.trim() || null,
        status: formData.status
      }

      await accountsApi.create(submitData)
      
      // Refresh the accounts list
      await fetchAccounts()
      
      // Close modal and reset form
      handleCloseModal()
      
      // Show success toast
      toast.success('Account created successfully!')
    } catch (err) {
      console.error('Error creating account:', err)
      const errorMessage = err.message || 'Failed to create account'
      setFormError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const handleExcelUpload = async (file, asyncMode = false) => {
    try {
      toast.info('Uploading file...')
      const result = await accountsApi.bulkUpload(file, asyncMode)
      
      // Only refresh immediately for synchronous uploads
      if (!result.async) {
        await fetchAccounts()
        if (result.success_count > 0) {
          toast.success(`Successfully uploaded ${result.success_count} accounts!`)
        }
        if (result.failed_count > 0) {
          toast.warning(`${result.failed_count} records failed to upload. Check the error details.`)
        }
      } else {
        toast.success('Upload started in background. Track progress in the modal.')
      }
      
      return result
    } catch (err) {
      console.error('Error uploading Excel file:', err)
      toast.error(err.message || 'Failed to upload file. Please try again.')
      throw err
    }
  }

  const handleGetUploadProgress = async (taskId) => {
    try {
      const progress = await accountsApi.getUploadProgress(taskId)
      
      // Refresh accounts list when upload completes
      if (progress.status === 'completed') {
        await fetchAccounts()
        if (progress.success_count > 0) {
          toast.success(`Successfully uploaded ${progress.success_count} accounts!`)
        }
        if (progress.failed_count > 0) {
          toast.warning(`${progress.failed_count} records failed. Check the error details.`)
        }
      } else if (progress.status === 'failed') {
        toast.error('Upload failed. Please try again.')
      }
      
      return progress
    } catch (err) {
      console.error('Error getting upload progress:', err)
      toast.error('Failed to get upload progress.')
      throw err
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await accountsApi.downloadTemplate()
    } catch (err) {
      console.error('Error downloading template:', err)
      throw err
    }
  }

  const handleViewDetails = (account) => {
    setSelectedAccount(account)
    setShowDetailsModal(true)
  }

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedAccount(null)
  }

  const handleEditAccount = (account) => {
    setEditingAccount(account.id)
    setEditFormData({
      name: account.name || '',
      industry: account.industry || '',
      revenue: account.annual_revenue || account.revenue || '',
      employees: account.number_of_employees || account.employees || '',
      location: account.billing_city ? `${account.billing_city}, ${account.billing_state || ''}` : account.location || '',
      phone: account.phone || '',
      website: account.website || '',
      account_owner: account.owner || account.account_owner || '',
      status: account.status || 'Active'
    })
  }

  const handleCancelEdit = () => {
    setEditingAccount(null)
    setEditFormData({})
  }

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveAccount = async (accountId) => {
    // Validate required fields
    if (!editFormData.name || !editFormData.name.trim()) {
      toast.error('Account name is required')
      return
    }
    
    setSaving(true)
    try {
      const updateData = {
        name: editFormData.name.trim(),
        industry: editFormData.industry.trim() || null,
        revenue: editFormData.revenue.trim() || null,
        employees: editFormData.employees ? parseInt(editFormData.employees) : null,
        location: editFormData.location.trim() || null,
        phone: editFormData.phone.trim() || null,
        website: editFormData.website.trim() || null,
        account_owner: editFormData.account_owner.trim() || null,
        status: editFormData.status
      }

      const updatedAccount = await accountsApi.update(accountId, updateData)
      
      // Update the accounts list with the updated account
      setAccounts(accounts.map(a => 
        a.id === accountId ? { ...a, ...updatedAccount } : a
      ))
      
      setEditingAccount(null)
      setEditFormData({})
      toast.success('Account updated successfully!')
    } catch (err) {
      console.error('Error updating account:', err)
      toast.error(err.message || 'Failed to update account')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async (id) => {
    const account = accounts.find(a => a.id === id)
    setAccountToDelete(account)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return

    setDeleting(true)
    try {
      await accountsApi.delete(accountToDelete.id)
      setAccounts(accounts.filter(a => a.id !== accountToDelete.id))
      setTotalItems(prev => prev - 1)
      setShowDeleteConfirm(false)
      setAccountToDelete(null)
      toast.success('Account deleted successfully!')
    } catch (err) {
      console.error('Error deleting account:', err)
      toast.error('Failed to delete account. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const cancelDeleteAccount = () => {
    setShowDeleteConfirm(false)
    setAccountToDelete(null)
  }

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Shared filter options cache to avoid multiple API calls
  let filterOptionsCache = null
  const getFilterOptions = async () => {
    if (!filterOptionsCache) {
      filterOptionsCache = await accountsApi.getFilterOptions()
    }
    return filterOptionsCache
  }

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
      key: 'industry',
      label: 'Industry',
      type: 'multiselect',
      icon: <Globe size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.industry || []
      }
    },
    {
      key: 'location',
      label: 'Location',
      type: 'multiselect',
      icon: <MapPin size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.location || []
      }
    },
    {
      key: 'account_owner',
      label: 'Account Owner',
      type: 'multiselect',
      icon: <User size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.account_owner || []
      }
    },
    {
      key: 'employees',
      label: 'Employees',
      type: 'range',
      icon: <Users size={16} />
    }
  ]

  return (
    <div className="accounts-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">Manage your business accounts and customer organizations</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button 
            icon={<Upload size={18} />} 
            onClick={() => setShowExcelModal(true)}
            variant="outline"
          >
            Upload Excel
          </Button>
          <Button icon={<Plus size={18} />} onClick={handleOpenModal}>
            Add Account
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', maxWidth: '100%' }}>
          <input 
            type="text" 
            placeholder="Search accounts..." 
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
        </form>
      </div>

      <div className="accounts-grid">
        {loading ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <CardListSkeleton count={6} size="large" />
          </div>
        ) : error ? (
          <Card style={{ gridColumn: '1 / -1' }}>
            <div className="error-state-container">
              <div className="error-state-message">{error}</div>
              <Button onClick={fetchAccounts} className="error-state-retry-button">Retry</Button>
            </div>
          </Card>
        ) : searching ? (
          <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', background: 'var(--surface)', borderRadius: '12px' }}>
            <Loader />
            <div style={{ marginTop: '12px', fontSize: '14px', color: '#64748b' }}>Searching accounts...</div>
          </div>
        ) : accounts.length === 0 ? (
          <Card style={{ gridColumn: '1 / -1' }}>
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <Building2 size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                {searchQuery ? 'No accounts found' : 'No accounts yet'}
              </div>
              <div style={{ fontSize: '14px' }}>
                {searchQuery ? 'Try adjusting your search or filters.' : 'Click "Add Account" to create your first account.'}
              </div>
            </div>
          </Card>
        ) : (
          accounts.map((account) => (
            <Card key={account.id} className="account-card">
              <div className="account-header">
                <div className="account-icon">
                  <Building2 size={32} />
                </div>
                <span className={`account-status ${(account.status || 'active').toLowerCase()}`}>
                  {account.status || 'Active'}
                </span>
              </div>
              
              <h3 className="account-name">{account.name}</h3>
              <p className="account-industry">{account.industry || 'N/A'}</p>

              <div className="account-details">
                <div className="detail-row">
                  <DollarSign size={16} />
                  <span>Annual Revenue: {account.annual_revenue || account.revenue || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <Users size={16} />
                  <span>Employees: {account.number_of_employees || account.employees || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <MapPin size={16} />
                  <span>{account.billing_city ? `${account.billing_city}, ${account.billing_state || ''}` : account.location || 'N/A'}</span>
                </div>
              </div>

              {/* <div className="account-metrics">
                <div className="metric">
                  <div className="metric-value">{account.contacts || 0}</div>
                  <div className="metric-label">Contacts</div>
                </div>
                <div className="metric">
                  <div className="metric-value">{account.opportunities || 0}</div>
                  <div className="metric-label">Opportunities</div>
                </div>
              </div> */}

              <div className="account-footer">
                <span className="owner-label">Owner: {account.account_owner || 'Unassigned'}</span>
                <div className="card-actions">
                  <button 
                    className="action-btn" 
                    title="View Details" 
                    onClick={() => handleViewDetails(account)}
                  >
                    <Eye size={16} />
                  </button>
                  <button 
                    className="action-btn" 
                    title="Edit" 
                    onClick={() => handleEditAccount(account)}
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="action-btn danger" 
                    title="Delete" 
                    onClick={() => handleDeleteAccount(account.id)}
                    disabled={deleting && accountToDelete?.id === account.id}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

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

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Account</h2>
              <button className="close-button" onClick={handleCloseModal}>
                <X size={18} />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              {formError && <div className="form-error">{formError}</div>}
              <div className="form-group">
                <label htmlFor="name">Account Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="industry">Industry</label>
                <input
                  type="text"
                  id="industry"
                  name="industry"
                  value={formData.industry}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="revenue">Annual Revenue</label>
                <input
                  type="text"
                  id="revenue"
                  name="revenue"
                  value={formData.revenue}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="employees">Employees</label>
                <input
                  type="text"
                  id="employees"
                  name="employees"
                  value={formData.employees}
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
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="website">Website</label>
                <input
                  type="text"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="account_owner">Account Owner</label>
                <input
                  type="text"
                  id="account_owner"
                  name="account_owner"
                  value={formData.account_owner}
                  onChange={handleInputChange}
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
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
                <Button type="submit" loading={submitting}>Create Account</Button>
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
        title="Upload Accounts from Excel"
        entityName="accounts"
      />

      {/* Edit Account Modal */}
      {editingAccount && (
        <div className="modal-overlay" onClick={handleCancelEdit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Account</h2>
              <button className="close-button" onClick={handleCancelEdit}>
                <X size={18} />
              </button>
            </div>
            <form className="modal-form" onSubmit={(e) => { e.preventDefault(); handleSaveAccount(editingAccount); }}>
              <div className="form-group">
                <label htmlFor="edit-name">Account Name <span style={{ color: 'red' }}>*</span></label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-industry">Industry</label>
                <input
                  type="text"
                  id="edit-industry"
                  name="industry"
                  value={editFormData.industry}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-revenue">Annual Revenue</label>
                <input
                  type="text"
                  id="edit-revenue"
                  name="revenue"
                  value={editFormData.revenue}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-employees">Employees</label>
                <input
                  type="text"
                  id="edit-employees"
                  name="employees"
                  value={editFormData.employees}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-location">Location</label>
                <input
                  type="text"
                  id="edit-location"
                  name="location"
                  value={editFormData.location}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-phone">Phone</label>
                <input
                  type="text"
                  id="edit-phone"
                  name="phone"
                  value={editFormData.phone}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-website">Website</label>
                <input
                  type="text"
                  id="edit-website"
                  name="website"
                  value={editFormData.website}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-account_owner">Account Owner</label>
                <input
                  type="text"
                  id="edit-account_owner"
                  name="account_owner"
                  value={editFormData.account_owner}
                  onChange={handleEditInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-status">Status</label>
                <select
                  id="edit-status"
                  name="status"
                  value={editFormData.status}
                  onChange={handleEditInputChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                <Button type="submit" loading={saving}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showDetailsModal && selectedAccount && (
        <div className="modal-overlay" onClick={handleCloseDetailsModal}>
          <div className="modal details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Account Details</h2>
              <button className="close-button" onClick={handleCloseDetailsModal}>
                <X size={18} />
              </button>
            </div>
            <div className="details-content">
              <div className="details-header">
                <div className="account-icon">
                  <Building2 size={32} />
                </div>
                <div>
                  <h3 className="details-account-name">{selectedAccount.name}</h3>
                  <span className={`account-status ${(selectedAccount.status || 'active').toLowerCase()}`}>
                    {selectedAccount.status || 'Active'}
                  </span>
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-item">
                  <span className="detail-label">Industry:</span>
                  <span className="detail-value">{selectedAccount.industry || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Annual Revenue:</span>
                  <span className="detail-value">{selectedAccount.annual_revenue || selectedAccount.revenue || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Employees:</span>
                  <span className="detail-value">{selectedAccount.number_of_employees || selectedAccount.employees || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Location:</span>
                  <span className="detail-value">
                    {selectedAccount.billing_city 
                      ? `${selectedAccount.billing_city}, ${selectedAccount.billing_state || ''}` 
                      : selectedAccount.location || 'N/A'}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Phone:</span>
                  <span className="detail-value">{selectedAccount.phone || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Website:</span>
                  <span className="detail-value">{selectedAccount.website || 'N/A'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Account Owner:</span>
                  <span className="detail-value">{selectedAccount.owner || 'Unassigned'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Contacts:</span>
                  <span className="detail-value">{selectedAccount.contacts || 0}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Opportunities:</span>
                  <span className="detail-value">{selectedAccount.opportunities || 0}</span>
                </div>
              </div>

              <div className="details-actions">
                <Button 
                  icon={<Edit size={16} />} 
                  onClick={() => {
                    handleEditAccount(selectedAccount)
                    handleCloseDetailsModal()
                  }}
                  variant="outline"
                >
                  Edit Account
                </Button>
                <Button 
                  icon={<Trash2 size={16} />} 
                  onClick={() => {
                    handleCloseDetailsModal()
                    handleDeleteAccount(selectedAccount.id)
                  }}
                  variant="outline"
                  style={{ color: '#ef4444', borderColor: '#ef4444' }}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <MUIFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        onApply={handleApplyFilters}
        filters={filters}
        filterConfigs={filterConfigs}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={cancelDeleteAccount}
        onConfirm={confirmDeleteAccount}
        title="Delete Account"
        message={
          accountToDelete 
            ? `Are you sure you want to delete "${accountToDelete.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this account?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      />
    </div>
  )
}

export default Accounts

