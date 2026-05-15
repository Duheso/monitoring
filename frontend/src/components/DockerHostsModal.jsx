import React, { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, CheckCircle, AlertCircle, Server, Wifi } from 'lucide-react'
import { authFetch } from '../lib/api'

export default function DockerHostsModal({ onClose }) {
  const [hosts, setHosts] = useState([])
  const [form, setForm] = useState({ name: '', host: '', port: '2375', tls: false, is_local: false })
  const [testing, setTesting] = useState({})
  const [testResults, setTestResults] = useState({})
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const r = await authFetch('/api/docker/hosts')
      const d = await r.json()
      setHosts(d.hosts ?? [])
    } catch {
      setError('Failed to load hosts')
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const addHost = async () => {
    if (!form.name.trim()) return
    try {
      const r = await authFetch('/api/docker/hosts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!d.ok) { setError(d.error); return }
      setForm({ name: '', host: '', port: '2375', tls: false, is_local: false })
      await refresh()
    } catch {
      setError('Failed to add host')
    }
  }

  const removeHost = async (id) => {
    try {
      await authFetch(`/api/docker/hosts/${id}`, { method: 'DELETE' })
      await refresh()
    } catch {
      setError('Failed to remove host')
    }
  }

  const testHost = async (id) => {
    setTesting(p => ({ ...p, [id]: true }))
    setTestResults(p => { const n = { ...p }; delete n[id]; return n })
    try {
      const r = await authFetch(`/api/docker/hosts/${id}/test`, { method: 'POST' })
      const d = await r.json()
      setTestResults(p => ({ ...p, [id]: d }))
    } catch (e) {
      setTestResults(p => ({ ...p, [id]: { ok: false, error: String(e) } }))
    } finally {
      setTesting(p => { const n = { ...p }; delete n[id]; return n })
    }
  }

  const modalStyle = {
    position: 'fixed', inset: 0, zIndex: 10000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  }

  const panelStyle = {
    background: '#1e293b', borderRadius: 12, padding: 20,
    minWidth: 480, maxWidth: 600, maxHeight: '80vh', overflowY: 'auto',
    border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
    borderRadius: 5, padding: '5px 8px', color: 'var(--text)', fontSize: 12, outline: 'none', width: '100%',
  }

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Server size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Docker Hosts</span>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ color: 'var(--muted)' }}><X size={16} /></button>
        </div>

        {/* Add host form */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Add Host</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name (e.g. GPU Server 1)" />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={form.is_local} onChange={e => setForm(f => ({ ...f, is_local: e.target.checked }))} />
              Local
            </label>
            {!form.is_local && (
              <>
                <input style={{ ...inputStyle, flex: 2 }} value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="Host (IP or hostname)" />
                <input style={{ ...inputStyle, flex: 0.5 }} value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="Port" />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={form.tls} onChange={e => setForm(f => ({ ...f, tls: e.target.checked }))} />
                  TLS
                </label>
              </>
            )}
          </div>
          <button onClick={addHost} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent)', color: '#fff', borderRadius: 5, padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: 12 }}>
            <Plus size={12} /> Add Host
          </button>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 8 }}>{error}</div>}

        {/* Hosts list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {hosts.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: 8, textAlign: 'center' }}>No hosts configured</div>
          )}
          {hosts.map(h => (
            <div key={h.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wifi size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{h.name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {h.is_local ? 'Local socket' : `${h.host}:${h.port}`}{h.tls ? ' (TLS)' : ''}
                </div>
              </div>
              {testResults[h.id] && (
                <div style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, color: testResults[h.id].ok ? '#22c55e' : '#ef4444' }}>
                  {testResults[h.id].ok ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
                  {testResults[h.id].ok ? `v${testResults[h.id].info?.server_version}` : 'Failed'}
                </div>
              )}
              <button className="icon-btn" onClick={() => testHost(h.id)} disabled={testing[h.id]} title="Test connection" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', color: 'var(--text2)', cursor: 'pointer' }}>
                {testing[h.id] ? '...' : 'Test'}
              </button>
              <button className="icon-btn" onClick={() => removeHost(h.id)} title="Remove host" style={{ color: '#ef444488', padding: '3px' }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
