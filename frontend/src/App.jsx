import React, { useEffect, useState, useCallback } from 'react'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './styles.css'

import { useWebSocket } from './hooks/useWebSocket'
import Header         from './components/Header'
import CPUCard        from './components/CPUCard'
import MemCard        from './components/MemCard'
import DiskCard       from './components/DiskCard'
import GPUCard        from './components/GPUCard'
import SingleGPUCard  from './components/SingleGPUCard'
import GPUProcessCard from './components/GPUProcessCard'
import ProcessesCard  from './components/ProcessesCard'
import NetworkCard    from './components/NetworkCard'
import SystemInfoCard from './components/SystemInfoCard'
import ServicesCard   from './components/ServicesCard'
import JournalCard    from './components/JournalCard'

// ── Card definitions ──────────────────────────────────────────────────────────
export const CARD_DEFS = {
  system:    { label: 'System Info',     singleton: true,  defaultH: 10, defaultW: 4 },
  cpu:       { label: 'CPU',             singleton: true,  defaultH: 10, defaultW: 4 },
  mem:       { label: 'Memory',          singleton: true,  defaultH: 7,  defaultW: 4 },
  disk:      { label: 'Disk',            singleton: true,  defaultH: 10, defaultW: 4 },
  network:   { label: 'Network',         singleton: true,  defaultH: 10, defaultW: 4 },
  gpus:      { label: 'GPUs (All)',       singleton: true,  defaultH: 20, defaultW: 12 },
  gpuproc:   { label: 'GPU Processes',   singleton: true,  defaultH: 10, defaultW: 6 },
  processes: { label: 'Processes',       singleton: true,  defaultH: 12, defaultW: 8 },
  services:  { label: 'Services',        singleton: true,  defaultH: 10, defaultW: 4 },
  journal:   { label: 'Journal',         singleton: false, defaultH: 12, defaultW: 4 },
  // singlegpu-{N} are added dynamically
}

const STATIC_SINGLETON_IDS = ['system','cpu','mem','disk','network','gpus','gpuproc','processes','services']

const DEFAULT_INSTANCES = ['system','cpu','mem','disk','network','gpus','processes','services','journal-default']

const DEFAULT_LAYOUT = [
  { i: 'system',    x: 0,  y: 0,  w: 4,  h: 10 },
  { i: 'cpu',       x: 4,  y: 0,  w: 4,  h: 10 },
  { i: 'mem',       x: 8,  y: 0,  w: 4,  h: 7  },
  { i: 'disk',      x: 0,  y: 10, w: 4,  h: 10 },
  { i: 'network',   x: 4,  y: 10, w: 4,  h: 10 },
  { i: 'services',  x: 8,  y: 10, w: 4,  h: 10 },
  { i: 'gpus',      x: 0,  y: 20, w: 12, h: 20 },
  { i: 'processes', x: 0,  y: 40, w: 8,  h: 12 },
  { i: 'journal-default', x: 8, y: 40, w: 4, h: 12 },
]

