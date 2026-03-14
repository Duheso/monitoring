import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { BookOpen, X } from 'lucide-react'
import CardWrapper from './CardWrapper'
import { authFetch, buildTokenUrl } from '../lib/api'

const LINE_OPTS = [100, 200, 500, 1000]

export default function JournalCard({ instanceId = 'default', onClose }) {
  const [services, setServices]   = useState([])
  const [selected, setSelected]   = useState(() => localStorage.getItem(`dgx_journal_svc_${instanceId}`) || '')
  const [maxLines, setMaxLines]   = useState(() => parseInt(localStorage.getItem(`dgx_journal_max_${instanceId}`) || '100', 10))
  const [lines, setLines]         = useState([])
  const [follow, setFollow]       = useState(true)
  const [paused, setPaused]       = useState(false)
  const [filter, setFilter]       = useState(() => localStorage.getItem(`dgx_journal_filter_${instanceId}`) || '')

  // Use refs to avoid stale closures in SSE handler
  const pausedRef  = useRef(paused)
  const maxLinesRef = useRef(maxLines)
  useEffect(() => { pausedRef.current = paused },   [paused])
  useEffect(() => { maxLinesRef.current = maxLines }, [maxLines])

  const evtRef  = useRef(null)
  const bodyRef = useRef(null)

  // ── Service list — load once + refresh every 10 s ──────────────────────────
  const loadServices = useCallback(() => {
    authFetch('/api/services')
      .then(r => r.ok ? r.json() : { services: [] })
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
  useEffect(() => { localStorage.setItem(`dgx_journal_filter_${instanceId}`, filter) }, [filter, instanceId])

  // ── SSE subscription — restarts when service or maxLines changes ──────────
  useEffect(() => {
    if (evtRef.current) { evtRef.current.close(); evtRef.current = null }
    if (!selected) return
    setLines([])

    const url = buildTokenUrl(`/api/journal/${encodeURIComponent(selected)}?lines=${maxLines}&follow=true`)
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

  const escapeRegExp = (value) => value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

  const filterPattern = filter ? escapeRegExp(filter) : ''
  const highlightMatches = (text) => {
    if (!filterPattern) return text
    const regex = new RegExp(filterPattern, 'gi')
    const nodes = []
    let lastIndex = 0
    let match
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
      nodes.push(<span key={`${text}-${match.index}`} className="journal-highlight">{match[0]}</span>)
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
    return nodes.length ? nodes : text
  }

  const filteredLines = filterPattern
    ? lines.filter(l => new RegExp(filterPattern, 'i').test(l))
    : lines

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
        <div className="journal-control-row">
          <div className="journal-service-select">
            <select className="journal-service-select-input" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— select service —</option>
              {services.map(svc => (
                <option key={svc.name} value={svc.name}>
                  {svc.name} ({svc.sub_state ?? svc.status})
                </option>
              ))}
            </select>
            <button className="journal-refresh-btn" onClick={loadServices} title="Refresh service list">↻</button>
          </div>
          <div className="journal-filter-group">
            <input
              className="journal-filter-input"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter logs (e.g. service, IP, status)"
            />
            {filter && (
              <button className="journal-filter-clear" onClick={() => setFilter('')}>✕</button>
            )}
          </div>
        </div>

        {/* Log area */}
        <div
          ref={bodyRef}
          onScroll={e => {
            const el = e.currentTarget
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
            if (!atBottom && follow) setFollow(false)
            if (atBottom && !follow) setFollow(true)
          }}
          className="journal-log"
        >
          {filteredLines.length === 0 ? (
            <span style={{ color: 'var(--muted)' }}>
              {selected ? 'Awaiting logs…' : 'Select a service above'}
            </span>
          ) : (
            filteredLines.map((l, i) => {
              const logMatch = l.match(/^(\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2}\.\d+)\s+(\S+)\s+(\S+)\[(\d+)\]:\s*([A-Z]+):\s*(.*)$/)
              if (logMatch) {
                const [, ts, host, svc, pid, level, msg] = logMatch
                return (
                  <div key={`${i}-${svc}`} className="journal-log-line">
                    <span className="journal-log-ts">{highlightMatches(ts)}</span>
                    <span className="journal-log-host">{highlightMatches(host)}</span>
                    <span className="journal-service">{highlightMatches(svc)}</span>
                    <span className="journal-pid">[{highlightMatches(pid)}]</span>
                    <span className="journal-level" style={{ color: levelColor(level) }}>{highlightMatches(level)}</span>
                    <span className="journal-msg">{highlightMatches(msg)}</span>
                  </div>
                )
              }
              return (
                <div key={i} className="journal-log-line">
                  <span className="journal-msg">{highlightMatches(l)}</span>
                </div>
              )
            })
          )}
        </div>

        {/* Status bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
          <span>{filteredLines.length} line{filteredLines.length !== 1 ? 's' : ''}</span>
          <span style={{ color: paused ? '#f59e0b' : follow ? 'var(--accent)' : 'var(--muted)' }}>
            {paused ? '⏸ paused' : follow ? '⬇ following' : '↕ scrolled'}
          </span>
        </div>
      </div>
    </CardWrapper>
  )
}
