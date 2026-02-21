import React, { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Card from '../components/Card'
import Button from '../components/Button'
import Loader from '../components/Loader'
import { ReportsSkeleton } from '../components/SkeletonLoader'
import { reportsApi, dashboardApi } from '../services'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import './Reports.css'
import '../components/ErrorState.css'

const Reports = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dashboardStats, setDashboardStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [exporting, setExporting] = useState(false)
  const reportsContentRef = useRef(null)

  useEffect(() => {
    fetchReportData()
  }, [])

  const fetchReportData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [statsResponse, analyticsResponse] = await Promise.all([
        dashboardApi.getStats(),
        reportsApi.analytics({ months: 6 })
      ])
      setDashboardStats(statsResponse)
      setAnalytics(analyticsResponse)
    } catch (err) {
      console.error('Error fetching report data:', err)
      setError('Failed to load reports. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const exportToPDF = async () => {
    try {
      setExporting(true)
      
      // Get the reports content element
      const content = reportsContentRef.current
      if (!content) {
        throw new Error('Reports content not found')
      }

      // Create a temporary container for better PDF rendering
      const pdfContainer = document.createElement('div')
      pdfContainer.style.position = 'absolute'
      pdfContainer.style.left = '-9999px'
      pdfContainer.style.top = '0'
      pdfContainer.style.width = '1200px'
      pdfContainer.style.background = 'white'
      pdfContainer.style.padding = '40px'
      document.body.appendChild(pdfContainer)

      // Clone the content
      const clone = content.cloneNode(true)
      pdfContainer.appendChild(clone)

      // Wait for charts to render
      await new Promise(resolve => setTimeout(resolve, 500))

      // Capture the content as canvas
      const canvas = await html2canvas(pdfContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      // Remove temporary container
      document.body.removeChild(pdfContainer)

      // Calculate dimensions
      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgData = canvas.toDataURL('image/png')

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      // Generate filename with current date
      const date = new Date().toISOString().split('T')[0]
      const filename = `CRM_Reports_${date}.pdf`

      // Save the PDF
      pdf.save(filename)
    } catch (err) {
      console.error('Error exporting PDF:', err)
      alert('Failed to export PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const salesByRep = analytics?.salesByRep || []
  const conversionFunnel = analytics?.conversionFunnel || []
  const monthlyTrends = analytics?.monthlyTrends || []

  const leadSourceData = (analytics?.leadSourceData || []).map((item, idx) => ({
    ...item,
    color: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#64748b'][idx % 5]
  }))

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Track performance metrics and gain insights into your sales activities</p>
        </div>
        <div className="page-actions">
          <Button 
            onClick={exportToPDF} 
            disabled={loading || exporting}
            variant="primary"
          >
            {exporting ? 'Exporting...' : '📄 Export PDF'}
          </Button>
        </div>
      </div>

      {loading ? (
        <ReportsSkeleton />
      ) : error ? (
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchReportData} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      ) : (
        <div ref={reportsContentRef}>
          <div className="reports-grid">
        <Card title="Sales Performance by Representative" className="report-card">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={salesByRep} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="name" 
                stroke="#64748b" 
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                stroke="#64748b"
                tickFormatter={(value) => {
                  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
                  return `$${value}`
                }}
                width={70}
              />
              <Tooltip 
                contentStyle={{ 
                  background: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value, name) => {
                  if (name === 'Revenue ($)') {
                    return [`$${value.toLocaleString()}`, name]
                  }
                  return [value, name]
                }}
              />
              <Legend />
              <Bar dataKey="deals" fill="#3b82f6" name="Deals Closed" />
              <Bar dataKey="revenue" fill="#10b981" name="Revenue ($)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Lead Sources Distribution" className="report-card">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={leadSourceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {leadSourceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Conversion Funnel" className="report-card full-width">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={conversionFunnel} layout="vertical" margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#64748b" tickFormatter={(value) => value.toLocaleString()} />
              <YAxis dataKey="stage" type="category" stroke="#64748b" width={100} />
              <Tooltip 
                contentStyle={{ 
                  background: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value, name) => [value.toLocaleString(), name]}
              />
              <Bar dataKey="count" fill="#8b5cf6" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="6-Month Performance Trends" className="report-card full-width">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={monthlyTrends} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" tickFormatter={(value) => value.toLocaleString()} />
              <Tooltip 
                contentStyle={{ 
                  background: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }}
                formatter={(value, name) => [value.toLocaleString(), name]}
              />
              <Legend />
              <Line type="monotone" dataKey="newLeads" stroke="#3b82f6" strokeWidth={2} name="New Leads" />
              <Line type="monotone" dataKey="closedDeals" stroke="#10b981" strokeWidth={2} name="Closed Deals" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
        </div>
      )}
    </div>
  )
}

export default Reports