// ── Themes ────────────────────────────────────────────────────────────────────
const THEMES = [
  { name: 'ocean',    vars: { '--bg': '#0a0e1a', '--bg2': '#0d1120', '--card': '#101828', '--accent': '#3b82f6', '--accent2': '#60a5fa', '--muted': '#94a3b8', '--text': '#e2e8f0', '--text2': '#cbd5e1', '--border': 'rgba(255,255,255,0.06)', '--card-border': 'rgba(255,255,255,0.07)' } },
  { name: 'midnight', vars: { '--bg': '#0b0d1a', '--bg2': '#0e1020', '--card': '#131526', '--accent': '#7c3aed', '--accent2': '#a78bfa', '--muted': '#9ca3af', '--text': '#e2e8f0', '--text2': '#d1d5db', '--border': 'rgba(255,255,255,0.06)', '--card-border': 'rgba(255,255,255,0.07)' } },
  { name: 'sunset',   vars: { '--bg': '#130a07', '--bg2': '#1a0e0a', '--card': '#1f1210', '--accent': '#f97316', '--accent2': '#fb923c', '--muted': '#a78b7a', '--text': '#ffe4d6', '--text2': '#fcd5b8', '--border': 'rgba(255,255,255,0.06)', '--card-border': 'rgba(255,255,255,0.07)' } },
  { name: 'forest',   vars: { '--bg': '#050f08', '--bg2': '#071510', '--card': '#0b1f12', '--accent': '#10b981', '--accent2': '#34d399', '--muted': '#6b8f77', '--text': '#d1fae5', '--text2': '#a7f3d0', '--border': 'rgba(255,255,255,0.06)', '--card-border': 'rgba(255,255,255,0.07)' } },
  { name: 'matrix',   vars: { '--bg': '#001100', '--bg2': '#001800', '--card': '#001e00', '--accent': '#00ff88', '--accent2': '#44ffaa', '--muted': '#4db36b', '--text': '#ccffe0', '--text2': '#99ffcc', '--border': 'rgba(0,255,136,0.1)', '--card-border': 'rgba(0,255,136,0.1)' } },
  { name: 'slate',    vars: { '--bg': '#0f172a', '--bg2': '#111827', '--card': '#1e293b', '--accent': '#60a5fa', '--accent2': '#93c5fd', '--muted': '#64748b', '--text': '#f1f5f9', '--text2': '#e2e8f0', '--border': 'rgba(255,255,255,0.06)', '--card-border': 'rgba(255,255,255,0.07)' } },
  { name: 'warm',     vars: { '--bg': '#140e08', '--bg2': '#1a120c', '--card': '#1f1510', '--accent': '#fb923c', '--accent2': '#fdba74', '--muted': '#a08060', '--text': '#fef3e8', '--text2': '#fed7aa', '--border': 'rgba(255,255,255,0.06)', '--card-border': 'rgba(255,255,255,0.07)' } },
  { name: 'violet',   vars: { '--bg': '#0f0520', '--bg2': '#130728', '--card': '#19082b', '--accent': '#a78bfa', '--accent2': '#c4b5fd', '--muted': '#7c6a9a', '--text': '#ede9fe', '--text2': '#ddd6fe', '--border': 'rgba(255,255,255,0.06)', '--card-border': 'rgba(255,255,255,0.07)' } },
  { name: 'solar',    vars: { '--bg': '#0b0b00', '--bg2': '#131300', '--card': '#1c1c00', '--accent': '#ffd166', '--accent2': '#ffe599', '--muted': '#998855', '--text': '#fffbe6', '--text2': '#fff3b0', '--border': 'rgba(255,255,255,0.06)', '--card-border': 'rgba(255,255,255,0.07)' } },
  { name: 'cool',     vars: { '--bg': '#071427', '--bg2': '#071e2b', '--card': '#0a1f30', '--accent': '#34d399', '--accent2': '#6ee7b7', '--muted': '#4b8a74', '--text': '#ccfbf1', '--text2': '#99f6e4', '--border': 'rgba(255,255,255,0.06)', '--card-border': 'rgba(255,255,255,0.07)' } },
]

const FONTS = ['Inter', 'Roboto', 'Poppins', 'Lato', 'Montserrat', 'Source Sans Pro', 'Open Sans', 'Nunito', 'IBM Plex Sans', 'JetBrains Mono']

