import React, { useState } from 'react'
import { Zap, Filter, Edit2, Check } from 'lucide-react'
import CardWrapper from './CardWrapper'
import GaugeBar from './GaugeBar'
import SparkLine from './SparkLine'
import ResizableTable from './ResizableTable'
import { useColumnSettings } from '../hooks/useColumnSettings'

const PROC_COLS = [
  { key: 'gpu',         label: 'GPU',    defaultWidth: 50  },
  { key: 'pid',         label: 'PID',    defaultWidth: 65  },
  { key: 'name',        label: 'Process', defaultWidth: 200 },
  { key: 'used_memory', label: 'Mem',    defaultWidth: 80  },
]

const TILE_METRICS = [
  { key: 'tile_util_bar',   label: 'Utilization Bar' },
  { key: 'tile_vram_bar',   label: 'VRAM Bar' },
  { key: 'tile_sparkline',  label: 'Sparkline' },
  { key: 'tile_temp',       label: 'Temperature' },
  { key: 'tile_power',      label: 'Power' },
  { key: 'tile_clocks',     label: 'Clocks (SM / Mem)' },
  { key: 'tile_vram_text',  label: 'VRAM Usage Text' },
  { key: 'tile_pcie',       label: 'PCIe Info' },
  { key: 'tile_name',       label: 'GPU Model Name' },
]

const ALL_COLS = [
  ...TILE_METRICS,
  ...PROC_COLS,
]

function tempColor(t) { if (!t) return ''; if (t >= 85) return 'hot'; if (t >= 70) return 'warm'; return '' }
function fmtPwr(v) { if (v === '[N/A]' || v == null) return '—'; return typeof v === 'number' ? v.toFixed(0) + ' W' : v + ' W' }
function fmtMHz(v) { if (v === '[N/A]' || v == null) return '—'; return typeof v === 'number' ? v + ' MHz' : v }
function fmtMem(used, total) { if (!total) return '—'; const pct = ((used / total) * 100).toFixed(0); return `${(used/1024).toFixed(1)} / ${(total/1024).toFixed(1)} GB (${pct}%)` }

function GPUNameEditor({ gpuIndex }) {
  const key = `dgx_gpu_name_${gpuIndex}`
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(() => localStorage.getItem(key) || '')
  const [input, setInput] = useState(name)
  const save = () => { localStorage.setItem(key, input); setName(input); setEditing(false) }
  if (editing) return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus
        style={{ width: 80, background: 'rgba(255,255,255,0.07)', border: '1px solid var(--accent)', borderRadius: 3, padding: '1px 4px', color: 'var(--text)', fontSize: 10, outline: 'none' }}
      />
      <button className="icon-btn" onClick={save} style={{ padding: 2 }}><Check size={9} style={{ color: '#22c55e' }} /></button>
    </span>
  )
  return (
    <button className="icon-btn" onClick={() => { setInput(name); setEditing(true) }} title="Custom GPU name" style={{ padding: 2, opacity: 0.5 }}>
      <Edit2 size={9} />
    </button>
  )
}

