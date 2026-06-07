import React, { useState, useEffect } from 'react'

export default function Settings({ onClose }) {
  const [s,     setS]     = useState({ cliPath: '', originalFw: '' })
  const [saved, setSaved] = useState(false)
  const isElectron = !!window.forge

  useEffect(() => {
    if (isElectron) window.forge.settings.get().then(setS).catch(() => {})
  }, [isElectron])

  const browse = async (field) => {
    if (!isElectron) return
    const filters = field === 'cliPath'
      ? [{ name: 'Executable', extensions: ['exe'] }]
      : [{ name: 'Firmware', extensions: ['bin'] }]
    const p = await window.forge.dialog.openFile({ filters })
    if (p) setS(prev => ({ ...prev, [field]: p }))
  }

  const handleSave = async () => {
    if (isElectron) await window.forge.settings.save(s).catch(() => {})
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 900)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ width: 520 }} onClick={e => e.stopPropagation()}>

        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span style={{ fontSize:16 }}>⚙</span>
          <h2 style={{ margin:0, fontSize:15 }}>Settings</h2>
          <button className="btn btn-ghost" style={{ marginLeft:'auto', padding:'3px 10px', fontSize:12 }} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:18 }}>

          <div>
            <label>STM32CubeProgrammer CLI</label>
            <div style={{ display:'flex', gap:6, marginTop:5 }}>
              <input type="text" value={s.cliPath||''} onChange={e => setS(p=>({...p, cliPath:e.target.value}))}
                style={{ flex:1, fontFamily:'var(--font-mono)', fontSize:11 }} />
              <button className="btn btn-ghost" style={{ flexShrink:0, padding:'7px 12px', fontSize:12 }} onClick={()=>browse('cliPath')}>
                Browse…
              </button>
            </div>
            <div style={{ fontSize:10, color:'var(--text-faint)', marginTop:4 }}>
              Path to STM32_Programmer_CLI.exe (used for flashing and restoring)
            </div>
          </div>

          <div>
            <label>Original firmware (.bin)</label>
            <div style={{ display:'flex', gap:6, marginTop:5 }}>
              <input type="text" value={s.originalFw||''} onChange={e => setS(p=>({...p, originalFw:e.target.value}))}
                style={{ flex:1, fontFamily:'var(--font-mono)', fontSize:11 }} />
              <button className="btn btn-ghost" style={{ flexShrink:0, padding:'7px 12px', fontSize:12 }} onClick={()=>browse('originalFw')}>
                Browse…
              </button>
            </div>
            <div style={{ fontSize:10, color:'var(--text-faint)', marginTop:4 }}>
              Thrustmaster firmware backup — never modified, used by "Restore"
            </div>
          </div>

          {s.lastFlashed && (
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
              <div style={{ fontSize:10, color:'var(--text-dim)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }}>Last flashed firmware</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className={`fw-badge fw-${s.lastFlashed.firmware}`}>{s.lastFlashed.firmware}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-dim)' }}>{s.lastFlashed.id}</span>
                <span style={{ fontSize:13, fontWeight:600 }}>{s.lastFlashed.name}</span>
                {s.lastFlashed.at && (
                  <span style={{ marginLeft:'auto', fontSize:11, color:'var(--text-faint)' }}>
                    {new Date(s.lastFlashed.at).toLocaleString('fr-FR')}
                  </span>
                )}
              </div>
            </div>
          )}

          <div style={{ fontSize:11, color:'var(--text-faint)', borderTop:'1px solid var(--border)', paddingTop:14 }}>
            ThrustFucker v0.1 — The original firmware is never overwritten.
          </div>
        </div>

        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:8, justifyContent:'flex-end', flexShrink:0 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className={`btn ${saved ? 'btn-success' : 'btn-primary'}`} onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
