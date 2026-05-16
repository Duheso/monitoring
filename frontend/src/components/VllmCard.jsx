import React, { useState, useEffect, useCallback } from 'react'
import { Cpu, Settings } from 'lucide-react'
import CardWrapper from './CardWrapper'
import GaugeBar from './GaugeBar'
import SparkLine from './SparkLine'
import VllmInstancesModal from './VllmInstancesModal'
import { authFetch } from '../lib/api'

const fmtBytes = (b) => {
  if (!b && b !== 0) return '—'
  if (b < 1024) return `${b} MB`
  return `${(b / 1024).toFixed(1)} GB`
}

const Section = ({ title, children }) => (
  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{title}</div>
    {children}
  </div>
)

const Row = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
    <span style={{ color: 'var(--muted)' }}>{label}</span>
    <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{value}</span>
  </div>
)

export default function VllmCard({ data, history }) {
  const [instances, setInstances] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [showModal, setShowModal] = useState(false)

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
  const sidecar = live.sidecar_metrics || {}
  const d = live.derived || sidecar.derived || {}
  const gpus = sidecar.gpus || []
  const isOnline = live.status === 'online'

  const getVal = (key) => (pt) => {
    const v = (pt.vllm_metrics || []).find(m => m.id === selectedId)
    return v?.derived?.[key] ?? 0
  }

  return (
    <CardWrapper
      title="vLLM"
      icon={<Cpu size={14} />}
      extra={
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', alignItems: 'center' }}>
          {instances.length > 1 && (
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text2)' }}
            >
              {instances.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
            </select>
          )}
          <button className="icon-btn" onClick={() => setShowModal(true)} title="Manage Instances" style={{ padding: '3px' }}>
            <Settings size={12} />
          </button>
        </div>
      }
    >
      {instances.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0', textAlign: 'center' }}>
          No vLLM instances configured.{' '}
          <button onClick={() => setShowModal(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Add one</button>
        </div>
      )}

      {instances.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* ── Status bar ─────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#22c55e' : '#ef4444', boxShadow: isOnline ? '0 0 6px #22c55e' : 'none', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: isOnline ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
              {isOnline ? 'Online' : (live.status || 'Offline')}
            </span>
            {d.model_name && (
              <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>
                — <span style={{ color: 'var(--accent2)', fontWeight: 600 }}>{d.model_name}</span>
              </span>
            )}
          </div>

          {/* ── Key stats ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 8 }}>
            {[
              ['Tokens/s', d.generation_tokens_per_sec?.toFixed(1) ?? '—', 'var(--accent2)'],
              ['Running',  d.num_requests_running ?? '—', '#22c55e'],
              ['Waiting',  d.num_requests_waiting ?? '—', '#f59e0b'],
              ['KV Cache', `${(d.gpu_cache_usage_pct ?? 0).toFixed(0)}%`, (d.gpu_cache_usage_pct ?? 0) > 80 ? '#ef4444' : 'var(--accent)'],
              ['P95 E2E',  d.p95_e2e_latency ? `${d.p95_e2e_latency.toFixed(2)}s` : '—', (d.p95_e2e_latency ?? 0) > 5 ? '#ef4444' : 'var(--text)'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 4px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: 'monospace', lineHeight: 1.2 }}>{val}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Tokens/s sparkline */}
          {history && history.length > 2 && (
            <SparkLine data={history} dataKey={getVal('generation_tokens_per_sec')}
              color="var(--accent)" height={36} gradientId="vllm-tps"
              formatter={v => `Tokens/s: ${v?.toFixed(1) ?? 0}`} />
          )}

          {/* ── Performance ────────────────────────────────────── */}
          <Section title="Performance">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Gen Tokens/s</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent2)', fontFamily: 'monospace' }}>{d.generation_tokens_per_sec?.toFixed(1) ?? '—'}</div>
                {history && history.length > 2 && (
                  <SparkLine data={history} dataKey={getVal('generation_tokens_per_sec')} color="#3b82f6" height={26} gradientId="vllm-gen-tps2" />
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Prompt Tokens/s</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>{d.prompt_tokens_per_sec?.toFixed(1) ?? '—'}</div>
                {history && history.length > 2 && (
                  <SparkLine data={history} dataKey={getVal('prompt_tokens_per_sec')} color="#22c55e" height={26} gradientId="vllm-prompt-tps2" />
                )}
              </div>
            </div>

            {/* E2E latency */}
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>E2E Latency</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              {[['P50', d.p50_e2e_latency], ['P95', d.p95_e2e_latency], ['P99', d.p99_e2e_latency]].map(([label, val]) => (
                <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 5, padding: '5px 0', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{val ? `${val.toFixed(3)}s` : '—'}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* TTFT */}
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>Time to First Token</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[['P50', d.p50_ttft], ['P95', d.p95_ttft]].map(([label, val]) => (
                <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 5, padding: '5px 0', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{val ? `${val.toFixed(3)}s` : '—'}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)' }}>{label}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Cache / Memory ─────────────────────────────────── */}
          <Section title="Cache / Memory">
            <Row label="GPU KV Cache" value={`${(d.gpu_cache_usage_pct ?? 0).toFixed(1)}%`} />
            <GaugeBar value={d.gpu_cache_usage_pct ?? 0} warnAt={60} dangerAt={85} />
            <div style={{ marginTop: 6 }} />
            <Row label="CPU Cache" value={`${(d.cpu_cache_usage_pct ?? 0).toFixed(1)}%`} />
            <GaugeBar value={d.cpu_cache_usage_pct ?? 0} warnAt={60} dangerAt={85} />

            {history && history.length > 2 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>KV Cache History</div>
                <SparkLine data={history} dataKey={getVal('gpu_cache_usage_pct')}
                  color="#f59e0b" height={26} gradientId="vllm-kvcache2"
                  formatter={v => `KV Cache: ${v?.toFixed(1) ?? 0}%`} />
              </div>
            )}

            {/* GPU cards from sidecar */}
            {gpus.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {gpus.map(g => (
                  <div key={g.index} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text)', fontWeight: 600 }}>GPU {g.index}: {g.name}</span>
                      <span style={{ color: 'var(--muted)' }}>{g.temperature}°C</span>
                    </div>
                    <Row label="Utilization" value={`${g.utilization}%`} />
                    <GaugeBar value={g.utilization} warnAt={70} dangerAt={90} />
                    <div style={{ marginTop: 4 }} />
                    <Row label="Memory" value={`${fmtBytes(g.memory_used)} / ${fmtBytes(g.memory_total)}`} />
                    <GaugeBar value={g.memory_used} max={g.memory_total || 1} warnAt={60} dangerAt={85} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Requests ───────────────────────────────────────── */}
          <Section title="Requests">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
              {[
                ['Running',  d.num_requests_running ?? '—', '#22c55e'],
                ['Waiting',  d.num_requests_waiting ?? '—', '#f59e0b'],
                ['Total',    d.total_requests ?? '—', 'var(--text)'],
                ['Prefix Hit', `${(d.prefix_cache_hit_rate ?? 0).toFixed(0)}%`, 'var(--accent)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '5px 4px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'monospace' }}>{val}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{label}</div>
                </div>
              ))}
            </div>

            <Row label="Preemptions" value={d.num_preemptions ?? '—'} />
            <Row label="Gen Tokens Total" value={(d.generation_tokens_total ?? 0).toLocaleString()} />
            <Row label="Prompt Tokens Total" value={(d.prompt_tokens_total ?? 0).toLocaleString()} />

            {history && history.length > 2 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>Running Requests</div>
                <SparkLine data={history} dataKey={getVal('num_requests_running')}
                  color="#22c55e" height={26} gradientId="vllm-req-running2"
                  formatter={v => `Running: ${v?.toFixed(0) ?? 0}`} />
              </div>
            )}
          </Section>

        </div>
      )}

      {showModal && <VllmInstancesModal onClose={() => { setShowModal(false); refreshInstances() }} />}
    </CardWrapper>
  )
}
