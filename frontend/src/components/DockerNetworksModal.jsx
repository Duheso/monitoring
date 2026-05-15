import React, { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Link, Unlink, Network as NetworkIcon } from 'lucide-react'
import { authFetch } from '../lib/api'

export default function DockerNetworksModal({ hosts, onClose }) {
  const [selectedHost, setSelectedHost] = useState(hosts[0]?.id || '')
  const [networks, setNetworks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newNetName, setNewNetName] = useState('')
  const [newNetDriver, setNewNetDriver] = useState('bridge')
  const [connectForm, setConnectForm] = useState({})
  const [availableContainers, setAvailableContainers] = useState([])

  const loadNetworks = useCallback(async () => {
    if (!selectedHost) return
    setLoading(true)
    try {
      const r = await authFetch(`/api/docker/hosts/${selectedHost}/networks`)
      const d = await r.json()
      setNetworks(d.networks ?? [])
    } catch {
      setError('Failed to load networks')
    } finally {
      setLoading(false)
    }
  }, [selectedHost])

  useEffect(() => { loadNetworks() }, [loadNetworks])

  useEffect(() => {
    if (!selectedHost) return
    authFetch(`/api/docker/containers/by-host/${selectedHost}`)
      .then(r => r.json())
      .then(d => setAvailableContainers(d.containers ?? []))
      .catch(() => {})
  }, [selectedHost])

  const createNetwork = async () => {
    if (!newNetName.trim() || !selectedHost) return
    try {
      await authFetch(`/api/docker/hosts/${selectedHost}/networks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newNetName, driver: newNetDriver }),
      })
      setNewNetName('')
      await loadNetworks()
    } catch {
      setError('Failed to create network')
    }
  }

  const removeNetwork = async (netName) => {
    try {
      await authFetch(`/api/docker/networks/${selectedHost}/${encodeURIComponent(netName)}`, { method: 'DELETE' })
      await loadNetworks()
    } catch {
      setError('Failed to remove network')
    }
  }

  const connectContainer = async (netName, containerName) => {
    try {
      await authFetch(`/api/docker/networks/${selectedHost}/${encodeURIComponent(netName)}/connect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ container_name: containerName }),
      })
      setConnectForm(p => ({ ...p, [netName]: '' }))
      await loadNetworks()
    } catch {
      setError('Failed to connect container')
    }
  }

  const disconnectContainer = async (netName, containerName) => {
    try {
      await authFetch(`/api/docker/networks/${selectedHost}/${encodeURIComponent(netName)}/disconnect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ container_name: containerName }),
      })
      await loadNetworks()
    } catch {
      setError('Failed to disconnect container')
    }
  }

  const modalStyle = {
    position: 'fixed', inset: 0, zIndex: 10000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  }

  const panelStyle = {
    background: '#1e293b', borderRadius: 12, padding: 20,
    minWidth: 540, maxWidth: 700, maxHeight: '80vh', overflowY: 'auto',
    border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
    borderRadius: 5, padding: '5px 8px', color: 'var(--text)', fontSize: 12, outline: 'none',
  }

  return (
    <div style={modalStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NetworkIcon size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Docker Networks</span>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ color: 'var(--muted)' }}><X size={16} /></button>
        </div>

        {/* Host selector */}
        <div style={{ marginBottom: 12 }}>
          <select
            value={selectedHost}
            onChange={e => setSelectedHost(e.target.value)}
            style={{ ...inputStyle, width: '100%' }}
          >
            <option value="">— select host —</option>
            {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>

        {/* Create network */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <input style={{ ...inputStyle, flex: 2 }} value={newNetName} onChange={e => setNewNetName(e.target.value)} placeholder="Network name" />
          <select style={{ ...inputStyle, flex: 1 }} value={newNetDriver} onChange={e => setNewNetDriver(e.target.value)}>
            <option value="bridge">bridge</option>
            <option value="overlay">overlay</option>
            <option value="macvlan">macvlan</option>
          </select>
          <button onClick={createNetwork} disabled={!newNetName.trim()} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--accent)', color: '#fff', borderRadius: 5, padding: '4px 8px', border: 'none', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>
            <Plus size={11} /> Create
          </button>
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 11, marginBottom: 8 }}>{error}</div>}

        {/* Networks list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {networks.map(net => (
            <div key={net.name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <NetworkIcon size={12} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{net.name}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{net.driver} · {net.scope}</span>
                {!['bridge', 'host', 'none'].includes(net.name) && (
                  <button className="icon-btn" onClick={() => removeNetwork(net.name)} title="Remove network" style={{ color: '#ef444488', padding: '2px' }}>
                    <Trash2 size={10} />
                  </button>
                )}
              </div>

              {/* Connected containers */}
              {net.containers.length > 0 && (
                <div style={{ marginLeft: 20, marginBottom: 4 }}>
                  {net.containers.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>
                      <Link size={9} style={{ color: 'var(--accent)' }} />
                      <span>{c.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{c.ipv4}</span>
                      <button className="icon-btn" onClick={() => disconnectContainer(net.name, c.name)} title="Disconnect" style={{ color: '#f59e0b', padding: '1px 3px', fontSize: 9, marginLeft: 'auto' }}>
                        <Unlink size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Connect container */}
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <select
                  value={connectForm[net.name] || ''}
                  onChange={e => setConnectForm(p => ({ ...p, [net.name]: e.target.value }))}
                  style={{ ...inputStyle, flex: 1, fontSize: 10 }}
                >
                  <option value="">— connect container —</option>
                  {availableContainers
                    .filter(c => !net.containers.some(nc => nc.name === c.name))
                    .map(c => <option key={c.name} value={c.name}>{c.name}</option>)
                  }
                </select>
                <button
                  onClick={() => connectForm[net.name] && connectContainer(net.name, connectForm[net.name])}
                  disabled={!connectForm[net.name]}
                  style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, border: '1px solid var(--border)', background: 'rgba(34,197,94,0.08)', color: '#22c55e', cursor: 'pointer' }}
                >
                  Connect
                </button>
              </div>
            </div>
          ))}
          {networks.length === 0 && !loading && (
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 12 }}>No networks found</div>
          )}
        </div>
      </div>
    </div>
  )
}
