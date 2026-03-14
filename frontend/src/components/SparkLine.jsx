import React, { useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

const CustomTooltip = ({ active, payload, formatter }) => {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 5, padding: '3px 8px', fontSize: 11, color: '#e2e8f0' }}>
      {formatter ? formatter(val) : val}
    </div>
  )
}

/**
 * SparkLine — mini area chart for history data.
 * Props:
 *  data        - array of metric snapshots
 *  dataKey     - accessor (string) or fn(point) => number
 *  color       - stroke/fill color
 *  height      - chart height (default 45)
 *  formatter   - tooltip label formatter fn
 *  gradientId  - unique id for gradient (use different id per instance)
 */
export default function SparkLine({ data, dataKey, color = '#3b82f6', height = 45, formatter, gradientId = 'sg' }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    return data.map((pt, i) => ({
      i,
      v: typeof dataKey === 'function' ? dataKey(pt) : (pt?.[dataKey] ?? 0),
    }))
  }, [data, dataKey])

  if (chartData.length < 2) return <div style={{ height }} />

  return (
    <div className="sparkline-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
