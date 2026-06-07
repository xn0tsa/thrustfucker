import { memo } from 'react'
import { BUTTONS, VIEWBOX } from './buttons.js'
import stickImg from './assets/tcasidestick.png'
import './SidestickPanel.css'

function Shape({ shape, ...rest }) {
  if (shape.type === 'circle') {
    return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...rest} />
  }
  if (shape.type === 'ellipse') {
    return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...rest} />
  }
  const points = shape.points.map(p => p.join(',')).join(' ')
  return <polygon points={points} {...rest} />
}

/**
 * Interactive TCA Sidestick panel for ThrustFucker.
 *
 * Props:
 *   selectedBtnIdx  : number | null    Forge BTN_x index of current selection
 *   litBtnIndices   : number[]         BTN_x indices to light up (assigned buttons)
 *   onZoneClick     : (zoneId) => void Called when a Forge-mapped zone is clicked
 *   debug           : boolean
 */
export default memo(function SidestickPanel({
  selectedBtnIdx = null,
  litBtnIndices  = [],
  onZoneClick,
  debug = false,
}) {
  const litSet = new Set(litBtnIndices)

  return (
    <div className="sidestick">
      <svg
        className={`sidestick-svg ${debug ? 'is-debug' : ''}`}
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        role="group"
        aria-label="TCA Sidestick X — button zones"
      >
        <defs>
          <filter id="ss-glow" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
        </defs>

        <image href={stickImg} x="0" y="0" width={VIEWBOX.width} height={VIEWBOX.height} />

        {/* Glow layer for lit + selected zones */}
        <g className="ss-lit-layer" aria-hidden="true">
          {BUTTONS.map(b => {
            const isSelected = b.forgeBtnIdx !== null && b.forgeBtnIdx === selectedBtnIdx
            const isLit      = b.forgeBtnIdx !== null && litSet.has(b.forgeBtnIdx)
            if (!isSelected && !isLit) return null
            const glowColor  = isSelected ? '#4a90e2' : b.glow
            return (
              <g key={b.id} className="ss-lit">
                <Shape shape={b.shape} className="ss-halo" fill={glowColor} />
                <Shape shape={b.shape} className="ss-core" fill={glowColor} />
                <Shape shape={b.shape} className="ss-edge" fill="none" stroke={glowColor} />
              </g>
            )
          })}
        </g>

        {/* Clickable hotspots */}
        <g className="ss-hotspots">
          {BUTTONS.map(b => {
            const isMapped   = b.forgeBtnIdx !== null
            const isSelected = isMapped && b.forgeBtnIdx === selectedBtnIdx
            const isActive   = isSelected || (isMapped && litSet.has(b.forgeBtnIdx))
            const cls        = [
              'ss-hotspot',
              isActive   ? 'is-active'   : '',
              !isMapped  ? 'is-disabled' : '',
            ].filter(Boolean).join(' ')

            return (
              <Shape
                key={b.id}
                shape={b.shape}
                className={cls}
                style={{ '--glow': isSelected ? '#4a90e2' : b.glow }}
                role="button"
                tabIndex={isMapped ? 0 : -1}
                aria-pressed={isSelected}
                aria-disabled={!isMapped}
                aria-label={`${b.label}${!isMapped ? ' (not available in Forge firmware)' : ''}`}
                onClick={() => isMapped && onZoneClick && onZoneClick(b.id)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ' ') && isMapped) {
                    e.preventDefault()
                    onZoneClick && onZoneClick(b.id)
                  }
                }}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
})
