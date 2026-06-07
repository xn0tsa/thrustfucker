import React from 'react'

export default function TitleBar({ onSettings }) {
  const isElectron = !!window.forge
  return (
    <div style={{
      height: 42,
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      flexShrink: 0,
      WebkitAppRegion: 'drag',
    }}>
      {/* Logo + title */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--accent)"/>
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight:700, fontSize:13, letterSpacing:'0.5px', color:'var(--text)' }}>
          THRUST<span style={{ color:'var(--accent)' }}>FUCKER</span>
        </span>
        <span style={{ fontSize:10, color:'var(--text-faint)', background:'var(--surface2)', padding:'1px 5px', borderRadius:3, border:'1px solid var(--border)' }}>
          v0.1
        </span>
      </div>

      {/* Right side: gear + window controls */}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, WebkitAppRegion:'no-drag' }}>
        <button
          onClick={onSettings}
          title="Settings"
          style={{
            background:'none', border:'none', color:'var(--text-faint)', cursor:'pointer',
            fontSize:15, padding:'4px 6px', borderRadius:'var(--radius)', lineHeight:1,
            transition:'color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-faint)'}
        >
          ⚙
        </button>
        {isElectron && (
          <div style={{ display:'flex', gap:6 }}>
            {[
              { action: 'minimize', color: '#f4a20a', label: '–' },
              { action: 'maximize', color: '#2dc653', label: '□' },
              { action: 'close',    color: '#e63946', label: '×' },
            ].map(({ action, color, label }) => (
              <button key={action}
                onClick={() => window.forge.app[action]()}
                style={{
                  width:14, height:14, borderRadius:'50%', border:'none', cursor:'pointer',
                  background: color, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:9, color:'transparent', transition:'color .1s',
                }}
                onMouseEnter={e => e.target.style.color = '#000'}
                onMouseLeave={e => e.target.style.color = 'transparent'}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
