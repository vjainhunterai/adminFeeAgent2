import React, { useState, useEffect } from 'react'
import { getDashboardStats, getRecentActivity } from '../services/api'

function formatNumber(num) {
  if (num === null || num === undefined) return '0'
  return num.toLocaleString()
}

function StatusBadge({ value }) {
  const status = Number(value)
  if (status === 0) return <span className="badge success">Completed</span>
  if (status === 1) return <span className="badge warning">Ready</span>
  if (status === 2) return <span className="badge info">Processing</span>
  return <span className="badge info">Status {value}</span>
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [statsData, activityData] = await Promise.all([
          getDashboardStats(),
          getRecentActivity(),
        ])
        setStats(statsData)
        setActivity(activityData)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h2>Dashboard</h2>
          <p>Overview of AdminFee processing and contracts</p>
        </div>
        <div className="page-body">
          <div className="loading-overlay">
            <div className="spinner spinner-lg" />
            <p>Loading dashboard data...</p>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <div className="page-header">
          <h2>Dashboard</h2>
          <p>Overview of AdminFee processing and contracts</p>
        </div>
        <div className="page-body">
          <div className="card">
            <div className="card-body">
              <p style={{ color: 'var(--color-danger)' }}>Failed to load dashboard: {error}</p>
              <p style={{ color: 'var(--color-text-secondary)', marginTop: 8, fontSize: 13 }}>
                Make sure the backend API is running on port 8000.
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  const ps = stats?.processing_status || { total: 0, completed: 0, in_progress: 0 }
  const completionPct = ps.total > 0 ? Math.round((ps.completed / ps.total) * 100) : 0

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of AdminFee processing and contracts</p>
      </div>
      <div className="page-body">
        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="stat-info">
              <h4>Total Contracts</h4>
              <div className="stat-value">{formatNumber(ps.total)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="stat-info">
              <h4>Completed</h4>
              <div className="stat-value">{formatNumber(ps.completed)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div className="stat-info">
              <h4>In Progress</h4>
              <div className="stat-value">{formatNumber(ps.in_progress)}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon cyan">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="stat-info">
              <h4>Deliveries</h4>
              <div className="stat-value">{formatNumber(stats?.total_deliveries)}</div>
            </div>
          </div>
        </div>

        {/* Progress */}
        {ps.total > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h3>Processing Progress</h3>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)' }}>
                {completionPct}%
              </span>
            </div>
            <div className="card-body">
              <div className="progress-bar">
                <div
                  className={`progress-bar-fill ${completionPct === 100 ? 'success' : ''}`}
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                <span>{ps.completed} of {ps.total} contracts completed</span>
                <span>{ps.in_progress} in progress</span>
              </div>
            </div>
          </div>
        )}

        {/* Deliveries List */}
        {stats?.deliveries?.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h3>Recent Deliveries</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stats.deliveries.map((d, i) => (
                <span key={i} className="badge info">{d}</span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity Table */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          {activity?.rows?.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {activity.columns.map((col, i) => (
                      <th key={i}>{col.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activity.rows.slice(0, 15).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>
                          {activity.columns[j] === 'status' ? (
                            <StatusBadge value={cell} />
                          ) : (
                            cell ?? '-'
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <h3>No recent activity</h3>
              <p>Process contracts to see activity here</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
