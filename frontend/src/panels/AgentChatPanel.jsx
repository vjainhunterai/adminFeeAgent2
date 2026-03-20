import React, { useState, useRef, useEffect } from 'react'
import { agentStart, agentChat } from '../services/api'
import MarkdownRenderer from '../components/MarkdownRenderer'

export default function AgentChatPanel({ onSessionComplete }) {
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(null)
  const [expecting, setExpecting] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function startSession() {
    setLoading(true)
    setMessages([])
    try {
      const data = await agentStart()
      setSessionId(data.session_id)
      setCurrentStep(data.step)
      setExpecting(data.expecting)
      setMessages([{ role: 'agent', content: data.agent_message }])
    } catch (e) {
      setMessages([{ role: 'system', content: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || loading || !sessionId) return

    const text = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const data = await agentChat(sessionId, text)
      setCurrentStep(data.step)
      setExpecting(data.expecting)
      setMessages((prev) => [...prev, { role: 'agent', content: data.agent_message }])

      // If session done and has delivery info, notify parent
      if (data.step === 'done' && data.delivery) {
        onSessionComplete(data.delivery, data.contracts || [])
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'system', content: `Error: ${e.message}` }])
    } finally {
      setLoading(false)
    }
  }

  const stepLabels = {
    input_type: 'Step 1: Input Type',
    contracts_manual: 'Step 2: Contract Names',
    contracts_file: 'Step 2: File Upload',
    delivery: 'Step 3: Delivery Name',
    confirm: 'Step 4: Confirm',
    trigger: 'Step 5: Pipeline',
    done: 'Complete',
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>
          <span className={`dot ${sessionId ? (currentStep === 'done' ? 'idle' : 'active') : 'idle'}`} />
          Processing Agent
        </h3>
        <button className="btn-sm" onClick={startSession} disabled={loading}>
          {sessionId ? 'New Session' : 'Start'}
        </button>
      </div>

      {/* Step indicator */}
      {currentStep && currentStep !== 'done' && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          {stepLabels[currentStep] || currentStep}
          {expecting && <span style={{ marginLeft: 8, color: 'var(--primary)' }}>expecting: {expecting}</span>}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <div className="empty-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h3>Processing Agent</h3>
            <p>Click <strong>Start</strong> to begin processing new GPO AdminFee contracts.<br />
            The agent will guide you step by step.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`msg ${msg.role}`}>
            <MarkdownRenderer text={msg.content} />
          </div>
        ))}

        {loading && (
          <div className="typing-indicator">
            <span /><span /><span />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form className="chat-input" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            !sessionId
              ? 'Start a session first...'
              : expecting
              ? `Type: ${expecting}`
              : 'Type your message...'
          }
          disabled={loading || !sessionId || currentStep === 'done'}
        />
        <button type="submit" disabled={!input.trim() || loading || !sessionId}>
          Send
        </button>
      </form>
    </div>
  )
}
