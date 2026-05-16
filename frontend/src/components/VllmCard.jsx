import React, { useState, useEffect, useCallback } from 'react'
import { Cpu, Settings, RefreshCw } from 'lucide-react'
import CardWrapper from './CardWrapper'
import GaugeBar from './GaugeBar'
import SparkLine from './SparkLine'
import VllmInstancesModal from './VllmInstancesModal'
import { authFetch } from '../lib/api'

const TABS = ['Overview', 'Performance', 'GPU / Memory', 'Requests']

const fmtBytes = (b) => {
  if (!b && b !== 0) return '—'
  if (b < 1024) return `${b} MB`
  return `${(b / 1024).toFixed(1)} GB`
}

export default function VllmCard({ data, history }) {
  const [instances, setInstances] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [tab, setTab] = useState(0)
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

  // Get live metrics for selected instance
  const liveAll = data ?? []
  const live = liveAll.find(m => m.id === selectedId) || {}
  // derived is populated directly by the backend from Prometheus data; sidecar enriches if available
  const sidecar = live.sidecar_metrics || {}
  const siderived = live.derived || sidecar.derived || {}
  const gpus = sidecar.gpus || []
  const model = sidecar.model || {}
  const isOnline = live.status === 'online'

  const tabStyle = (i) => ({
    padding: '4px 10px', fontSize: 11, borderRadius: '4px 4px 0 0', cursor: 'pointer',
    background: tab === i ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${tab === i ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
    borderBottom: tab === i ? 'none' : '1px solid var(--border)',
    color: tab === i ? 'var(--accent2)' : 'var(--muted)',
    fontWeight: tab === i ? 600 : 400,
  })

  const statBox = (label, value, color = 'var(--text)') => (
    <div style={{ textAlign: 'center', minWidth: 70 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{label}</div>
    </div>
  )

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
        <>
          {/* Status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#22c55e' : '#ef4444', boxShadow: isOnline ? '0 0 6px #22c55e' : 'none' }} />
            <span style={{ fontSize: 11, color: isOnline ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
              {isOnline ? 'Online' : (live.status || 'Offline')}
            </span>
            {(siderived.model_name || model?.id) && (
              <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 8 }}>
                Model: <span style={{ color: 'var(--accent2)', fontWeight: 600 }}>{siderived.model_name || model.id}</span>
              </span>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginBottom: -1, position: 'relative', zIndex: 1 }}>
            {TABS.map((t, i) => <button key={t} onClick={() => setTab(i)} style={tabStyle(i)}>{t}</button>)}
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '0 6px 6px 6px', padding: 10, minHeight: 120, background: 'rgba(255,255,255,0.02)' }}>

            {/* Overview Tab */}
            {tab === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {statBox('Tokens/s', siderived.generation_tokens_per_sec?.toFixed(1) ?? '—', 'var(--accent2)')}
                  {statBox('Running', siderived.num_requests_running?.toFixed(0) ?? '—', '#22c55e')}
                  {statBox('Waiting', siderived.num_requests_waiting?.toFixed(0) ?? '—', '#f59e0b')}
                  {statBox('KV Cache', `${(siderived.gpu_cache_usage_pct ?? 0).toFixed(0)}%`, (siderived.gpu_cache_usage_pct ?? 0) > 80 ? '#ef4444' : 'var(--accent)')}
                  {statBox('P95 Latency', siderived.p95_e2e_latency ? `${siderived.p95_e2e_latency.toFixed(2)}s` : '—', (siderived.p95_e2e_latency ?? 0) > 5 ? '#ef4444' : 'var(--text)')}
                </div>
                {history && history.length > 2 && (
                  <SparkLine
                    data={history}
                    dataKey={(pt) => {
                      const v = (pt.vllm_metrics || []).find(m => m.id === selectedId)
                      return v?.derived?.generation_tokens_per_sec ?? 0
                    }}
                    color="var(--accent)"
                    height={40}
                    gradientId="vllm-tps"
                    formatter={(v) => `Tokens/s: ${v?.toFixed(1) ?? 0}`}
                  />
                )}
              </div>
            )}

            {/* Performance Tab */}
            {tab === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>Generation Tokens/s</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent2)', fontFamily: 'monospace' }}>
                      {siderived.generation_tokens_per_sec?.toFixed(1) ?? '—'}
                    </div>
                    {history && history.length > 2 && (
                      <SparkLine data={history} dataKey={pt => (pt.vllm_metrics || []).find(m => m.id === selectedId)?.derived?.generation_tokens_per_sec ?? 0} color="#3b82f6" height={30} gradientId="vllm-gen-tps" />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4, fontWeight: 600 }}>Prompt Tokens/s</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e', fontFamily: 'monospace' }}>
                      {siderived.prompt_tokens_per_sec?.toFixed(1) ?? '—'}
                    </div>
                    {history && history.length > 2 && (
                      <SparkLine data={history} dataKey={pt => (pt.vllm_metrics || []).find(m => m.id === selectedId)?.derived?.prompt_tokens_per_sec ?? 0} color="#22c55e" height={30} gradientId="vllm-prompt-tps" />
                    )}
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: 8 }}>Latency</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[['P50', siderived.p50_e2e_latency], ['P95', siderived.p95_e2e_latency], ['P99', siderived.p99_e2e_latency]].map(([label, val]) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{val?.toFixed(3) ?? '—'}s</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>TTFT P50</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{siderived.p50_ttft?.toFixed(3) ?? '—'}s</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>TTFT P95</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{siderived.p95_ttft?.toFixed(3) ?? '—'}s</div>
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Gen Tokens/s (live rate)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{siderived.generation_tokens_per_sec?.toFixed(1) ?? '—'} tok/s</div>
                </div>
              </div>
            )}

            {/* GPU / Memory Tab */}
            {tab === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* KV Cache */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)', fontWeight: 600 }}>GPU KV Cache</span>
                      <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{(siderived.gpu_cache_usage_pct ?? 0).toFixed(1)}%</span>
                    </div>
                    <GaugeBar value={siderived.gpu_cache_usage_pct ?? 0} warnAt={60} dangerAt={85} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)', fontWeight: 600 }}>CPU Cache</span>
                      <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{(siderived.cpu_cache_usage_pct ?? 0).toFixed(1)}%</span>
                    </div>
                    <GaugeBar value={siderived.cpu_cache_usage_pct ?? 0} warnAt={60} dangerAt={85} />
                </div>

                {/* GPU cards */}
                {gpus.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: 8 }}>GPUs</div>
                    {gpus.map(g => (
                      <div key={g.index} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                          <span style={{ color: 'var(--text)', fontWeight: 600 }}>GPU {g.index}: {g.name}</span>
                          <span style={{ color: 'var(--muted)' }}>{g.temperature}°C</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                          <span style={{ color: 'var(--muted)' }}>Utilization</span>
                          <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{g.utilization}%</span>
                        </div>
                        <GaugeBar value={g.utilization} warnAt={70} dangerAt={90} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3, marginTop: 4 }}>
                          <span style={{ color: 'var(--muted)' }}>Memory</span>
                          <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{fmtBytes(g.memory_used)} / {fmtBytes(g.memory_total)}</span>
                        </div>
                        <GaugeBar value={g.memory_used} max={g.memory_total || 1} warnAt={60} dangerAt={85} />
                      </div>
                    ))}
                  </>
                )}

                {history && history.length > 2 && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>KV Cache History</div>
                    <SparkLine
                      data={history}
                      dataKey={pt => (pt.vllm_metrics || []).find(m => m.id === selectedId)?.derived?.gpu_cache_usage_pct ?? 0}
                      color="#f59e0b"
                      height={30}
                      gradientId="vllm-kvcache"
                      formatter={v => `KV Cache: ${v?.toFixed(1) ?? 0}%`}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Requests Tab */}
            {tab === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {statBox('Running', siderived.num_requests_running?.toFixed(0) ?? '—', '#22c55e')}
                  {statBox('Waiting', siderived.num_requests_waiting?.toFixed(0) ?? '—', '#f59e0b')}
                  {statBox('Total', siderived.total_requests?.toFixed(0) ?? '—', 'var(--text)')}
                  {statBox('Preemptions', siderived.num_preemptions?.toFixed(0) ?? '—', '#a78bfa')}
                  {statBox('Prefix Hit', `${(siderived.prefix_cache_hit_rate ?? 0).toFixed(0)}%`, 'var(--accent)')}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Generation Tokens Total</span>
                    <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{(siderived.generation_tokens_total ?? 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Prompt Tokens Total</span>
                    <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{(siderived.prompt_tokens_total ?? 0).toLocaleString()}</span>
                  </div>
                </div>

                {history && history.length > 2 && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Running Requests History</div>
                    <SparkLine
                      data={history}
                      dataKey={pt => (pt.vllm_metrics || []).find(m => m.id === selectedId)?.derived?.num_requests_running ?? 0}
                      color="#22c55e"
                      height={30}
                      gradientId="vllm-req-running"
                      formatter={v => `Running: ${v?.toFixed(0) ?? 0}`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {showModal && <VllmInstancesModal onClose={() => { setShowModal(false); refreshInstances() }} />}
    </CardWrapper>
  )
}
