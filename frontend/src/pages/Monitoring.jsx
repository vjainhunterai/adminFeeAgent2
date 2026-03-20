import React, { useState, useEffect, useRef } from 'react'
import { getProcessingStatus, getProcessingContracts, askStatusQuestion } from '../services/api'

export default function Monitoring() {
  const [status, setStatus] = useState(null)
  const [contracts, setContracts] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [question, setQuestion] = useState('')
  const [questionLoading, setQuestionLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState([])
  const [deliveryForQ, setDeliveryForQ] = useState('')
  const intervalRef = useRef(null)
  const chatEndRef = useRef(null)

  async function fetchStatus() {
    try {
      const [statusData, contractData] = await Promise.all([
        getProcessingStatus(),
        getProcessingContracts(),
      ])
      setStatus(statusData)
      setContracts(contractData)
    } catch (e) {
      // silently fail for polling
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchStatus, 30000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function handleAskQuestion(e) {
    e.preventDefault()
    if (!question.trim() || !deliveryForQ.trim()) return

    const q = question.trim()
    setQuestion('')
    setChatHistory((prev) => [...prev, { role: 'user', content: q }])
    setQuestionLoading(true)

    try {
      const data = await askStatusQuestion(q, deliveryForQ)
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sql: data.sql_generated,
        },
      ])
    } catch (e) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${e.message}` },
      ])
    } finally {
      setQuestionLoading(false)
    }
  }

  const completionPct =
    status && status.total > 0
      ? Math.round((status.completed / status.total) * 100)
      : 0
  const allDone = status && status.in_progress === 0 && status.total > 0

  function getStatusBadge(val) {
    const s = Number(val)
    if (s === 0) return <span className="badge success">Completed</span>
    if (s === 1) return <span className="badge warning">Ready</span>
    if (s === 2) return <span className="badge info">SQL Done</span>
    return <span className="badge info">Status {val}</span>
  }

  return (
    <>
      <div className="page-header">
        <h2>Status Monitor</h2>
        <p>Real-time monitoring of contract processing pipeline</p>
      </div>
      <div className="page-body">
        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button className="btn btn-primary btn-sm" onClick={fetchStatus} disabled={loading}>
            {loading ? <div className="spinner" style={{ borderTopColor: '#fff' }} /> : null}
            Refresh
          </button>
          <button
            className={`btn btn-sm ${autoRefresh ? 'btn-danger' : 'btn-outline'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Stop Auto-Refresh' : 'Auto-Refresh (30s)'}
          </button>
        </div>

        {loading && !status ? (
          <div className="loading-overlay">
            <div className="spinner spinner-lg" />
            <p>Loading processing status...</p>
          </div>
        ) : (
          <>
            {/* Status Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon blue">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  </svg>
                </div>
                <div className="stat-info">
                  <h4>Total</h4>
                  <div className="stat-value">{status?.total || 0}</div>
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
                  <div className="stat-value">{status?.completed || 0}</div>
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
                  <div className="stat-value">{status?.in_progress || 0}</div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            {status && status.total > 0 && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {allDone ? 'All contracts completed!' : 'Processing...'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-primary)' }}>
                      {completionPct}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-bar-fill ${allDone ? 'success' : ''}`}
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Contract Details Table */}
            {contracts?.rows?.length > 0 && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                  <h3>Contract Details</h3>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        {contracts.columns.map((col, i) => (
                          <th key={i}>{col.replace(/_/g, ' ')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j}>
                              {contracts.columns[j] === 'STATUS' ? (
                                getStatusBadge(cell)
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
              </div>
            )}

            {/* AI Status Q&A */}
            <div className="card">
              <div className="card-header">
                <h3>Ask About Status</h3>
              </div>
              <div className="card-body">
                <div className="form-group" style={{ maxWidth: 300 }}>
                  <label>Delivery Name</label>
                  <input
                    type="text"
                    value={deliveryForQ}
                    onChange={(e) => setDeliveryForQ(e.target.value)}
                    placeholder="e.g., delivery_1"
                  />
                </div>

                {chatHistory.length > 0 && (
                  <div
                    style={{
                      maxHeight: 300,
                      overflowY: 'auto',
                      marginBottom: 16,
                      padding: 12,
                      background: '#f8fafc',
                      borderRadius: 8,
                    }}
                  >
                    {chatHistory.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: 12,
                          padding: '8px 12px',
                          borderRadius: 8,
                          background: msg.role === 'user' ? 'var(--color-primary)' : '#fff',
                          color: msg.role === 'user' ? '#fff' : 'var(--color-text)',
                          maxWidth: '80%',
                          marginLeft: msg.role === 'user' ? 'auto' : 0,
                          fontSize: 14,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {msg.content}
                        {msg.sql && (
                          <div className="sql-block" style={{ marginTop: 8 }}>
                            {msg.sql}
                          </div>
                        )}
                      </div>
                    ))}
                    {questionLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--color-text-secondary)' }}>
                        <div className="spinner" />
                        Analyzing...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}

                <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: 12 }}>
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g., Which contracts are still processing?"
                    disabled={questionLoading || !deliveryForQ}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={!question.trim() || !deliveryForQ.trim() || questionLoading}
                  >
                    Ask
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
