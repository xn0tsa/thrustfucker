import React, { useState, useCallback, useEffect } from 'react'
import TitleBar       from './components/TitleBar'
import StickDashboard from './components/StickDashboard'
import MappingWizard  from './components/MappingWizard'
import Configurator   from './components/Configurator'
import FlashWizard    from './components/FlashWizard'
import RestoreBar     from './components/RestoreBar'
import Settings       from './components/Settings'

const BTN_NAMES = ['Trigger', 'Button A', 'Button B', 'Button C', 'Button D', 'Button E', 'Hat ↑', 'Hat ↓', 'Hat ←', 'Hat →', 'Extra']

const DEFAULT_GLOBAL = { keyboardLayout: 'QWERTY (US)', keystrokeDelayMs: 60, driveLabel: 'FORGE USB', webhookUrl: '', exfilMode: 'Webhook HTTPS', aesKey: '' }

export default function App() {
  // ── Core state ───────────────────────────────────────────────────────────
  const [view,          setView]          = useState('dashboard')
  // 'dashboard' | 'wizard' | 'configure' | 'flash'
  const [mappings,      setMappings]      = useState([])
  const [firmwareClass, setFirmwareClass] = useState(null)
  const [globalConfig,  setGlobalConfig]  = useState(DEFAULT_GLOBAL)
  const [wizard,        setWizard]        = useState({ buttonIndex: null, mode: null, editId: null })
  const [flashResult,   setFlashResult]   = useState(null)
  const [showSettings,  setShowSettings]  = useState(false)

  // Load persisted state on mount
  useEffect(() => {
    if (!window.forge) return
    window.forge.settings.get().catch(() => ({})).then(s => {
      if (s?.mappings)      setMappings(s.mappings)
      if (s?.firmwareClass) setFirmwareClass(s.firmwareClass)
      if (s?.globalConfig)  setGlobalConfig({ ...DEFAULT_GLOBAL, ...s.globalConfig })
    })
  }, [])

  // Persist whenever key state changes
  useEffect(() => {
    if (!window.forge) return
    window.forge.settings.get().catch(() => ({})).then(s => {
      window.forge.settings.save({ ...s, mappings, firmwareClass, globalConfig }).catch(() => {})
    })
  }, [mappings, firmwareClass, globalConfig])

  // ── Dashboard actions ────────────────────────────────────────────────────
  const handleAddMapping = useCallback(() => {
    setWizard({ buttonIndex: null, mode: null, editId: null })
    setView('wizard')
  }, [])

  const handleEditMapping = useCallback((id) => {
    const m = mappings.find(x => x.id === id)
    if (!m) return
    setWizard({ buttonIndex: m.buttonIndex, mode: m.mode, editId: id })
    setView('configure')
  }, [mappings])

  const handleDeleteMapping = useCallback((id) => {
    setMappings(prev => {
      const next = prev.filter(m => m.id !== id)
      if (next.length === 0) setFirmwareClass(null)
      return next
    })
  }, [])

  const handleFlashAll = useCallback(() => {
    setFlashResult(null)
    setView('flash')
  }, [])

  // ── Wizard → configure ───────────────────────────────────────────────────
  const handleWizardDone = useCallback((buttonIndex, mode) => {
    setWizard(prev => ({ ...prev, buttonIndex, mode, editId: null }))
    if (!firmwareClass) setFirmwareClass(mode.firmware)
    setView('configure')
  }, [firmwareClass])

  // ── Configure → dashboard ────────────────────────────────────────────────
  const handleConfigureDone = useCallback((cfg) => {
    const { buttonIndex, mode, editId } = wizard
    setMappings(prev => {
      if (editId) {
        return prev.map(m => m.id === editId ? { ...m, config: cfg } : m)
      }
      return [...prev, { id: `${Date.now()}-${Math.random()}`, buttonIndex, mode, config: cfg }]
    })
    setView('dashboard')
  }, [wizard])

  // ── Flash → dashboard ────────────────────────────────────────────────────
  const handleFlashDone = useCallback((result) => {
    setFlashResult(result)
    setView('dashboard')
  }, [])

  // ── Back navigation ──────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (view === 'wizard')    { setView('dashboard'); return }
    if (view === 'configure') { wizard.editId ? setView('dashboard') : setView('wizard'); return }
    if (view === 'flash')     { setView('dashboard'); return }
    setView('dashboard')
  }, [view, wizard.editId])

  // ── Derived ──────────────────────────────────────────────────────────────
  const buttonLabel  = wizard.buttonIndex !== null ? (BTN_NAMES[wizard.buttonIndex] ?? `Btn ${wizard.buttonIndex}`) : null
  const takenButtons = mappings.filter(m => m.id !== wizard.editId).map(m => m.buttonIndex)
  const lockedClass  = mappings.filter(m => m.id !== wizard.editId).length > 0 ? firmwareClass : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TitleBar onSettings={() => setShowSettings(true)} />

      {view !== 'dashboard' && (
        <WizardBar view={view} wizard={wizard} firmwareClass={firmwareClass} buttonLabel={buttonLabel} onBack={handleBack} />
      )}

      {view === 'dashboard' && flashResult?.ok && (
        <div style={{
          background: '#0d2d14', borderBottom: '1px solid var(--green)',
          padding: '8px 24px', fontSize: 12, color: 'var(--green)',
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ✓ Flash successful — the stick is restarting with the new payloads.
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: 11 }}
            onClick={() => setFlashResult(null)}>✕</button>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {view === 'dashboard' && (
          <StickDashboard
            mappings={mappings}
            firmwareClass={firmwareClass}
            globalConfig={globalConfig}
            onAddMapping={handleAddMapping}
            onEditMapping={handleEditMapping}
            onDeleteMapping={handleDeleteMapping}
            onFlashAll={handleFlashAll}
            onGlobalConfigChange={setGlobalConfig}
          />
        )}

        {view === 'wizard' && (
          <MappingWizard
            takenButtons={takenButtons}
            firmwareClass={lockedClass}
            defaultButtonIndex={wizard.buttonIndex}
            onDone={handleWizardDone}
            onCancel={() => setView('dashboard')}
          />
        )}

        {view === 'configure' && wizard.mode && (
          <Configurator
            mode={wizard.mode}
            initialConfig={wizard.editId ? mappings.find(m => m.id === wizard.editId)?.config : undefined}
            buttonLabel={buttonLabel}
            onBack={handleBack}
            onNext={handleConfigureDone}
          />
        )}

        {view === 'flash' && (
          <FlashWizard
            mappings={mappings}
            firmwareClass={firmwareClass}
            globalConfig={globalConfig}
            onBack={handleBack}
            onDone={handleFlashDone}
          />
        )}
      </div>

      <RestoreBar />
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  )
}

