import React, { useState, useEffect } from 'react'
import { PAYLOAD_LIBRARY, PAYLOAD_CATEGORIES } from '../data/payloadLibrary'

export default function PayloadLibrary({ onInsert, onClose }) {
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState('All')
  const [selected, setSelected] = useState(PAYLOAD_LIBRARY[0])

  const filtered = PAYLOAD_LIBRARY.filter(p =>
    (category === 'All' || p.category === category) &&
    (!search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()))
  )

  // Keep a valid selection when the filter changes
  useEffect(() => {
    if (filtered.length > 0 && !filtered.find(p => p.id === selected?.id)) {
      setSelected(filtered[0])
    }
  }, [filtered, selected])

  // Close on Escape
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" style={{ width:'85%', maxWidth:960, height:'78vh' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14, letterSpacing:'-0.2px' }}>
              Payload Library
            </div>
            <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:2 }}>
              {PAYLOAD_LIBRARY.length} pre-built payloads · Select then click "Insert"
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding:'4px 10px', fontSize:12 }} onClick={onClose}>✕</button>
        </div>

        {/* Filters */}
        <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', flexShrink:0, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width:160, padding:'5px 9px', fontSize:12 }}
            autoFocus
          />
          <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
            {['All', ...PAYLOAD_CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding:'3px 10px', fontSize:11, borderRadius:'var(--radius)',
                  border:'1px solid var(--border2)', cursor:'pointer',
                  background: category === cat ? 'var(--accent)' : 'transparent',
                  color:      category === cat ? '#fff' : 'var(--text-dim)',
                  transition: 'background .15s, color .15s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-faint)' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Body: list + preview */}
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

          {/* List */}
          <div style={{ width:300, borderRight:'1px solid var(--border)', overflowY:'auto', flexShrink:0 }}>
            {filtered.length === 0 && (
              <div style={{ padding:24, color:'var(--text-faint)', fontSize:12, textAlign:'center' }}>
                No matching payload
              </div>
            )}
            {filtered.map(p => {
              const active = selected?.id === p.id
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(p)}
                  style={{
                    padding:'10px 14px', cursor:'pointer',
                    borderBottom:'1px solid var(--border)',
                    borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                    background: active ? 'var(--surface2)' : 'transparent',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#1a1a1a' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    <span style={{ fontSize:12, fontWeight:600, color: active ? 'var(--text)' : 'var(--text-dim)' }}>
                      {p.name}
                    </span>
                  </div>
                  <span style={{ fontSize:10, padding:'1px 5px', borderRadius:3, background:'var(--surface)', color:'var(--text-dim)', border:'1px solid var(--border)', marginBottom:5, display:'inline-block' }}>
                    {p.category}
                  </span>
                  <div style={{ fontSize:11, color:'var(--text-faint)', lineHeight:1.4, marginTop:3 }}>
                    {p.description}
                  </div>
                  <div style={{ marginTop:6, display:'flex', gap:4 }}>
                    {p.os.map(o => <span key={o} className="os-tag">{o}</span>)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Preview */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {selected ? (
              <>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>{selected.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-dim)', lineHeight:1.5 }}>{selected.description}</div>
                  <div style={{ marginTop:8, display:'flex', gap:4 }}>
                    <span style={{ fontSize:10, padding:'2px 6px', borderRadius:3, background:'var(--surface2)', color:'var(--text-dim)', border:'1px solid var(--border)' }}>
                      {selected.category}
                    </span>
                    {selected.os.map(o => <span key={o} className="os-tag">{o}</span>)}
                  </div>
                </div>

                <div style={{ flex:1, overflow:'hidden', padding:'14px 20px', display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ fontSize:11, color:'var(--text-dim)', fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:'0.6px' }}>
                    DuckyScript
                  </div>
                  <pre
                    className="terminal"
                    style={{ flex:1, maxHeight:'none', overflow:'auto', fontSize:12, userSelect:'text', cursor:'text', lineHeight:1.6 }}
                  >
                    {selected.script}
                  </pre>
                </div>

                <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', flexShrink:0, display:'flex', gap:8, justifyContent:'flex-end', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--text-faint)', flex:1 }}>
                    UPPERCASE variables must be replaced according to your context.
                  </span>
                  <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    onClick={() => { onInsert(selected.script); onClose() }}
                  >
                    ↓ Insert into field
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding:40, color:'var(--text-faint)', fontSize:12, textAlign:'center' }}>
                Select a payload from the list
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
