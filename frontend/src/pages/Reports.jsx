import React, { useState, useEffect } from 'react'
import {
  getDeliveries,
  getContractSummary,
  getAuditReport,
  runCustomQuery,
} from '../services/api'

function formatCurrency(value) {
  if (value === null || value === undefined) return '-'
  return '$' + Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ReconciliationCard({ item }) {
  const statusClass =
    item.status === 'MATCH'
      ? 'match'
      : item.status?.includes('high')
      ? 'high'
      : item.status?.includes('higher')
      ? 'low'
      : 'missing'

  return (
    <div className={`reconciliation-card ${statusClass}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{item.contract}</h4>
          <span className={`badge ${statusClass === 'match' ? 'success' : statusClass === 'high' ? 'warning' : statusClass === 'low' ? 'danger' : 'info'}`}>
            {item.status}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, flex: 1, minWidth: 300 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>PO Spend</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{formatCurrency(item.po_spend)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Invoice Spend</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{formatCurrency(item.inv_spend)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Report Spend</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{formatCurrency(item.report_spend)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Difference</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: item.difference > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
              {formatCurrency(item.difference)}
            </div>
          </div>
        </div>
      </div>
      {item.error && (
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--color-danger)' }}>Error: {item.error}</p>
      )}
    </div>
  )
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState('reconciliation')
  const [deliveries, setDeliveries] = useState([])
  const [selectedDelivery, setSelectedDelivery] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingDeliveries, setLoadingDeliveries] = useState(true)

  // Reconciliation state
  const [summary, setSummary] = useState(null)
  const [formattedReport, setFormattedReport] = useState('')

  // Audit state
  const [auditData, setAuditData] = useState(null)

  // Custom query state
  const [customQuery, setCustomQuery] = useState('')
  const [queryResult, setQueryResult] = useState(null)
  const [queryError, setQueryError] = useState(null)

  useEffect(() => {
    getDeliveries()
      .then((data) => setDeliveries(data.deliveries || []))
      .catch(() => {})
      .finally(() => setLoadingDeliveries(false))
  }, [])

  async function handleGenerateSummary() {
    if (!selectedDelivery) return
    setLoading(true)
    setSummary(null)
    setFormattedReport('')
    try {
      const data = await getContractSummary(selectedDelivery)
      setSummary(data.summary)
      setFormattedReport(data.formatted_report)
    } catch (e) {
      setSummary([])
      setFormattedReport(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleLoadAudit() {
    setLoading(true)
    setAuditData(null)
    try {
      const data = await getAuditReport(selectedDelivery || null)
      setAuditData(data)
    } catch (e) {
      setAuditData({ columns: [], rows: [], error: e.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleCustomQuery(e) {
    e.preventDefault()
    if (!customQuery.trim()) return
    setLoading(true)
    setQueryResult(null)
    setQueryError(null)
    try {
      const data = await runCustomQuery(customQuery)
      setQueryResult(data)
    } catch (e) {
      setQueryError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'reconciliation', label: 'Reconciliation' },
    { id: 'audit', label: 'Audit Data' },
    { id: 'custom', label: 'Custom Query' },
  ]

  return (
    <>
      <div className="page-header">
        <h2>Reports</h2>
        <p>Reconciliation summaries, audit data, and custom queries</p>
      </div>
      <div className="page-body">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid var(--color-border)', paddingBottom: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'inherit',
                color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                marginBottom: -2,
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Reconciliation Tab ─────────────────────────────────────────── */}
        {activeTab === 'reconciliation' && (
          <div>
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Delivery</label>
                  {deliveries.length > 0 ? (
                    <select
                      value={selectedDelivery}
                      onChange={(e) => setSelectedDelivery(e.target.value)}
                    >
                      <option value="">-- Select --</option>
                      {deliveries.map((d, i) => (
                        <option key={i} value={d}>{d}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={selectedDelivery}
                      onChange={(e) => setSelectedDelivery(e.target.value)}
                      placeholder="delivery_1"
                    />
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerateSummary}
                  disabled={!selectedDelivery || loading}
                >
                  {loading ? (
                    <>
                      <div className="spinner" style={{ borderTopColor: '#fff' }} />
                      Generating...
                    </>
                  ) : (
                    'Generate Summary'
                  )}
                </button>
              </div>
            </div>

            {summary && summary.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>
                  Contract Reconciliation ({summary.length} contracts)
                </h3>
                {summary.map((item, i) => (
                  <ReconciliationCard key={i} item={item} />
                ))}
              </div>
            )}

            {formattedReport && (
              <div className="card">
                <div className="card-header">
                  <h3>AI-Formatted Report</h3>
                </div>
                <div className="card-body">
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7 }}>
                    {formattedReport}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Audit Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'audit' && (
          <div>
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Filter by Delivery (optional)</label>
                  <input
                    type="text"
                    value={selectedDelivery}
                    onChange={(e) => setSelectedDelivery(e.target.value)}
                    placeholder="Leave empty for all"
                  />
                </div>
                <button className="btn btn-primary" onClick={handleLoadAudit} disabled={loading}>
                  {loading ? <div className="spinner" style={{ borderTopColor: '#fff' }} /> : null}
                  Load Audit Data
                </button>
              </div>
            </div>

            {auditData && (
              <div className="card">
                <div className="card-header">
                  <h3>Audit Records ({auditData.rows?.length || 0})</h3>
                </div>
                {auditData.rows?.length > 0 ? (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          {auditData.columns.map((col, i) => (
                            <th key={i}>{col.replace(/_/g, ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {auditData.rows.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => (
                              <td key={j}>{cell ?? '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <h3>No audit data found</h3>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Custom Query Tab ──────────────────────────────────────────── */}
        {activeTab === 'custom' && (
          <div>
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <h3>Custom SQL Query</h3>
              </div>
              <div className="card-body">
                <form onSubmit={handleCustomQuery}>
                  <div className="form-group">
                    <label>SQL Query (SELECT only)</label>
                    <textarea
                      value={customQuery}
                      onChange={(e) => setCustomQuery(e.target.value)}
                      placeholder="SELECT * FROM joblog_metadata.admin_fee_metadata LIMIT 10"
                      rows={4}
                      style={{ fontFamily: "'Fira Code', 'Consolas', monospace", fontSize: 13 }}
                    />
                    <p className="hint">Only SELECT queries are allowed for security</p>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={!customQuery.trim() || loading}>
                    {loading ? (
                      <>
                        <div className="spinner" style={{ borderTopColor: '#fff' }} />
                        Running...
                      </>
                    ) : (
                      'Run Query'
                    )}
                  </button>
                </form>
              </div>
            </div>

            {queryError && (
              <div className="card" style={{ marginBottom: 16, borderColor: 'var(--color-danger)' }}>
                <div className="card-body" style={{ color: 'var(--color-danger)' }}>
                  {queryError}
                </div>
              </div>
            )}

            {queryResult && (
              <div className="card">
                <div className="card-header">
                  <h3>Results ({queryResult.rows?.length || 0} rows)</h3>
                </div>
                {queryResult.rows?.length > 0 ? (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          {queryResult.columns.map((col, i) => (
                            <th key={i}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => (
                              <td key={j}>{cell ?? '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <h3>Query returned no results</h3>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