export default function GPUCard({ data, history }) {
  const gpus     = data?.gpus ?? []
  const gpuProcs = data?.gpu_processes ?? []

  const { settings, toggleVisible, setWidth } = useColumnSettings('gpu-all', ALL_COLS)
  const vis = (key) => settings?.[key]?.visible !== false

  // Process filters
  const [showFilters, setShowFilters] = useState(false)
  const [filterGPU,   setFilterGPU]  = useState('')
  const [filterPID,   setFilterPID]  = useState('')
  const [filterName,  setFilterName] = useState('')

  const parseSet = (s) => new Set(s.split(',').map(x => x.trim()).filter(Boolean))
  const gpuSet = parseSet(filterGPU)
  const pidSet = parseSet(filterPID)

  let procRows = gpuProcs.map(p => {
    const gpu = gpus.find(g => g.uuid === p.gpu_uuid)
    return { ...p, gpu: gpu ? `GPU ${gpu.index}` : '—', _gpuIdx: gpu ? gpu.index : -1 }
  })
  if (gpuSet.size > 0)   procRows = procRows.filter(r => gpuSet.has(String(r._gpuIdx)))
  if (pidSet.size > 0)   procRows = procRows.filter(r => pidSet.has(String(r.pid)))
  if (filterName.trim()) procRows = procRows.filter(r => r.name?.toLowerCase().includes(filterName.toLowerCase()))

  return (
    <CardWrapper
      title="GPUs"
      icon={<Zap size={14} />}
      columns={ALL_COLS}
      colSettings={settings}
      onToggleCol={toggleVisible}
      columnGroups={[
        { label: 'GPU Tile Metrics', keys: TILE_METRICS.map(m => m.key) },
        { label: 'Process Table',    keys: PROC_COLS.map(c => c.key) },
      ]}
    >
      {gpus.length === 0 && (
        <div className="text-muted" style={{ padding: '12px 0', textAlign: 'center' }}>No GPUs detected.</div>
      )}

      <div className="gpu-grid">
        {gpus.map(g => {
          const customName = localStorage.getItem(`dgx_gpu_name_${g.index}`) || ''
          return (
            <div key={g.index} className="gpu-tile">
              <div className="gpu-tile-header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  {customName
                    ? <div className="gpu-name" title={g.name}>{customName}</div>
                    : vis('tile_name') && <div className="gpu-name">{g.name}</div>
                  }
                  <div className="gpu-idx">GPU {g.index}</div>
                </div>
                <GPUNameEditor gpuIndex={g.index} />
              </div>

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
                <SparkLine data={history}
                  dataKey={pt => pt?.gpus?.find(x => x.index === g.index)?.utilization ?? 0}
                  color="#f59e0b" height={35} gradientId={`gpu-spark-${g.index}`}
                  formatter={v => `GPU ${g.index}: ${v?.toFixed(0)}%`}
                />
              )}
              <div className="gpu-metrics">
                {vis('tile_temp') && <div className="gpu-metric"><div className="lbl">Temp</div><div className={`val ${tempColor(g.temperature)}`}>{g.temperature != null ? `${g.temperature}°C` : '—'}</div></div>}
                {vis('tile_power') && <div className="gpu-metric"><div className="lbl">Power</div><div className="val">{fmtPwr(g.power_draw)} <span className="text-muted">/ {fmtPwr(g.power_limit)}</span></div></div>}
                {vis('tile_clocks') && <>
                  <div className="gpu-metric"><div className="lbl">SM Clock</div><div className="val">{fmtMHz(g.clock_sm)}</div></div>
                  <div className="gpu-metric"><div className="lbl">Mem Clock</div><div className="val">{fmtMHz(g.clock_mem)}</div></div>
                </>}
                {vis('tile_vram_text') && <div className="gpu-metric" style={{ gridColumn: '1/-1' }}><div className="lbl">VRAM</div><div className="val">{fmtMem(g.memory_used, g.memory_total)}</div></div>}
                {vis('tile_pcie') && g.pcie_gen && <div className="gpu-metric"><div className="lbl">PCIe</div><div className="val">Gen{g.pcie_gen} ×{g.pcie_width}</div></div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* GPU Processes section */}
      {gpuProcs.length > 0 && (
        <>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            GPU Processes ({procRows.length}{procRows.length !== gpuProcs.length ? `/${gpuProcs.length}` : ''})
            <button className="icon-btn" onClick={() => setShowFilters(v => !v)} title="Filters"
              style={{ padding: '2px 4px', color: (gpuSet.size || pidSet.size || filterName) ? 'var(--accent)' : undefined }}>
              <Filter size={11} />
            </button>
          </div>

          {showFilters && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>GPU indices (0,1,…)</div>
                <input value={filterGPU} onChange={e => setFilterGPU(e.target.value)} placeholder="0,1,2"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>PIDs</div>
                <input value={filterPID} onChange={e => setFilterPID(e.target.value)} placeholder="1234,5678"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Process name</div>
                <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="python, nemo…"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          )}

          <ResizableTable
            columns={PROC_COLS}
            data={procRows}
            keyFn={(r, i) => `${r.pid}-${i}`}
            colSettings={settings}
            onSetWidth={setWidth}
            emptyMsg="No GPU processes match filter"
          />
        </>
      )}
    </CardWrapper>
  )
}
