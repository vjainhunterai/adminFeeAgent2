import React, { useState, useRef, useEffect } from 'react'
import { getDeliveries, analysisSetup, analysisAsk, getReconciliation } from '../services/api'
import MarkdownRenderer from '../components/MarkdownRenderer'

export default function AnalysisPanel({ activeDelivery, activeContracts, processingComplete, onAnalysisStarted }) {
  const [deliveries, setDeliveries] = useState([])
  const [delivery, setDelivery] = useState('')
  const [contracts, setContracts] = useState([])
  const [normalizedDelivery, setNormalizedDelivery] = useState('')
  const [isSetup, setIsSetup] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)
  const bottomRef = useRef(null)

  // Load deliveries list
  useEffect(() => {
    getDeliveries()
      .then((d) => setDeliveries(d.deliveries || []))
      .catch(() => {})
  }, [])

  // When activeDelivery changes, reset state so auto-trigger can fire for new delivery
  const prevDeliveryRef = useRef(activeDelivery)
  useEffect(() => {
    if (activeDelivery && activeDelivery !== prevDeliveryRef.current) {
      prevDeliveryRef.current = activeDelivery
      // Reset analysis state for the new delivery
      setIsSetup(false)
      setMessages([])
      setContracts([])
      setNormalizedDelivery('')
    }
    if (activeDelivery) setDelivery(activeDelivery)
  }, [activeDelivery])

  // Auto-trigger: when processing completes, auto-setup + run reconciliation
  useEffect(() => {
    if (!processingComplete || !activeDelivery || isSetup) return

    async function autoAnalyze() {
      onAnalysisStarted?.()
      setDelivery(activeDelivery)
      setSetupLoading(true)

      try {
        // Step 1: Setup — normalize delivery + fetch contracts
        const setupData = await analysisSetup(activeDelivery)
        const norm = setupData.delivery_normalized
        const ctrs = setupData.contracts || []
        setNormalizedDelivery(norm)
        setContracts(ctrs)
        setIsSetup(true)

        if (!ctrs.length) {
          setMessages([{ role: 'system', content: `No contracts found for "${norm}".` }])
          return
        }

        // Step 2: Auto-run reconciliation summary
        setMessages([
          {
            role: 'agent',
            content: `**Processing complete!** Found **${ctrs.length} contracts** for \`${norm}\`.\n\nGenerating reconciliation summary...`,
          },
        ])
        setLoading(true)

        try {
          const reconData = await getReconciliation(norm)
          const summaryLines = (reconData.summary || []).map(
            (s) =>
              `**${s.contract}**: PO=$${Number(s.po_spend || 0).toLocaleString()}, INV=$${Number(s.inv_spend || 0).toLocaleString()}, Report=$${s.report_spend !== null ? Number(s.report_spend).toLocaleString() : 'N/A'} — *${s.status}*`
          )
          setMessages([
            {
              role: 'agent',
              content: reconData.formatted_report
                ? `**Processing complete!** Found **${ctrs.length} contracts** for \`${norm}\`.\n\n${reconData.formatted_report}`
                : `**Processing complete!** Found **${ctrs.length} contracts** for \`${norm}\`.\n\n**Reconciliation Summary:**\n\n${summaryLines.join('\n\n')}`,
              extra: summaryLines.length ? `\n\n---\n**Raw Summary:**\n${summaryLines.join('\n')}` : '',
            },
            {
              role: 'agent',
              content: 'You can now ask follow-up questions — spend analysis, supplier breakdown, discrepancy details, etc.',
            },
          ])
        } catch (reconErr) {
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: `Reconciliation error: ${reconErr.message}. You can still ask questions manually.` },
          ])
        }
      } catch (e) {
        setMessages([{ role: 'system', content: `Auto-analysis failed: ${e.message}` }])
      } finally {
        setSetupLoading(false)
        setLoading(false)
      }
    }

    autoAnalyze()
  }, [processingComplete, activeDelivery])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSetup() {
    if (!delivery.trim()) return
    setSetupLoading(true)
    try {
      const data = await analysisSetup(delivery)
      setNormalizedDelivery(data.delivery_normalized)
      setContracts(data.contracts || [])
      setIsSetup(true)

      const contractList = (data.contracts || []).map((c) => `\`${c}\``).join(', ')
      setMessages([
        {
          role: 'agent',
          content: data.contracts?.length
            ? `**${data.contracts.length} contracts** found for delivery \`${data.delivery_normalized}\`:\n\n${contractList}\n\nAsk me anything about these contracts — spend analysis, supplier breakdown, reconciliation, etc.`
            : `No contracts found for delivery "${data.delivery_normalized}". Please check the delivery name.`,
        },
      ])
    } catch (e) {
      setMessages([{ role: 'system', content: `Setup failed: ${e.message}` }])
      // Don't transition to chat - stay on setup screen so user can retry
    } finally {
      setSetupLoading(false)
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const q = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      // Check if user is asking for reconciliation
      const isRecon = /reconcil|summary|report|compare.*report/i.test(q)

      if (isRecon) {
        const data = await getReconciliation(normalizedDelivery)
        const summaryLines = (data.summary || []).map(
          (s) =>
            `**${s.contract}**: PO=$${Number(s.po_spend || 0).toLocaleString()}, INV=$${Number(s.inv_spend || 0).toLocaleString()}, Report=$${s.report_spend !== null ? Number(s.report_spend).toLocaleString() : 'N/A'} — *${s.status}*`
        )
        setMessages((prev) => [
          ...prev,
          {
            role: 'agent',
            content: data.formatted_report || summaryLines.join('\n\n'),
            extra: summaryLines.length ? `\n\n---\n**Raw Summary:**\n${summaryLines.join('\n')}` : '',
          },
        ])
      } else {
        const data = await analysisAsk(q, normalizedDelivery, contracts)
        setMessages((prev) => [
          ...prev,
          {
            role: 'agent',
            content: data.formatted_answer,
            sql: data.sql_generated,
            rawData: data.raw_data,
          },
        ])
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `Error: ${e.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  function resetSetup() {
    setIsSetup(false)
    setMessages([])
    setContracts([])
    setNormalizedDelivery('')
    setDelivery(activeDelivery || '')
  }

  // ─── Setup Screen ────────────────────────────────────────────────────────
  if (!isSetup) {
    return (
      <div className="panel">
        <div className="panel-header">
          <h3>
            <span className="dot idle" />
            Contract Analysis
          </h3>
        </div>
        <div className="setup-form">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" style={{ opacity: 0.6 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h3>Contract Analyst Agent</h3>
          <p>Select a delivery to load contracts, then ask natural language questions about spend, suppliers, reconciliation, and more.</p>

          <div className="field">
            <label>Delivery Name</label>
            {deliveries.length > 0 ? (
              <select value={delivery} onChange={(e) => setDelivery(e.target.value)}>
                <option value="">-- Select delivery --</option>
                {deliveries.map((d, i) => (
                  <option key={i} value={d}>{d}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={delivery}
                onChange={(e) => setDelivery(e.target.value)}
                placeholder="e.g., delivery_1"
              />
            )}
          </div>

          <button onClick={handleSetup} disabled={!delivery.trim() || setupLoading}>
            {setupLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="spinner" style={{ borderTopColor: '#fff' }} /> Loading...
              </span>
            ) : (
              'Start Analysis'
            )}
          </button>

          {messages.length > 0 && messages[0].role === 'system' && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
              {messages[0].content}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Chat Screen ─────────────────────────────────────────────────────────
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>
          <span className="dot active" />
          Analysis: {normalizedDelivery}
          <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
            ({contracts.length} contracts)
          </span>
        </h3>
        <button className="btn-sm" onClick={resetSetup}>Change</button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role}`}>
            <MarkdownRenderer text={msg.content} />
            {msg.extra && <MarkdownRenderer text={msg.extra} />}
            {msg.sql && (
              <details style={{ marginTop: 6 }}>
                <summary className="sql-toggle">View Generated SQL</summary>
                <pre>{msg.sql}</pre>
              </details>
            )}
            {msg.rawData?.rows?.length > 0 && (
              <details style={{ marginTop: 4 }}>
                <summary className="sql-toggle">View Raw Data ({msg.rawData.rows.length} rows)</summary>
                <div style={{ overflowX: 'auto', marginTop: 4 }}>
                  <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr>
                        {msg.rawData.columns.map((c, j) => (
                          <th key={j} style={{ padding: '3px 8px', border: '1px solid #cbd5e1', background: '#e2e8f0', textAlign: 'left', fontSize: 10 }}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.rawData.rows.slice(0, 25).map((row, j) => (
                        <tr key={j}>
                          {row.map((cell, k) => (
                            <td key={k} style={{ padding: '3px 8px', border: '1px solid #e2e8f0' }}>{cell ?? '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        ))}
        {loading && <div className="typing-indicator"><span /><span /><span /></div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="chat-input" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about spend, suppliers, reconciliation..."
          disabled={loading || contracts.length === 0}
        />
        <button type="submit" disabled={!input.trim() || loading}>Send</button>
      </form>
    </div>
  )
}
