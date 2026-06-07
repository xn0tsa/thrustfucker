import React, { useState, useEffect, useRef } from 'react'
import SidestickPanel from './SidestickPanel/SidestickPanel.jsx'
import { BUTTONS_BY_ID, BTN_TO_ZONE } from './SidestickPanel/buttons.js'

// Forge BTN_x index → display name (indices 0-10 = GPIO direct; 11-20 = SPI IO expander)
// Mapping confirmé par test physique 2026-06-07 (firmware Forge SPI2)
const BTN_NAMES = [
  'X / Trigger', // 0  — G0  PC0  — confirmé : trigger physique = X gauche
  'A (left)',    // 1  — G1  PC1  — confirmé
  'B (left)',    // 2  — G2  PC4  — confirmé
  'A (right)',   // 3  — G3  PC5  — confirmé
  'B (right)',   // 4  — G4  PA0  — confirmé
  'Handle L',    // 5  — G5  PA10
  'Hat ↑',       // 6  — G6  PB0
  'Hat ↓',       // 7  — G7  PB3
  'Hat ←',       // 8  — G8  PB4
  'Hat →',       // 9  — G9  PC14
  'Roller',      // 10 — G10 PC15
  'Y (right)',   // 11 — S0  — confirmé
  'X (right)',   // 12 — S1  — confirmé (Y=S0, B1=S2 → X forcément S1)
  'B1 (right)',  // 13 — S2  — confirmé
  'B2 (right)',  // 14 — S3  — confirmé
  '— (S4)',      // 15 — S4  — broche shift register non connectée
  'Y (left)',    // 16 — S5  — confirmé
  'B1 (left)',   // 17 — S6  — confirmé
  'B2 (left)',   // 18 — S7  — confirmé
  'Eject L',     // 19 — S8  — confirmé
  'Eject R',     // 20 — S9  — confirmé
]

// Physical mapping: original Thrustmaster firmware gamepad button index → Forge BTN_x index
// ATTENTION: ce mapping est partiellement confirmé par test physique (2026-06-07).
// L'index 10 du fw original correspond au trigger physique (confirmé par l'utilisateur).
// Les autres entrées sont provisoires et peuvent être erronées.
// Pour un mapping fiable, utiliser "Detect" avec le firmware Forge directement.
const ORIG_GP_TO_FORGE = {
  10: 0,   // btn_red (trigger)  → BTN_TRIGGER (confirmé : fw orig btn 10 = trigger)
  15: 1,   // L_A (présumé)      → BTN_A
  14: 2,   // L_B (présumé)      → BTN_B
  8:  3,   // R_A (présumé)      → BTN_C
  9:  4,   // R_B (présumé)      → BTN_D
  2:  5,   // btn_handle_left    → BTN_E
  16: 10,  // roller             → BTN_EXTRA
  4:  11,  // R_Y (présumé)      → BTN 11
  5:  12,  // R_X (présumé)      → BTN 12
  6:  13,  // R_B1 (présumé)     → BTN 13
  7:  14,  // R_B2 (présumé)     → BTN 14
  11: 16,  // L_Y (présumé)      → BTN 16
  12: 17,  // L_B1 (présumé)     → BTN 17
  13: 18,  // L_B2 (présumé)     → BTN 18
  17: 19,  // L_icon (présumé)   → BTN 19
  18: 20,  // R_icon (présumé)   → BTN 20
  // hat : non détectable via fw original (axe POV, pas boutons digitaux)
  // L_X : retiré de cette table (l'index 10 du fw original = trigger, pas L_X)
}

function detectFirmwareType(gamepadId) {
  if (!gamepadId) return 'unknown'
  const id = gamepadId.toLowerCase()
  if (id.includes('1209')) return 'forge'       // VID_1209 = Forge SSF firmware
  if (id.includes('044f') || id.includes('thrustmaster') || id.includes('tca')) return 'original'
  return 'unknown'
}

// Map a raw gamepad button index to a Forge BTN_x index (0-20), or null if no Forge equivalent
function gpBtnToForge(gpBtnIdx, firmwareType) {
  if (firmwareType === 'forge') {
    // Forge firmware reports BTN 0-10 (GPIO) and BTN 11-26 (SPI) directly
    return gpBtnIdx >= 0 && gpBtnIdx <= 20 ? gpBtnIdx : null
  }
  if (firmwareType === 'original') {
    return ORIG_GP_TO_FORGE[gpBtnIdx] ?? null
  }
  // Unknown firmware: try Forge direct mapping first, then original translation
  if (gpBtnIdx >= 0 && gpBtnIdx <= 10) return gpBtnIdx
  return ORIG_GP_TO_FORGE[gpBtnIdx] ?? null
}

function btnName(idx) {
  if (idx === null || idx === undefined) return '—'
  return BTN_NAMES[idx] ?? `Button ${idx}`
}

