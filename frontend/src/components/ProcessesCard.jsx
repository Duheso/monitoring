import React, { useMemo, useState } from 'react'
import { List } from 'lucide-react'
import CardWrapper from './CardWrapper'
import ResizableTable from './ResizableTable'
import { useColumnSettings } from '../hooks/useColumnSettings'

const COLS = [
  { key: 'pid',            label: 'PID',    defaultWidth: 62  },
  { key: 'name',           label: 'Name',   defaultWidth: 160 },
  { key: 'cpu_percent',    label: 'CPU %',  defaultWidth: 70  },
  { key: 'memory_percent', label: 'Mem %',  defaultWidth: 70  },
  { key: 'runtime',        label: 'Time',   defaultWidth: 80  },
  { key: 'status',         label: 'Status', defaultWidth: 80, defaultVisible: false },
  { key: 'username',       label: 'User',   defaultWidth: 90, defaultVisible: false },
]

function fmtRuntime(secs) {
  if (secs == null || secs < 0) return '—'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (d > 0) return `${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function cpuClass(v) { return v >= 80 ? 'danger-val' : v >= 40 ? 'warn-val' : 'accent-val' }

export default function ProcessesCard({ data }) {
  const { settings, toggleVisible, setWidth } = useColumnSettings('processes', COLS)
  const [userFilter, setUserFilter] = useState('root')

  const userOptions = useMemo(() => {
    const usernames = new Set()
    ;(data ?? []).forEach(proc => {
      if (proc.username) usernames.add(proc.username)
    })
    const sorted = Array.from(usernames).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    if (!sorted.includes('root')) sorted.unshift('root')
    if (sorted.length === 0) return ['all', 'root']
    return ['all', ...sorted]
  }, [data])

  const normalizedFilter = userFilter === 'all' ? null : userFilter
  const filteredProcesses = (data ?? []).filter(proc => {
    if (!normalizedFilter) return true
    return proc.username === normalizedFilter
  })

  const rows = filteredProcesses.map(p => ({
    ...p,
    cpu_percent:    p.cpu_percent?.toFixed(1) ?? '0.0',
    memory_percent: p.memory_percent?.toFixed(2) ?? '0.00',
    runtime:        fmtRuntime(p.runtime_secs),
    _cpuRaw:        p.cpu_percent ?? 0,
  }))

  const enrichedCols = COLS.map(col => {
    if (col.key === 'cpu_percent')    return { ...col, render: (row) => <span className={`mono ${cpuClass(row._cpuRaw)}`}>{row.cpu_percent}%</span> }
    if (col.key === 'memory_percent') return { ...col, render: (row) => <span className="mono">{row.memory_percent}%</span> }
    if (col.key === 'pid')            return { ...col, render: (row) => <span className="mono text-muted">{row.pid}</span> }
    if (col.key === 'runtime')        return { ...col, render: (row) => <span className="mono" style={{ color: 'var(--muted)' }}>{row.runtime}</span> }
    return col
  })

  const headerExtra = (
    <div className="processes-header-filter">
      <span className="processes-filter-label">Filter by user</span>
      <select
        className="processes-filter-select"
        value={userFilter}
        onChange={e => setUserFilter(e.target.value)}
      >
        {userOptions.map(user => (
          <option key={user} value={user}>{user === 'all' ? 'All users' : user}</option>
        ))}
      </select>
    </div>
  )

  return (
    <CardWrapper
      title="Processes"
      icon={<List size={14} />}
      columns={COLS}
      colSettings={settings}
      onToggleCol={toggleVisible}
      extra={headerExtra}
    >
      <ResizableTable
        columns={enrichedCols}
        data={rows}
        keyFn={(r, i) => `${r.pid}-${i}`}
        colSettings={settings}
        onSetWidth={setWidth}
        emptyMsg="No process data"
      />
    </CardWrapper>
  )
}
