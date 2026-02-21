import React, { useState, useEffect } from 'react'
import { Plus, CheckCircle, Circle, Clock, X, Upload, Edit2, Trash2, GripVertical, Filter, Target, User, Calendar } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Loader from '../components/Loader'
import { TasksBoardSkeleton } from '../components/SkeletonLoader'
import ExcelUploadModal from '../components/ExcelUploadModal'
import MUIFilterPanel from '../components/MUIFilterPanel'
import Pagination from '../components/Pagination'
import { tasksApi } from '../services'
import './Tasks.css'
import '../components/ErrorState.css'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const DroppableColumn = ({ status, children, count }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  })

  return (
    <div className="kanban-column">
      <div className="column-header">
        <h3>{status}</h3>
        <span className="task-count">{count}</span>
      </div>
      <div 
        ref={setNodeRef} 
        className={`column-content ${isOver ? 'drag-over' : ''}`}
      >
        {children}
      </div>
    </div>
  )
}

const SortableTaskCard = ({ task, priorityColors, statusIcons, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const normalizedStatus = ['Open', 'In Progress', 'Completed', 'Closed'].includes(task.status)
    ? task.status === 'Open' ? 'To Do' : task.status === 'Closed' ? 'Completed' : task.status
    : task.status

  const StatusIcon = statusIcons[normalizedStatus] || Circle

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${normalizedStatus === 'Completed' ? 'completed' : ''}`}
    >
      <div className="task-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div {...attributes} {...listeners} className="drag-handle">
            <GripVertical size={16} />
          </div>
          <StatusIcon size={20} className={`task-status-icon ${normalizedStatus === 'In Progress' ? 'in-progress' : normalizedStatus === 'Completed' ? 'completed' : ''}`} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span 
            className="task-priority"
            style={{ 
              background: `${priorityColors[task.priority] || '#64748b'}20`,
              color: priorityColors[task.priority] || '#64748b'
            }}
          >
            {task.priority || 'Medium'}
          </span>
          <button
            className="task-action-btn"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(task)
            }}
            title="Edit task"
          >
            <Edit2 size={16} />
          </button>
          <button
            className="task-action-btn delete"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task)
            }}
            title="Delete task"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <h4 className="task-title">{task.title || task.subject}</h4>
      <p className="task-description">{task.description}</p>
      <div className="task-meta">
        <span className="task-due">Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}</span>
        <span className="task-related">{task.related_to || 'N/A'}</span>
      </div>
      <div className="task-assignee">{task.assigned_to || 'Unassigned'}</div>
    </div>
  )
}

const Tasks = () => {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filters, setFilters] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchTimeout, setSearchTimeout] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: 'To Do',
    due_date: '',
    assigned_to: '',
    related_to: '',
    contact_id: ''
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    fetchTasks()
  }, [currentPage, pageSize, searchQuery, filters])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [searchTimeout])

  const fetchTasks = async () => {
    try {
      // Only show full loader on initial load
      if (tasks.length === 0 && !searchQuery) {
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
      if (filters.priority && filters.priority.length > 0) {
        params.priority = filters.priority.join(',')
      }
      if (filters.assigned_to && filters.assigned_to.length > 0) {
        params.assigned_to = filters.assigned_to.join(',')
      }
      if (filters.related_to && filters.related_to.length > 0) {
        params.related_to = filters.related_to.join(',')
      }
      if (filters.due_date?.start) {
        params.due_date_start = filters.due_date.start
      }
      if (filters.due_date?.end) {
        params.due_date_end = filters.due_date.end
      }
      
      const response = await tasksApi.getAll(params)
      setTasks(response.items || [])
      setTotalPages(response.total_pages || 0)
      setTotalItems(response.total || 0)
    } catch (err) {
      console.error('Error fetching tasks:', err)
      setError('Failed to load tasks. Please try again.')
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

  const priorityColors = {
    'High': '#ef4444',
    'Medium': '#f59e0b',
    'Low': '#64748b'
  }

  const statusIcons = {
    'To Do': Circle,
    'In Progress': Clock,
    'Completed': CheckCircle
  }

  const normalizeStatus = (status) => {
    const statusMap = {
      'Open': 'To Do',
      'In Progress': 'In Progress',
      'Completed': 'Completed',
      'Closed': 'Completed'
    }
    return statusMap[status] || status
  }

  const getTasksByStatus = (status) => {
    return tasks.filter(t => normalizeStatus(t.status) === status)
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
    
    // Validate required fields
    if (!formData.title.trim()) {
      alert('Please enter a task title')
      return
    }

    try {
      setSubmitting(true)
      
      // Prepare data for submission
      const taskData = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        status: formData.status,
        due_date: formData.due_date || null,
        assigned_to: formData.assigned_to || null,
        related_to: formData.related_to || null,
        contact_id: formData.contact_id ? parseInt(formData.contact_id) : null
      }

      if (editingTask) {
        // Update existing task
        await tasksApi.update(editingTask.id, taskData)
      } else {
        // Create new task
        await tasksApi.create(taskData)
      }
      
      // Reset form and close modal
      setFormData({
        title: '',
        description: '',
        priority: 'Medium',
        status: 'To Do',
        due_date: '',
        assigned_to: '',
        related_to: '',
        contact_id: ''
      })
      setEditingTask(null)
      setShowModal(false)
      
      // Refresh tasks list
      await fetchTasks()
    } catch (err) {
      console.error('Error saving task:', err)
      alert(err.message || 'Failed to save task. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingTask(null)
    // Reset form data
    setFormData({
      title: '',
      description: '',
      priority: 'Medium',
      status: 'To Do',
      due_date: '',
      assigned_to: '',
      related_to: '',
      contact_id: ''
    })
  }

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const taskId = active.id
    let newStatus = over.id

    // If dropped over a task card (number ID), find which column it belongs to
    if (typeof newStatus === 'number') {
      const targetTask = tasks.find(t => t.id === newStatus)
      if (targetTask) {
        newStatus = normalizeStatus(targetTask.status)
      } else {
        console.error('Target task not found:', newStatus)
        return
      }
    }

    // Validate that newStatus is a valid column status
    if (typeof newStatus !== 'string' || !['To Do', 'In Progress', 'Completed'].includes(newStatus)) {
      console.error('Invalid drop target:', newStatus)
      return
    }

    // Find the task being dragged
    const task = tasks.find(t => t.id === taskId)
    if (!task) {
      console.error('Task not found:', taskId)
      return
    }

    const oldStatus = normalizeStatus(task.status)
    
    if (oldStatus === newStatus) return

    try {
      // Optimistically update UI
      setTasks(prevTasks =>
        prevTasks.map(t =>
          t.id === taskId ? { ...t, status: newStatus } : t
        )
      )

      // Update on backend - send only status field
      await tasksApi.update(taskId, { status: newStatus })
    } catch (err) {
      console.error('Error updating task status:', err)
      // Revert on error
      await fetchTasks()
      alert('Failed to update task status. Please try again.')
    }
  }

  const handleEditTask = (task) => {
    setEditingTask(task)
    setFormData({
      title: task.title || task.subject || '',
      description: task.description || '',
      priority: task.priority || 'Medium',
      status: normalizeStatus(task.status),
      due_date: task.due_date || '',
      assigned_to: task.assigned_to || '',
      related_to: task.related_to || '',
      contact_id: task.contact_id || ''
    })
    setShowModal(true)
  }

  const handleDeleteClick = (task) => {
    setTaskToDelete(task)
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return

    try {
      setSubmitting(true)
      await tasksApi.delete(taskToDelete.id)
      setShowDeleteModal(false)
      setTaskToDelete(null)
      await fetchTasks()
    } catch (err) {
      console.error('Error deleting task:', err)
      alert('Failed to delete task. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
    setTaskToDelete(null)
  }

  const handleExcelUpload = async (file, asyncMode = false) => {
    try {
      const result = await tasksApi.bulkUpload(file, asyncMode)
      
      // Only refresh immediately for synchronous uploads
      if (!result.async) {
        await fetchTasks()
      }
      
      return result
    } catch (err) {
      console.error('Error uploading Excel file:', err)
      throw err
    }
  }

  const handleGetUploadProgress = async (taskId) => {
    try {
      const progress = await tasksApi.getUploadProgress(taskId)
      
      // Refresh tasks list when upload completes
      if (progress.status === 'completed') {
        await fetchTasks()
      }
      
      return progress
    } catch (err) {
      console.error('Error getting upload progress:', err)
      throw err
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await tasksApi.downloadTemplate()
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
      filterOptionsCache = await tasksApi.getFilterOptions()
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
        return options.status || ['To Do', 'In Progress', 'Completed']
      }
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'multiselect',
      icon: <Target size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.priority || ['Low', 'Medium', 'High']
      }
    },
    {
      key: 'assigned_to',
      label: 'Assigned To',
      type: 'multiselect',
      icon: <User size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.assigned_to || []
      }
    },
    {
      key: 'related_to',
      label: 'Related To',
      type: 'multiselect',
      icon: <Target size={16} />,
      loadOptions: async () => {
        const options = await getFilterOptions()
        return options.related_to || []
      }
    },
    {
      key: 'due_date',
      label: 'Due Date',
      type: 'daterange',
      icon: <Calendar size={16} />
    }
  ]

  const groupedTasks = {
    'To Do': getTasksByStatus('To Do'),
    'In Progress': getTasksByStatus('In Progress'),
    'Completed': getTasksByStatus('Completed')
  }

  return (
    <div className="tasks-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">Manage and track your daily activities and follow-ups</p>
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
            Add Task
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '1rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', maxWidth: '100%' }}>
          <input 
            type="text" 
            placeholder="Search tasks..." 
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

      {loading ? (
        <TasksBoardSkeleton />
      ) : error ? (
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchTasks} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      ) : searching ? (
        <Card>
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            <Loader />
            <div style={{ marginTop: '8px' }}>Searching...</div>
          </div>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="tasks-kanban">
            {['To Do', 'In Progress', 'Completed'].map((status) => {
              const statusTasks = getTasksByStatus(status)
              return (
                <DroppableColumn key={status} status={status} count={statusTasks.length}>
                  <SortableContext
                    id={status}
                    items={statusTasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {statusTasks.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                        No tasks
                      </div>
                    ) : (
                      statusTasks.map((task) => (
                        <SortableTaskCard 
                          key={task.id} 
                          task={task} 
                          priorityColors={priorityColors} 
                          statusIcons={statusIcons} 
                          onEdit={handleEditTask} 
                          onDelete={handleDeleteClick}
                        />
                      ))
                    )}
                  </SortableContext>
                </DroppableColumn>
              )
            })}
          </div>
          <DragOverlay>
            {activeId ? (
              <div className="task-card dragging">
                {tasks.find(t => t.id === activeId)?.title || 'Task'}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
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

      {/* Add/Edit Task Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTask ? 'Edit Task' : 'Add New Task'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="title">
                  Title <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter task title"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter task description"
                  rows="4"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="priority">Priority</label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
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
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="due_date">Due Date</label>
                  <input
                    type="date"
                    id="due_date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
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

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="related_to">Related To</label>
                  <input
                    type="text"
                    id="related_to"
                    name="related_to"
                    value={formData.related_to}
                    onChange={handleInputChange}
                    placeholder="e.g., Account or Opportunity"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contact_id">Contact ID</label>
                  <input
                    type="number"
                    id="contact_id"
                    name="contact_id"
                    value={formData.contact_id}
                    onChange={handleInputChange}
                    placeholder="Enter contact ID"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting 
                    ? (editingTask ? 'Updating...' : 'Creating...') 
                    : (editingTask ? 'Update Task' : 'Create Task')
                  }
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Task</h2>
              <button className="modal-close" onClick={handleDeleteCancel}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this task?</p>
              <p style={{ fontWeight: 600, marginTop: '12px' }}>
                {taskToDelete?.title || taskToDelete?.subject}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={handleDeleteCancel}>
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleDeleteConfirm}
                disabled={submitting}
                style={{ background: 'var(--danger-color)', borderColor: 'var(--danger-color)' }}
              >
                {submitting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
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
        title="Upload Tasks from Excel"
        entityName="tasks"
      />

      {/* Filter Panel */}
      <MUIFilterPanel
        isOpen={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        onApply={handleApplyFilters}
        filters={filters}
        filterConfigs={filterConfigs}
      />
    </div>
  )
}

export default Tasks
