import React, { useState } from 'react'
import { submitContracts, triggerPipeline } from '../services/api'

const STEPS = [
  { label: 'Input Type' },
  { label: 'Contract Details' },
  { label: 'Delivery Name' },
  { label: 'Review & Submit' },
  { label: 'Pipeline' },
]

export default function Processing() {
  const [step, setStep] = useState(0)
  const [inputType, setInputType] = useState('')
  const [contractsText, setContractsText] = useState('')
  const [deliveryName, setDeliveryName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [pipelineStatus, setPipelineStatus] = useState(null)
  const [error, setError] = useState(null)

  function getContractsList() {
    return contractsText
      .split(/[,\n]+/)
      .map((c) => c.trim())
      .filter(Boolean)
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    try {
      const contracts = getContractsList()
      const res = await submitContracts(contracts, deliveryName, inputType)
      setResult(res)
      setStep(4)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleTriggerPipeline() {
    setLoading(true)
    setError(null)
    try {
      const res = await triggerPipeline()
      setPipelineStatus(res)
    } catch (e) {
      setPipelineStatus({ status: 'FAILED', message: e.message })
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep(0)
    setInputType('')
    setContractsText('')
    setDeliveryName('')
    setResult(null)
    setPipelineStatus(null)
    setError(null)
  }

  return (
    <>
      <div className="page-header">
        <h2>Process New Contracts</h2>
        <p>Submit new contracts for AdminFee processing pipeline</p>
      </div>
      <div className="page-body">
        {/* Step Indicator */}
        <div className="steps">
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <div className={`step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}>
                <div className="step-number">{i < step ? '✓' : i + 1}</div>
                <span className="step-label">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-connector ${i < step ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'var(--color-danger)' }}>
            <div className="card-body" style={{ color: 'var(--color-danger)' }}>
              {error}
            </div>
          </div>
        )}

        {/* Step 0: Input Type */}
        {step === 0 && (
          <div className="card">
            <div className="card-header">
              <h3>How would you like to provide contract information?</h3>
            </div>
            <div className="card-body">
              <div className="option-cards">
                <div
                  className={`option-card ${inputType === 'manual' ? 'selected' : ''}`}
                  onClick={() => setInputType('manual')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <h4>Manual Entry</h4>
                  <p>Type contract names directly</p>
                </div>
                <div
                  className={`option-card ${inputType === 'file' ? 'selected' : ''}`}
                  onClick={() => setInputType('file')}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <h4>File Upload</h4>
                  <p>Upload contracts.xlsx from S3</p>
                </div>
              </div>
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  disabled={!inputType}
                  onClick={() => setStep(1)}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Contract Details */}
        {step === 1 && (
          <div className="card">
            <div className="card-header">
              <h3>{inputType === 'file' ? 'File Upload Instructions' : 'Enter Contract Names'}</h3>
            </div>
            <div className="card-body">
              {inputType === 'file' ? (
                <div>
                  <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, marginBottom: 16 }}>
                    <h4 style={{ marginBottom: 8, fontSize: 14 }}>Place your Excel file in S3:</h4>
                    <code style={{ display: 'block', padding: 8, background: '#1e293b', color: '#e2e8f0', borderRadius: 4, fontSize: 13 }}>
                      s3://etlhunter/adminfee_input/contracts.xlsx
                    </code>
                    <ul style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-secondary)', paddingLeft: 20 }}>
                      <li>File name must be exactly: contracts.xlsx</li>
                      <li>Column name should be: contract_name</li>
                      <li>File should be closed (not open in Excel)</li>
                    </ul>
                  </div>
                  <div className="form-group">
                    <label>Or enter contracts manually as fallback:</label>
                    <textarea
                      value={contractsText}
                      onChange={(e) => setContractsText(e.target.value)}
                      placeholder="PP-OR-123, PP-NS-345"
                      rows={4}
                    />
                    <p className="hint">Comma or newline separated contract names</p>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label>Contract Names</label>
                  <textarea
                    value={contractsText}
                    onChange={(e) => setContractsText(e.target.value)}
                    placeholder="PP-OR-123, PP-NS-345&#10;PP-QQ-678"
                    rows={6}
                  />
                  <p className="hint">Enter multiple contracts separated by comma or new line</p>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setStep(0)}>Back</button>
                <button
                  className="btn btn-primary"
                  disabled={!contractsText.trim()}
                  onClick={() => setStep(2)}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Delivery Name */}
        {step === 2 && (
          <div className="card">
            <div className="card-header">
              <h3>Delivery Name</h3>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>Enter the delivery name</label>
                <input
                  type="text"
                  value={deliveryName}
                  onChange={(e) => setDeliveryName(e.target.value)}
                  placeholder="e.g., delivery_1, delivery_2"
                />
                <p className="hint">The delivery name for grouping these contracts</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
                <button
                  className="btn btn-primary"
                  disabled={!deliveryName.trim()}
                  onClick={() => setStep(3)}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && (
          <div className="card">
            <div className="card-header">
              <h3>Review & Submit</h3>
            </div>
            <div className="card-body">
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 8, marginBottom: 20 }}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                      Input Type
                    </span>
                    <p style={{ fontWeight: 600, marginTop: 2 }}>{inputType}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                      Delivery Name
                    </span>
                    <p style={{ fontWeight: 600, marginTop: 2 }}>{deliveryName}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                      Contracts ({getContractsList().length})
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {getContractsList().map((c, i) => (
                        <span key={i} className="badge info">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-outline" onClick={() => setStep(2)}>Back</button>
                <button className="btn btn-success btn-lg" onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <>
                      <div className="spinner" style={{ borderTopColor: '#fff' }} />
                      Submitting...
                    </>
                  ) : (
                    'Submit Contracts'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Pipeline */}
        {step === 4 && result && (
          <div className="card">
            <div className="card-header">
              <h3>Contracts Submitted Successfully</h3>
            </div>
            <div className="card-body">
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h3 style={{ marginBottom: 8 }}>{result.message}</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>
                  {result.contracts?.length} contracts submitted for delivery "{result.delivery}"
                </p>

                {!pipelineStatus && (
                  <button className="btn btn-primary btn-lg" onClick={handleTriggerPipeline} disabled={loading}>
                    {loading ? (
                      <>
                        <div className="spinner" style={{ borderTopColor: '#fff' }} />
                        Triggering Pipeline...
                      </>
                    ) : (
                      'Trigger Airflow Pipeline'
                    )}
                  </button>
                )}

                {pipelineStatus && (
                  <div
                    className="card"
                    style={{
                      marginTop: 16,
                      borderColor: pipelineStatus.status === 'TRIGGERED' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}
                  >
                    <div className="card-body" style={{ textAlign: 'center' }}>
                      <span
                        className={`badge ${pipelineStatus.status === 'TRIGGERED' ? 'success' : 'danger'}`}
                        style={{ fontSize: 14, padding: '4px 16px' }}
                      >
                        {pipelineStatus.status}
                      </span>
                      <p style={{ marginTop: 8, fontSize: 14, color: 'var(--color-text-secondary)' }}>
                        {pipelineStatus.message}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
                <button className="btn btn-outline" onClick={reset}>Process More Contracts</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
