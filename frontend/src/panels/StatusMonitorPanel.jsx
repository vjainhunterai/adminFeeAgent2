import React, { useState, useEffect, useRef } from 'react'
import { getStatusSummary, getStatusContracts, askStatusQuestion } from '../services/api'
import MarkdownRenderer from '../components/MarkdownRenderer'

function StatusBadge({ value }) {
  const s = Number(value)
  if (s === 0) return <span className="badge done">Completed</span>
  if (s === 1) return <span className="badge ready">Ready</span>
  if (s === 2) return <span className="badge sql-done">SQL Done</span>
  return <span className="badge ready">#{value}</span>
}

export default function StatusMonitorPanel({ activeDelivery, onDeliveryChange }) {
  const [status, setStatus] = useState({ total: 0, completed: 0, in_progress: 0 })
  const [contracts, setContracts] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const intervalRef = useRef(null)

  // Status Q&A
  const [delivery, setDelivery] = useState('')
  const [question, setQuestion] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)

  useEffect(() => {
    if (activeDelivery) setDelivery(activeDelivery)
  }, [activeDelivery])

  async function refresh() {
    try {
      const [s, c] = await Promise.all([getStatusSummary(), getStatusContracts()])
      setStatus(s)
      setContracts(c)
      setLastRefresh(new Date().toLocaleTimeString())
    } catch (e) {
      // silent fail for polling
    }
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(refresh, 30000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function handleAsk(e) {
    e.preventDefault()
    if (!question.trim() || !delivery.trim()) return

    const q = question.trim()
    setQuestion('')
    setChatHistory((prev) => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const data = await askStatusQuestion(q, delivery)
      setChatHistory((prev) => [
        ...prev,
        { role: 'agent', content: data.answer, sql: data.sql_generated },
      ])
    } catch (e) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'system', content: `Error: ${e.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const pct = status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0
  const allDone = status.total > 0 && status.in_progress === 0

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>
          <span className={`dot ${autoRefresh ? 'processing' : 'idle'}`} />
          Status Monitor
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-sm" onClick={refresh}>Refresh</button>
          <button
            className={`btn-sm ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto: ON' : 'Auto: OFF'}
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="status-grid">
        <div className="status-card">
          <div className="label">Total</div>
          <div className="value total">{status.total}</div>
        </div>
        <div className="status-card">
          <div className="label">Completed</div>
          <div className="value done">{status.completed}</div>
        </div>
        <div className="status-card">
          <div className="label">In Progress</div>
          <div className="value progress">{status.in_progress}</div>
        </div>
      </div>

      {/* Progress Bar */}
      {status.total > 0 && (
        <div className="progress-section">
          <div className="progress-bar">
            <div className={`progress-fill ${allDone ? 'complete' : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="progress-label">
            <span>{allDone ? 'All contracts completed!' : `${status.completed}/${status.total} done`}</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {/* Contract Table */}
      {contracts?.rows?.length > 0 && (
        <div className="contract-table-section" style={{ maxHeight: 180 }}>
          <h4>Contracts</h4>
          <table className="mini-table">
            <thead>
              <tr>
                {contracts.columns.map((col, i) => <th key={i}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {contracts.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>
                      {contracts.columns[j] === 'STATUS' ? <StatusBadge value={cell} /> : (cell ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Divider with delivery input */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>DELIVERY:</label>
        <input
          type="text"
          value={delivery}
          onChange={(e) => { setDelivery(e.target.value); onDeliveryChange(e.target.value) }}
          placeholder="delivery_1"
          style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
        />
      </div>

      {/* AI Status Q&A Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {chatHistory.length === 0 && (
            <div className="empty-center" style={{ padding: 20 }}>
              <p style={{ fontSize: 12 }}>Ask questions about processing status.<br />e.g. "Which contracts are still processing?"</p>
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: msg.role === 'user' ? 'var(--primary)' : msg.role === 'system' ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
              color: msg.role === 'user' ? '#fff' : msg.role === 'system' ? 'var(--text-muted)' : 'var(--text-dark)',
              maxWidth: '90%',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              fontSize: 12,
            }}>
              <MarkdownRenderer text={msg.content} />
              {msg.sql && (
                <details style={{ marginTop: 4 }}>
                  <summary className="sql-toggle">View SQL</summary>
                  <pre style={{ margin: '4px 0', fontSize: 10 }}>{msg.sql}</pre>
                </details>
              )}
            </div>
          ))}
          {loading && <div className="typing-indicator"><span /><span /><span /></div>}
          <div ref={chatEndRef} />
        </div>

        <form className="chat-input" onSubmit={handleAsk}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={delivery ? 'Ask about processing status...' : 'Enter delivery name first'}
            disabled={loading || !delivery}
          />
          <button type="submit" disabled={!question.trim() || !delivery || loading}>Ask</button>
        </form>
      </div>

      {/* Last refresh */}
      {lastRefresh && (
        <div style={{ padding: '4px 16px', fontSize: 10, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          Last refresh: {lastRefresh} {autoRefresh && '(auto-refreshing every 30s)'}
        </div>
      )}
    </div>
  )
}
