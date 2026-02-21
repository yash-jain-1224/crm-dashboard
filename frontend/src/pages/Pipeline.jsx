import React, { useState, useEffect } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import Loader from '../components/Loader'
import { PipelineSkeleton } from '../components/SkeletonLoader'
import { opportunitiesApi } from '../services'
import './Pipeline.css'
import '../components/ErrorState.css'

const Pipeline = () => {
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [draggedDeal, setDraggedDeal] = useState(null)
  const [dragOverStage, setDragOverStage] = useState(null)

  useEffect(() => {
    fetchOpportunities()
  }, [])

  const fetchOpportunities = async () => {
    try {
      setLoading(true)
      setError(null)
      // API returns paginated response with 'items' array
      const response = await opportunitiesApi.getAll({ page_size: 100 })
      // Extract items from paginated response
      const items = response?.items || response || []
      setOpportunities(Array.isArray(items) ? items : [])
    } catch (err) {
      console.error('Error fetching opportunities:', err)
      setError('Failed to load pipeline. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stageOrder = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won']
  
  const pipelineStages = stageOrder.map(stageName => {
    // Ensure opportunities is an array
    const opportunitiesArray = Array.isArray(opportunities) ? opportunities : []
    
    const deals = opportunitiesArray
      .filter(opp => opp?.stage === stageName)
      .map(opp => ({
        id: opp.id,
        company: opp.account || 'Unknown',
        value: typeof opp.value === 'number' ? `$${opp.value.toLocaleString()}` : String(opp.value || '0'),
        probability: opp.probability || 0,
        amount: typeof opp.value === 'number' ? opp.value : parseFloat(String(opp.value || '0').replace(/[$,]/g, '')) || 0
      }))
    
    return {
      name: stageName,
      deals
    }
  })

  const getTotalValue = (deals) => {
    return deals.reduce((sum, deal) => sum + deal.amount, 0).toLocaleString()
  }

  const getWeightedValue = (deals) => {
    return Math.round(deals.reduce((sum, deal) => 
      sum + (deal.amount * deal.probability / 100), 0
    )).toLocaleString()
  }

  // Drag and Drop handlers
  const handleDragStart = (e, deal, currentStage) => {
    setDraggedDeal({ ...deal, currentStage })
    e.dataTransfer.effectAllowed = 'move'
    e.currentTarget.classList.add('dragging')
  }

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging')
    setDraggedDeal(null)
    setDragOverStage(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e, stageName) => {
    e.preventDefault()
    setDragOverStage(stageName)
  }

  const handleDragLeave = (e) => {
    // Only clear if we're leaving the stage container itself
    if (e.currentTarget === e.target) {
      setDragOverStage(null)
    }
  }

  const handleDrop = async (e, targetStage) => {
    e.preventDefault()
    setDragOverStage(null)

    if (!draggedDeal || draggedDeal.currentStage === targetStage) {
      return
    }

    const previousStage = draggedDeal.currentStage

    // Optimistic update - update UI immediately
    setOpportunities(prevOpportunities => 
      prevOpportunities.map(opp => 
        opp.id === draggedDeal.id 
          ? { ...opp, stage: targetStage }
          : opp
      )
    )

    try {
      // Update via API in background
      await opportunitiesApi.update(draggedDeal.id, { stage: targetStage })
    } catch (err) {
      console.error('Error updating opportunity stage:', err)
      
      // Revert on error
      setOpportunities(prevOpportunities => 
        prevOpportunities.map(opp => 
          opp.id === draggedDeal.id 
            ? { ...opp, stage: previousStage }
            : opp
        )
      )
      
      setError('Failed to update opportunity. Please try again.')
      setTimeout(() => setError(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="pipeline-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Sales Pipeline</h1>
            <p className="page-subtitle">Visualize and manage opportunities across different sales stages</p>
          </div>
        </div>
        <PipelineSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="pipeline-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Sales Pipeline</h1>
            <p className="page-subtitle">Visualize and manage opportunities across different sales stages</p>
          </div>
        </div>
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchOpportunities} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="pipeline-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Pipeline</h1>
          <p className="page-subtitle">Visualize and manage opportunities across different sales stages</p>
        </div>
      </div>

      {loading ? (
        <Card>
          <Loader text="Loading pipeline..." />
        </Card>
      ) : error ? (
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchOpportunities} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      ) : (
        <div className="pipeline-view">
        {pipelineStages.map((stage, index) => (
          <div 
            key={index} 
            className={`pipeline-stage ${dragOverStage === stage.name ? 'drag-over' : ''}`}
          >
            <div className="stage-header">
              <h3 className="stage-name">{stage.name}</h3>
              <div className="stage-metrics">
                <div className="stage-count">{stage.deals.length} deals</div>
                <div className="stage-value">${getTotalValue(stage.deals)}</div>
                <div className="stage-weighted">Weighted: ${getWeightedValue(stage.deals)}</div>
              </div>
            </div>
            
            <div className="stage-deals"
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, stage.name)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.name)}
            >
              {stage.deals.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                  No opportunities
                </div>
              ) : (
                stage.deals.map((deal) => (
                  <div 
                    key={deal.id} 
                    className="pipeline-deal"
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal, stage.name)}
                    onDragEnd={handleDragEnd}
                  >
                    <h4 className="deal-company">{deal.company}</h4>
                    <div className="deal-value">{deal.value}</div>
                    <div className="deal-probability">
                      <div className="probability-bar-container">
                        <div 
                          className="probability-bar-fill"
                          style={{ width: `${deal.probability}%` }}
                        />
                      </div>
                      <span className="probability-text">{deal.probability}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

export default Pipeline
