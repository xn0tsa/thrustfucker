import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { generatePayload } from '../data/payloads'
import TriggerMapper  from './TriggerMapper'
import PayloadLibrary from './PayloadLibrary'

const TRIGGER_FIELD = {
  key:     'triggerButton',
  type:    'trigger',
  label:   'Trigger button',
  default: 0,
}

const KEYBOARD_LAYOUT_FIELD = {
  key:     'keyboardLayout',
  type:    'select',
  label:   'Keyboard layout',
  options: ['QWERTY (US)', 'AZERTY (FR)'],
  default: 'QWERTY (US)',
}

const DUCK_KW = new Set(['DELAY','STRING','ENTER','GUI','CTRL','ALT','SHIFT','TAB','DELETE','BACKSPACE',
  'UP','DOWN','LEFT','RIGHT','HOME','END','PAGEUP','PAGEDOWN','PRINTSCREEN','PAUSE','ESCAPE','MENU','APP',
  'CAPSLOCK','NUMLOCK','SCROLLLOCK','F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
  'REPEAT','SPACE','INSERT','WINDOWS'])

function DuckyHighlight({ code }) {
  if (!code) return null
  return (
    <pre className="terminal" style={{ overflowY:'auto', maxHeight:240, userSelect:'text' }}>
      {code.split('\n').map((line, i) => {
        const space  = line.indexOf(' ')
        const kw     = space === -1 ? line : line.slice(0, space)
        const rest   = space === -1 ? '' : line.slice(space)
        if (line.startsWith('REM') || line.startsWith('//'))
          return <div key={i} style={{ color:'#555' }}>{line}</div>
        if (DUCK_KW.has(kw.toUpperCase()))
          return <div key={i}><span style={{ color:'#4895ef' }}>{kw}</span><span style={{ color:'#ccc' }}>{rest}</span></div>
        return <div key={i} style={{ color:'#888' }}>{line || ' '}</div>
      })}
    </pre>
  )
}

function parseTiming(duck) {
  let ms = 0
  for (const line of (duck || '').split('\n')) {
    const m = line.match(/^DELAY\s+(\d+)/i)
    if (m) ms += parseInt(m[1], 10)
  }
  return ms
}

function fmtMs(ms) {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function SizeBar({ bytes }) {
  const MAX   = 4096
  const pct   = Math.min(bytes / MAX * 100, 100)
  const color = pct > 90 ? 'var(--accent)' : pct > 70 ? 'var(--yellow)' : 'var(--green)'
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5, fontSize:11 }}>
        <span style={{ color:'var(--text-dim)' }}>Payload size</span>
        <span style={{ fontFamily:'var(--font-mono)', color }}>{bytes} / {MAX} bytes</span>
      </div>
      <div style={{ height:4, background:'var(--surface2)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2, transition:'width .2s' }} />
      </div>
    </div>
  )
}

function validateDucky(script) {
  const errors = []
  if (!script) return errors
  script.split('\n').forEach((line, i) => {
    const t = line.trim()
    if (!t || /^REM\b/i.test(t)) return
    const kw = t.split(/\s+/)[0].toUpperCase()
    if (kw === 'DELAY'  && !/^DELAY\s+\d+/.test(t))  errors.push(`Line ${i+1}: DELAY without a number`)
    if (kw === 'STRING' && !/^STRING\s+.+/.test(t))   errors.push(`Line ${i+1}: STRING without text`)
    if (kw === 'REPEAT' && !/^REPEAT\s+\d+/.test(t))  errors.push(`Line ${i+1}: REPEAT without a number`)
    if (kw !== 'STRING' && /[^\x00-\x7F]/.test(t))    errors.push(`Line ${i+1}: non-ASCII characters outside STRING`)
  })
  return errors
}

