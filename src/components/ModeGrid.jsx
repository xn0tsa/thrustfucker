import React, { useState } from 'react'
import { MODES, FIRMWARE_META } from '../data/modes'

const RISK_LABEL  = { low:'LOW', medium:'MEDIUM', high:'HIGH', critical:'CRITICAL' }
const OS_ICON     = { windows:'⊞', linux:'🐧', macos:'' }
const CATEGORIES  = ['All', 'Injection', 'Exfiltration', 'Reconnaissance', 'Persistence',
                     'Evasion', 'Network', 'Social Engineering', 'C2', 'Fuzzing', 'Covert Channel', 'Utility']

export default function ModeGrid({ onSelect, lastFlashed }) {
  const [fw,  setFw]  = useState('all')
  const [cat, setCat] = useState('All')
  const [q,   setQ]   = useState('')

  const filtered = MODES.filter(m => {
    if (fw  !== 'all'  && m.firmware !== fw)  return false
    if (cat !== 'All' && m.category !== cat) return false
    if (q && !m.name.toLowerCase().includes(q.toLowerCase()) &&
             !m.description.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Header filters */}
      <div style={{ padding:'14px 20px 0', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <h1 style={{ fontSize:18 }}>Choose a payload</h1>
          <span style={{ color:'var(--text-faint)', fontSize:12 }}>{filtered.length} available</span>
          <div style={{ marginLeft:'auto', position:'relative' }}>
            <input type="text" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)}
              style={{ width:200, paddingLeft:28 }} />
            <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-faint)', fontSize:13 }}>⌕</span>
          </div>
        </div>

        {/* Firmware tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:10 }}>
          {[['all','All firmware'], ...Object.entries(FIRMWARE_META).map(([k,v]) => [k, v.label.split(' ')[0]])].map(([key, label]) => (
            <button key={key} className="btn"
              style={{
                padding:'4px 12px', fontSize:11,
                background: fw === key ? (key === 'all' ? 'var(--surface2)' : `${FIRMWARE_META[key]?.color}22`) : 'transparent',
                color:       fw === key ? (key === 'all' ? 'var(--text)' : FIRMWARE_META[key]?.color) : 'var(--text-faint)',
                border:      fw === key ? `1px solid ${key === 'all' ? 'var(--border2)' : FIRMWARE_META[key]?.color}` : '1px solid transparent',
              }}
              onClick={() => setFw(key)}>
              {key !== 'all' && <span className={`fw-badge fw-${key}`} style={{ marginRight:4 }}>{key}</span>}
              {label}
            </button>
          ))}
        </div>

        {/* Category pills */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
          {CATEGORIES.map(c => (
            <button key={c} className="btn"
              style={{
                padding:'2px 9px', fontSize:11,
                background: cat === c ? 'var(--accent)' : 'var(--surface2)',
                color:       cat === c ? '#fff' : 'var(--text-dim)',
                border:      '1px solid ' + (cat === c ? 'var(--accent)' : 'var(--border)'),
              }}
              onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{
        flex:1, overflowY:'auto', padding:'4px 20px 80px',
        display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:10, alignContent:'start',
      }}>
        {filtered.map(mode => <ModeCard key={mode.id} mode={mode} onSelect={onSelect} isActive={lastFlashed?.id === mode.id} />)}
        {filtered.length === 0 && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', color:'var(--text-faint)', padding:48 }}>
            No payload found
          </div>
        )}
      </div>
    </div>
  )
}

function ModeCard({ mode, onSelect, isActive }) {
  const [hov, setHov] = useState(false)
  const fw = FIRMWARE_META[mode.firmware]

  return (
    <div
      onClick={() => onSelect(mode)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'var(--surface2)' : 'var(--surface)',
        border: `1px solid ${isActive ? 'var(--green)' : hov ? 'var(--border2)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all .15s',
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
      {/* Top row */}
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span className={`fw-badge fw-${mode.firmware}`}>{mode.firmware}</span>
        <span style={{ color:'var(--text-faint)', fontSize:11, fontFamily:'var(--font-mono)' }}>{mode.id}</span>
        {isActive && (
          <span style={{
            padding:'1px 6px', borderRadius:3, fontSize:9, fontWeight:700, letterSpacing:'0.5px',
            textTransform:'uppercase', background:'#0d2d14', color:'var(--green)', border:'1px solid var(--green)',
          }}>ACTIVE</span>
        )}
        <span className={`risk risk-${mode.risk}`} style={{ marginLeft:'auto' }}>{RISK_LABEL[mode.risk]}</span>
      </div>

      {/* Name */}
      <div style={{ fontWeight:700, fontSize:14, color: hov ? '#fff' : 'var(--text)' }}>
        {mode.name}
      </div>

      {/* Description */}
      <div style={{ fontSize:12, color:'var(--text-dim)', lineHeight:1.5, flexGrow:1 }}>
        {mode.description}
      </div>

      {/* Footer */}
      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap', marginTop:4 }}>
        {mode.os.map(o => (
          <span key={o} className="os-tag" style={{ fontSize:10 }}>
            {OS_ICON[o] || ''} {o}
          </span>
        ))}
        {mode.exfil.includes('device') && <span className="os-tag" style={{ fontSize:10, color:'var(--blue)', borderColor:'var(--blue)' }}>📁 on stick</span>}
        {mode.exfil.includes('webhook') && <span className="os-tag" style={{ fontSize:10, color:'var(--yellow)', borderColor:'var(--yellow)' }}>⚡ webhook</span>}
        {mode.exfil.includes('dual-usb') && <span className="os-tag" style={{ fontSize:10, color:fw.color, borderColor:fw.color }}>↔ C2 live</span>}
        {mode.exfil.includes('audio') && <span className="os-tag" style={{ fontSize:10, color:'#ff6b9d', borderColor:'#ff6b9d' }}>♪ audio</span>}
        <span style={{ marginLeft:'auto', color:'var(--text-faint)', fontSize:11 }}>{mode.category}</span>
      </div>

      {/* Hover arrow */}
      {hov && (
        <div style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:'var(--accent)', fontSize:16 }}>→</div>
      )}
    </div>
  )
}
