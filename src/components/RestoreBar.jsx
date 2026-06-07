import React, { useState } from 'react'

export default function RestoreBar() {
  const [state, setState] = useState('idle')
  const [log,   setLog]   = useState('')
  const isElectron = !!window.forge

  const handleRestore = async () => {
    if (!confirm('Restore the original Thrustmaster firmware? The current pentest mode will be overwritten.')) return
    setState('running')
    setLog('Restoring…')
    if (!isElectron) {
      setState('error')
      setLog('Available only in the Electron app (not in the browser)')
      setTimeout(() => setState('idle'), 4000)
      return
    }
    const r = await window.forge.dfu.restore()
    if (r.ok) {
      setState('done')
      setLog('Original firmware restored successfully')
      setTimeout(() => setState('idle'), 4000)
    } else {
      setState('error')
      setLog('Error: ' + (r.error || 'unknown'))
      setTimeout(() => setState('idle'), 5000)
    }
  }

  const barBg = state === 'done' ? '#0d2d14' : state === 'error' ? '#2d0d0d' : 'var(--surface)'

  return (
    <div style={{
      background: barBg,
      borderTop: '1px solid var(--border)',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      flexShrink: 0,
      transition: 'background .3s',
    }}>
      <span style={{ fontSize:11, color:'var(--text-faint)' }}>
        Original firmware:&nbsp;
        <code style={{ fontSize:10, color:'var(--text-dim)' }}>
          tca_sidestick_x_fw_ORIGINAL_512k.bin
        </code>
      </span>

      {log && state !== 'idle' && (
        <span style={{
          fontSize:11,
          color: state === 'done' ? 'var(--green)' : state === 'error' ? 'var(--accent)' : 'var(--yellow)',
        }}>
          {log}
        </span>
      )}

      <button
        className={`btn ${state === 'done' ? 'btn-success' : 'btn-danger'}`}
        style={{ marginLeft:'auto', fontSize:11, padding:'5px 14px' }}
        onClick={handleRestore}
        disabled={state === 'running'}>
        {state === 'running' ? '⏳ Restoring…' : state === 'done' ? '✓ Restored' : '↩ Restore original firmware'}
      </button>
    </div>
  )
}
