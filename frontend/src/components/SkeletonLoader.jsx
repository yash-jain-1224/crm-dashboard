import React from 'react'
import './SkeletonLoader.css'

// Dashboard Skeleton
export const DashboardSkeleton = () => (
  <div className="dashboard-skeleton">
    <div className="skeleton-stats-grid">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton skeleton-stat-card" />
      ))}
    </div>
    
    <div className="skeleton-charts-grid">
      <div className="skeleton skeleton-chart" />
      <div className="skeleton skeleton-chart" />
    </div>
    
    <div className="skeleton-tables-grid">
      <div className="skeleton skeleton-table" />
      <div className="skeleton skeleton-table" />
    </div>
  </div>
)

// Table Skeleton
export const TableSkeleton = ({ rows = 5, columns = 6 }) => (
  <div className="table-skeleton">
    <div className="skeleton-table-header">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="skeleton skeleton-header-cell" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton-table-row">
        {Array.from({ length: columns }).map((_, j) => (
          <div key={j} className="skeleton skeleton-cell" />
        ))}
      </div>
    ))}
  </div>
)

// Card List Skeleton (for Leads, Contacts, Accounts, Opportunities)
export const CardListSkeleton = ({ count = 6, size = 'medium' }) => (
  <div className="card-list-skeleton">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`skeleton skeleton-card ${size}`} />
    ))}
  </div>
)

// Calendar Skeleton
export const CalendarSkeleton = () => (
  <div className="calendar-skeleton">
    <div className="skeleton-calendar-header">
      <div className="skeleton skeleton-calendar-title" />
      <div className="skeleton-calendar-controls">
        <div className="skeleton skeleton-calendar-button" />
        <div className="skeleton skeleton-calendar-button" />
      </div>
    </div>
    <div className="skeleton skeleton-calendar-grid" />
    <div className="skeleton skeleton-events-list" />
  </div>
)

// Pipeline Skeleton
export const PipelineSkeleton = () => (
  <div className="pipeline-skeleton">
    <div className="skeleton-pipeline-columns">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton-pipeline-column">
          <div className="skeleton skeleton-pipeline-column-header" />
          {[1, 2, 3].map(j => (
            <div key={j} className="skeleton skeleton-pipeline-deal" />
          ))}
        </div>
      ))}
    </div>
  </div>
)

// Reports Skeleton
export const ReportsSkeleton = () => (
  <div className="reports-skeleton">
    <div className="skeleton-report-header">
      <div className="skeleton skeleton-report-title" />
      <div className="skeleton skeleton-export-button" />
    </div>
    
    <div className="skeleton-metrics-grid">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton skeleton-metric" />
      ))}
    </div>
    
    <div className="skeleton-charts-grid">
      <div className="skeleton skeleton-chart" />
      <div className="skeleton skeleton-chart" />
    </div>
    
    <div className="skeleton skeleton-chart" />
  </div>
)

// Tasks Board Skeleton
export const TasksBoardSkeleton = () => (
  <div className="tasks-board-skeleton">
    {['To Do', 'In Progress', 'Completed'].map((status, i) => (
      <div key={i} className="skeleton-task-column">
        <div className="skeleton skeleton-task-column-header" />
        {[1, 2, 3, 4].map(j => (
          <div key={j} className="skeleton skeleton-task-card-simple" />
        ))}
      </div>
    ))}
  </div>
)

// Email Campaigns Skeleton
export const EmailCampaignsSkeleton = () => (
  <div className="card-list-skeleton">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="skeleton skeleton-card large" />
    ))}
  </div>
)

// Generic Form Skeleton
export const FormSkeleton = () => (
  <div className="form-skeleton">
    <div className="skeleton-form-row">
      <div className="skeleton skeleton-input" />
      <div className="skeleton skeleton-input" />
    </div>
    <div className="skeleton-form-row">
      <div className="skeleton skeleton-input" />
      <div className="skeleton skeleton-input" />
    </div>
    <div className="skeleton skeleton-textarea" />
    <div className="skeleton-form-row">
      <div className="skeleton skeleton-input" />
      <div className="skeleton skeleton-input" />
    </div>
    <div className="skeleton skeleton-button" />
  </div>
)

export default {
  DashboardSkeleton,
  TableSkeleton,
  CardListSkeleton,
  CalendarSkeleton,
  PipelineSkeleton,
  ReportsSkeleton,
  TasksBoardSkeleton,
  EmailCampaignsSkeleton,
  FormSkeleton
}

// ============================================
// SPECIALIZED SKELETON COMPONENTS
// ============================================

// Specialized Card Skeletons
export const LeadCardSkeleton = () => (
  <div className="skeleton-card-wrapper">
    <div className="skeleton-lead-card">
      <div className="skeleton skeleton-avatar" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-subtitle" />
      <div className="skeleton-badges">
        <div className="skeleton skeleton-badge" />
        <div className="skeleton skeleton-badge" />
      </div>
      <div className="skeleton-details">
        <div className="skeleton skeleton-detail-line" />
        <div className="skeleton skeleton-detail-line" style={{ width: '80%' }} />
        <div className="skeleton skeleton-detail-line" style={{ width: '90%' }} />
      </div>
      <div className="skeleton-footer">
        <div className="skeleton skeleton-score" />
        <div className="skeleton-actions">
          <div className="skeleton skeleton-action-btn" />
          <div className="skeleton skeleton-action-btn" />
        </div>
      </div>
    </div>
  </div>
)

