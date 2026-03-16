import React from 'react'
import { Database } from 'lucide-react'
import CardWrapper from './CardWrapper'
import GaugeBar from './GaugeBar'
import SparkLine from './SparkLine'
import { useColumnSettings } from '../hooks/useColumnSettings'

const DISK_METRICS = [
  { key: 'usage_bar',    label: 'Usage Gauge' },
  { key: 'usage_spark',  label: 'Usage Sparkline' },
  { key: 'usage_detail', label: 'Usage Details (Used/Free/Total)' },
]

const fmtSize = (b) => {
  if (!b) return '—'
  if (b >= 1099511627776) return (b / 1099511627776).toFixed(1) + ' TB'
  if (b >= 1073741824)    return (b / 1073741824).toFixed(1) + ' GB'
  return (b / 1048576).toFixed(1) + ' MB'
}

/**
 * RaidDiskCard — displays usage for a specific mount point (e.g. /raid or /raid02).
 * Props:
 *   data        — { total, used, free, percent, mountpoint, unavailable? }
 *   title       — card title label
 *   device      — device label shown in subtitle (e.g. "/dev/md127")
 *   historyKey  — key in history snapshots that holds this disk's data (e.g. "disk_raid1")
 *   history     — metrics history array reference
 */
export default function RaidDiskCard({ data, title, device, historyKey, history }) {
  const settingsKey = `raid-disk-${historyKey}`
  const { settings, toggleVisible } = useColumnSettings(settingsKey, DISK_METRICS)
  const vis = (key) => settings?.[key]?.visible !== false

  const pct = data?.percent ?? 0
  const cls = pct >= 90 ? 'text-danger' : pct >= 75 ? 'text-warn' : 'text-accent'
  const unavailable = data?.unavailable

  return (
    <CardWrapper
      title={title}
      icon={<Database size={14} />}
      columns={DISK_METRICS}
      colSettings={settings}
      onToggleCol={toggleVisible}
    >
      {device && (
        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, fontFamily: 'monospace' }}>
          {device} → {data?.mountpoint ?? ''}
        </div>
      )}

      {unavailable ? (
        <div className="text-muted" style={{ padding: '8px 0', fontSize: 12 }}>
          Mount point unavailable
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
            <span className={`stat-value tabnum ${cls}`}>{pct.toFixed(1)}</span>
            <span className="stat-unit">%</span>
          </div>

          {vis('usage_bar') && <GaugeBar value={pct} warnAt={75} dangerAt={90} />}

          {vis('usage_spark') && historyKey && (
            <SparkLine
              data={history}
              dataKey={pt => pt?.[historyKey]?.percent ?? 0}
              color="#34d399"
              gradientId={`${historyKey}-spark`}
              formatter={v => v?.toFixed(1) + '%'}
            />
          )}

          {vis('usage_detail') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginTop: 4, fontSize: 12 }}>
              <div className="metric-row"><span className="metric-key">Used</span><span className="metric-val tabnum">{fmtSize(data?.used)}</span></div>
              <div className="metric-row"><span className="metric-key">Free</span><span className="metric-val tabnum">{fmtSize(data?.free)}</span></div>
              <div className="metric-row"><span className="metric-key">Total</span><span className="metric-val tabnum">{fmtSize(data?.total)}</span></div>
            </div>
          )}
        </>
      )}
    </CardWrapper>
  )
}
