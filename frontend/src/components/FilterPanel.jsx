import React, { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import Button from './Button'
import './FilterPanel.css'

/**
 * Dynamic Filter Panel Component
 * 
 * Props:
 * - isOpen: boolean - Whether the filter panel is visible
 * - onClose: function - Callback when panel is closed
 * - onApply: function - Callback when filters are applied (receives filters object)
 * - filters: object - Current filter values
 * - filterConfigs: array - Configuration for each filter field
 *   Example: [
 *     {
 *       key: 'status',
 *       label: 'Status',
 *       type: 'select', // 'select', 'multiselect', 'range', 'date'
 *       options: ['New', 'Qualified', 'Lost'], // For select/multiselect
 *       loadOptions: async () => [...] // Optional: async function to load options
 *     }
 *   ]
 * - onLoadOptions: function - Optional callback to load filter options dynamically
 */
const FilterPanel = ({ 
  isOpen, 
  onClose, 
  onApply, 
  filters = {}, 
  filterConfigs = [],
  onLoadOptions
}) => {
  const [localFilters, setLocalFilters] = useState(filters)
  const [expandedSections, setExpandedSections] = useState({})
  const [loadingOptions, setLoadingOptions] = useState({})
  const [filterOptions, setFilterOptions] = useState({})

  // Initialize local filters when props change
  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  // Load options for filters when panel opens
  useEffect(() => {
    if (isOpen) {
      loadAllFilterOptions()
    }
  }, [isOpen])

  const loadAllFilterOptions = async () => {
    for (const config of filterConfigs) {
      if (config.loadOptions && !filterOptions[config.key]) {
        await loadFilterOptions(config.key, config.loadOptions)
      } else if (config.options) {
        setFilterOptions(prev => ({
          ...prev,
          [config.key]: config.options
        }))
      }
    }
  }

  const loadFilterOptions = async (key, loadFunction) => {
    setLoadingOptions(prev => ({ ...prev, [key]: true }))
    try {
      const options = await loadFunction()
      setFilterOptions(prev => ({
        ...prev,
        [key]: options
      }))
    } catch (error) {
      console.error(`Error loading options for ${key}:`, error)
    } finally {
      setLoadingOptions(prev => ({ ...prev, [key]: false }))
    }
  }

  const handleFilterChange = (key, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleMultiSelectChange = (key, option) => {
    const currentValues = localFilters[key] || []
    const newValues = currentValues.includes(option)
      ? currentValues.filter(v => v !== option)
      : [...currentValues, option]
    
    handleFilterChange(key, newValues)
  }

  const toggleSection = (key) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleApply = () => {
    // Remove empty filters
    const activeFilters = Object.entries(localFilters).reduce((acc, [key, value]) => {
      if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        acc[key] = value
      }
      return acc
    }, {})
    
    onApply(activeFilters)
    onClose()
  }

  const handleClear = () => {
    setLocalFilters({})
    onApply({})
  }

  const getActiveFilterCount = () => {
    return Object.entries(localFilters).filter(([key, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0
      }
      return value !== null && value !== undefined && value !== ''
    }).length
  }

  const renderFilterField = (config) => {
    const { key, label, type, placeholder } = config
    const value = localFilters[key]
    const options = filterOptions[key] || []
    const isLoading = loadingOptions[key]
    const isExpanded = expandedSections[key] !== false // Default to expanded

    switch (type) {
      case 'select':
        return (
          <div key={key} className="filter-field">
            <label className="filter-label">{label}</label>
            <select
              className="filter-select"
              value={value || ''}
              onChange={(e) => handleFilterChange(key, e.target.value)}
              disabled={isLoading}
            >
              <option value="">All</option>
              {isLoading ? (
                <option disabled>Loading...</option>
              ) : (
                options.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))
              )}
            </select>
          </div>
        )

      case 'multiselect':
        return (
          <div key={key} className="filter-field">
            <div 
              className="filter-label-collapsible"
              onClick={() => toggleSection(key)}
            >
              <label className="filter-label">{label}</label>
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {isExpanded && (
              <div className="filter-multiselect">
                {isLoading ? (
                  <div className="filter-loading">Loading options...</div>
                ) : options.length === 0 ? (
                  <div className="filter-empty">No options available</div>
                ) : (
                  options.map(option => (
                    <label key={option} className="filter-checkbox-label">
                      <input
                        type="checkbox"
                        checked={(value || []).includes(option)}
                        onChange={() => handleMultiSelectChange(key, option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>
        )

      case 'range':
        return (
          <div key={key} className="filter-field">
            <label className="filter-label">{label}</label>
            <div className="filter-range">
              <input
                type="number"
                className="filter-input"
                placeholder="Min"
                value={value?.min || ''}
                onChange={(e) => handleFilterChange(key, { ...(value || {}), min: e.target.value })}
              />
              <span className="filter-range-separator">to</span>
              <input
                type="number"
                className="filter-input"
                placeholder="Max"
                value={value?.max || ''}
                onChange={(e) => handleFilterChange(key, { ...(value || {}), max: e.target.value })}
              />
            </div>
          </div>
        )

      case 'date':
        return (
          <div key={key} className="filter-field">
            <label className="filter-label">{label}</label>
            <div className="filter-date-range">
              <input
                type="date"
                className="filter-input"
                value={value?.from || ''}
                onChange={(e) => handleFilterChange(key, { ...(value || {}), from: e.target.value })}
              />
              <span className="filter-range-separator">to</span>
              <input
                type="date"
                className="filter-input"
                value={value?.to || ''}
                onChange={(e) => handleFilterChange(key, { ...(value || {}), to: e.target.value })}
              />
            </div>
          </div>
        )

      case 'text':
        return (
          <div key={key} className="filter-field">
            <label className="filter-label">{label}</label>
            <input
              type="text"
              className="filter-input"
              placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
              value={value || ''}
              onChange={(e) => handleFilterChange(key, e.target.value)}
            />
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  const activeCount = getActiveFilterCount()

  return (
    <>
      <div className="filter-overlay" onClick={onClose} />
      <div className="filter-panel">
        <div className="filter-panel-header">
          <div>
            <h3 className="filter-panel-title">Filters</h3>
            {activeCount > 0 && (
              <span className="filter-active-badge">{activeCount} active</span>
            )}
          </div>
          <button className="filter-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="filter-panel-content">
          {filterConfigs.map(config => renderFilterField(config))}
        </div>

        <div className="filter-panel-footer">
          <Button variant="outline" onClick={handleClear}>
            Clear All
          </Button>
          <Button onClick={handleApply}>
            Apply Filters
          </Button>
        </div>
      </div>
    </>
  )
}

export default FilterPanel
