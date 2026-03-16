import React from 'react'
import { Cpu } from 'lucide-react'
import CardWrapper from './CardWrapper'
import ResizableTable from './ResizableTable'
import { useColumnSettings } from '../hooks/useColumnSettings'

const COLS = [
  { key: 'name',      label: 'Name',      defaultWidth: 200 },
  { key: 'id',        label: 'ID',        defaultWidth: 120 },
  { key: 'size',      label: 'Size',      defaultWidth: 80  },
  { key: 'processor', label: 'Processor', defaultWidth: 100 },
  { key: 'context',   label: 'Context',   defaultWidth: 80,  defaultVisible: false },
  { key: 'until',     label: 'Until',     defaultWidth: 160 },
]

export default function OllamaPSCard({ data }) {
  const { settings, toggleVisible, setWidth } = useColumnSettings('ollama_ps', COLS)

  const rows = (data ?? []).map((m, i) => ({ ...m, _key: i }))

  const enrichedCols = COLS.map(col => {
    if (col.key === 'name') return { ...col, render: (row) => <span className="mono accent-val">{row.name || '—'}</span> }
    if (col.key === 'id')   return { ...col, render: (row) => <span className="mono text-muted" style={{ fontSize: '0.8em' }}>{row.id || '—'}</span> }
    if (col.key === 'size') return { ...col, render: (row) => <span className="mono">{row.size || '—'}</span> }
    if (col.key === 'processor') return {
      ...col,
      render: (row) => {
        const v = row.processor || ''
        const isGpu = /gpu/i.test(v)
        return <span className={`mono ${isGpu ? 'accent-val' : 'warn-val'}`}>{v || '—'}</span>
      }
    }
    if (col.key === 'until') return { ...col, render: (row) => <span className="mono" style={{ color: 'var(--muted)' }}>{row.until || '—'}</span> }
    return col
  })

  return (
    <CardWrapper
      title="Ollama PS"
      icon={<Cpu size={14} />}
      columns={COLS}
      colSettings={settings}
      onToggleCol={toggleVisible}
    >
      <ResizableTable
        columns={enrichedCols}
        data={rows}
        keyFn={(r) => r._key}
        colSettings={settings}
        onSetWidth={setWidth}
        emptyMsg="No models running"
      />
    </CardWrapper>
  )
}
