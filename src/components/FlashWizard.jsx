import React, { useState, useEffect, useRef } from 'react'
import { generatePayload } from '../data/payloads'

const STATES = { idle:'idle', detecting:'detecting', ready:'ready', building:'building', flashing:'flashing', done:'done', error:'error' }

function getErrorHelp(log) {
  if (!log) return null
  if (/no device|not found|DFU.*detect/i.test(log))
    return { icon:'🔌', msg:'Device not found — redo the DFU procedure (rear switch + Xbox button + plug in).' }
  if (/winusb|driver|usb device/i.test(log))
    return { icon:'🪛', msg:'Incorrect USB driver — install WinUSB via Zadig (Device → STM32 BOOTLOADER → Install Driver).' }
  if (/access.denied|permission/i.test(log))
    return { icon:'🔐', msg:'Access denied — restart the application as administrator.' }
  if (/address|0x08/i.test(log))
    return { icon:'📍', msg:'Flash address error — check the version of STM32CubeProgrammer (≥ 2.10).' }
  return null
}

// mappings : [{ id, buttonIndex, mode, config }]
// firmwareClass : 'A' | 'B' | ...
// globalConfig  : { keystrokeDelayMs, keyboardLayout, ... }
export default function FlashWizard({ mappings, firmwareClass, globalConfig, onBack, onDone }) {
  // Resolve display name from first mapping for legacy sections
  const mode   = mappings?.[0]?.mode   ?? { id: '?-01', name: 'Payload' }
  const config = mappings?.[0]?.config ?? {}
  const [state,    setState]    = useState(STATES.idle)
  const [log,      setLog]      = useState([])
  const [dfuFound, setDfuFound] = useState(false)
  const [progress, setProgress] = useState(0)
  const logRef      = useRef()
  const progressRef = useRef(null)
  const isElectron  = !!window.forge

  const addLog = (msg, type = '') => setLog(prev => [...prev, { msg, type, t: Date.now() }])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  useEffect(() => () => {
    clearInterval(progressRef.current)
    if (window.forge?.flash) window.forge.flash.offProgress()
  }, [])

  const startProgress = () => {
    setProgress(0)
    let p = 0
    progressRef.current = setInterval(() => {
      p += Math.random() * 12
      if (p > 88) p = 88
      setProgress(Math.round(p))
    }, 350)
  }

  const stopProgress = (ok) => {
    clearInterval(progressRef.current)
    setProgress(ok ? 100 : 0)
  }

  const handleDetect = async () => {
    setState(STATES.detecting)
    addLog('Searching for STM32 device in DFU mode (0483:DF11)…')
    if (!isElectron) {
      setTimeout(() => { setDfuFound(true); setState(STATES.ready); addLog('[DEMO] Device found (simulation)', 'ok') }, 1500)
      return
    }
    const r = await window.forge.dfu.detect()
    if (r.found) {
      setDfuFound(true); setState(STATES.ready)
      addLog('DFU device detected!', 'ok')
      addLog(r.raw || 'STM32 USB DFU', 'dim')
    } else {
      setState(STATES.error)
      addLog('Device not found. ' + (r.error || ''), 'err')
      addLog('Check that the stick is in DFU mode (rear switch toward PC + hold Xbox while plugging in)', 'err')
    }
  }

  const handleFlash = async () => {
    setState(STATES.building)
    addLog('Generating payloads…')

    // Generate DuckyScript for each slot + pass modeConfig for extra_json (C/E/F)
    const slots = (mappings || []).map(m => {
      const { ducky } = generatePayload(m.mode.id, m.config)
      addLog(`Slot ${m.buttonIndex} (${m.mode.name}) : ${ducky ? ducky.split('\n').length : 0} lines`, 'ok')
      return { buttonIndex: m.buttonIndex, ducky, modeConfig: m.config }
    })

    if (!isElectron) {
      startProgress()
      setTimeout(() => {
        addLog('Writing firmware… (simulation)', 'ok')
        setTimeout(() => {
          stopProgress(true); setState(STATES.done)
          addLog('Firmware flashed successfully!', 'ok')
          onDone({ ok:true })
        }, 2000)
      }, 1000)
      return
    }

    addLog('Building multi-slot firmware…')
    const modeId    = mappings?.[0]?.mode.id ?? (firmwareClass + '-01')
    const fwClass   = mappings?.[0]?.mode.firmware ?? firmwareClass
    const buildRes  = await window.forge.firmware.build({ modeId, globalConfig: globalConfig || {}, slots, firmwareClass: fwClass })
    if (!buildRes.ok) {
      setState(STATES.error)
      addLog('Build error: ' + buildRes.error, 'err')
      return
    }
    addLog('Firmware built: ' + buildRes.binPath, 'ok')

    setState(STATES.flashing)
    setProgress(2)
    window.forge.flash.onProgress(pct => setProgress(pct))
    addLog('Flashing (DFU)…')
    const flashRes = await window.forge.dfu.flash({ firmwarePath: buildRes.binPath })
    window.forge.flash.offProgress()
    setProgress(flashRes.ok ? 100 : 0)
    if (flashRes.ok) {
      setState(STATES.done)
      addLog('Flash successful!', 'ok')
      addLog(`The stick is restarting with ${(mappings?.length ?? 0)} payload(s) configured`, 'dim')
      onDone({ ok: true, log: flashRes.log })
    } else {
      setState(STATES.error)
      addLog('Flash error!', 'err')
      if (flashRes.log) addLog(flashRes.log, 'err')
    }
  }

  const handleRetry = () => {
    setState(STATES.ready)
    setProgress(0)
    addLog('↩ Retrying…', 'dim')
  }

  const statusDot = {
    [STATES.idle]:      'dot-grey',
    [STATES.detecting]: 'dot-yellow',
    [STATES.ready]:     'dot-green',
    [STATES.building]:  'dot-yellow',
    [STATES.flashing]:  'dot-yellow',
    [STATES.done]:      'dot-green',
    [STATES.error]:     'dot-red',
  }[state]

  const isFlashing = [STATES.building, STATES.flashing].includes(state)
  const errorLog   = log.filter(l => l.type === 'err').map(l => l.msg).join(' ')
  const errorHelp  = state === STATES.error ? getErrorHelp(errorLog) : null

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'24px', maxWidth:680 }}>

      <h2 style={{ marginBottom:4 }}>Firmware flash</h2>
      <p style={{ color:'var(--text-dim)', fontSize:12, marginBottom:24 }}>
        {(mappings?.length ?? 0)} payload{(mappings?.length ?? 0) > 1 ? 's' : ''} to flash — firmware class <strong style={{ color:'var(--text)' }}>{firmwareClass}</strong>
      </p>

      {/* Step 1: DFU */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px 20px', marginBottom:16 }}>
        <h3 style={{ marginBottom:12 }}>Step 1 — Switch the stick to DFU mode</h3>
        <ol style={{ paddingLeft:20, display:'flex', flexDirection:'column', gap:8 }}>
          {[
            'Unplug the stick if it is connected',
            'Set the rear switch to the PC position (upward)',
            'Hold the Xbox button (center of the stick)',
            'Plug in the USB cable while holding Xbox',
            'Wait ~3 seconds then release',
          ].map((s, i) => (
            <li key={i} style={{ fontSize:13, color:'var(--text-dim)', lineHeight:1.5 }}>
              <span style={{ color:'var(--accent)', fontWeight:700, marginRight:6 }}>{i+1}.</span>{s}
            </li>
          ))}
        </ol>
        <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:10 }}>
          <div className={`dot ${statusDot}`} />
          <span style={{ fontSize:12, color:'var(--text-dim)' }}>
            {{
              [STATES.idle]:      'Waiting for detection',
              [STATES.detecting]: 'Searching…',
              [STATES.ready]:     'DFU device detected — ready',
              [STATES.building]:  'Building firmware…',
              [STATES.flashing]:  'Flashing…',
              [STATES.done]:      'Flash successful',
              [STATES.error]:     'Error — see the log',
            }[state]}
          </span>
          <button className="btn btn-ghost"
            style={{ marginLeft:'auto', padding:'5px 14px', fontSize:12 }}
            disabled={[STATES.detecting, STATES.building, STATES.flashing, STATES.done].includes(state)}
            onClick={handleDetect}>
            Detect device
          </button>
        </div>
      </div>

      {/* Step 2: Flash */}
      <div style={{
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:'var(--radius-lg)', padding:'16px 20px', marginBottom:16,
        opacity: dfuFound ? 1 : 0.5,
      }}>
        <h3 style={{ marginBottom:8 }}>Step 2 — Write firmware</h3>
        <p style={{ fontSize:12, color:'var(--text-dim)', marginBottom:14, lineHeight:1.5 }}>
          The firmware will be built with your configuration then flashed to <code>0x08000000</code>.<br/>
          The operation takes ~5 seconds. <strong>Do not unplug.</strong>
        </p>

        {/* Progress bar */}
        {(isFlashing || (progress === 100 && state === STATES.done)) && (
          <div style={{ marginBottom:14 }}>
            <div style={{ height:4, background:'var(--surface2)', borderRadius:2, overflow:'hidden' }}>
              <div style={{
                height:'100%', borderRadius:2,
                background: state === STATES.done ? 'var(--green)' : 'var(--accent)',
                width:`${progress}%`,
                transition:'width .35s ease',
              }} />
            </div>
            <div style={{ fontSize:10, color:'var(--text-faint)', marginTop:4, textAlign:'right' }}>{progress}%</div>
          </div>
        )}

        <button className="btn btn-primary"
          disabled={!dfuFound || [STATES.building, STATES.flashing, STATES.done, STATES.detecting].includes(state)}
          onClick={handleFlash}
          style={{ width:'100%', justifyContent:'center', padding:'10px' }}>
          {state === STATES.building ? '⏳ Building…' :
           state === STATES.flashing ? '⚡ Flashing…' :
           state === STATES.done     ? '✓ Done' :
           '⚡ Write firmware'}
        </button>
      </div>

      {/* Contextual error help */}
      {state === STATES.error && errorHelp && (
        <div style={{
          background:'#1a0a0a', border:'1px solid var(--accent-dim)',
          borderRadius:'var(--radius)', padding:'12px 16px',
          display:'flex', gap:12, alignItems:'flex-start', marginBottom:12,
        }}>
          <span style={{ fontSize:20, flexShrink:0 }}>{errorHelp.icon}</span>
          <div style={{ fontSize:12, color:'var(--text-dim)', lineHeight:1.5 }}>{errorHelp.msg}</div>
        </div>
      )}

      {/* Terminal log */}
      {log.length > 0 && (
        <div>
          <h3 style={{ marginBottom:8 }}>Log</h3>
          <div ref={logRef} className="terminal" style={{ maxHeight:180 }}>
            {log.map((l, i) => (
              <div key={i} className={l.type}>{l.msg}</div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop:20, display:'flex', gap:10 }}>
        <button className="btn btn-ghost" onClick={onBack} disabled={isFlashing}>
          ← Back
        </button>
        {state === STATES.error && (
          <button className="btn btn-ghost" onClick={handleRetry}
            style={{ color:'var(--yellow)', borderColor:'var(--yellow)' }}>
            ↩ Retry
          </button>
        )}
      </div>
    </div>
  )
}
