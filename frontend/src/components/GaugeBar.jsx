import React from 'react'

/**
 * GaugeBar — color-coded progress bar.
 * green < warnAt, yellow < dangerAt, red >= dangerAt
 */
export default function GaugeBar({ value, max = 100, height = 7, warnAt = 60, dangerAt = 85 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const cls = pct >= dangerAt ? 'danger' : pct >= warnAt ? 'warn' : 'ok'
  return (
    <div className="gauge-track" style={{ height }}>
      <div className={`gauge-fill ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
