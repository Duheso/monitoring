import React, { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, CheckCircle, AlertCircle, Cpu, Wifi } from 'lucide-react'
import { authFetch } from '../lib/api'

export default function VllmInstancesModal({ onClose }) {
  const [instances, setInstances] = useState([])
  const [form, setForm] = useState({ name: '', url: '', sidecar_url: '' })
  const [testing, setTesting] = useState({})
  const [testResults, setTestResults] = useState({})
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const r = await authFetch('/api/vllm/instances')
      const d = await r.json()
      setInstances(d.instances ?? [])
    } catch {
      setError('Failed to load instances')
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const addInstance = async () => {
    if (!form.name.trim() || !form.url.trim()) return
    try {
      const r = await authFetch('/api/vllm/instances', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (!d.ok) { setError(d.error); return }
      setForm({ name: '', url: '', sidecar_url: '' })
      await refresh()
    } catch {
      setError('Failed to add instance')
    }
  }

  const removeInstance = async (id) => {
    try {
      await authFetch(`/api/vllm/instances/${id}`, { method: 'DELETE' })
      await refresh()
    } catch {
      setError('Failed to remove instance')
    }
  }

  const testInstance = async (id) => {
    setTesting(p => ({ ...p, [id]: true }))
    setTestResults(p => { const n = { ...p }; delete n[id]; return n })
    try {
      const r = await authFetch(`/api/vllm/instances/${id}/test`, { method: 'POST' })
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
            <Cpu size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>vLLM Instances</span>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ color: 'var(--muted)' }}><X size={16} /></button>
        </div>

        {/* Add form */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Add Instance</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name (e.g. vLLM Llama-3)" />
            <input style={inputStyle} value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="vLLM URL (e.g. http://gpu-server:8000)" />
            <input style={inputStyle} value={form.sidecar_url} onChange={e => setForm(f => ({ ...f, sidecar_url: e.target.value }))} placeholder="Sidecar URL (optional, e.g. http://gpu-server:9100)" />
          </div>
          <button onClick={addInstance} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent)', color: '#fff', borderRadius: 5, padding: '5px 10px', border: 'none', cursor: 'pointer', fontSize: 12 }}>
            <Plus size={12} /> Add Instance
          </button>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 8 }}>{error}</div>}

        {/* Instances list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {instances.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: 8, textAlign: 'center' }}>No instances configured</div>
          )}
          {instances.map(inst => {
            const tr = testResults[inst.id]
            return (
              <div key={inst.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{inst.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{inst.url}</div>
                  {inst.sidecar_url && <div style={{ fontSize: 10, color: 'var(--muted)' }}>Sidecar: {inst.sidecar_url}</div>}
                </div>
                {tr && (
                  <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: tr.result?.vllm?.status === 'online' ? '#22c55e' : '#ef4444' }}>
                      {tr.result?.vllm?.status === 'online' ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                      vLLM: {tr.result?.vllm?.status}
                      {tr.result?.vllm?.models?.length > 0 && ` (${tr.result.vllm.models.join(', ')})`}
                    </div>
                    {tr.result?.sidecar && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: tr.result.sidecar.status === 'online' ? '#22c55e' : '#f59e0b' }}>
                        <Wifi size={10} />
                        Sidecar: {tr.result.sidecar.status}
                      </div>
                    )}
                  </div>
                )}
                <button className="icon-btn" onClick={() => testInstance(inst.id)} disabled={testing[inst.id]} title="Test connection" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', color: 'var(--text2)', cursor: 'pointer' }}>
                  {testing[inst.id] ? '...' : 'Test'}
                </button>
                <button className="icon-btn" onClick={() => removeInstance(inst.id)} title="Remove" style={{ color: '#ef444488', padding: '3px' }}>
                  <Trash2 size={11} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
