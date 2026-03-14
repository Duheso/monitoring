import React, { useState, useEffect, useCallback } from 'react'
import { Activity, Plus, Trash2, RefreshCw, Play, Square, RotateCcw } from 'lucide-react'
import CardWrapper from './CardWrapper'
import { authFetch } from '../lib/api'

const STATUS_COLOR = {
  active:       '#22c55e',
  activating:   '#f59e0b',
  deactivating: '#f59e0b',
  inactive:     '#64748b',
  failed:       '#ef4444',
  'not-found':  '#ef4444',
  unknown:      '#64748b',
  error:        '#ef4444',
}

const STATUS_BG = {
  active:   'rgba(34,197,94,0.1)',
  failed:   'rgba(239,68,68,0.1)',
  inactive: 'rgba(100,116,139,0.08)',
}

export default function ServicesCard() {
  const [services, setServices] = useState([])
  const [newSvc, setNewSvc]     = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [actionPending, setActionPending] = useState({})

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const r = await authFetch('/api/services')
      const j = await r.json()
      setServices(j.services ?? [])
    } catch (e) {
      setError('Failed to load services')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 10000)
    return () => clearInterval(id)
  }, [refresh])

  const addService = async () => {
    const name = newSvc.trim()
    if (!name) return
    try {
      await authFetch('/api/services', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
      setNewSvc('')
      await refresh()
    } catch (e) {
      setError('Failed to add service')
    }
  }

  const removeService = async (name) => {
    try {
      await authFetch(`/api/services/${encodeURIComponent(name)}`, { method: 'DELETE' })
      await refresh()
    } catch (e) {
      setError('Failed to remove service')
    }
  }

  const doAction = async (name, action) => {
    setActionPending(p => ({ ...p, [name]: action }))
    try {
      await authFetch(`/api/services/${encodeURIComponent(name)}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      setTimeout(refresh, 1500)
    } catch (e) {
      setError(`Failed to ${action} ${name}`)
    } finally {
      setActionPending(p => { const n = { ...p }; delete n[name]; return n })
    }
  }

  const color = (s) => STATUS_COLOR[s] ?? STATUS_COLOR.unknown
  const bg    = (s) => STATUS_BG[s] ?? STATUS_BG.inactive

  return (
    <CardWrapper title="Services" icon={<Activity size={14} />}
      extra={
        <button className="icon-btn" onClick={refresh} title="Refresh" style={{ marginLeft: 'auto' }}>
          <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      }
    >
      {/* Add service input */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          className="svc-input"
          value={newSvc}
          onChange={e => setNewSvc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addService()}
          placeholder="e.g. nginx.service"
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 5, padding: '5px 8px', color: 'var(--text)', fontSize: 12, outline: 'none' }}
        />
        <button
          className="icon-btn"
          onClick={addService}
          title="Add service"
          style={{ background: 'var(--accent)', color: '#fff', borderRadius: 5, padding: '4px 8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 6 }}>{error}</div>}

      {services.length === 0 && !loading && (
        <div className="text-muted" style={{ fontSize: 12, padding: '8px 0' }}>No services registered. Add a systemd service name above.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {services.map(svc => (
          <div key={svc.name} style={{ background: bg(svc.status), border: `1px solid ${color(svc.status)}22`, borderRadius: 6, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Status dot */}
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color(svc.status), flexShrink: 0, boxShadow: svc.status === 'active' ? `0 0 6px ${color(svc.status)}` : 'none' }} />

            {/* Name + description */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {svc.name}
              </div>
              {svc.description && svc.description !== svc.name && (
                <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {svc.description}
                </div>
              )}
            </div>

            {/* Status badge */}
            <div style={{ fontSize: 10, fontWeight: 700, color: color(svc.status), padding: '2px 6px', background: `${color(svc.status)}18`, borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
              {svc.active_state ?? svc.status}
              {svc.sub_state && svc.sub_state !== svc.active_state && (
                <span style={{ fontWeight: 400, opacity: 0.7 }}> ({svc.sub_state})</span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 3 }}>
              <button className="icon-btn" onClick={() => doAction(svc.name, 'start')}   title="Start"   disabled={!!actionPending[svc.name]} style={{ padding: '3px' }}><Play      size={10} /></button>
              <button className="icon-btn" onClick={() => doAction(svc.name, 'stop')}    title="Stop"    disabled={!!actionPending[svc.name]} style={{ padding: '3px' }}><Square    size={10} /></button>
              <button className="icon-btn" onClick={() => doAction(svc.name, 'restart')} title="Restart" disabled={!!actionPending[svc.name]} style={{ padding: '3px' }}><RotateCcw size={10} /></button>
              <button className="icon-btn" onClick={() => removeService(svc.name)} title="Remove from list" style={{ padding: '3px', color: '#ef444488' }}><Trash2 size={10} /></button>
            </div>
          </div>
        ))}
      </div>
    </CardWrapper>
  )
}
