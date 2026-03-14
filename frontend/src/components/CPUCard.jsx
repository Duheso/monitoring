import React from 'react'
import { Cpu } from 'lucide-react'
import CardWrapper from './CardWrapper'
import GaugeBar from './GaugeBar'
import SparkLine from './SparkLine'
import { useColumnSettings } from '../hooks/useColumnSettings'

const CPU_METRICS = [
  { key: 'gauge',     label: 'Usage Gauge' },
  { key: 'spark',     label: 'Sparkline' },
  { key: 'load_avg',  label: 'Load Average' },
  { key: 'freq',      label: 'CPU Frequency' },
  { key: 'per_core',  label: 'Per-Core Grid' },
]

export default function CPUCard({ data, history }) {
  const { settings, toggleVisible } = useColumnSettings('cpu-metrics', CPU_METRICS)
  const vis = (key) => settings?.[key]?.visible !== false

  const total   = data?.total ?? 0
  const percore = data?.percore ?? []
  const cls     = total >= 85 ? 'text-danger' : total >= 60 ? 'text-warn' : 'text-accent'

  return (
    <CardWrapper title="CPU" icon={<Cpu size={14} />} columns={CPU_METRICS} colSettings={settings} onToggleCol={toggleVisible}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
        <span className={`stat-value tabnum ${cls}`}>{total.toFixed(1)}</span>
        <span className="stat-unit">%</span>
      </div>
      {vis('gauge') && <GaugeBar value={total} />}
      {vis('spark') && (
        <SparkLine data={history} dataKey={pt => pt?.cpu?.total ?? 0} color="var(--accent)" gradientId="cpu-spark" formatter={v => v?.toFixed(1) + '%'} />
      )}
      {vis('load_avg') && data?._system?.load_avg_1 !== undefined && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12 }}>
          <span className="text-muted">Load&nbsp;
            <span className="font-600 text-accent">{data._system.load_avg_1}</span>
            &nbsp;/&nbsp;{data._system.load_avg_5}&nbsp;/&nbsp;{data._system.load_avg_15}
          </span>
          {vis('freq') && data._system.cpu_freq_mhz && (
            <span className="text-muted tabnum">{(data._system.cpu_freq_mhz / 1000).toFixed(2)}&nbsp;GHz</span>
          )}
        </div>
      )}
      {vis('per_core') && percore.length > 0 && (
        <div>
          <div className="section-title">Per Core ({percore.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(34px, 1fr))', gap: 2 }}>
            {percore.map((v, i) => {
              const color = v >= 85 ? '#ef4444' : v >= 60 ? '#f59e0b' : '#3b82f6'
              return (
                <div key={i} title={`Core ${i}: ${v.toFixed(0)}%`}
                  style={{ background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 3, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color, fontWeight: 600 }}>
                  {v.toFixed(0)}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </CardWrapper>
  )
}
