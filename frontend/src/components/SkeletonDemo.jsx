import React, { useState } from 'react'
import {
  DashboardSkeleton,
  TableSkeleton,
  CardListSkeleton,
  CalendarSkeleton,
  PipelineSkeleton,
  ReportsSkeleton,
  TasksBoardSkeleton,
  EmailCampaignsSkeleton,
  FormSkeleton
} from './SkeletonLoader'
import Card from './Card'
import Button from './Button'
import './SkeletonDemo.css'

/**
 * SkeletonDemo Component
 * 
 * This component demonstrates all available skeleton loader variants.
 * Useful for development and design review purposes.
 */
const SkeletonDemo = () => {
  const [activeDemo, setActiveDemo] = useState('dashboard')

  const demos = [
    { id: 'dashboard', name: 'Dashboard', component: <DashboardSkeleton /> },
    { id: 'cardList', name: 'Card List', component: <CardListSkeleton count={6} size="medium" /> },
    { id: 'cardListLarge', name: 'Card List (Large)', component: <CardListSkeleton count={4} size="large" /> },
    { id: 'table', name: 'Table', component: <TableSkeleton rows={8} columns={6} /> },
    { id: 'calendar', name: 'Calendar', component: <CalendarSkeleton /> },
    { id: 'pipeline', name: 'Pipeline', component: <PipelineSkeleton /> },
    { id: 'tasks', name: 'Tasks Board', component: <TasksBoardSkeleton /> },
    { id: 'emailCampaigns', name: 'Email Campaigns', component: <EmailCampaignsSkeleton /> },
    { id: 'reports', name: 'Reports', component: <ReportsSkeleton /> },
    { id: 'form', name: 'Form', component: <FormSkeleton /> },
  ]

  const activeComponent = demos.find(d => d.id === activeDemo)

  return (
    <div className="skeleton-demo">
      <div className="demo-header">
        <h1>Skeleton Loader Demo</h1>
        <p>Preview all skeleton loader components</p>
      </div>

      <div className="demo-controls">
        {demos.map(demo => (
          <Button
            key={demo.id}
            variant={activeDemo === demo.id ? 'primary' : 'outline'}
            onClick={() => setActiveDemo(demo.id)}
            className="demo-button"
          >
            {demo.name}
          </Button>
        ))}
      </div>

      <Card className="demo-content">
        <div className="demo-title">
          <h2>{activeComponent?.name}</h2>
          <code className="demo-code">
            {`<${activeComponent?.name.replace(/\s/g, '')}Skeleton />`}
          </code>
        </div>
        <div className="demo-preview">
          {activeComponent?.component}
        </div>
      </Card>

      <Card className="demo-info">
        <h3>Usage Example</h3>
        <pre className="code-block">
{`import { ${activeComponent?.name.replace(/\s/g, '')}Skeleton } from '../components/SkeletonLoader'

const YourComponent = () => {
  const [loading, setLoading] = useState(true)

  if (loading) {
    return <${activeComponent?.name.replace(/\s/g, '')}Skeleton />
  }

  return <YourContent />
}`}
        </pre>
      </Card>
    </div>
  )
}

export default SkeletonDemo
