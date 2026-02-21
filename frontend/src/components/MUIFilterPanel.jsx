import React, { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight, Search } from 'lucide-react'
import Button from './Button'
import './MUIFilterPanel.css'

/**
 * Material-UI Style Filter Panel Component
 * 
 * Props:
 * - isOpen: boolean - Whether the filter panel is visible
 * - onClose: function - Callback when panel is closed
 * - onApply: function - Callback when filters are applied (receives filters object)
 * - filters: object - Current filter values
 * - filterConfigs: array - Configuration for each filter field
 */
const MUIFilterPanel = ({ 
  isOpen, 
  onClose, 
  onApply, 
  filters = {}, 
  filterConfigs = []
}) => {
  const [localFilters, setLocalFilters] = useState(filters)
  const [expandedSections, setExpandedSections] = useState({})
  const [loadingOptions, setLoadingOptions] = useState({})
  const [filterOptions, setFilterOptions] = useState({})
  const [searchTerms, setSearchTerms] = useState({})

  // Initialize local filters when props change
  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  // Load options for filters when panel opens
  useEffect(() => {
    if (isOpen) {
      loadAllFilterOptions()
      // Initialize all sections as expanded
      const initialExpanded = {}
      filterConfigs.forEach(config => {
        initialExpanded[config.key] = true
      })
      setExpandedSections(initialExpanded)
    }
  }, [isOpen])

  const loadAllFilterOptions = async () => {
    // Load all filter options in parallel for better performance
    const loadPromises = filterConfigs.map(async (config) => {
      if (config.loadOptions && !filterOptions[config.key]) {
        return loadFilterOptions(config.key, config.loadOptions)
      } else if (config.options) {
        setFilterOptions(prev => ({
          ...prev,
          [config.key]: config.options
        }))
        return Promise.resolve()
      }
      return Promise.resolve()
    })

    // Wait for all options to load in parallel
    await Promise.all(loadPromises)
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
    
    handleFilterChange(key, newValues.length > 0 ? newValues : undefined)
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
      if (value !== undefined && value !== null && value !== '' && 
          (!Array.isArray(value) || value.length > 0)) {
        acc[key] = value
      }
      return acc
    }, {})
    
    onApply(activeFilters)
    onClose()
  }

  const handleClear = () => {
    setLocalFilters({})
    setSearchTerms({})
    onApply({})
  }

  const handleClearField = (key) => {
    const newFilters = { ...localFilters }
    delete newFilters[key]
    setLocalFilters(newFilters)
  }

  const getActiveFilterCount = () => {
    return Object.entries(localFilters).filter(([key, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0
      }
      return value !== null && value !== undefined && value !== ''
    }).length
  }

  const getFilteredOptions = (key, options) => {
    const searchTerm = searchTerms[key]
    if (!searchTerm) return options
    
    return options.filter(option => 
      option.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const renderFilterField = (config) => {
    const { key, label, type, placeholder, icon } = config
    const value = localFilters[key]
    const options = filterOptions[key] || []
    const isLoading = loadingOptions[key]
    const isExpanded = expandedSections[key] !== false

    switch (type) {
      case 'select':
        return (
          <div key={key} className="mui-filter-field">
            <label className="mui-filter-label">
              {icon && <span className="mui-filter-icon">{icon}</span>}
              {label}
            </label>
            <select
              className="mui-filter-select"
              value={value || ''}
              onChange={(e) => handleFilterChange(key, e.target.value || undefined)}
              disabled={isLoading}
            >
              <option value="">All {label}</option>
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
        const selectedCount = (value || []).length
        const filteredOptions = getFilteredOptions(key, options)
        
        return (
          <div key={key} className="mui-filter-field">
            <div 
              className="mui-filter-header"
              onClick={() => toggleSection(key)}
            >
              <div className="mui-filter-header-left">
                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                {icon && <span className="mui-filter-icon">{icon}</span>}
                <label className="mui-filter-label">{label}</label>
              </div>
              {selectedCount > 0 && (
                <span className="mui-filter-chip">{selectedCount}</span>
              )}
            </div>
            
            {isExpanded && (
              <div className="mui-filter-content">
                {options.length > 5 && (
                  <div className="mui-filter-search">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder={`Search ${label.toLowerCase()}...`}
                      value={searchTerms[key] || ''}
                      onChange={(e) => setSearchTerms(prev => ({ ...prev, [key]: e.target.value }))}
                      className="mui-search-input"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                
                <div className="mui-filter-options">
                  {isLoading ? (
                    <div className="mui-filter-loading">
                      <div className="mui-spinner"></div>
                      Loading options...
                    </div>
                  ) : filteredOptions.length === 0 ? (
                    <div className="mui-filter-empty">
                      {searchTerms[key] ? 'No matches found' : 'No options available'}
                    </div>
                  ) : (
                    <>
                      {filteredOptions.map(option => (
                        <label key={option} className="mui-checkbox-label">
                          <input
                            type="checkbox"
                            checked={(value || []).includes(option)}
                            onChange={() => handleMultiSelectChange(key, option)}
                            className="mui-checkbox"
                          />
                          <span className="mui-checkbox-text">{option}</span>
                          {(value || []).includes(option) && (
                            <span className="mui-checkbox-check">✓</span>
                          )}
                        </label>
                      ))}
                    </>
                  )}
                </div>
                
                {selectedCount > 0 && (
                  <div className="mui-filter-actions">
                    <button 
                      className="mui-clear-btn"
                      onClick={() => handleClearField(key)}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )

      case 'range':
        return (
          <div key={key} className="mui-filter-field">
            <label className="mui-filter-label">
              {icon && <span className="mui-filter-icon">{icon}</span>}
              {label}
            </label>
            <div className="mui-filter-range">
              <input
                type="number"
                className="mui-filter-input"
                placeholder="Min"
                value={value?.min || ''}
                onChange={(e) => handleFilterChange(key, { ...(value || {}), min: e.target.value || undefined })}
              />
              <span className="mui-range-separator">—</span>
              <input
                type="number"
                className="mui-filter-input"
                placeholder="Max"
                value={value?.max || ''}
                onChange={(e) => handleFilterChange(key, { ...(value || {}), max: e.target.value || undefined })}
              />
            </div>
          </div>
        )

      case 'date':
        return (
          <div key={key} className="mui-filter-field">
            <label className="mui-filter-label">
              {icon && <span className="mui-filter-icon">{icon}</span>}
              {label}
            </label>
            <div className="mui-filter-date-range">
              <input
                type="date"
                className="mui-filter-input"
                value={value?.from || ''}
                onChange={(e) => handleFilterChange(key, { ...(value || {}), from: e.target.value || undefined })}
              />
              <span className="mui-range-separator">to</span>
              <input
                type="date"
                className="mui-filter-input"
                value={value?.to || ''}
                onChange={(e) => handleFilterChange(key, { ...(value || {}), to: e.target.value || undefined })}
              />
            </div>
          </div>
        )

      case 'text':
        return (
          <div key={key} className="mui-filter-field">
            <label className="mui-filter-label">
              {icon && <span className="mui-filter-icon">{icon}</span>}
              {label}
            </label>
            <input
              type="text"
              className="mui-filter-input"
              placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
              value={value || ''}
              onChange={(e) => handleFilterChange(key, e.target.value || undefined)}
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
      <div className="mui-filter-overlay" onClick={onClose} />
      <div className="mui-filter-panel">
        <div className="mui-filter-panel-header">
          <div>
            <h3 className="mui-filter-panel-title">Filters</h3>
            {activeCount > 0 && (
              <span className="mui-active-badge">{activeCount} active</span>
            )}
          </div>
          <button className="mui-close-btn" onClick={onClose} aria-label="Close filters">
            <X size={20} />
          </button>
        </div>

        <div className="mui-filter-panel-content">
          {filterConfigs.map(config => renderFilterField(config))}
        </div>

        <div className="mui-filter-panel-footer">
          <Button 
            variant="outline" 
            onClick={handleClear}
            disabled={activeCount === 0}
          >
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

export default MUIFilterPanel
