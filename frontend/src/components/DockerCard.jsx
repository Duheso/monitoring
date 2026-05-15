import React, { useState, useEffect, useCallback } from 'react'
import {
  Container, Plus, Trash2, Play, Square, RotateCcw, RefreshCw,
  Pause, PlayCircle, Download, Settings, Network, ChevronDown
} from 'lucide-react'
import CardWrapper from './CardWrapper'
import SparkLine from './SparkLine'
import DockerHostsModal from './DockerHostsModal'
import DockerNetworksModal from './DockerNetworksModal'
import { authFetch } from '../lib/api'

const STATUS_COLOR = {
  running:    '#22c55e',
  created:    '#60a5fa',
  restarting: '#f59e0b',
  paused:     '#f59e0b',
  exited:     '#64748b',
  removing:   '#ef4444',
  dead:       '#ef4444',
  error:      '#ef4444',
  unknown:    '#64748b',
}

const STATUS_BG = {
  running:  'rgba(34,197,94,0.08)',
  paused:   'rgba(245,158,11,0.08)',
  exited:   'rgba(100,116,139,0.06)',
  error:    'rgba(239,68,68,0.08)',
}

const fmtBytes = (b) => {
  if (!b && b !== 0) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`
  return `${(b / 1073741824).toFixed(2)} GB`
}

export default function DockerCard({ data, history }) {
  const [hosts, setHosts] = useState([])
  const [containers, setContainers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionPending, setActionPending] = useState({})
  const [showHostsModal, setShowHostsModal] = useState(false)
  const [showNetworksModal, setShowNetworksModal] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedHost, setSelectedHost] = useState('')
  const [availableContainers, setAvailableContainers] = useState([])
  const [selectedContainer, setSelectedContainer] = useState('')
  const [expandedActions, setExpandedActions] = useState({})

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [hRes, cRes] = await Promise.all([
        authFetch('/api/docker/hosts'),
        authFetch('/api/docker/containers'),
      ])
      const hData = await hRes.json()
      const cData = await cRes.json()
      setHosts(hData.hosts ?? [])
      setContainers(cData.containers ?? [])
    } catch {
      setError('Failed to load Docker data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 15000)
    return () => clearInterval(id)
  }, [refresh])

  // Load available containers when host selected
  useEffect(() => {
    if (!selectedHost) { setAvailableContainers([]); return }
    authFetch(`/api/docker/containers/by-host/${selectedHost}`)
      .then(r => r.json())
      .then(d => setAvailableContainers(d.containers ?? []))
      .catch(() => setAvailableContainers([]))
  }, [selectedHost])

  const addContainer = async () => {
    if (!selectedContainer || !selectedHost) return
    try {
      await authFetch('/api/docker/containers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ container_name: selectedContainer, host_id: selectedHost }),
      })
      setSelectedContainer('')
      setShowAddForm(false)
      await refresh()
    } catch {
      setError('Failed to add container')
    }
  }

  const removeContainer = async (id) => {
    try {
      await authFetch(`/api/docker/containers/${id}`, { method: 'DELETE' })
      await refresh()
    } catch {
      setError('Failed to remove container')
    }
  }

  const doAction = async (id, action, extra = {}) => {
    setActionPending(p => ({ ...p, [id]: action }))
    try {
      await authFetch(`/api/docker/containers/${id}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      setTimeout(refresh, 2000)
    } catch {
      setError(`Failed to ${action}`)
    } finally {
      setActionPending(p => { const n = { ...p }; delete n[id]; return n })
    }
  }

  // Merge live WebSocket data with containers list
  const liveData = data ?? []
  const mergedContainers = containers.map(c => {
    const live = liveData.find(l => l.id === c.id)
    return live ? { ...c, ...live } : { ...c, status: c.status || 'unknown' }
  })

  const color = (s) => STATUS_COLOR[s] ?? STATUS_COLOR.unknown
  const bg = (s) => STATUS_BG[s] ?? STATUS_BG.exited

  const btnS = { padding: '2px 4px', cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center' }

  return (
    <CardWrapper
      title="Docker"
      icon={<Container size={14} />}
      extra={
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
          <button className="icon-btn" onClick={() => setShowNetworksModal(true)} title="Networks" style={{ padding: '3px' }}>
            <Network size={12} />
          </button>
          <button className="icon-btn" onClick={() => setShowHostsModal(true)} title="Manage Hosts" style={{ padding: '3px' }}>
            <Settings size={12} />
          </button>
          <button className="icon-btn" onClick={refresh} title="Refresh" style={{ padding: '3px' }}>
            <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
        </div>
      }
    >
      {/* Add container form */}
      <div style={{ marginBottom: 8 }}>
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent)', color: '#fff', borderRadius: 5, padding: '4px 8px', border: 'none', cursor: 'pointer', fontSize: 12 }}
          >
            <Plus size={12} /> Add Container
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={selectedHost}
                onChange={e => setSelectedHost(e.target.value)}
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px', color: 'var(--text)', fontSize: 11 }}
              >
                <option value="">— select host —</option>
                {hosts.map(h => <option key={h.id} value={h.id}>{h.name} ({h.is_local ? 'local' : h.host})</option>)}
              </select>
              <select
                value={selectedContainer}
                onChange={e => setSelectedContainer(e.target.value)}
                disabled={!selectedHost}
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 6px', color: 'var(--text)', fontSize: 11 }}
              >
                <option value="">— select container —</option>
                {availableContainers.map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.status})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddForm(false)} style={{ padding: '3px 8px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={addContainer} disabled={!selectedContainer} style={{ padding: '3px 8px', fontSize: 11, border: 'none', borderRadius: 4, background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        )}
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 6 }}>{error}</div>}

      {mergedContainers.length === 0 && !loading && (
        <div className="text-muted" style={{ fontSize: 12, padding: '8px 0' }}>No containers monitored. Add a container above.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {mergedContainers.map(ct => {
          const isRunning = ct.status === 'running'
          const isPaused = ct.status === 'paused'
          const pending = actionPending[ct.id]
          const showMore = expandedActions[ct.id]

          return (
            <div key={ct.id} style={{ background: bg(ct.status), border: `1px solid ${color(ct.status)}22`, borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Status dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color(ct.status), flexShrink: 0, boxShadow: isRunning ? `0 0 6px ${color(ct.status)}` : 'none' }} />

                {/* Name + host */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ct.name}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ct.host_name || 'unknown'}{ct.image ? ` · ${ct.image}` : ''}
                  </div>
                </div>

                {/* Stats (when running) */}
                {isRunning && ct.cpu_percent !== undefined && (
                  <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text2)', flexShrink: 0 }}>
                    <span title="CPU">🖥 {ct.cpu_percent}%</span>
                    <span title="Memory">💾 {fmtBytes(ct.mem_usage)}/{fmtBytes(ct.mem_limit)}</span>
                    <span title="Net I/O">🌐 ↓{fmtBytes(ct.net_rx)} ↑{fmtBytes(ct.net_tx)}</span>
                  </div>
                )}

                {/* Status badge */}
                <div style={{ fontSize: 10, fontWeight: 700, color: color(ct.status), padding: '2px 6px', background: `${color(ct.status)}18`, borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                  {ct.status}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  {!isRunning && <button style={btnS} className="icon-btn" onClick={() => doAction(ct.id, 'start')} disabled={!!pending} title="Start"><Play size={10} /></button>}
                  {isRunning && <button style={btnS} className="icon-btn" onClick={() => doAction(ct.id, 'stop')} disabled={!!pending} title="Stop"><Square size={10} /></button>}
                  {isRunning && <button style={btnS} className="icon-btn" onClick={() => doAction(ct.id, 'restart')} disabled={!!pending} title="Restart"><RotateCcw size={10} /></button>}
                  {isRunning && !isPaused && <button style={btnS} className="icon-btn" onClick={() => doAction(ct.id, 'pause')} disabled={!!pending} title="Pause"><Pause size={10} /></button>}
                  {isPaused && <button style={btnS} className="icon-btn" onClick={() => doAction(ct.id, 'unpause')} disabled={!!pending} title="Unpause"><PlayCircle size={10} /></button>}
                  <button style={btnS} className="icon-btn" onClick={() => setExpandedActions(p => ({ ...p, [ct.id]: !p[ct.id] }))} title="More actions"><ChevronDown size={10} /></button>
                  <button style={{ ...btnS, color: '#ef444488' }} className="icon-btn" onClick={() => removeContainer(ct.id)} title="Remove from monitoring"><Trash2 size={10} /></button>
                </div>
              </div>

              {/* Expanded actions */}
              {showMore && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => doAction(ct.id, 'pull')} disabled={!!pending} className="icon-btn" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', color: 'var(--text2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Download size={9} /> Pull Image
                  </button>
                  <button onClick={() => doAction(ct.id, 'recreate')} disabled={!!pending} className="icon-btn" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.08)', color: '#60a5fa', cursor: 'pointer' }}>
                    Recreate (cache)
                  </button>
                  <button onClick={() => doAction(ct.id, 'recreate_no_cache')} disabled={!!pending} className="icon-btn" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', cursor: 'pointer' }}>
                    Recreate (no cache)
                  </button>
                  <button onClick={() => doAction(ct.id, 'remove', { force: true })} disabled={!!pending} className="icon-btn" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer' }}>
                    Remove Container
                  </button>
                </div>
              )}

              {/* CPU sparkline for running containers with history */}
              {isRunning && history && history.length > 2 && (
                <div style={{ marginTop: 4 }}>
                  <SparkLine
                    data={history}
                    dataKey={(pt) => {
                      const dc = (pt.docker_containers || []).find(d => d.id === ct.id)
                      return dc?.cpu_percent ?? 0
                    }}
                    color={color(ct.status)}
                    height={25}
                    gradientId={`docker-cpu-${ct.id}`}
                    formatter={(v) => `CPU: ${v?.toFixed(1) ?? 0}%`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showHostsModal && <DockerHostsModal onClose={() => { setShowHostsModal(false); refresh() }} />}
      {showNetworksModal && <DockerNetworksModal hosts={hosts} onClose={() => setShowNetworksModal(false)} />}
    </CardWrapper>
  )
}
