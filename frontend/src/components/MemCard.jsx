import React from 'react'
import { MemoryStick } from 'lucide-react'
import CardWrapper from './CardWrapper'
import GaugeBar from './GaugeBar'
import SparkLine from './SparkLine'
import { useColumnSettings } from '../hooks/useColumnSettings'

const MEM_METRICS = [
  { key: 'gauge',    label: 'Usage Gauge' },
  { key: 'spark',    label: 'Sparkline' },
  { key: 'used',     label: 'Used' },
  { key: 'free',     label: 'Free / Available' },
  { key: 'total',    label: 'Total' },
  { key: 'cached',   label: 'Cached' },
  { key: 'buffers',  label: 'Buffers' },
]

const fmtGB = (b) => b ? (b / 1073741824).toFixed(1) + ' GB' : '—'

export default function MemCard({ data, history }) {
  const { settings, toggleVisible } = useColumnSettings('mem-metrics', MEM_METRICS)
  const vis = (key) => settings?.[key]?.visible !== false

  const pct     = data?.percent ?? 0
  const used    = data?.used ?? 0
  const avail   = data?.available ?? 0
  const total   = data?.total ?? 0
  const cached  = data?.cached ?? 0
  const buffers = data?.buffers ?? 0
  const cls     = pct >= 90 ? 'text-danger' : pct >= 75 ? 'text-warn' : 'text-accent'

  return (
    <CardWrapper title="Memory" icon={<MemoryStick size={14} />} columns={MEM_METRICS} colSettings={settings} onToggleCol={toggleVisible}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
        <span className={`stat-value tabnum ${cls}`}>{pct.toFixed(1)}</span>
        <span className="stat-unit">%</span>
      </div>
      {vis('gauge') && <GaugeBar value={pct} warnAt={75} dangerAt={90} />}
      {vis('spark') && (
        <SparkLine data={history} dataKey={pt => pt?.memory?.percent ?? 0} color="#a78bfa" gradientId="mem-spark" formatter={v => v?.toFixed(1) + '%'} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: 4, fontSize: 12 }}>
        {vis('used')    && <div className="metric-row"><span className="metric-key">Used</span><span className="metric-val tabnum">{fmtGB(used)}</span></div>}
        {vis('free')    && <div className="metric-row"><span className="metric-key">Free</span><span className="metric-val tabnum">{fmtGB(avail)}</span></div>}
        {vis('total')   && <div className="metric-row"><span className="metric-key">Total</span><span className="metric-val tabnum">{fmtGB(total)}</span></div>}
        {vis('cached')  && cached > 0  && <div className="metric-row"><span className="metric-key">Cached</span><span className="metric-val tabnum">{fmtGB(cached)}</span></div>}
        {vis('buffers') && buffers > 0 && <div className="metric-row"><span className="metric-key">Buffers</span><span className="metric-val tabnum">{fmtGB(buffers)}</span></div>}
      </div>
    </CardWrapper>
  )
}
