import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FIRMWARE_META } from '../data/modes'

const BTN_NAMES  = ['Trigger', 'Button A', 'Button B', 'Button C', 'Button D', 'Button E', 'Hat ↑', 'Hat ↓', 'Hat ←', 'Hat →', 'Extra']
const BTN_SHORT  = ['◎', 'A', 'B', 'C', 'D', 'E', '↑', '↓', '←', '→', '★']
const MAX_SLOTS  = 8
const FLASH_TOTAL_KB = 512
const CODE_KB    = 24
const CONFIG_KB  = 33

function fmtSize(bytes) {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function StickDashboard({ mappings, firmwareClass, globalConfig, onAddMapping, onEditMapping, onDeleteMapping, onFlashAll, onGlobalConfigChange }) {
  // ── DFU / MSC / normal-mode state ───────────────────────────────────────────
  const [dfuStatus,     setDfuStatus]     = useState(null)  // null | true | false
  const [detecting,     setDetecting]     = useState(false)
  // Normal-mode detection: null=unknown, { found, firmwareClass, productString, serial }
  const [stickNormal,   setStickNormal]   = useState(null)
  const [detectingNorm, setDetectingNorm] = useState(false)
  const [volumeStatus,  setVolumeStatus]  = useState(null)
  const [volumeFiles,   setVolumeFiles]   = useState([])
  const [volumeLoading, setVolumeLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // ── Serial / C2 state ────────────────────────────────────────────────────────
  const [serialPorts,     setSerialPorts]     = useState([])
  const [serialPort,      setSerialPort]      = useState('')
  const [serialBaud,      setSerialBaud]      = useState('9600')
  const [serialConnected, setSerialConnected] = useState(false)
  const [serialConnecting,setSerialConnecting]= useState(false)
  const [serialLog,       setSerialLog]       = useState([])
  const [serialInput,     setSerialInput]     = useState('')
  const serialLogRef = useRef(null)

  const usedKB   = CODE_KB + CONFIG_KB
  const freeKB   = FLASH_TOTAL_KB - usedKB
  const slotsPct = (mappings.length / MAX_SLOTS) * 100

  // ── Normal-mode detect ───────────────────────────────────────────────────────
  const detectNormal = useCallback(async () => {
    if (!window.forge || detectingNorm) return
    setDetectingNorm(true)
    const r = await window.forge.stick.detectNormal().catch(() => ({ found: false }))
    setStickNormal(r)
    setDetectingNorm(false)
  }, [detectingNorm])

  // ── DFU detect ──────────────────────────────────────────────────────────────
  const detectDfu = useCallback(async () => {
    if (!window.forge || detecting) return
    setDetecting(true)
    const r = await window.forge.dfu.detect().catch(() => ({ found: false }))
    setDfuStatus(r.found)
    setDetecting(false)
  }, [detecting])

  // Detect both modes on mount
  useEffect(() => {
    detectNormal()
    detectDfu()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh all
  const detectAll = useCallback(async () => {
    await Promise.all([detectNormal(), detectDfu()])
  }, [detectNormal, detectDfu])

  // ── MSC volume ──────────────────────────────────────────────────────────────
  const refreshFiles = useCallback(async (vol) => {
    if (!vol?.path) return
    const fl = await window.forge.stick.listFiles({ drivePath: vol.path }).catch(() => ({ ok: false, files: [] }))
    setVolumeFiles(fl.files || [])
  }, [])

  const detectVolume = useCallback(async () => {
    if (!window.forge || volumeLoading) return
    setVolumeLoading(true)
    setDeleteConfirm(null)
    const label = globalConfig.driveLabel || 'FORGE USB'
    const r = await window.forge.stick.findVolume({ driveLabel: label }).catch(() => ({ found: false }))
    setVolumeStatus(r)
    if (r.found) await refreshFiles(r)
    else         setVolumeFiles([])
    setVolumeLoading(false)
  }, [volumeLoading, globalConfig.driveLabel, refreshFiles])

  const handleSaveFile = useCallback(async (fileName) => {
    if (!volumeStatus?.path || !window.forge) return
    await window.forge.stick.saveFile({ drivePath: volumeStatus.path, fileName }).catch(() => {})
  }, [volumeStatus])

  const handleDeleteFile = useCallback(async (fileName) => {
    if (!volumeStatus?.path || !window.forge) return
    const r = await window.forge.stick.deleteFile({ drivePath: volumeStatus.path, fileName }).catch(() => ({ ok: false }))
    if (r.ok) setVolumeFiles(prev => prev.filter(f => f.name !== fileName))
    setDeleteConfirm(null)
  }, [volumeStatus])

  const handleDeleteAll = useCallback(async () => {
    if (!volumeStatus?.path || !window.forge) return
    for (const f of volumeFiles) {
      await window.forge.stick.deleteFile({ drivePath: volumeStatus.path, fileName: f.name }).catch(() => {})
    }
    setVolumeFiles([])
    setDeleteConfirm(null)
  }, [volumeStatus, volumeFiles])

  // ── Serial C2 ────────────────────────────────────────────────────────────────
  const serialAddLog = useCallback((msg, type = '') =>
    setSerialLog(prev => [...prev, { msg, type, t: Date.now() }])
  , [])

  useEffect(() => {
    if (serialLogRef.current) serialLogRef.current.scrollTop = serialLogRef.current.scrollHeight
  }, [serialLog])

  // Register data listener on mount, cleanup on unmount
  useEffect(() => {
    if (!window.forge?.serial) return
    window.forge.serial.onData(({ line, type }) => {
      setSerialLog(prev => [...prev, { msg: line, type: type || 'ok', t: Date.now() }])
    })
    return () => { window.forge?.serial.offData() }
  }, [])

  const handleSerialRefresh = useCallback(async () => {
    if (!window.forge?.serial) return
    const r = await window.forge.serial.list().catch(() => ({ ok: false, ports: [] }))
    setSerialPorts(r.ports || [])
    if (r.ports?.length && !serialPort) setSerialPort(r.ports[0].path)
  }, [serialPort])

  useEffect(() => {
    if (firmwareClass === 'D') handleSerialRefresh()
  }, [firmwareClass]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSerialConnect = useCallback(async () => {
    if (!window.forge?.serial || !serialPort) return
    setSerialConnecting(true)
    serialAddLog(`Connecting ${serialPort} @ ${serialBaud} baud…`, 'dim')
    const r = await window.forge.serial.connect({ path: serialPort, baudRate: parseInt(serialBaud) }).catch(e => ({ ok: false, error: e.message }))
    if (r.ok) {
      setSerialConnected(true)
      serialAddLog(`Connected to ${serialPort}`, 'ok')
    } else {
      serialAddLog(`Error: ${r.error}`, 'err')
    }
    setSerialConnecting(false)
  }, [serialPort, serialBaud, serialAddLog])

  const handleSerialDisconnect = useCallback(async () => {
    if (!window.forge?.serial) return
    await window.forge.serial.disconnect().catch(() => {})
    setSerialConnected(false)
    serialAddLog('Disconnected.', 'dim')
  }, [serialAddLog])

  const handleSerialSend = useCallback(async (text) => {
    if (!serialConnected || !text.trim() || !window.forge?.serial) return
    serialAddLog(`> ${text}`, 'dim')
    const r = await window.forge.serial.send(text).catch(e => ({ ok: false, error: e.message }))
    if (!r.ok) serialAddLog(`Send error: ${r.error}`, 'err')
    setSerialInput('')
  }, [serialConnected, serialAddLog])

  const handleSerialKeyDown = useCallback(e => {
    if (e.key === 'Enter') { e.preventDefault(); handleSerialSend(serialInput) }
  }, [serialInput, handleSerialSend])

  const fwMeta = firmwareClass ? FIRMWARE_META[firmwareClass] : null

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 780 }}>

      {/* ── Device status card ───────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '14px 20px', marginBottom: 24,
      }}>
        {/* Row 1 : title + refresh button */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>TCA Sidestick X</div>
          <button className="btn btn-ghost"
            style={{ marginLeft: 'auto', padding: '4px 12px', fontSize: 11 }}
            disabled={detecting || detectingNorm}
            onClick={detectAll}>
            {(detecting || detectingNorm) ? '…' : '↺ Refresh'}
          </button>
        </div>

        {/* Row 2 : normal mode */}
        {(() => {
          const isOrig  = stickNormal?.isOriginal
          const isForge = stickNormal?.found && !isOrig
          const bg      = isForge ? '#0d1f0d' : isOrig ? '#1a1400' : 'var(--surface2)'
          const border  = isForge ? 'var(--green)' : isOrig ? 'var(--yellow)' : 'var(--border)'
          const dotCls  = detectingNorm ? 'dot-yellow' : isForge ? 'dot-green' : isOrig ? 'dot-yellow' : 'dot-grey'
          const color   = isForge ? 'var(--green)' : isOrig ? 'var(--yellow)' : 'var(--text-dim)'
          const label   = detectingNorm
            ? 'Detection…'
            : isForge
              ? `Connected — ThrustFucker (${stickNormal.serial})`
              : isOrig
                ? 'Original Thrustmaster firmware detected'
                : stickNormal === null
                  ? 'Normal mode: not verified'
                  : 'Not connected (plug in normal mode)'
          const sub = isForge ? null
            : isOrig ? 'Switch to DFU mode to flash ThrustFucker firmware'
            : null
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 'var(--radius)',
              background: bg, border: `1px solid ${border}`, marginBottom: 8,
            }}>
              <div className={`dot ${dotCls}`} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color }}>{label}</div>
                {sub && <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>{sub}</div>}
              </div>
              {/* Detected ThrustFucker firmware badge */}
              {isForge && stickNormal.firmwareClass && (() => {
                const m = FIRMWARE_META[stickNormal.firmwareClass]
                return m ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span className={`fw-badge fw-${stickNormal.firmwareClass}`}>{stickNormal.firmwareClass}</span>
                    <span style={{ fontSize: 11, color: m.color }}>{m.label}</span>
                  </div>
                ) : null
              })()}
              {/* "ORIGINAL" badge for Thrustmaster firmware */}
              {isOrig && (
                <div style={{
                  padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.5px', background: '#2a1e00',
                  color: 'var(--yellow)', border: '1px solid #4a3600', flexShrink: 0,
                }}>
                  ORIGINAL
                </div>
              )}
            </div>
          )
        })()}

        {/* Row 3 : DFU mode */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', borderRadius: 'var(--radius)',
          background: dfuStatus === true ? '#0d1a2d' : 'var(--surface2)',
          border: `1px solid ${dfuStatus === true ? '#4895ef' : 'var(--border)'}`,
        }}>
          <div className={`dot ${detecting ? 'dot-yellow' : dfuStatus === true ? 'dot-blue' : 'dot-grey'}`} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: dfuStatus === true ? '#4895ef' : 'var(--text-dim)' }}>
              {detecting
                ? 'DFU Detection…'
                : dfuStatus === true
                  ? 'DFU mode detected — ready to flash'
                  : dfuStatus === false
                    ? 'DFU mode: not detected'
                    : 'DFU mode: not verified'}
            </div>
            {dfuStatus !== true && (
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>
                Rear switch + hold Xbox + plug in
              </div>
            )}
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11, flexShrink: 0 }}
            disabled={detecting} onClick={detectDfu}>
            {detecting ? '…' : 'Check DFU'}
          </button>
        </div>

        {/* Warning if detected firmware ≠ firmware selected in the app */}
        {stickNormal?.found && stickNormal.firmwareClass && firmwareClass &&
         stickNormal.firmwareClass !== firmwareClass && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius)',
            background: '#1a1200', border: '1px solid var(--yellow)',
            fontSize: 11, color: 'var(--yellow)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ⚠ The stick has firmware <strong>{stickNormal.firmwareClass}</strong> active but
            you are configuring a class <strong>{firmwareClass}</strong> payload — a flash will be required.
          </div>
        )}
      </div>

      {/* ── Mappings ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, margin: 0 }}>Mappings</h2>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 8 }}>
            {mappings.length} / {MAX_SLOTS} slots
          </span>
          {firmwareClass && (
            <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 8 }}>
              · firmware class <span className={`fw-badge fw-${firmwareClass}`} style={{ marginLeft: 4 }}>{firmwareClass}</span> enforced
            </span>
          )}
          <button
            className="btn btn-primary"
            style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: 12 }}
            disabled={mappings.length >= MAX_SLOTS}
            onClick={onAddMapping}>
            + Add
          </button>
        </div>

        {mappings.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px dashed var(--border2)',
            borderRadius: 'var(--radius-lg)', padding: '44px 24px',
            textAlign: 'center', color: 'var(--text-faint)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 14, opacity: .5 }}>🎮</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No payload assigned</div>
            <div style={{ fontSize: 12 }}>Click <strong>+ Add</strong> to bind a physical button to a payload</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mappings.map(m => {
              const fwM = FIRMWARE_META[m.mode.firmware]
              return (
                <div key={m.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: 'var(--surface2)', border: '1px solid var(--border2)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 8, color: 'var(--text-faint)', lineHeight: 1 }}>{m.buttonIndex}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, fontFamily: 'var(--font-mono)' }}>
                      {BTN_SHORT[m.buttonIndex] ?? m.buttonIndex}
                    </span>
                  </div>
                  <span style={{ color: 'var(--text-faint)', fontSize: 16 }}>→</span>
                  <span className={`fw-badge fw-${m.mode.firmware}`}>{m.mode.firmware}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.mode.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {BTN_NAMES[m.buttonIndex] ?? `Btn ${m.buttonIndex}`} · {m.mode.id}
                    </div>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }}
                    onClick={() => onEditMapping(m.id)}>Edit</button>
                  <button className="btn btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 11, color: 'var(--accent)', borderColor: 'var(--accent-dim)' }}
                    onClick={() => onDeleteMapping(m.id)}>✕</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Global config ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
          Global Settings
        </h3>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 5 }}>Keyboard layout</label>
            <select
              value={globalConfig.keyboardLayout}
              onChange={e => onGlobalConfigChange({ ...globalConfig, keyboardLayout: e.target.value })}
              style={{ fontSize: 12, padding: '5px 10px' }}>
              <option>QWERTY (US)</option>
              <option>AZERTY (FR)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 5 }}>Keystroke delay (ms)</label>
            <input type="number" min={1} max={500}
              value={globalConfig.keystrokeDelayMs}
              onChange={e => onGlobalConfigChange({ ...globalConfig, keystrokeDelayMs: Math.max(1, parseInt(e.target.value) || 60) })}
              style={{ fontSize: 12, padding: '5px 8px', width: 80 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 5 }}>MSC volume</label>
            <input type="text" maxLength={31}
              value={globalConfig.driveLabel || ''}
              placeholder="FORGE USB"
              onChange={e => onGlobalConfigChange({ ...globalConfig, driveLabel: e.target.value })}
              style={{ fontSize: 12, padding: '5px 8px', width: 120, fontFamily: 'var(--font-mono)' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 5 }}>Default exfil</label>
            <select
              value={globalConfig.exfilMode || 'Webhook HTTPS'}
              onChange={e => onGlobalConfigChange({ ...globalConfig, exfilMode: e.target.value })}
              style={{ fontSize: 12, padding: '5px 10px' }}>
              <option>Webhook HTTPS</option>
              <option>Device (flash)</option>
              <option>Dual USB</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 5 }}>Webhook URL (global)</label>
            <input type="url"
              value={globalConfig.webhookUrl || ''}
              placeholder="https://discord.com/api/webhooks/…"
              onChange={e => onGlobalConfigChange({ ...globalConfig, webhookUrl: e.target.value })}
              style={{ fontSize: 11, padding: '5px 8px', width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>
        </div>
        {/* AES key — shown only when class D */}
        {firmwareClass === 'D' && (
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 5 }}>
              AES Key (Firmware D — encrypted C2)
            </label>
            <input type="text" maxLength={32}
              value={globalConfig.aesKey || ''}
              placeholder="DEADBEEF0123456789ABCDEF01234567"
              onChange={e => onGlobalConfigChange({ ...globalConfig, aesKey: e.target.value })}
              style={{ fontSize: 11, padding: '5px 8px', width: 280, fontFamily: 'var(--font-mono)' }} />
          </div>
        )}
      </div>

      {/* ── Stick data (MSC — Firmware A) ──────────────────────────── */}
      {firmwareClass === 'A' && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 10 }}>
            <h3 style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>
              Stick data
            </h3>
            {volumeStatus?.found && (
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--green)', background: '#0d2d14', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--green)' }}>
                {volumeStatus.driveLetter}
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {volumeStatus?.found && (
                <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }}
                  disabled={volumeLoading} onClick={() => refreshFiles(volumeStatus)}>
                  Refresh
                </button>
              )}
              <button className="btn btn-ghost" style={{ padding: '4px 14px', fontSize: 11 }}
                disabled={volumeLoading} onClick={detectVolume}>
                {volumeLoading ? '…' : volumeStatus === null ? 'Detect' : 'Re-detect'}
              </button>
            </div>
          </div>

          {volumeStatus === null && !volumeLoading && (
            <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '10px 0' }}>
              Plug in the stick in normal mode (not DFU) then click <strong>Detect</strong>.
            </div>
          )}
          {volumeStatus?.found === false && (
            <div style={{ fontSize: 12, color: 'var(--accent)', padding: '8px 12px', background: '#1a0a0a', border: '1px solid var(--accent-dim)', borderRadius: 'var(--radius)' }}>
              Volume "<strong>{globalConfig.driveLabel || 'FORGE USB'}</strong>" not found. Check that the stick is plugged in and the label matches.
            </div>
          )}

          {volumeStatus?.found && (
            volumeFiles.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-faint)', padding: '10px 0', textAlign: 'center' }}>
                No files on the stick.
              </div>
            ) : (
              <div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Name', 'Size', 'Modified', ''].map(h => (
                        <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text-faint)', fontWeight: 500, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {volumeFiles.map(f => (
                      <tr key={f.name} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '7px 8px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{f.name}</td>
                        <td style={{ padding: '7px 8px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{fmtSize(f.size)}</td>
                        <td style={{ padding: '7px 8px', color: 'var(--text-faint)', whiteSpace: 'nowrap', fontSize: 11 }}>{fmtDate(f.modified)}</td>
                        <td style={{ padding: '7px 8px', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }}
                            onClick={() => handleSaveFile(f.name)}>
                            ↓ Download
                          </button>
                          {deleteConfirm === f.name ? (
                            <>
                              <button className="btn" style={{ padding: '3px 10px', fontSize: 11, background: 'var(--accent)', color: '#fff', border: 'none' }}
                                onClick={() => handleDeleteFile(f.name)}>
                                Confirm
                              </button>
                              <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11 }}
                                onClick={() => setDeleteConfirm(null)}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-ghost"
                              style={{ padding: '3px 10px', fontSize: 11, color: 'var(--accent)', borderColor: 'var(--accent-dim)' }}
                              onClick={() => setDeleteConfirm(f.name)}>
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {volumeFiles.length > 1 && (
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    {deleteConfirm === '__all__' ? (
                      <>
                        <button className="btn" style={{ padding: '4px 14px', fontSize: 11, background: 'var(--accent)', color: '#fff', border: 'none', marginRight: 6 }}
                          onClick={handleDeleteAll}>
                          Confirm — clear the stick
                        </button>
                        <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: 11 }}
                          onClick={() => setDeleteConfirm(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-ghost"
                        style={{ padding: '4px 14px', fontSize: 11, color: 'var(--accent)', borderColor: 'var(--accent-dim)' }}
                        onClick={() => setDeleteConfirm('__all__')}>
                        Clear the stick ({volumeFiles.length} files)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* ── C2 Terminal (Firmware D — serial relay) ────────────────────────── */}
      {firmwareClass === 'D' && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>
            C2 Terminal — Serial relay
          </h3>

          {/* Port selector */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <select
              value={serialPort}
              onChange={e => setSerialPort(e.target.value)}
              disabled={serialConnected}
              style={{ fontSize: 12, padding: '5px 10px', flex: 1, minWidth: 120 }}>
              {serialPorts.length === 0
                ? <option value="">— no port —</option>
                : serialPorts.map(p => (
                    <option key={p.path} value={p.path}>
                      {p.path}{p.manufacturer ? ` (${p.manufacturer})` : ''}
                    </option>
                  ))
              }
            </select>
            <select
              value={serialBaud}
              onChange={e => setSerialBaud(e.target.value)}
              disabled={serialConnected}
              style={{ fontSize: 12, padding: '5px 10px', width: 100 }}>
              <option value="9600">9600 bps</option>
              <option value="115200">115200 bps</option>
            </select>
            <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 11 }}
              disabled={serialConnected} onClick={handleSerialRefresh}>
              ↺ Refresh
            </button>
            <button
              className={`btn ${serialConnected ? 'btn-ghost' : 'btn-primary'}`}
              style={{
                padding: '5px 16px', fontSize: 12,
                color: serialConnected ? 'var(--accent)' : undefined,
                borderColor: serialConnected ? 'var(--accent-dim)' : undefined,
              }}
              disabled={serialConnecting || (!serialPort && !serialConnected)}
              onClick={serialConnected ? handleSerialDisconnect : handleSerialConnect}>
              {serialConnecting ? '…' : serialConnected ? '⏹ Disconnect' : '▶ Connect'}
            </button>
            {serialConnected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div className="dot dot-green" />
                <span style={{ fontSize: 11, color: 'var(--green)' }}>Connected</span>
              </div>
            )}
          </div>

          {/* Log terminal */}
          <div ref={serialLogRef} className="terminal" style={{ maxHeight: 200, marginBottom: 10 }}>
            {serialLog.length === 0
              ? <div style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>Waiting for connection…</div>
              : serialLog.map((l, i) => (
                  <div key={i} className={l.type} style={{ lineHeight: 1.5 }}>{l.msg}</div>
                ))
            }
          </div>

          {/* Input relay (D-01: live keystroke, D-03: payload → stick → receives data) */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={serialInput}
              onChange={e => setSerialInput(e.target.value)}
              onKeyDown={handleSerialKeyDown}
              disabled={!serialConnected}
              placeholder={serialConnected ? 'Type here → injected on target via HID…' : 'Connect the serial port first'}
              style={{ flex: 1, fontSize: 12, padding: '6px 10px', fontFamily: 'var(--font-mono)' }}
            />
            <button className="btn btn-ghost" style={{ padding: '5px 14px', fontSize: 12 }}
              disabled={!serialConnected || !serialInput.trim()}
              onClick={() => handleSerialSend(serialInput)}>
              ↵ Send
            </button>
            <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }}
              onClick={() => setSerialLog([])}>
              Clear
            </button>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-faint)' }}>
            D-01 / D-02: what you type is injected via HID on the target · D-03: exfiltrated data appears here
          </div>
        </div>
      )}

      {/* ── Flash storage ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 14 }}>
          Flash memory — 512 KB
        </h3>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
            <span style={{ color: 'var(--text-dim)' }}>Payload slots</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: slotsPct > 87 ? 'var(--accent)' : 'var(--text)' }}>
              {mappings.length} / {MAX_SLOTS}
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${slotsPct}%`, borderRadius: 3, transition: 'width .3s',
              background: slotsPct > 87 ? 'var(--accent)' : slotsPct > 62 ? 'var(--yellow)' : 'var(--green)',
            }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { color: '#4895ef', label: 'Firmware code', val: `~${CODE_KB} KB` },
            { color: 'var(--yellow)', label: 'Config & payloads', val: `~${CONFIG_KB} KB` },
            { color: 'var(--green)', label: 'Free space', val: `~${freeKB} KB` },
          ].map(({ color, label, val }) => (
            <div key={label} style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '8px 12px',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Flash all ─────────────────────────────────────────────────────── */}
      {mappings.length > 0 && (
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 14 }}
          onClick={onFlashAll}>
          ⚡ Flash the stick — {mappings.length} payload{mappings.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
