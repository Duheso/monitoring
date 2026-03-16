import React, { useState } from 'react'
import { Zap, X, Filter } from 'lucide-react'
import CardWrapper from './CardWrapper'
import ResizableTable from './ResizableTable'
import { useColumnSettings } from '../hooks/useColumnSettings'

const PROC_COLS = [
  { key: 'gpu',         label: 'GPU',     defaultWidth: 50  },
  { key: 'pid',         label: 'PID',     defaultWidth: 65  },
  { key: 'user',        label: 'User',    defaultWidth: 110 },
  { key: 'name',        label: 'Process', defaultWidth: 200 },
  { key: 'used_memory', label: 'Mem',     defaultWidth: 80  },
]

export default function GPUProcessCard({ data, onClose }) {
  const gpus     = data?.gpus ?? []
  const gpuProcs = data?.gpu_processes ?? []

  const { settings, toggleVisible, setWidth } = useColumnSettings('gpuproc-table', PROC_COLS)

  // Filter state
  const [filterGPU,  setFilterGPU]  = useState('')   // comma-separated GPU indices
  const [filterPID,  setFilterPID]  = useState('')   // comma-separated PIDs
  const [filterUser, setFilterUser] = useState('')   // comma-separated username substrings
  const [filterName, setFilterName] = useState('')   // comma-separated substrings (OR semantics)

  const parseSet = (s) => new Set(s.split(',').map(x => x.trim()).filter(Boolean))

  const gpuSet  = parseSet(filterGPU)
  const pidSet  = parseSet(filterPID)

  // Build rows
  let rows = gpuProcs.map(p => {
    const gpu = gpus.find(g => g.uuid === p.gpu_uuid)
    return { ...p, gpu: gpu ? `GPU ${gpu.index}` : '—', _gpuIdx: gpu ? gpu.index : -1 }
  })

  // Apply filters
  if (gpuSet.size > 0) rows = rows.filter(r => gpuSet.has(String(r._gpuIdx)))
  if (pidSet.size > 0) rows = rows.filter(r => pidSet.has(String(r.pid)))
  const userFilters = filterUser.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
  if (userFilters.length > 0) rows = rows.filter(r => userFilters.some(t => (r.user ?? '').toLowerCase().includes(t)))
  const nameFilters = filterName.split(',').map(term => term.trim().toLowerCase()).filter(Boolean)
  if (nameFilters.length > 0) {
    rows = rows.filter(r => {
      const name = r.name?.toLowerCase() ?? ''
      return nameFilters.some(term => name.includes(term))
    })
  }

  const [showFilters, setShowFilters] = useState(false)

  return (
    <CardWrapper
      title="GPU Processes"
      icon={<Zap size={14} />}
      columns={PROC_COLS}
      colSettings={settings}
      onToggleCol={toggleVisible}
      extra={
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <button className="icon-btn" onClick={() => setShowFilters(v => !v)} title="Filters"
            style={{ color: (gpuSet.size || pidSet.size || filterUser || filterName) ? 'var(--accent)' : undefined }}>
            <Filter size={12} />
          </button>
          {onClose && <button className="icon-btn" onClick={onClose} title="Close" style={{ color: '#ef444488' }}><X size={13} /></button>}
        </div>
      }
    >
      {showFilters && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>GPU indices (0,1,…)</div>
            <input value={filterGPU} onChange={e => setFilterGPU(e.target.value)} placeholder="e.g. 0,1,2"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>PIDs</div>
            <input value={filterPID} onChange={e => setFilterPID(e.target.value)} placeholder="e.g. 1234,5678"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>User</div>
            <input value={filterUser} onChange={e => setFilterUser(e.target.value)} placeholder="root, user1…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Process name</div>
            <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="python, nemo…"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
        {rows.length} process{rows.length !== 1 ? 'es' : ''} {(gpuSet.size || pidSet.size || filterUser || filterName) ? '(filtered)' : ''}
      </div>

      <ResizableTable
        columns={PROC_COLS}
        data={rows}
        keyFn={(r, i) => `${r.pid}-${i}`}
        colSettings={settings}
        onSetWidth={setWidth}
        emptyMsg="No GPU processes"
      />
    </CardWrapper>
  )
}