function applyTheme(name) {
  const t = THEMES.find(x => x.name === name) || THEMES[0]
  Object.entries(t.vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
}

function applyFont(name) {
  const id = 'dgx-font-link'
  let link = document.getElementById(id)
  if (link) link.remove()
  link = document.createElement('link')
  link.id   = id
  link.rel  = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name.replace(/ /g, '+'))}:wght@300;400;600;700&display=swap`
  document.head.appendChild(link)
  document.documentElement.style.fontFamily = `'${name}', Inter, Roboto, Arial, sans-serif`
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { status, metrics, history } = useWebSocket('/ws')

  const [width, setWidth] = useState(window.innerWidth - 20)
  const [theme, setTheme] = useState(() => localStorage.getItem('dgx_theme') || 'midnight')
  const [font,  setFont]  = useState(() => localStorage.getItem('dgx_font')  || 'Inter')
  const [user,  setUser]  = useState(() => localStorage.getItem('dgx_user')  || '1')

  // Dynamic card instances
  const [instances, setInstances] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dgx_instances')) || DEFAULT_INSTANCES } catch { return DEFAULT_INSTANCES }
  })

  // Grid layout
  const [layout, setLayout] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dgx_layout')) || DEFAULT_LAYOUT } catch { return DEFAULT_LAYOUT }
  })

  // Responsive width
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth - 20)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { applyTheme(theme); localStorage.setItem('dgx_theme', theme) }, [theme])
  useEffect(() => { applyFont(font);   localStorage.setItem('dgx_font',  font)  }, [font])
  useEffect(() => { localStorage.setItem('dgx_user', user) }, [user])
  useEffect(() => { localStorage.setItem('dgx_layout',    JSON.stringify(layout)) }, [layout])
  useEffect(() => { localStorage.setItem('dgx_instances', JSON.stringify(instances)) }, [instances])

  // Save layout to server
  useEffect(() => {
    const u = localStorage.getItem('dgx_user') || '1'
    fetch(`/api/layout?user=${encodeURIComponent(u)}`)
      .then(r => r.json())
      .then(j => { if (j?.layout) setLayout(j.layout) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const u = localStorage.getItem('dgx_user') || user
    fetch(`/api/layout?user=${encodeURIComponent(u)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ layout }),
    }).catch(() => {})
  }, [layout])

  // ── Card management ─────────────────────────────────────────────────────────
  const addCard = useCallback((typeOrId) => {
    const isJournal = typeOrId === 'journal'
    const isSingleGPU = typeOrId.startsWith('singlegpu-')
    const isGpuProc   = typeOrId === 'gpuproc'

    let id
    if (isJournal) {
      id = `journal-${genId()}`
    } else {
      id = typeOrId // singleton IDs are their own type
    }

    if (instances.includes(id)) return // already visible

    setInstances(prev => [...prev, id])

    const def = CARD_DEFS[typeOrId] || CARD_DEFS['journal']
    const newItem = {
      i: id,
      x: 0, y: 9999, // push to bottom
      w: def?.defaultW || 4,
      h: def?.defaultH || 10,
    }
    setLayout(prev => [...prev, newItem])
  }, [instances])

  const removeCard = useCallback((id) => {
    setInstances(prev => prev.filter(x => x !== id))
    setLayout(prev => prev.filter(x => x.i !== id))
  }, [])

  const toggleCard = useCallback((id) => {
    if (instances.includes(id)) {
      removeCard(id)
    } else {
      addCard(id)
    }
  }, [instances, addCard, removeCard])

  const hist    = history.current
  const cpuData = metrics?.cpu ? { ...metrics.cpu, _system: metrics.system } : undefined
  const gpus    = metrics?.gpus ?? []

  // Render a card by instance ID
  const renderCard = (id) => {
    if (id === 'system')    return <SystemInfoCard data={metrics?.system} />
    if (id === 'cpu')       return <CPUCard data={cpuData} history={hist} />
    if (id === 'mem')       return <MemCard data={metrics?.memory} history={hist} />
    if (id === 'disk')      return <DiskCard data={metrics?.disk} diskIo={metrics?.disk_io} history={hist} />
    if (id === 'network')   return <NetworkCard data={metrics?.network} history={hist} />
    if (id === 'gpus')      return <GPUCard data={metrics} history={hist} />
    if (id === 'gpuproc')   return <GPUProcessCard data={metrics} onClose={() => removeCard(id)} />
    if (id === 'processes') return <ProcessesCard data={metrics?.processes} />
    if (id === 'services')  return <ServicesCard />
    if (id.startsWith('journal-'))   return <JournalCard instanceId={id} onClose={instances.filter(x => x.startsWith('journal-')).length > 1 ? () => removeCard(id) : null} />
    if (id.startsWith('singlegpu-')) {
      const idx = parseInt(id.replace('singlegpu-', ''), 10)
      return <SingleGPUCard gpuIndex={idx} data={metrics} history={hist} onClose={() => removeCard(id)} />
    }
    return null
  }

  // Only include layout items that have matching instances
  const activeLayout = layout.filter(l => instances.includes(l.i))

  const toolbarProps = {
    themes: THEMES.map(t => t.name),
    fonts: FONTS,
    theme, setTheme,
    font, setFont,
    user, setUser,
    instances,
    gpus,
    onAddCard: addCard,
    onToggleCard: toggleCard,
  }

  return (
    <div id="root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header status={status} toolbarProps={toolbarProps} />
      <div className="app-body">
        <GridLayout
          className="layout"
          layout={activeLayout}
          onLayoutChange={l => setLayout(l)}
          cols={12}
          rowHeight={30}
          width={width}
          draggableHandle=".card-drag"
          margin={[10, 10]}
        >
          {instances.map(id => (
            <div key={id}>{renderCard(id)}</div>
          ))}
        </GridLayout>
      </div>
    </div>
  )
}