export default function Configurator({ mode, onBack, onNext, initialConfig, buttonLabel }) {
  const [cfg,             setCfg]             = useState({})
  const [preview,         setPreview]         = useState(null)
  const [tab,             setTab]             = useState('ducky')
  const [library,         setLibrary]         = useState(null)
  const [duckyValidation, setDuckyValidation] = useState(null)
  const [savePrompt,      setSavePrompt]      = useState(null)

  // triggerButton and keyboardLayout are now global — handled at mapping/dashboard level
  const fields = useMemo(() => {
    return mode.configFields.filter(f => f.key !== 'triggerButton' && f.key !== 'keyboardLayout')
  }, [mode])

  useEffect(() => {
    const defaults = {}
    fields.forEach(f => {
      defaults[f.key] = f.default ?? (f.type === 'toggle' ? false : f.type === 'range' ? f.min : '')
    })
    setCfg(initialConfig ? { ...defaults, ...initialConfig } : defaults)
    setPreview(null)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((key, val) => setCfg(prev => ({ ...prev, [key]: val })), [])

  const handlePreview = () => {
    const p = generatePayload(mode.id, cfg)
    setPreview(p)
    setTab('ducky')
  }

  const handleValidate = (fieldKey) => {
    const errors = validateDucky(cfg[fieldKey] || '')
    setDuckyValidation({ fieldKey, errors, saved: false })
    setTimeout(() => setDuckyValidation(v => v?.fieldKey === fieldKey ? null : v), 6000)
  }

  const handleSaveToLibrary = async (fieldKey) => {
    if (!savePrompt?.name?.trim()) return
    const entry = {
      id:                 `pl_user_${Date.now()}`,
      name:               savePrompt.name.trim(),
      script:             cfg[fieldKey] || '',
      tags:               [mode.firmware, mode.category?.toLowerCase()].filter(Boolean),
      compatibleFirmwares: [mode.firmware],
      author:             'user',
      createdAt:          new Date().toISOString(),
      description:        mode.name,
    }
    if (window.forge) {
      const existing = await window.forge.library.load().catch(() => [])
      await window.forge.library.save([...existing, entry]).catch(() => {})
    }
    setSavePrompt(null)
    setDuckyValidation({ fieldKey, errors: [], saved: true })
    setTimeout(() => setDuckyValidation(null), 2500)
  }

  // Live byte count from any ducky-type field
  const duckyBytes = useMemo(() => {
    const df = fields.find(f => f.type === 'ducky')
    if (!df) return 0
    return new TextEncoder().encode(cfg[df.key] || '').length
  }, [fields, cfg])

  const hasDucky  = !!preview?.ducky
  const hasPs     = !!preview?.psScript
  const timingMs  = hasDucky ? parseTiming(preview.ducky) : 0
  const byteCount = hasDucky ? new TextEncoder().encode(preview.ducky).length : 0

  const TABS = [
    { key:'ducky',   label:'DuckyScript', show: true },
    { key:'ps',      label:'PowerShell',  show: hasPs },
    { key:'timing',  label:'Timing',      show: hasDucky },
    { key:'size',    label:'Size',        show: hasDucky },
  ].filter(t => t.show)

  return (
    <div style={{ flex:1, overflow:'hidden', display:'flex' }}>

      {/* Left panel */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', borderRight:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
          <h2 style={{ margin:0 }}>Configuration — {mode.name}</h2>
          {buttonLabel && (
            <span style={{ fontSize:12, padding:'2px 10px', background:'var(--surface2)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', fontFamily:'var(--font-mono)', color:'var(--text-dim)' }}>
              {buttonLabel}
            </span>
          )}
        </div>
        <p style={{ color:'var(--text-dim)', fontSize:12, marginBottom:20 }}>{mode.description}</p>

        {fields.length === 0 && (
          <div style={{ color:'var(--text-dim)', fontStyle:'italic', padding:'20px 0' }}>
            No configuration needed for this mode.
          </div>
        )}

        {fields.map(field => (
          <div key={field.key} style={{ marginBottom:18 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
              <label style={{ margin:0 }}>{field.label}</label>
              {field.type === 'ducky' && (
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color: duckyBytes > 3686 ? 'var(--accent)' : 'var(--text-faint)' }}>
                    {duckyBytes}/4096 B
                  </span>
                  <button className="btn btn-ghost" style={{ padding:'2px 7px', fontSize:10 }} type="button"
                    onClick={() => handleValidate(field.key)}>✓ Test</button>
                  <button className="btn btn-ghost" style={{ padding:'2px 7px', fontSize:10 }} type="button"
                    onClick={() => setSavePrompt({ fieldKey: field.key, name: '' })}
                    title="Save to library">💾</button>
                  <button className="btn btn-ghost" style={{ padding:'2px 9px', fontSize:10, gap:4 }} type="button"
                    onClick={() => setLibrary({ fieldKey: field.key })}>
                    📚 Library
                  </button>
                </div>
              )}
            </div>
            <FieldInput field={field} value={cfg[field.key]} onChange={val => set(field.key, val)} />

            {/* Validation result */}
            {duckyValidation?.fieldKey === field.key && (
              <div style={{ marginTop:6 }}>
                {duckyValidation.saved ? (
                  <span style={{ fontSize:11, color:'var(--green)' }}>✓ Saved to library</span>
                ) : duckyValidation.errors.length === 0 ? (
                  <span style={{ fontSize:11, color:'var(--green)' }}>
                    ✓ Valid syntax — {(cfg[field.key] || '').split('\n').filter(Boolean).length} lines
                  </span>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                    {duckyValidation.errors.map((e, i) => (
                      <div key={i} style={{ fontSize:11, color:'var(--accent)' }}>⚠ {e}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save form */}
            {savePrompt?.fieldKey === field.key && (
              <div style={{ marginTop:8, display:'flex', gap:6 }}>
                <input type="text" value={savePrompt.name}
                  onChange={e => setSavePrompt(p => ({...p, name: e.target.value}))}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  handleSaveToLibrary(field.key)
                    if (e.key === 'Escape') setSavePrompt(null)
                  }}
                  placeholder="Template name…"
                  style={{ flex:1, fontSize:12 }}
                  autoFocus />
                <button className="btn btn-primary" style={{ padding:'4px 10px', fontSize:11 }}
                  onClick={() => handleSaveToLibrary(field.key)}>✓</button>
                <button className="btn btn-ghost" style={{ padding:'4px 8px', fontSize:11 }}
                  onClick={() => setSavePrompt(null)}>✕</button>
              </div>
            )}
          </div>
        ))}

        <div style={{ display:'flex', gap:10, marginTop:28, paddingTop:16, borderTop:'1px solid var(--border)' }}>
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <button className="btn btn-ghost" onClick={handlePreview}>Payload preview</button>
          <button className="btn btn-primary" style={{ marginLeft:'auto' }} onClick={() => onNext(cfg)}>
            Continue → Flash
          </button>
        </div>
      </div>

      {/* Right panel: enriched preview */}
      <div style={{ width:360, overflowY:'auto', padding:'20px', flexShrink:0 }}>
        <h3 style={{ marginBottom:12 }}>Payload preview</h3>

        {!preview && (
          <div style={{ color:'var(--text-faint)', fontSize:12, textAlign:'center', paddingTop:40 }}>
            Click "Payload preview"<br/>to visualize the generated script
          </div>
        )}

        {preview && (
          <>
            {/* Tab bar */}
            <div style={{ display:'flex', gap:2, marginBottom:12, borderBottom:'1px solid var(--border)', paddingBottom:8 }}>
              {TABS.map(t => (
                <button key={t.key}
                  onClick={() => setTab(t.key)}
                  className="btn"
                  style={{
                    padding:'3px 10px', fontSize:11,
                    background: tab === t.key ? 'var(--surface2)' : 'transparent',
                    color:       tab === t.key ? 'var(--text)' : 'var(--text-dim)',
                    border:      tab === t.key ? '1px solid var(--border2)' : '1px solid transparent',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'ducky' && <DuckyHighlight code={preview.ducky} />}

            {tab === 'ps' && (
              <pre className="terminal" style={{ maxHeight:300, fontSize:10, userSelect:'text' }}>
                {preview.psScript}
              </pre>
            )}

            {tab === 'timing' && (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ background:'var(--surface2)', borderRadius:'var(--radius)', padding:'12px 16px' }}>
                  <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' }}>Total DELAY time</div>
                  <div style={{ fontSize:22, fontFamily:'var(--font-mono)', color:'var(--accent)', fontWeight:700 }}>
                    {fmtMs(timingMs)}
                  </div>
                </div>
                <div style={{ fontSize:11, color:'var(--text-faint)' }}>
                  {preview.ducky.split('\n').filter(l => /^DELAY/i.test(l)).length} DELAY instructions total
                </div>
                <pre className="terminal" style={{ maxHeight:180, fontSize:10 }}>
                  {preview.ducky.split('\n').filter(l => /^DELAY/i.test(l) || /^STRING/i.test(l)).join('\n')}
                </pre>
              </div>
            )}

            {tab === 'size' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <SizeBar bytes={byteCount} />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'Lines', val: preview.ducky.split('\n').filter(Boolean).length },
                    { label:'Instructions', val: preview.ducky.split('\n').filter(l => l.trim() && !l.startsWith('REM')).length },
                    { label:'DELAY count', val: preview.ducky.split('\n').filter(l => /^DELAY/i.test(l)).length },
                    { label:'STRING count', val: preview.ducky.split('\n').filter(l => /^STRING/i.test(l)).length },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background:'var(--surface2)', borderRadius:'var(--radius)', padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:3 }}>{label}</div>
                      <div style={{ fontSize:18, fontFamily:'var(--font-mono)', fontWeight:700 }}>{val}</div>
                    </div>
                  ))}
                </div>
                {byteCount > 3686 && (
                  <div style={{ fontSize:11, color:'var(--accent)', background:'#1a0808', border:'1px solid var(--accent-dim)', borderRadius:'var(--radius)', padding:'8px 12px' }}>
                    ⚠ Payload close to the 4096 byte limit ({4096 - byteCount} remaining)
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {library && (
        <PayloadLibrary
          onInsert={script => set(library.fieldKey, script)}
          onClose={() => setLibrary(null)}
        />
      )}
    </div>
  )
}

function FieldInput({ field, value, onChange }) {
  switch (field.type) {

    case 'trigger':
      return <TriggerMapper value={value} onChange={onChange} />

    case 'text':
    case 'url':
      return (
        <input type={field.type} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ''} />
      )

    case 'textarea':
      return (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={5} />
      )

    case 'ducky':
      return (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)}
          rows={8} style={{ fontFamily:'var(--font-mono)', fontSize:12 }} />
      )

    case 'range':
      return (
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <input type="range" min={field.min} max={field.max} value={value ?? field.default ?? field.min}
            onChange={e => onChange(Number(e.target.value))} style={{ flex:1 }} />
          <span style={{ minWidth:36, textAlign:'right', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent)' }}>
            {value ?? field.default}
          </span>
        </div>
      )

    case 'select':
      return (
        <select value={value || field.default || ''} onChange={e => onChange(e.target.value)}>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )

    case 'toggle':
      return (
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4 }}>
          <div onClick={() => onChange(!value)}
            style={{
              width:36, height:20, borderRadius:10, cursor:'pointer',
              background: value ? 'var(--accent)' : 'var(--surface2)',
              border: '1px solid ' + (value ? 'var(--accent)' : 'var(--border2)'),
              position:'relative', transition:'background .2s',
            }}>
            <div style={{
              width:14, height:14, borderRadius:'50%', background:'#fff',
              position:'absolute', top:2, left: value ? 18 : 2, transition:'left .2s',
            }} />
          </div>
          <span style={{ fontSize:12, color:'var(--text-dim)' }}>{value ? 'Enabled' : 'Disabled'}</span>
        </div>
      )

    default:
      return <input type="text" value={value || ''} onChange={e => onChange(e.target.value)} />
  }
}
