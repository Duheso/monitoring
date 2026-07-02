import React, { useState, useEffect, useCallback } from 'react'
import { Activity, Server, Globe, Zap, Users, CheckCircle, XCircle } from 'lucide-react'
import CardWrapper from './CardWrapper'
import { authFetch } from '../lib/api'

const Section = ({ title, icon: Icon, children }) => (
  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
      {Icon && <Icon size={10} />}
      {title}
    </div>
    {children}
  </div>
)

const Row = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
    <span style={{ color: 'var(--muted)' }}>{label}</span>
    <span style={{ color: color || 'var(--text)', fontFamily: 'monospace' }}>{value}</span>
  </div>
)

export default function VllmTrackingCard({ data, history }) {
  const [instances, setInstances] = useState([])
  const [selectedId, setSelectedId] = useState('')

  const refreshInstances = useCallback(async () => {
    try {
      const r = await authFetch('/api/vllm/instances')
      const d = await r.json()
      setInstances(d.instances ?? [])
      if (!selectedId && d.instances?.length) setSelectedId(d.instances[0].id)
    } catch {}
  }, [selectedId])

  useEffect(() => {
    refreshInstances()
    const id = setInterval(refreshInstances, 30000)
    return () => clearInterval(id)
  }, [refreshInstances])

  const liveAll = data ?? []
  const live = liveAll.find(m => m.id === selectedId) || {}
  const tracking = live.tracking || {}
  const derived = live.derived || {}
  const model = derived.model_name || live.model || ''
  const ipMetrics = tracking.ip_metrics || []
  const totalRunning = derived.num_requests_running || 0
  const totalWaiting = derived.num_requests_waiting || 0
  const totalGenTps = derived.generation_tokens_per_sec || 0
  const totalPromptTps = derived.prompt_tokens_per_sec || 0
  const totalCache = derived.gpu_cache_usage_pct || 0
  const totalPosts = ipMetrics.reduce((s, m) => s + m.requests, 0) || 1

  return (
    <CardWrapper
      title="vLLM Tracking"
      icon={<Activity size={14} />}
      extra={
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
          {instances.length > 1 && (
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setConnHistory([]) }}
              style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text2)' }}
            >
              {instances.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          )}
        </div>
      }
    >
      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: live.status === 'online' ? 'var(--success)' : 'var(--danger)',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          {live.status === 'online' ? 'Online' : 'Offline'}
          {model && ` \u2022 ${model}`}
        </span>
      </div>

      {/* Overall summary */}
      <Section title="Overview" icon={Zap}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div style={{ background: 'var(--bg-alt)', borderRadius: 6, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Running</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
              {totalRunning}
            </div>
          </div>
          <div style={{ background: 'var(--bg-alt)', borderRadius: 6, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Waiting</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>
              {totalWaiting}
            </div>
          </div>
          <div style={{ background: 'var(--bg-alt)', borderRadius: 6, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Total Requests</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>
              {derived.total_requests ? derived.total_requests.toLocaleString() : 0}
            </div>
          </div>
        </div>
      </Section>

      {/* Throughput + Cache */}
      <Section title="Throughput & Cache" icon={Zap}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          <Row label="Gen tokens/s" value={totalGenTps.toFixed(1)} />
          <Row label="GPU Cache" value={`${totalCache}%`} />
          <Row label="Prompt tokens/s" value={totalPromptTps.toFixed(1)} />
          <Row label="Prefix Cache Hit" value={`${derived.prefix_cache_hit_rate ?? 0}%`} />
        </div>
      </Section>

      {/* Per-IP metrics table */}
      <Section title={`Per-IP Metrics — ${tracking.active_connections ?? 0}`} icon={Globe}>
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 50px 50px 50px 60px 60px 55px',
            fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase',
            padding: '4px 0', borderBottom: '1px solid var(--border)', gap: 2,
          }}>
            <span>IP</span>
            <span>Run</span>
            <span>Wait</span>
            <span>Reqs</span>
            <span style={{ textAlign: 'right' }}>Gen/s</span>
            <span style={{ textAlign: 'right' }}>Prm/s</span>
            <span style={{ textAlign: 'right' }}>Cache</span>
          </div>
          {ipMetrics.map((m) => {
            // Distribute global metrics proportionally by request share
            const share = m.requests > 0 ? m.requests / totalPosts : (1 / (ipMetrics.length || 1))
            const run = Math.round(totalRunning * share)
            const wait = Math.round(totalWaiting * share)
            const genS = (totalGenTps * share).toFixed(1)
            const prmS = (totalPromptTps * share).toFixed(1)
            const cache = (totalCache * share).toFixed(0)

            return (
              <div key={m.ip} style={{
                display: 'grid', gridTemplateColumns: '1fr 50px 50px 50px 60px 60px 55px',
                fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border)', gap: 2,
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {m.active ? (
                    <CheckCircle size={10} style={{ color: '#22c55e' }} />
                  ) : (
                    <XCircle size={10} style={{ color: 'var(--muted)', opacity: 0.4 }} />
                  )}
                  <span style={{ fontFamily: 'monospace', color: '#3b82f6' }}>{m.ip}</span>
                </div>
                <span style={{ fontFamily: 'monospace', color: '#3b82f6' }}>{run}</span>
                <span style={{ fontFamily: 'monospace', color: '#f59e0b' }}>{wait}</span>
                <span style={{ fontFamily: 'monospace' }}>{m.requests}</span>
                <span style={{ fontFamily: 'monospace', textAlign: 'right' }}>{genS}</span>
                <span style={{ fontFamily: 'monospace', textAlign: 'right' }}>{prmS}</span>
                <span style={{ fontFamily: 'monospace', textAlign: 'right' }}>{cache}%</span>
              </div>
            )
          })}
          {ipMetrics.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>
              <Users size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Nenhum IP trackeado
            </div>
          )}
        </div>
      </Section>

    </CardWrapper>
  )
}
