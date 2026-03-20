import React, { useState, useRef, useEffect } from 'react'
import {
  getDeliveries,
  getContractsForDelivery,
  askAnalysisQuestion,
} from '../services/api'

export default function Analysis() {
  const [deliveries, setDeliveries] = useState([])
  const [selectedDelivery, setSelectedDelivery] = useState('')
  const [contracts, setContracts] = useState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingDeliveries, setLoadingDeliveries] = useState(true)
  const [step, setStep] = useState('select') // select | chat
  const messagesEndRef = useRef(null)

  useEffect(() => {
    getDeliveries()
      .then((data) => setDeliveries(data.deliveries || []))
      .catch(() => {})
      .finally(() => setLoadingDeliveries(false))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSelectDelivery() {
    if (!selectedDelivery) return
    setLoading(true)
    try {
      const data = await getContractsForDelivery(selectedDelivery)
      setContracts(data.contracts || [])
      setMessages([
        {
          role: 'assistant',
          content: `Loaded **${data.contracts?.length || 0} contracts** for delivery "${selectedDelivery}":\n\n${(data.contracts || []).map((c) => `- ${c}`).join('\n')}\n\nAsk me anything about these contracts.`,
        },
      ])
      setStep('chat')
    } catch (e) {
      setMessages([{ role: 'assistant', content: `Error: ${e.message}` }])
      setStep('chat')
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const question = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const data = await askAnalysisQuestion(question, selectedDelivery, contracts)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.formatted_answer,
          sql: data.sql_generated,
          rawResult: data.raw_result,
        },
      ])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, I encountered an error: ${e.message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  // ─── Delivery Selection ──────────────────────────────────────────────────
  if (step === 'select') {
    return (
      <>
        <div className="page-header">
          <h2>Contract Analysis</h2>
          <p>Ask natural language questions about your contracts</p>
        </div>
        <div className="page-body">
          <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="card-header">
              <h3>Select a Delivery</h3>
            </div>
            <div className="card-body">
              {loadingDeliveries ? (
                <div className="loading-overlay" style={{ padding: 40 }}>
                  <div className="spinner" />
                  <p>Loading deliveries...</p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Delivery Name</label>
                    {deliveries.length > 0 ? (
                      <select
                        value={selectedDelivery}
                        onChange={(e) => setSelectedDelivery(e.target.value)}
                      >
                        <option value="">-- Select delivery --</option>
                        {deliveries.map((d, i) => (
                          <option key={i} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={selectedDelivery}
                        onChange={(e) => setSelectedDelivery(e.target.value)}
                        placeholder="Enter delivery name (e.g., delivery_1)"
                      />
                    )}
                    <p className="hint">
                      Select or enter the delivery whose contracts you want to analyze
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      disabled={!selectedDelivery || loading}
                      onClick={handleSelectDelivery}
                    >
                      {loading ? (
                        <>
                          <div className="spinner" style={{ borderTopColor: '#fff' }} />
                          Loading...
                        </>
                      ) : (
                        'Start Analysis'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ─── Chat Interface ──────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>Contract Analysis</h2>
          <p>
            Delivery: <strong>{selectedDelivery}</strong> &middot; {contracts.length} contracts
          </p>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            setStep('select')
            setMessages([])
            setContracts([])
            setSelectedDelivery('')
          }}
        >
          Change Delivery
        </button>
      </div>
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              {msg.sql && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    View Generated SQL
                  </summary>
                  <div className="sql-block">{msg.sql}</div>
                </details>
              )}
              {msg.rawResult?.rows?.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    View Raw Data ({msg.rawResult.rows.length} rows)
                  </summary>
                  <div style={{ overflowX: 'auto', marginTop: 8 }}>
                    <table style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          {msg.rawResult.columns.map((c, j) => (
                            <th key={j} style={{ padding: '4px 8px' }}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.rawResult.rows.slice(0, 20).map((row, j) => (
                          <tr key={j}>
                            {row.map((cell, k) => (
                              <td key={k} style={{ padding: '4px 8px' }}>{cell ?? '-'}</td>
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
          {loading && (
            <div className="chat-message assistant">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="spinner" />
                Analyzing your question...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form className="chat-input-area" onSubmit={handleSend}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your contracts... (e.g., 'What is the total spend?')"
            disabled={loading}
          />
          <button className="btn btn-primary" type="submit" disabled={!input.trim() || loading}>
            Send
          </button>
        </form>
      </div>
    </>
  )
}