export default function TriggerMapper({ value, onChange }) {
  const [gamepad,     setGamepad]     = useState(null)
  const [capturing,   setCapturing]   = useState(false)
  const [livePressed, setLivePressed] = useState(new Set())
  const [showRaw,     setShowRaw]     = useState(false)
  const [lastActive,  setLastActive]  = useState(null)
  const rafRef       = useRef(null)
  const prevRef      = useRef([])
  const capturingRef = useRef(false)

  useEffect(() => { capturingRef.current = capturing }, [capturing])

  // ── Gamepad connect/disconnect ────────────────────────────────────────────
  useEffect(() => {
    const onConnect    = e => setGamepad(e.gamepad)
    const onDisconnect = () => {
      setGamepad(null)
      setCapturing(false)
      setLivePressed(new Set())
    }
    window.addEventListener('gamepadconnected',    onConnect)
    window.addEventListener('gamepaddisconnected', onDisconnect)
    for (const gp of navigator.getGamepads()) {
      if (gp) { setGamepad(gp); break }
    }
    return () => {
      window.removeEventListener('gamepadconnected',    onConnect)
      window.removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [])

  // ── RAF: live display + capture ───────────────────────────────────────────
  useEffect(() => {
    if (!gamepad) return
    prevRef.current = new Array(32).fill(false)
    const fwType = detectFirmwareType(gamepad.id)

    const poll = () => {
      const gps = navigator.getGamepads()
      const gp  = gps[gamepad.index]
      if (gp) {
        const states = Array.from(gp.buttons).map(b => b.pressed)

        // Translate live pressed buttons → Forge BTN_x indices for glow
        const liveForge = new Set()
        states.forEach((on, i) => {
          if (on) {
            const fi = gpBtnToForge(i, fwType)
            if (fi !== null) liveForge.add(fi)
          }
        })
        setLivePressed(liveForge)
        if (liveForge.size > 0) setLastActive([...liveForge].sort((a, b) => a - b))

        if (capturingRef.current) {
          for (let i = 0; i < states.length; i++) {
            if (states[i] && !prevRef.current[i]) {
              const forgeBtnIdx = gpBtnToForge(i, fwType)
              if (forgeBtnIdx !== null) {
                onChange(forgeBtnIdx)
                setCapturing(false)
                prevRef.current = states
                rafRef.current = requestAnimationFrame(poll)
                return
              }
            }
          }
          prevRef.current = states
        }
      }
      rafRef.current = requestAnimationFrame(poll)
    }

    rafRef.current = requestAnimationFrame(poll)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [gamepad, onChange])

  const btnIdx        = typeof value === 'number' ? value : null
  const selectedZoneId = btnIdx !== null ? BTN_TO_ZONE[btnIdx] : null
  const fwType         = gamepad ? detectFirmwareType(gamepad.id) : null

  // livePressed already contains translated Forge BTN_x indices
  const liveForgeBtns = [...livePressed]

  const handleZoneClick = id => {
    if (capturing) return
    const zone = BUTTONS_BY_ID[id]
    if (zone && zone.forgeBtnIdx !== null) {
      onChange(zone.forgeBtnIdx)
    }
  }

  return (
    <div style={{
      background:   'var(--surface)',
      border:       `1px solid ${capturing ? 'var(--accent)' : 'var(--border2)'}`,
      borderRadius: 'var(--radius)',
      padding:      '10px 12px',
      transition:   'border-color .2s',
    }}>

      {/* Visual stick panel — 70% width */}
      <div style={{ position: 'relative', width: '70%', margin: '0 auto' }}>
        <SidestickPanel
          selectedBtnIdx={btnIdx}
          litBtnIndices={liveForgeBtns}
          onZoneClick={handleZoneClick}
        />

        {/* Capture overlay */}
        {capturing && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius)',
            gap: 8,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', animation: 'blink .7s infinite' }}>
              ◉ Press the physical button…
            </div>
            <button
              className="btn btn-ghost"
              style={{ padding: '4px 14px', fontSize: 11 }}
              onClick={() => setCapturing(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Controller status bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
        <div className={`dot ${gamepad ? (capturing ? 'dot-yellow' : 'dot-green') : 'dot-grey'}`} />
        <span style={{ fontSize:11, color:'var(--text-dim)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {gamepad
            ? (gamepad.id.length > 44 ? gamepad.id.substring(0, 41) + '…' : gamepad.id)
            : 'No controller — click a zone to assign manually'}
        </span>
        {fwType === 'original' && (
          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:3, background:'#1a1400', color:'var(--yellow)', border:'1px solid var(--yellow)', flexShrink:0 }}>
            original fw
          </span>
        )}
        {fwType === 'forge' && (
          <span style={{ fontSize:10, padding:'1px 6px', borderRadius:3, background:'#0d1a0d', color:'var(--green)', border:'1px solid var(--green)', flexShrink:0 }}>
            forge fw
          </span>
        )}
      </div>

      {/* Current assignment + action buttons */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
        {capturing ? (
          <div style={{ flex:1, fontSize:12, color:'var(--accent)', fontWeight:600, animation:'blink 0.7s infinite' }}>
            Press the button to use as trigger…
          </div>
        ) : (
          <div style={{
            flex:1, padding:'4px 10px', borderRadius:'var(--radius)', fontSize:12, fontWeight:600,
            fontFamily:'var(--font-mono)',
            background: btnIdx !== null ? '#2a0d0f' : 'var(--surface)',
            color:      btnIdx !== null ? 'var(--accent)' : 'var(--text-faint)',
            border:     `1px solid ${btnIdx !== null ? 'var(--accent-dim)' : 'var(--border)'}`,
          }}>
            {btnIdx !== null
              ? `[${btnIdx}]  ${btnName(btnIdx)}${selectedZoneId ? `  ·  ${BUTTONS_BY_ID[selectedZoneId]?.label ?? ''}` : ''}`
              : 'Unassigned — click a zone above'}
          </div>
        )}

        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          {capturing ? (
            <button className="btn btn-ghost" style={{ padding:'4px 10px', fontSize:11 }}
              onClick={() => setCapturing(false)}>
              Cancel
            </button>
          ) : (
            <>
              <button
                className={gamepad ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding:'4px 12px', fontSize:11 }}
                disabled={!gamepad}
                title={!gamepad ? 'Connect the stick in Normal mode (ThrustFucker firmware with joystick Report ID)' : 'Press a button on the stick to detect it'}
                onClick={() => {
                  const gp = navigator.getGamepads()[gamepad.index]
                  prevRef.current = gp ? Array.from(gp.buttons).map(b => b.pressed) : []
                  setCapturing(true)
                }}
              >
                🎮 Detect
              </button>
              {btnIdx !== null && btnIdx !== 0 && (
                <button className="btn btn-ghost" style={{ padding:'4px 8px', fontSize:11 }}
                  title="Reset to Trigger (BTN_TRIGGER)" onClick={() => onChange(0)}>
                  ↺
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!gamepad && (
        <p style={{ fontSize:11, color:'var(--text-faint)', marginTop:8, lineHeight:1.4 }}>
          ThrustFucker firmware reports as HID joystick (Report ID 3) — plug the stick and wait for the browser to pick it up.
          <strong style={{ color:'var(--text-dim)' }}> Click a zone in the image</strong> to assign it manually.
        </p>
      )}

      {/* ── Raw bits panel ────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
        <button
          className="btn btn-ghost"
          style={{ padding:'3px 10px', fontSize:10, opacity: gamepad ? 1 : 0.4 }}
          onClick={() => setShowRaw(s => !s)}
        >
          {showRaw ? '▲ Hide raw bits' : '⬡ Raw bits'}
        </button>
        {lastActive !== null && (
          <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:'var(--text-faint)' }}>
            last: [{lastActive.join(', ')}]
          </span>
        )}
      </div>

      {showRaw && (
        <div style={{
          marginTop:8, padding:'10px 12px',
          background:'var(--surface2)', border:'1px solid var(--border)',
          borderRadius:'var(--radius)',
        }}>
          <div style={{ fontSize:9, color:'var(--text-faint)', marginBottom:8, fontFamily:'var(--font-mono)' }}>
            Bit index · G=GPIO(0-10) · S=SPI(11-20) — press a physical button to identify it
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {Array.from({length: 21}, (_, i) => {
              const isActive = livePressed.has(i)
              const isGpio   = i <= 10
              const tag      = isGpio ? `G${i}` : `S${i-11}`
              const name     = BTN_NAMES[i] ?? `Btn ${i}`
              const short    = name.length > 6 ? name.slice(0, 5) + '…' : name
              return (
                <div
                  key={i}
                  title={`[${i}] ${name}`}
                  style={{
                    width:44, padding:'4px 2px',
                    borderRadius:4, textAlign:'center',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:1,
                    fontFamily:'var(--font-mono)',
                    background: isActive ? 'var(--accent)' : 'var(--surface)',
                    color:      isActive ? '#fff'          : 'var(--text-faint)',
                    border:     `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    transition: 'background .08s, border-color .08s',
                  }}
                >
                  <span style={{ fontSize:12, fontWeight:700, lineHeight:1 }}>{i}</span>
                  <span style={{
                    fontSize:8, lineHeight:1,
                    color: isActive ? 'rgba(255,255,255,.7)' : isGpio ? 'var(--green)' : 'var(--yellow)',
                  }}>{tag}</span>
                  <span style={{
                    fontSize:8, lineHeight:1,
                    color: isActive ? 'rgba(255,255,255,.6)' : 'var(--text-faint)',
                    maxWidth:42, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  }}>{short}</span>
                </div>
              )
            })}
          </div>
          {livePressed.size > 0 && (
            <div style={{ marginTop:8, fontSize:11, fontFamily:'var(--font-mono)', color:'var(--accent)' }}>
              ● active: [{[...livePressed].sort((a,b)=>a-b).join(', ')}]
            </div>
          )}
        </div>
      )}

    </div>
  )
}
