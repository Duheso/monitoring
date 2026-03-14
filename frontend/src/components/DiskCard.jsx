import React from 'react'
import { HardDrive } from 'lucide-react'
import CardWrapper from './CardWrapper'
import GaugeBar from './GaugeBar'
import SparkLine from './SparkLine'
import MultiSparkLine from './MultiSparkLine'
import { useColumnSettings } from '../hooks/useColumnSettings'

const DISK_METRICS = [
  { key: 'usage_bar',    label: 'Usage Gauge' },
  { key: 'usage_spark',  label: 'Usage Sparkline' },
  { key: 'usage_detail', label: 'Usage Details (Used/Free/Total)' },
  { key: 'io_spark',     label: 'I/O Rates Chart' },
  { key: 'io_detail',    label: 'I/O Detail (rates + IOPS)' },
]

const fmtGB   = (b) => b ? (b / 1073741824).toFixed(1) + ' GB' : '—'
const fmtRate = (b) => {
  if (!b) return '0 B/s'
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB/s'
  if (b >= 1048576)    return (b / 1048576).toFixed(1) + ' MB/s'
  if (b >= 1024)       return (b / 1024).toFixed(0) + ' KB/s'
  return b.toFixed(0) + ' B/s'
}

const IO_LINES = [
  {
    key: 'read',
    label: 'Read',
    color: '#f59e0b',
    gradientId: 'disk-read-grad',
    dataKey: pt => (pt?.disk_io?.read_bytes_rate ?? 0) / 1048576,
    formatter: v => `Read: ${v?.toFixed(1)} MB/s`,
  },
  {
    key: 'write',
    label: 'Write',
    color: '#6366f1',
    gradientId: 'disk-write-grad',
    dataKey: pt => (pt?.disk_io?.write_bytes_rate ?? 0) / 1048576,
    formatter: v => `Write: ${v?.toFixed(1)} MB/s`,
  },
]

export default function DiskCard({ data, diskIo, history }) {
  const { settings, toggleVisible } = useColumnSettings('disk-metrics', DISK_METRICS)
  const vis = (key) => settings?.[key]?.visible !== false

  const pct = data?.percent ?? 0
  const cls = pct >= 90 ? 'text-danger' : pct >= 75 ? 'text-warn' : 'text-accent'

  return (
    <CardWrapper
      title="Disk"
      icon={<HardDrive size={14} />}
      columns={DISK_METRICS}
      colSettings={settings}
      onToggleCol={toggleVisible}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
        <span className={`stat-value tabnum ${cls}`}>{pct.toFixed(1)}</span>
        <span className="stat-unit">%</span>
      </div>

      {vis('usage_bar') && <GaugeBar value={pct} warnAt={75} dangerAt={90} />}

      {vis('usage_spark') && (
        <SparkLine
          data={history}
          dataKey={pt => pt?.disk?.percent ?? 0}
          color="#34d399"
          gradientId="disk-spark"
          formatter={v => v?.toFixed(1) + '%'}
        />
      )}

      {vis('usage_detail') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: 4, fontSize: 12 }}>
          <div className="metric-row"><span className="metric-key">Used</span><span className="metric-val tabnum">{fmtGB(data?.used)}</span></div>
          <div className="metric-row"><span className="metric-key">Free</span><span className="metric-val tabnum">{fmtGB(data?.free)}</span></div>
          <div className="metric-row"><span className="metric-key">Total</span><span className="metric-val tabnum">{fmtGB(data?.total)}</span></div>
        </div>
      )}

      {diskIo && (
        <>
          {vis('io_spark') && (
            <>
              <div className="section-title mt8">I/O Rates</div>
              <MultiSparkLine data={history} lines={IO_LINES} height={45} />
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--muted)', marginTop: 2, marginBottom: 4 }}>
                <span style={{ color: '#f59e0b' }}>— Read</span>
                <span style={{ color: '#6366f1' }}>— Write</span>
              </div>
            </>
          )}

          {vis('io_detail') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12 }}>
              <div className="metric-row"><span className="metric-key">Read</span><span className="metric-val tabnum text-warn">{fmtRate(diskIo.read_bytes_rate)}</span></div>
              <div className="metric-row"><span className="metric-key">Write</span><span className="metric-val tabnum" style={{ color: '#6366f1' }}>{fmtRate(diskIo.write_bytes_rate)}</span></div>
              <div className="metric-row"><span className="metric-key">Read IOPS</span><span className="metric-val tabnum">{(diskIo.read_iops ?? 0).toFixed(0)}</span></div>
              <div className="metric-row"><span className="metric-key">Write IOPS</span><span className="metric-val tabnum">{(diskIo.write_iops ?? 0).toFixed(0)}</span></div>
            </div>
          )}
        </>
      )}
    </CardWrapper>
  )
}
