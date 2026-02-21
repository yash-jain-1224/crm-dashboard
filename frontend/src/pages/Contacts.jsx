import React, { useState, useEffect } from 'react'
import { Plus, Mail, Phone, MapPin, Building2, Edit, Trash2, Filter, Upload, X, User, Briefcase } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Loader from '../components/Loader'
import { CardListSkeleton } from '../components/SkeletonLoader'
import ExcelUploadModal from '../components/ExcelUploadModal'
import ConfirmationModal from '../components/ConfirmationModal'
import MUIFilterPanel from '../components/MUIFilterPanel'
import Pagination from '../components/Pagination'
import { useToast } from '../components/Toast'
import { contactsApi } from '../services'
import './Contacts.css'
import '../components/ErrorState.css'

const Contacts = () => {
  const toast = useToast()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [contactToDelete, setContactToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [filters, setFilters] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTimeout, setSearchTimeout] = useState(null)
  const [editingContact, setEditingContact] = useState(null)
  const [editFormData, setEditFormData] = useState({})
  const [saving, setSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false) // Flag to prevent GET API during upload
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    location: '',
    status: 'Active',
    last_contact: ''
  })
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Prevent fetching contacts during upload
    if (!isUploading) {
      fetchContacts()
    }
  }, [currentPage, pageSize, searchQuery, filters, isUploading])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  const fetchContacts = async () => {
    try {
      // Only show full loader on initial load
      if (contacts.length === 0 && !searchQuery) {
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
      if (filters.company && filters.company.length > 0) {
        params.company = filters.company.join(',')
      }
      if (filters.position && filters.position.length > 0) {
        params.position = filters.position.join(',')
      }
      if (filters.location && filters.location.length > 0) {
        params.location = filters.location.join(',')
      }
      
      const response = await contactsApi.getAll(params)
      setContacts(response.items || [])
      setTotalPages(response.total_pages || 0)
      setTotalItems(response.total || 0)
      setError(null)
    } catch (err) {
      console.error('Error fetching contacts:', err)
      setError('Failed to load contacts. Please try again.')
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

  const handleDelete = async (id) => {
    const contact = contacts.find(c => c.id === id)
    setContactToDelete(contact)
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!contactToDelete) return

    setDeleting(true)
    try {
      await contactsApi.delete(contactToDelete.id)
      // Remove from local state immediately
      setContacts(contacts.filter(c => c.id !== contactToDelete.id))
      // Update total items
      setTotalItems(prev => prev - 1)
      // Close the modal
      setShowDeleteConfirm(false)
      setContactToDelete(null)
      toast.success('Contact deleted successfully!')
    } catch (err) {
      console.error('Error deleting contact:', err)
      // Show error but keep modal open so user can retry or close
      toast.error('Failed to delete contact. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setContactToDelete(null)
  }

  const handleEditContact = (contact) => {
    setEditingContact(contact.id)
    setEditFormData({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
      position: contact.position || '',
      location: contact.location || '',
      status: contact.status || 'Active'
    })
  }

  const handleCancelEdit = () => {
    setEditingContact(null)
    setEditFormData({})
  }

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSaveContact = async (contactId) => {
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
    
    setSaving(true)
    try {
      const updatedContact = await contactsApi.update(contactId, editFormData)
      
      // Update the contacts list with the updated contact
      setContacts(contacts.map(c => 
        c.id === contactId ? { ...c, ...updatedContact } : c
      ))
      
      setEditingContact(null)
      setEditFormData({})
      toast.success('Contact updated successfully!')
    } catch (err) {
      console.error('Error updating contact:', err)
      toast.error(err.message || 'Failed to update contact')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenModal = () => {
    setShowModal(true)
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      position: '',
      location: '',
      status: 'Active',
      last_contact: ''
    })
    setFormErrors({})
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      position: '',
      location: '',
      status: 'Active',
      last_contact: ''
    })
    setFormErrors({})
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error for this field when user starts typing
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
      errors.name = 'Name is required'
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format'
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

    setSubmitting(true)
    try {
      const newContact = await contactsApi.create(formData)
      setContacts(prev => [newContact, ...prev])
      handleCloseModal()
      toast.success('Contact created successfully!')
    } catch (err) {
      console.error('Error creating contact:', err)
      toast.error(err.message || 'Failed to create contact')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExcelUpload = async (file, asyncMode = false) => {
    try {
      // Set uploading flag to prevent GET API calls
      setIsUploading(true)
      
      const result = await contactsApi.bulkUpload(file, asyncMode)
      
      // Only refresh immediately for synchronous uploads
      if (!result.async) {
        // Reset upload flag before fetching
        setIsUploading(false)
        await fetchContacts()
      }
      // For async uploads, the flag will be reset in handleGetUploadProgress
      
      return result
    } catch (err) {
      console.error('Error uploading Excel file:', err)
      // Reset upload flag on error
      setIsUploading(false)
      throw err
    }
  }

  const handleGetUploadProgress = async (taskId) => {
    try {
      const progress = await contactsApi.getUploadProgress(taskId)
      
      // Refresh contacts list when upload completes
      if (progress.status === 'completed') {
        // Reset upload flag before fetching
        setIsUploading(false)
        await fetchContacts()
      } else if (progress.status === 'failed') {
        // Reset upload flag on failure
        setIsUploading(false)
      }
      
      return progress
    } catch (err) {
      console.error('Error getting upload progress:', err)
      // Reset upload flag on error
      setIsUploading(false)
      throw err
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await contactsApi.downloadTemplate()
    } catch (err) {
      console.error('Error downloading template:', err)
      throw err
    }
  }

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Shared filter options cache to avoid multiple API calls
  let filterOptionsCache = null
  const getFilterOptions = async () => {
    if (!filterOptionsCache) {
      filterOptionsCache = await contactsApi.getFilterOptions()
    }
    return filterOptionsCache
  }

  const filterConfigs = [
    {
      key: 'status',
      label: 'Status',
      type: 'multiselect',
      icon: <User size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.status || []
      }
    },
    {
      key: 'company',
      label: 'Company',
      type: 'multiselect',
      icon: <Building2 size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.company || []
      }
    },
    {
      key: 'position',
      label: 'Position',
      type: 'multiselect',
      icon: <Briefcase size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.position || []
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
    }
  ]

  return (
    <div className="contacts-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contacts</h1>
          <p className="page-subtitle">Manage your customer relationships and contact information</p>
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
            Add Contact
          </Button>
        </div>
      </div>

      {loading ? (
        <CardListSkeleton count={6} size="medium" />
      ) : error ? (
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchContacts} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="contacts-toolbar">
            <div className="search-filter">
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1 }}>
                <input 
                  type="text" 
                  placeholder="Search contacts..." 
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
          </div>

          {searching ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <Loader />
              <div style={{ marginTop: '8px' }}>Searching...</div>
            </div>
          ) : (
            <div className="contacts-grid">
              {contacts.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', gridColumn: '1 / -1' }}>
                  {searchQuery ? 'No contacts found matching your search.' : 'No contacts found. Click "Add Contact" to create one.'}
                </div>
              ) : (
                contacts.map((contact) => (
            <div key={contact.id} className="contact-card">
              <div className="contact-avatar">
                {contact.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="contact-info">
                <h3 className="contact-name">{contact.name}</h3>
                <p className="contact-position">{contact.position} at {contact.company}</p>
                
                <div className="contact-details">
                  <div className="contact-detail">
                    <Mail size={16} />
                    <span>{contact.email}</span>
                  </div>
                  <div className="contact-detail">
                    <Phone size={16} />
                    <span>{contact.phone}</span>
                  </div>
                  <div className="contact-detail">
                    <MapPin size={16} />
                    <span>{contact.location}</span>
                  </div>
                </div>

                <div className="contact-footer">
                  <span className={`status-badge ${contact.status.toLowerCase()}`}>
                    {contact.status}
                  </span>
                </div>
              </div>
              
              <div className="contact-actions">
                <button className="action-btn" title="Edit" onClick={() => handleEditContact(contact)}>
                  <Edit size={16} />
                </button>
                <button 
                  className="action-btn danger" 
                  title="Delete" 
                  onClick={() => handleDelete(contact.id)}
                  disabled={deleting && contactToDelete?.id === contact.id}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
          )}
        </div>
          )}
        
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
      )}

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Contact</h2>
              <button className="close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="name" className="form-label">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Enter name"
                />
                {formErrors.name && <div className="form-error">{formErrors.name}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Enter email"
                />
                {formErrors.email && <div className="form-error">{formErrors.email}</div>}
              </div>
              <div className="form-group">
                <label htmlFor="phone" className="form-label">Phone</label>
                <input
                  type="text"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Enter phone number"
                />
              </div>
              <div className="form-group">
                <label htmlFor="company" className="form-label">Company</label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Enter company name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="position" className="form-label">Position</label>
                <input
                  type="text"
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Enter position"
                />
              </div>
              <div className="form-group">
                <label htmlFor="location" className="form-label">Location</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  className="form-input"
                  placeholder="Enter location"
                />
              </div>
              <div className="form-group">
                <label htmlFor="status" className="form-label">Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="last_contact" className="form-label">Last Contact</label>
                <input
                  type="date"
                  id="last_contact"
                  name="last_contact"
                  value={formData.last_contact}
                  onChange={handleInputChange}
                  className="form-input"
                />
              </div>
              <div className="modal-footer">
                <Button onClick={handleCloseModal} variant="outline" disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Contact'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      <ExcelUploadModal
        isOpen={showExcelModal}
        onClose={() => {
          setShowExcelModal(false)
          // Reset upload flag when modal is closed
          setIsUploading(false)
        }}
        onUpload={handleExcelUpload}
        onDownloadTemplate={handleDownloadTemplate}
        onGetProgress={handleGetUploadProgress}
        title="Upload Contacts from Excel"
        entityName="contacts"
      />

      <MUIFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        onApply={handleApplyFilters}
        filters={filters}
        filterConfigs={filterConfigs}
      />

      {/* Edit Contact Inline */}
      {editingContact && (
        <div className="edit-contact-overlay" onClick={handleCancelEdit}>
          <div className="edit-contact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-contact-header">
              <h2 className="edit-contact-title">Edit Contact</h2>
              <button className="close-btn" onClick={handleCancelEdit}>×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveContact(editingContact) }} className="edit-contact-form">
              <div className="form-group">
                <label htmlFor="edit_name" className="form-label">
                  Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  id="edit_name"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  className="form-input"
                  placeholder="Enter name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_email" className="form-label">
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  id="edit_email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  className="form-input"
                  placeholder="Enter email"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_phone" className="form-label">Phone</label>
                <input
                  type="text"
                  id="edit_phone"
                  name="phone"
                  value={editFormData.phone}
                  onChange={handleEditInputChange}
                  className="form-input"
                  placeholder="Enter phone number"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_company" className="form-label">Company</label>
                <input
                  type="text"
                  id="edit_company"
                  name="company"
                  value={editFormData.company}
                  onChange={handleEditInputChange}
                  className="form-input"
                  placeholder="Enter company name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_position" className="form-label">Position</label>
                <input
                  type="text"
                  id="edit_position"
                  name="position"
                  value={editFormData.position}
                  onChange={handleEditInputChange}
                  className="form-input"
                  placeholder="Enter position"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_location" className="form-label">Location</label>
                <input
                  type="text"
                  id="edit_location"
                  name="location"
                  value={editFormData.location}
                  onChange={handleEditInputChange}
                  className="form-input"
                  placeholder="Enter location"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit_status" className="form-label">Status</label>
                <select
                  id="edit_status"
                  name="status"
                  value={editFormData.status}
                  onChange={handleEditInputChange}
                  className="form-select"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="edit-contact-footer">
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
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Contact"
        message={
          contactToDelete 
            ? `Are you sure you want to delete "${contactToDelete.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this contact?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        loading={deleting}
      />
    </div>
  )
}

export default Contacts
