import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { BookOpen, X } from 'lucide-react'
import CardWrapper from './CardWrapper'

const API = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.host.replace(/:\d+$/, '')}:3001`

const LINE_OPTS = [100, 200, 500, 1000]

export default function JournalCard({ instanceId = 'default', onClose }) {
  const [services, setServices]   = useState([])
  const [selected, setSelected]   = useState(() => localStorage.getItem(`dgx_journal_svc_${instanceId}`) || '')
  const [maxLines, setMaxLines]   = useState(() => parseInt(localStorage.getItem(`dgx_journal_max_${instanceId}`) || '100', 10))
  const [lines, setLines]         = useState([])
  const [follow, setFollow]       = useState(true)
  const [paused, setPaused]       = useState(false)

  // Use refs to avoid stale closures in SSE handler
  const pausedRef  = useRef(paused)
  const maxLinesRef = useRef(maxLines)
  useEffect(() => { pausedRef.current = paused },   [paused])
  useEffect(() => { maxLinesRef.current = maxLines }, [maxLines])

  const evtRef  = useRef(null)
  const bodyRef = useRef(null)

  // ── Service list — load once + refresh every 10 s ──────────────────────────
  const loadServices = useCallback(() => {
    fetch(`${API}/api/services`)
      .then(r => r.json())
      .then(d => setServices(d.services ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadServices()
    const id = setInterval(loadServices, 10000)
    return () => clearInterval(id)
  }, [loadServices])

  // Persist selection & maxLines
  useEffect(() => { localStorage.setItem(`dgx_journal_svc_${instanceId}`, selected) }, [selected, instanceId])
  useEffect(() => { localStorage.setItem(`dgx_journal_max_${instanceId}`, String(maxLines)) }, [maxLines, instanceId])

  // ── SSE subscription — restarts when service or maxLines changes ──────────
  useEffect(() => {
    if (evtRef.current) { evtRef.current.close(); evtRef.current = null }
    if (!selected) return
    setLines([])

    const url = `${API}/api/journal/${encodeURIComponent(selected)}?lines=${maxLines}&follow=true`
    const es = new EventSource(url)
    evtRef.current = es

    // Backend sends plain `data: {...}\n\n` (message events, NOT named events)
    es.onmessage = (e) => {
      if (pausedRef.current) return
      try {
        const obj = JSON.parse(e.data)
        if (obj.keepalive || !obj.line) return
        const text = obj.line
        setLines(prev => {
          const next = [...prev, text]
          const cap  = maxLinesRef.current
          return next.length > cap ? next.slice(next.length - cap) : next
        })
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => {
      // EventSource will auto-reconnect; nothing to do
    }

    return () => { es.close(); evtRef.current = null }
  }, [selected, maxLines])  // restart when either changes

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (follow && !paused && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [lines, follow, paused])

  const levelColor = (line) => {
    if (/\berror\b|failed|fail\b/i.test(line))    return '#ef4444'
    if (/\bwarn(ing)?\b/i.test(line))              return '#f59e0b'
    if (/\bstart(ed|ing)?\b|active|success/i.test(line)) return '#22c55e'
    return 'var(--text2)'
  }

  const btnStyle = (active, activeColor = 'var(--accent)', activeBg = 'rgba(59,130,246,0.12)') => ({
    padding: '2px 7px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
    border: `1px solid ${active ? (activeColor + '66') : 'var(--border)'}`,
    background: active ? activeBg : 'rgba(255,255,255,0.03)',
    color: active ? activeColor : 'var(--muted)',
  })

  const extraActions = (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {/* Lines selector */}
      <select value={maxLines} onChange={e => setMaxLines(Number(e.target.value))}
        title="Max lines to display"
        style={{ fontSize: 10, padding: '2px 4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted)', cursor: 'pointer' }}>
        {LINE_OPTS.map(n => <option key={n} value={n}>{n} lines</option>)}
      </select>

      <button onClick={() => setFollow(f => !f)} title={follow ? 'Disable follow' : 'Enable follow'} style={btnStyle(follow)}>
        {follow ? '⬇ Follow' : 'Follow'}
      </button>

      <button onClick={() => setPaused(p => !p)} title={paused ? 'Resume' : 'Pause'}
        style={btnStyle(paused, '#f59e0b', 'rgba(245,158,11,0.12)')}>
        {paused ? '▶ Resume' : '⏸ Pause'}
      </button>

      <button onClick={() => setLines([])} title="Clear log"
        style={btnStyle(false)}>
        Clear
      </button>

      {onClose && (
        <button onClick={onClose} title="Close"
          style={{ ...btnStyle(false), border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 6px' }}>
          <X size={12} />
        </button>
      )}
    </div>
  )

  return (
    <CardWrapper
      title={`Journal${selected ? ': ' + selected : ''}`}
      icon={<BookOpen size={14} />}
      extra={extraActions}
    >
      <div className="journal-body">
        {/* Service selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <select value={selected} onChange={e => setSelected(e.target.value)}
            style={{ flex: 1, fontSize: 12, padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text1)', outline: 'none' }}>
            <option value="">— select service —</option>
            {services.map(svc => (
              <option key={svc.name} value={svc.name}>
                {svc.name} ({svc.sub_state ?? svc.status})
              </option>
            ))}
          </select>
          <button onClick={loadServices} title="Refresh service list"
            style={{ padding: '4px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: 'var(--muted)' }}>
            ↻
          </button>
        </div>

        {/* Log area */}
        <div
          ref={bodyRef}
          onScroll={e => {
            // If user scrolled up manually, disable follow
            const el = e.currentTarget
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
            if (!atBottom && follow) setFollow(false)
            if (atBottom && !follow) setFollow(true)
          }}
          className="journal-log"
        >
        {lines.length === 0 ? (
          <span style={{ color: 'var(--muted)' }}>
            {selected ? 'Connecting…' : 'Select a service above'}
          </span>
        ) : (
          lines.map((l, i) => (
            <div key={i} style={{ color: levelColor(l), wordBreak: 'break-all', userSelect: 'text' }}>{l}</div>
          ))
        )}
      </div>

        {/* Status bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
        <span>{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
        <span style={{ color: paused ? '#f59e0b' : follow ? 'var(--accent)' : 'var(--muted)' }}>
          {paused ? '⏸ paused' : follow ? '⬇ following' : '↕ scrolled'}
        </span>
      </div>
      </div>
    </CardWrapper>
  )
}