function WizardBar({ view, wizard, firmwareClass, buttonLabel, onBack }) {
  const steps = view === 'flash'
    ? [{ key: 'flash', label: 'Flash' }]
    : [{ key: 'wizard', label: 'Button' }, { key: 'configure', label: 'Configuration' }]
  const idx = steps.findIndex(s => s.key === view)

  return (
    <div style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
    }}>
      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={onBack}>
        ← Back
      </button>

      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: i < idx ? 'var(--green)' : i === idx ? 'var(--accent)' : 'var(--surface2)',
              color: i <= idx ? '#fff' : 'var(--text-faint)',
            }}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 12, color: i === idx ? 'var(--text)' : i < idx ? 'var(--text-dim)' : 'var(--text-faint)', fontWeight: i === idx ? 600 : 400 }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 0, width: 24, height: 1, background: i < idx ? 'var(--green)' : 'var(--border)' }} />
          )}
        </React.Fragment>
      ))}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {buttonLabel && (
          <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            {buttonLabel}
          </span>
        )}
        {wizard?.mode && (
          <>
            <span className={`fw-badge fw-${wizard.mode.firmware}`}>{wizard.mode.firmware}</span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{wizard.mode.id}</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{wizard.mode.name}</span>
          </>
        )}
        {view === 'flash' && firmwareClass && (
          <span className={`fw-badge fw-${firmwareClass}`}>{firmwareClass}</span>
        )}
      </div>
    </div>
  )
}
