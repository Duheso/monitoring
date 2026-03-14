import React, { useState } from 'react'
import { Zap, X, Edit2, Check } from 'lucide-react'
import CardWrapper from './CardWrapper'
import GaugeBar from './GaugeBar'
import SparkLine from './SparkLine'
import { useColumnSettings } from '../hooks/useColumnSettings'

const TILE_METRICS = [
  { key: 'tile_util_bar',   label: 'Utilization Bar' },
  { key: 'tile_vram_bar',   label: 'VRAM Bar' },
  { key: 'tile_sparkline',  label: 'Sparkline' },
  { key: 'tile_temp',       label: 'Temperature' },
  { key: 'tile_power',      label: 'Power' },
  { key: 'tile_clocks',     label: 'Clocks (SM / Mem)' },
  { key: 'tile_vram_text',  label: 'VRAM Usage Text' },
  { key: 'tile_pcie',       label: 'PCIe Info' },
  { key: 'tile_name',       label: 'Show GPU Model Name' },
]

function tempColor(t) { if (!t) return ''; if (t >= 85) return 'hot'; if (t >= 70) return 'warm'; return '' }
function fmtPwr(v) { if (v === '[N/A]' || v == null) return '—'; return typeof v === 'number' ? v.toFixed(0) + ' W' : v + ' W' }
function fmtMHz(v) { if (v === '[N/A]' || v == null) return '—'; return typeof v === 'number' ? v + ' MHz' : v }
function fmtMem(used, total) { if (!total) return '—'; const pct = ((used / total) * 100).toFixed(0); return `${(used/1024).toFixed(1)} / ${(total/1024).toFixed(1)} GB (${pct}%)` }

export default function SingleGPUCard({ gpuIndex, data, history, onClose }) {
  const g = data?.gpus?.find(x => x.index === gpuIndex)
  const settingsKey = `singlegpu-${gpuIndex}`
  const { settings, toggleVisible } = useColumnSettings(settingsKey, TILE_METRICS)
  const vis = (key) => settings?.[key]?.visible !== false

  // Custom GPU name stored in localStorage
  const nameKey = `dgx_gpu_name_${gpuIndex}`
  const [editing, setEditing] = useState(false)
  const [customName, setCustomName] = useState(() => localStorage.getItem(nameKey) || '')
  const [nameInput, setNameInput] = useState(customName)

  const saveName = () => { localStorage.setItem(nameKey, nameInput); setCustomName(nameInput); setEditing(false) }

  const title = customName || (g?.name || `GPU ${gpuIndex}`)

  return (
    <CardWrapper
      title={title}
      icon={<Zap size={14} />}
      columns={TILE_METRICS}
      colSettings={settings}
      onToggleCol={toggleVisible}
      extra={
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          {editing ? (
            <>
              <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false) }}
                autoFocus
                style={{ width: 120, background: 'rgba(255,255,255,0.07)', border: '1px solid var(--accent)', borderRadius: 4, padding: '2px 6px', color: 'var(--text)', fontSize: 11, outline: 'none' }}
              />
              <button className="icon-btn" onClick={saveName}><Check size={11} style={{ color: '#22c55e' }} /></button>
            </>
          ) : (
            <button className="icon-btn" onClick={() => { setNameInput(customName); setEditing(true) }} title="Custom name">
              <Edit2 size={11} />
            </button>
          )}
          {onClose && <button className="icon-btn" onClick={onClose} title="Close card" style={{ color: '#ef444488' }}><X size={13} /></button>}
        </div>
      }
    >
      {!g ? (
        <div className="text-muted" style={{ padding: '12px 0', textAlign: 'center' }}>GPU {gpuIndex} not found.</div>
      ) : (
        <>
          {vis('tile_name') && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 5, borderLeft: '2px solid var(--accent)' }}>
              {g.name} · GPU {g.index}
            </div>
          )}
          {vis('tile_util_bar') && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span className="text-muted">GPU Util</span>
                <span className="font-600 tabnum">{g.utilization}%</span>
              </div>
              <GaugeBar value={g.utilization} height={5} />
            </div>
          )}
          {vis('tile_vram_bar') && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span className="text-muted">VRAM</span>
                <span className="font-600 tabnum">{g.memory_utilization ?? 0}%</span>
              </div>
              <GaugeBar value={g.memory_utilization ?? ((g.memory_used / g.memory_total) * 100)} height={5} warnAt={80} dangerAt={95} />
            </div>
          )}
          {vis('tile_sparkline') && (
            <SparkLine
              data={history}
              dataKey={pt => pt?.gpus?.find(x => x.index === gpuIndex)?.utilization ?? 0}
              color="#f59e0b" height={40}
              gradientId={`sgpu-spark-${gpuIndex}`}
              formatter={v => `GPU ${gpuIndex}: ${v?.toFixed(0)}%`}
            />
          )}
          <div className="gpu-metrics">
            {vis('tile_temp') && (
              <div className="gpu-metric">
                <div className="lbl">Temp</div>
                <div className={`val ${tempColor(g.temperature)}`}>{g.temperature != null ? `${g.temperature}°C` : '—'}</div>
              </div>
            )}
            {vis('tile_power') && (
              <div className="gpu-metric">
                <div className="lbl">Power</div>
                <div className="val">{fmtPwr(g.power_draw)} <span className="text-muted">/ {fmtPwr(g.power_limit)}</span></div>
              </div>
            )}
            {vis('tile_clocks') && (
              <>
                <div className="gpu-metric"><div className="lbl">SM Clock</div><div className="val">{fmtMHz(g.clock_sm)}</div></div>
                <div className="gpu-metric"><div className="lbl">Mem Clock</div><div className="val">{fmtMHz(g.clock_mem)}</div></div>
              </>
            )}
            {vis('tile_vram_text') && (
              <div className="gpu-metric" style={{ gridColumn: '1/-1' }}>
                <div className="lbl">VRAM</div>
                <div className="val">{fmtMem(g.memory_used, g.memory_total)}</div>
              </div>
            )}
            {vis('tile_pcie') && g.pcie_gen && (
              <div className="gpu-metric"><div className="lbl">PCIe</div><div className="val">Gen{g.pcie_gen} ×{g.pcie_width}</div></div>
            )}
          </div>
        </>
      )}
    </CardWrapper>
  )
}
