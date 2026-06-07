import React from 'react'
import { FIRMWARE_META } from '../data/modes'

const BUTTON_NAMES = ['Trigger','Button A','Button B','Button C','Hat ↑','Hat ↓','Hat ←','Hat →','Button ①','Button ②','Button ③','Button ④','L3','R3','Start','Select']

function interpolate(text, config) {
  if (!text || !config) return text
  return text
    .replace(/\{\{triggerButton\}\}/g, BUTTON_NAMES[config.triggerButton ?? 0] ?? 'Trigger')
    .replace(/\{\{webhookUrl\}\}/g,   config.webhookUrl  || '(not set)')
    .replace(/\{\{driveLabel\}\}/g,   config.driveLabel  || 'FORGE')
    .replace(/\{\{lhost\}\}/g,        config.lhost       || 'LHOST')
    .replace(/\{\{lport\}\}/g,        config.lport       || 'LPORT')
    .replace(/\{\{aesKey\}\}/g,       config.aesKey      || '(not set)')
    .replace(/\{\{speed\}\}/g,        config.speed ? `${config.speed}ms` : '60ms')
}

export default function CheatSheet({ mode, config, result, onReset }) {
  const raw = mode?.cheatSheet || {}
  const cfg = config || {}
  const cs  = {
    trigger:  raw.trigger  ? interpolate(raw.trigger, cfg)              : undefined,
    controls: raw.controls?.map(c => interpolate(c, cfg)),
    leds:     raw.leds?.map(l => interpolate(l, cfg)),
    notes:    raw.notes?.map(n => interpolate(n, cfg)),
  }
  const fw = FIRMWARE_META[mode?.firmware] || {}

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'24px', maxWidth:740 }}>

      {/* Success banner */}
      <div style={{
        background:'#0d2d14', border:'1px solid var(--green)', borderRadius:'var(--radius-lg)',
        padding:'14px 20px', marginBottom:24, display:'flex', alignItems:'center', gap:12,
      }}>
        <div className="dot dot-green" style={{ width:12, height:12 }} />
        <div>
          <div style={{ fontWeight:700, color:'var(--green)' }}>Flash successful</div>
          <div style={{ fontSize:12, color:'#5a9a6a', marginTop:2 }}>
            {mode?.id} — {mode?.name} is now active on the stick
          </div>
        </div>
        <button className="btn btn-ghost" style={{ marginLeft:'auto', fontSize:12 }} onClick={onReset}>
          ← New payload
        </button>
      </div>

      <h2 style={{ marginBottom:16 }}>
        Usage sheet — <span style={{ color: fw.color }}>{mode?.name}</span>
      </h2>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>

        {/* Trigger */}
        {cs.trigger && (
          <Card title="Trigger" icon="⚡" accent="var(--accent)">
            <p style={{ fontSize:13, color:'var(--text)', marginTop:6 }}>{cs.trigger}</p>
          </Card>
        )}

        {/* Controls */}
        {cs.controls?.length > 0 && (
          <Card title="Controls" icon="🕹" accent="var(--blue)">
            <ul style={{ paddingLeft:16, marginTop:6, display:'flex', flexDirection:'column', gap:5 }}>
              {cs.controls.map((c, i) => (
                <li key={i} style={{ fontSize:12, color:'var(--text-dim)', lineHeight:1.4 }}>{c}</li>
              ))}
            </ul>
          </Card>
        )}

        {/* LEDs */}
        {cs.leds?.length > 0 && (
          <Card title="LED status" icon="💡" accent="var(--yellow)">
            <ul style={{ paddingLeft:0, marginTop:6, display:'flex', flexDirection:'column', gap:5, listStyle:'none' }}>
              {cs.leds.map((l, i) => {
                const color = l.startsWith('Red') ? 'var(--accent)' : l.startsWith('Green') ? 'var(--green)' : l.startsWith('Yellow') ? 'var(--yellow)' : l.startsWith('Blue') ? 'var(--blue)' : 'var(--text-faint)'
                return (
                  <li key={i} style={{ fontSize:12, color:'var(--text-dim)', display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
                    {l}
                  </li>
                )
              })}
            </ul>
          </Card>
        )}

        {/* Notes */}
        {cs.notes?.length > 0 && (
          <Card title="Notes" icon="📋" accent="var(--text-dim)">
            <ul style={{ paddingLeft:16, marginTop:6, display:'flex', flexDirection:'column', gap:5 }}>
              {cs.notes.map((n, i) => (
                <li key={i} style={{ fontSize:12, color:'var(--text-dim)', lineHeight:1.5 }}>
                  {n.startsWith('hashcat') || n.startsWith('nc ') || n.startsWith('certutil') ? (
                    <code style={{ background:'var(--surface2)', padding:'2px 6px', borderRadius:3, display:'block', marginTop:2 }}>{n}</code>
                  ) : n}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Restore reminder */}
      <div style={{
        marginTop:24, background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:'var(--radius)', padding:'12px 16px',
        display:'flex', alignItems:'center', gap:12,
      }}>
        <span style={{ fontSize:18 }}>⚠️</span>
        <div style={{ fontSize:12, color:'var(--text-dim)' }}>
          To restore the original firmware, use the <strong style={{ color:'var(--text)' }}>Restore</strong> button at the bottom of the window.
          The original file is preserved and never overwritten.
        </div>
      </div>
    </div>
  )
}

function Card({ title, icon, accent, children }) {
  return (
    <div style={{
      background:'var(--surface)', border:'1px solid var(--border)',
      borderRadius:'var(--radius-lg)', padding:'14px 16px',
      borderTop: `2px solid ${accent}`,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
        <span style={{ fontSize:15 }}>{icon}</span>
        <h3 style={{ color:'var(--text-dim)', fontSize:10, letterSpacing:'0.8px', textTransform:'uppercase' }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}
