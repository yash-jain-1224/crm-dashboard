import React, { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Users, DollarSign, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import Loader from '../components/Loader'
import { DashboardSkeleton } from '../components/SkeletonLoader'
import AnimatedCounter from '../components/AnimatedCounter'
import { dashboardApi } from '../services'
import './Dashboard.css'
import '../components/ErrorState.css'

const Dashboard = () => {
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const [statsData, trendsData] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getTrends({ months: 6 })
      ])
      setStats(statsData)
      setTrends(trendsData?.series || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('Failed to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const salesData = trends

  const pipelineData = stats?.opportunities_by_stage?.map((item, index) => ({
    name: item.stage,
    value: item.total_value,
    count: item.count,
    color: ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][index % 5]
  })) || []

  const statsCards = stats ? [
    {
      title: 'Total Contacts',
      value: stats.summary.total_contacts.toString(),
      change: '+12.5%',
      icon: Users,
      positive: true,
      color: '#10b981'
    },
    {
      title: 'Total Leads',
      value: stats.summary.total_leads.toString(),
      change: '+8.2%',
      icon: TrendingUp,
      positive: true,
      color: '#3b82f6'
    },
    {
      title: 'Pipeline Value',
      value: `$${Math.round(stats.summary.total_opportunity_value).toLocaleString()}`,
      change: '-2.1%',
      icon: DollarSign,
      positive: false,
      color: '#f59e0b'
    },
    {
      title: 'Opportunities',
      value: stats.summary.total_opportunities.toString(),
      change: '+18.7%',
      icon: Target,
      positive: true,
      color: '#8b5cf6'
    },
  ] : []

  const recentContacts = stats?.recent_activities?.contacts || []
  
  const recentDeals = (stats?.recent_opportunities || []).map((d) => ({
    id: d.id,
    company: d.company || 'N/A',
    contact: d.contact || 'N/A',
    value: `$${Math.round(d.value || 0).toLocaleString()}`,
    stage: d.stage || 'N/A',
    probability: `${d.probability || 0}%`,
  }))

  if (loading) {
    return (
      <div className="dashboard">
        <div className="page-header">
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-subtitle">Welcome back! Here's what's happening with your sales today.</p>
        </div>
        <DashboardSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="page-header">
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-subtitle">Welcome back! Here's what's happening with your sales today.</p>
        </div>
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchDashboardData} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Dashboard Overview</h1>
        <p className="page-subtitle">Welcome back! Here's what's happening with your sales today.</p>
      </div>

      {loading ? (
        <Card>
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading dashboard...</div>
        </Card>
      ) : error ? (
        <Card>
          <div className="error-state-container">
            <div className="error-state-message">{error}</div>
            <Button onClick={fetchDashboardData} className="error-state-retry-button">Retry</Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Stats Grid */}
      <div className="stats-grid">
        {statsCards.map((stat, index) => (
          <Card key={index} className="stat-card">
            <div className="stat-content">
              <div className="stat-header">
                <div className="stat-icon" style={{ background: `${stat.color}20`, color: stat.color }}>
                  <stat.icon size={24} />
                </div>
                <div className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>
                  {stat.positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {stat.change}
                </div>
              </div>
              <div className="stat-info">
                <h3 className="stat-value">
                  {stat.title === 'Pipeline Value' ? (
                    <>$<AnimatedCounter value={Math.round(stats.summary.total_opportunity_value)} duration={1200} separator="," /></>
                  ) : (
                    <AnimatedCounter value={parseInt(stat.value.replace(/[^0-9]/g, '')) || 0} duration={1200} separator="," />
                  )}
                </h3>
                <p className="stat-title">{stat.title}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <Card title="Revenue & Leads Trend" className="chart-card">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip 
                contentStyle={{ 
                  background: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                }} 
              />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} name="Revenue ($)" />
              <Line type="monotone" dataKey="leads" stroke="#8b5cf6" strokeWidth={3} name="Leads" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Pipeline Distribution" className="chart-card">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pipelineData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pipelineData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent Deals Table */}
      <Card title="Recent Opportunities">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Value</th>
                <th>Stage</th>
                <th>Probability</th>
              </tr>
            </thead>
            <tbody>
              {recentDeals.map((deal) => (
                <tr key={deal.id}>
                  <td className="font-semibold">{deal.company}</td>
                  <td>{deal.contact}</td>
                  <td className="font-semibold text-success">{deal.value}</td>
                  <td>
                    <span className={`badge badge-${deal.stage.toLowerCase().replace(' ', '-')}`}>
                      {deal.stage}
                    </span>
                  </td>
                  <td>{deal.probability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
        </>
      )}
    </div>
  )
}

export default Dashboard
