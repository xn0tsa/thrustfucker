import React, { useState } from 'react'
import { MODES, FIRMWARE_META } from '../data/modes'
import TriggerMapper from './TriggerMapper'

const BTN_NAMES = ['Trigger', 'Button A', 'Button B', 'Button C', 'Button D', 'Button E', 'Hat ↑', 'Hat ↓', 'Hat ←', 'Hat →', 'Extra']

const RISK_COLOR = { low: 'var(--green)', medium: 'var(--yellow)', high: 'var(--accent)', critical: '#ff3333' }

export default function MappingWizard({ takenButtons, firmwareClass, defaultButtonIndex, onDone, onCancel }) {
  const [step,        setStep]        = useState(defaultButtonIndex != null ? 2 : 1)
  const [buttonIndex, setButtonIndex] = useState(defaultButtonIndex ?? null)
  const [modeFilter,   setModeFilter]   = useState('all')
  const [searchQ,      setSearchQ]      = useState('')

  const handleButtonNext = () => {
    if (buttonIndex === null) return
    setStep(2)
  }

  const handleModeSelect = (mode) => {
    onDone(buttonIndex, mode)
  }

  const handleBack = () => {
    if (step === 2) { setStep(1); return }
    onCancel()
  }

  // Available modes: if firmwareClass is locked, filter to that class
  const availableModes = MODES.filter(m => {
    if (firmwareClass && m.firmware !== firmwareClass) return false
    if (modeFilter !== 'all' && m.firmware !== modeFilter) return false
    if (searchQ && !m.name.toLowerCase().includes(searchQ.toLowerCase()) &&
                   !m.description.toLowerCase().includes(searchQ.toLowerCase())) return false
    return true
  })

  const btnAlreadyTaken = takenButtons.includes(buttonIndex)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 780 }}>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {[1, 2].map(s => (
          <React.Fragment key={s}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              background: step > s ? 'var(--green)' : step === s ? 'var(--accent)' : 'var(--surface2)',
              color: step >= s ? '#fff' : 'var(--text-faint)',
            }}>
              {step > s ? '✓' : s}
            </div>
            <span style={{ fontSize: 12, color: step === s ? 'var(--text)' : 'var(--text-faint)', fontWeight: step === s ? 600 : 400 }}>
              {s === 1 ? 'Choose a button' : 'Choose a payload'}
            </span>
            {s < 2 && <div style={{ flex: '0 0 32px', height: 1, background: step > s ? 'var(--green)' : 'var(--border)' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 1: Button picker ─────────────────────────────────────────── */}
      {step === 1 && (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 6 }}>Which button triggers this payload?</h2>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20, lineHeight: 1.5 }}>
            Plug in the stick in normal mode (not DFU) then physically press the desired button, or select it in the grid.
          </p>

          <TriggerMapper
            value={buttonIndex}
            onChange={setButtonIndex}
          />

          {/* Buttons already taken */}
          {takenButtons.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-faint)' }}>
              Buttons already in use: {takenButtons.map(i => BTN_NAMES[i] ?? `Btn ${i}`).join(', ')}
            </div>
          )}

          {buttonIndex !== null && btnAlreadyTaken && (
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: '#1a0a0a', border: '1px solid var(--accent-dim)',
              borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--accent)',
            }}>
              This button is already mapped. Delete the existing mapping to reassign this button.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button className="btn btn-ghost" onClick={handleBack} style={{ padding: '8px 18px' }}>
              ← Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 24px' }}
              disabled={buttonIndex === null || btnAlreadyTaken}
              onClick={handleButtonNext}>
              Next →
            </button>
          </div>
        </>
      )}

      {/* ── Step 2: Mode picker ───────────────────────────────────────────── */}
      {step === 2 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Which payload to assign to this button?</h2>
            <div style={{
              padding: '3px 10px', borderRadius: 'var(--radius)',
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              fontSize: 11, fontFamily: 'var(--font-mono)',
            }}>
              {BTN_NAMES[buttonIndex] ?? `Btn ${buttonIndex}`}
            </div>
          </div>

          {firmwareClass && (
            <div style={{
              padding: '8px 14px', marginBottom: 14,
              background: `${FIRMWARE_META[firmwareClass]?.color}18`,
              border: `1px solid ${FIRMWARE_META[firmwareClass]?.color}44`,
              borderRadius: 'var(--radius)', fontSize: 12,
              color: FIRMWARE_META[firmwareClass]?.color,
            }}>
              Firmware class <strong>{firmwareClass}</strong> enforced by the first mapping — {FIRMWARE_META[firmwareClass]?.label}
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {!firmwareClass && (
              <div style={{ display: 'flex', gap: 4 }}>
                {[['all', 'All'], ...Object.entries(FIRMWARE_META).map(([k, v]) => [k, v.label.split(' ')[0]])].map(([key, label]) => (
                  <button key={key} className="btn"
                    style={{
                      padding: '3px 10px', fontSize: 11,
                      background: modeFilter === key ? (key === 'all' ? 'var(--surface2)' : `${FIRMWARE_META[key]?.color}22`) : 'transparent',
                      color: modeFilter === key ? (key === 'all' ? 'var(--text)' : FIRMWARE_META[key]?.color) : 'var(--text-faint)',
                      border: modeFilter === key ? `1px solid ${key === 'all' ? 'var(--border2)' : FIRMWARE_META[key]?.color}` : '1px solid transparent',
                    }}
                    onClick={() => setModeFilter(key)}>
                    {key !== 'all' && <span className={`fw-badge fw-${key}`} style={{ marginRight: 4 }}>{key}</span>}
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <input type="text" placeholder="Search…" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                style={{ width: 200, paddingLeft: 28, fontSize: 12 }} />
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', fontSize: 13 }}>⌕</span>
            </div>
          </div>

          {/* Mode list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {availableModes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-faint)', fontSize: 13 }}>
                No payloads available
              </div>
            ) : (
              availableModes.map(m => {
                const fw = FIRMWARE_META[m.firmware]
                return (
                  <button key={m.id}
                    onClick={() => handleModeSelect(m)}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)', padding: '12px 16px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'border-color .15s, background .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}>
                    <span className={`fw-badge fw-${m.firmware}`}>{m.firmware}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}
                        <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6 }}>{m.id}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>{m.description}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: RISK_COLOR[m.risk] ?? 'var(--text-faint)' }}>
                      {(m.risk ?? '').toUpperCase()}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={handleBack} style={{ padding: '8px 18px' }}>
              ← Back
            </button>
          </div>
        </>
      )}
    </div>
  )
}