export const ContactCardSkeleton = () => (
  <div className="skeleton-card-wrapper">
    <div className="skeleton-contact-card">
      <div className="skeleton skeleton-avatar" />
      <div className="skeleton skeleton-name" />
      <div className="skeleton skeleton-role" />
      <div className="skeleton-info-grid">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton-info-item">
            <div className="skeleton skeleton-icon" />
            <div className="skeleton skeleton-text" />
          </div>
        ))}
      </div>
      <div className="skeleton-button-group">
        <div className="skeleton skeleton-btn" />
        <div className="skeleton skeleton-btn" />
      </div>
    </div>
  </div>
)

export const AccountCardSkeleton = () => (
  <div className="skeleton-card-wrapper">
    <div className="skeleton-account-card">
      <div className="skeleton-header">
        <div className="skeleton skeleton-icon-large" />
        <div className="skeleton skeleton-status" />
      </div>
      <div className="skeleton skeleton-company-name" />
      <div className="skeleton skeleton-industry" />
      <div className="skeleton-stats">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-stat-item">
            <div className="skeleton skeleton-stat-icon" />
            <div className="skeleton skeleton-stat-value" />
          </div>
        ))}
      </div>
    </div>
  </div>
)

export const OpportunityCardSkeleton = () => (
  <div className="skeleton-card-wrapper">
    <div className="skeleton-opportunity-card">
      <div className="skeleton-top-section">
        <div className="skeleton skeleton-opp-name" />
        <div className="skeleton skeleton-amount" />
      </div>
      <div className="skeleton skeleton-company" />
      <div className="skeleton skeleton-progress-bar" />
      <div className="skeleton-metadata">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton skeleton-meta-item" />
        ))}
      </div>
      <div className="skeleton skeleton-stage-badge" />
    </div>
  </div>
)

export const CampaignCardSkeleton = () => (
  <div className="skeleton-card-wrapper">
    <div className="skeleton-campaign-card">
      <div className="skeleton-campaign-header">
        <div className="skeleton skeleton-campaign-name" />
        <div className="skeleton skeleton-campaign-status" />
      </div>
      <div className="skeleton skeleton-subject" />
      <div className="skeleton-metrics">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-metric">
            <div className="skeleton skeleton-metric-label" />
            <div className="skeleton skeleton-metric-value" />
          </div>
        ))}
      </div>
      <div className="skeleton skeleton-date" />
    </div>
  </div>
)

export const TaskCardSkeleton = () => (
  <div className="skeleton-card-wrapper">
    <div className="skeleton-task-card">
      <div className="skeleton-task-header">
        <div className="skeleton skeleton-checkbox" />
        <div className="skeleton skeleton-task-title" />
      </div>
      <div className="skeleton skeleton-task-desc" />
      <div className="skeleton-task-meta">
        <div className="skeleton skeleton-priority" />
        <div className="skeleton skeleton-due-date" />
        <div className="skeleton skeleton-assignee" />
      </div>
    </div>
  </div>
)

// Specialized Table Skeletons
export const DataTableSkeleton = ({ rows = 5, columns = 6 }) => (
  <div className="skeleton-table-wrapper">
    <div className="skeleton-data-table">
      <div className="skeleton-thead">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="skeleton skeleton-th" />
        ))}
      </div>
      <div className="skeleton-tbody">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton-tr">
            {Array.from({ length: columns }).map((_, j) => (
              <div key={j} className="skeleton skeleton-td" />
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
)

export const ListTableSkeleton = ({ rows = 5 }) => (
  <div className="skeleton-list-table">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton-list-item">
        <div className="skeleton skeleton-item-avatar" />
        <div className="skeleton-item-content">
          <div className="skeleton skeleton-item-title" />
          <div className="skeleton skeleton-item-subtitle" />
        </div>
        <div className="skeleton-item-actions">
          <div className="skeleton skeleton-action-icon" />
          <div className="skeleton skeleton-action-icon" />
        </div>
      </div>
    ))}
  </div>
)

// Chart Skeletons
export const BarChartSkeleton = () => (
  <div className="skeleton-chart-wrapper">
    <div className="skeleton-chart-header">
      <div className="skeleton skeleton-chart-title" />
      <div className="skeleton-chart-legend">
        <div className="skeleton skeleton-legend-item" />
        <div className="skeleton skeleton-legend-item" />
      </div>
    </div>
    <div className="skeleton-bar-chart">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="skeleton-bar" />
      ))}
    </div>
  </div>
)

