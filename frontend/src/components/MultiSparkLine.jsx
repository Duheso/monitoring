import React, { useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

const CustomTooltip = ({ active, payload, lines }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '4px 8px', fontSize: 11 }}>
      {payload.map(p => {
        const line = lines?.find(l => l.key === p.dataKey)
        return (
          <div key={p.dataKey} style={{ color: p.color }}>
            {line?.label ? `${line.label}: ` : ''}
            {line?.formatter ? line.formatter(p.value) : p.value?.toFixed?.(1) ?? p.value}
          </div>
        )
      })}
    </div>
  )
}

/**
 * MultiSparkLine — mini area chart with multiple lines.
 * Props:
 *  data    - array of metric snapshots
 *  lines   - [{key, dataKey (str|fn), color, gradientId, label, formatter}]
 *  height  - chart height (default 45)
 */
export default function MultiSparkLine({ data, lines = [], height = 45 }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0 || lines.length === 0) return []
    return data.map((pt, i) => {
      const point = { i }
      lines.forEach(line => {
        point[line.key] = typeof line.dataKey === 'function'
          ? line.dataKey(pt)
          : (pt?.[line.dataKey] ?? 0)
      })
      return point
    })
  }, [data, lines])

  if (chartData.length < 2) return <div style={{ height }} />

  return (
    <div className="sparkline-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            {lines.map(line => (
              <linearGradient key={line.key} id={line.gradientId || line.key} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={line.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={line.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <Tooltip content={<CustomTooltip lines={lines} />} />
          {lines.map(line => (
            <Area
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={1.5}
              fill={`url(#${line.gradientId || line.key})`}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
