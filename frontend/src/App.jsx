import React, { useState } from 'react'
import AgentChatPanel from './panels/AgentChatPanel'
import StatusMonitorPanel from './panels/StatusMonitorPanel'
import AnalysisPanel from './panels/AnalysisPanel'

export default function App() {
  // Shared state: when agent submits contracts, pass delivery to status panel
  const [activeDelivery, setActiveDelivery] = useState('')
  const [activeContracts, setActiveContracts] = useState([])
  const [processingComplete, setProcessingComplete] = useState(false)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ─── Top Header ──────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">H</div>
          <div>
            <h1>hunterAI <span>GPO AdminFee Reconciliation</span></h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {activeDelivery && (
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
              Active: {activeDelivery}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>v2.0</span>
        </div>
      </header>

      {/* ─── 3-Panel Layout ──────────────────────────────────────────────── */}
      <div className="panels-container">
        {/* Panel 1: Agent Chat */}
        <AgentChatPanel
          onSessionComplete={(delivery, contracts) => {
            setActiveDelivery(delivery)
            setActiveContracts(contracts)
            setProcessingComplete(false)
          }}
        />

        {/* Panel 2: Status Monitor */}
        <StatusMonitorPanel
          activeDelivery={activeDelivery}
          onDeliveryChange={setActiveDelivery}
          onProcessingComplete={(delivery) => {
            setActiveDelivery(delivery)
            setProcessingComplete(true)
          }}
        />

        {/* Panel 3: Analysis Chat */}
        <AnalysisPanel
          activeDelivery={activeDelivery}
          activeContracts={activeContracts}
          processingComplete={processingComplete}
          onAnalysisStarted={() => setProcessingComplete(false)}
        />
      </div>
    </div>
  )
}