export const LineChartSkeleton = () => (
  <div className="skeleton-chart-wrapper">
    <div className="skeleton-chart-header">
      <div className="skeleton skeleton-chart-title" />
      <div className="skeleton-chart-legend">
        <div className="skeleton skeleton-legend-item" />
        <div className="skeleton skeleton-legend-item" />
      </div>
    </div>
    <div className="skeleton-line-chart">
      <div className="skeleton-line-path" />
    </div>
  </div>
)

export const PieChartSkeleton = () => (
  <div className="skeleton-chart-wrapper">
    <div className="skeleton-chart-header">
      <div className="skeleton skeleton-chart-title" />
    </div>
    <div className="skeleton-pie-chart" />
  </div>
)

// Stat Card Skeleton
export const StatCardSkeleton = () => (
  <div className="skeleton-stat-card-detailed">
    <div className="skeleton-stat-header">
      <div className="skeleton skeleton-stat-icon" />
      <div className="skeleton skeleton-trend" />
    </div>
    <div className="skeleton skeleton-stat-label" />
    <div className="skeleton skeleton-stat-value" />
    <div className="skeleton skeleton-stat-change" />
  </div>
)

// Page Elements
export const PageHeaderSkeleton = ({ withActions = true }) => (
  <div className="skeleton-page-header">
    <div className="skeleton-page-title">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-subtitle" />
    </div>
    {withActions && (
      <div className="skeleton-page-actions">
        <div className="skeleton skeleton-action-btn" />
        <div className="skeleton skeleton-action-btn" />
      </div>
    )}
  </div>
)

export const SearchBarSkeleton = () => (
  <div className="skeleton-search-bar">
    <div className="skeleton skeleton-search-input" />
    <div className="skeleton skeleton-filter-button" />
  </div>
)

// Enhanced Page Skeletons
export const EnhancedDashboardSkeleton = () => (
  <div className="dashboard-skeleton">
    <div className="skeleton-stats-grid">
      {[1, 2, 3, 4].map(i => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
    
    <div className="skeleton-charts-grid">
      <BarChartSkeleton />
      <LineChartSkeleton />
    </div>
    
    <div className="skeleton-charts-grid">
      <PieChartSkeleton />
      <DataTableSkeleton rows={5} columns={4} />
    </div>
  </div>
)

export const EnhancedLeadsSkeleton = ({ count = 6 }) => (
  <div>
    <SearchBarSkeleton />
    <div className="card-list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <LeadCardSkeleton key={i} />
      ))}
    </div>
  </div>
)

export const EnhancedContactsSkeleton = ({ count = 6 }) => (
  <div>
    <SearchBarSkeleton />
    <div className="card-list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <ContactCardSkeleton key={i} />
      ))}
    </div>
  </div>
)

export const EnhancedAccountsSkeleton = ({ count = 6 }) => (
  <div>
    <SearchBarSkeleton />
    <div className="card-list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <AccountCardSkeleton key={i} />
      ))}
    </div>
  </div>
)

export const EnhancedOpportunitiesSkeleton = ({ count = 6 }) => (
  <div>
    <SearchBarSkeleton />
    <div className="card-list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <OpportunityCardSkeleton key={i} />
      ))}
    </div>
  </div>
)

export const EnhancedEmailCampaignsSkeleton = ({ count = 6 }) => (
  <div>
    <div className="skeleton-stats-grid">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton skeleton-stat-card" style={{ height: '100px' }} />
      ))}
    </div>
    <div className="card-list-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <CampaignCardSkeleton key={i} />
      ))}
    </div>
  </div>
)

export const EnhancedTasksBoardSkeleton = () => (
  <div className="tasks-board-skeleton">
    {['To Do', 'In Progress', 'Completed'].map((status, i) => (
      <div key={i} className="skeleton-task-column">
        <div className="skeleton skeleton-task-column-header" />
        {[1, 2, 3, 4].map(j => (
          <TaskCardSkeleton key={j} />
        ))}
      </div>
    ))}
  </div>
)

export const PipelineDealCardSkeleton = () => (
  <div className="skeleton-pipeline-deal-card">
    <div className="skeleton skeleton-deal-company" />
    <div className="skeleton skeleton-deal-value" />
    <div className="skeleton-deal-meta">
      <div className="skeleton skeleton-probability" />
      <div className="skeleton skeleton-owner" />
    </div>
  </div>
)

export const EnhancedPipelineSkeleton = () => (
  <div className="pipeline-skeleton">
    <div className="skeleton-pipeline-columns">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="skeleton-pipeline-column">
          <div className="skeleton skeleton-pipeline-column-header" />
          {[1, 2, 3].map(j => (
            <PipelineDealCardSkeleton key={j} />
          ))}
        </div>
      ))}
    </div>
  </div>
)

export const ModalSkeleton = () => (
  <div className="skeleton-modal">
    <div className="skeleton-modal-header">
      <div className="skeleton skeleton-modal-title" />
      <div className="skeleton skeleton-modal-close" />
    </div>
    <div className="skeleton-modal-body">
      <FormSkeleton />
    </div>
    <div className="skeleton-modal-footer">
      <div className="skeleton skeleton-form-button" />
      <div className="skeleton skeleton-form-button" style={{ width: '120px' }} />
    </div>
  </div>
)
