import React, { useState, useRef, useEffect } from 'react'
import { Palette, Type, User, LayoutGrid, Plus, Eye, EyeOff, LogOut } from 'lucide-react'

const SINGLETON_CARDS = [
  { id: 'system',    label: 'System Info' },
  { id: 'cpu',       label: 'CPU' },
  { id: 'mem',       label: 'Memory' },
  { id: 'disk',      label: 'Disk' },
  { id: 'network',   label: 'Network' },
  { id: 'gpus',      label: 'GPUs (All)' },
  { id: 'gpuproc',   label: 'GPU Processes' },
  { id: 'processes', label: 'Processes' },
  { id: 'services',  label: 'Services' },
  { id: 'ollamaps',  label: 'Ollama PS' },
]

export default function Toolbar({ themes, fonts, theme, setTheme, font, setFont, authUser, logout, instances, gpus, onAddCard, onToggleCard }) {
  const [showCards, setShowCards] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!showCards) return
    const close = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setShowCards(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showCards])

  const journalCount = instances.filter(x => x.startsWith('journal-')).length

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <Palette size={13} style={{ color: 'var(--muted)' }} />
        <span className="toolbar-label">Theme</span>
        <select value={theme} onChange={e => setTheme(e.target.value)}>
          {themes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="toolbar-group">
        <Type size={13} style={{ color: 'var(--muted)' }} />
        <span className="toolbar-label">Font</span>
        <select value={font} onChange={e => setFont(e.target.value)}>
          {fonts.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="toolbar-group">
        <User size={13} style={{ color: 'var(--accent)' }} />
        <span className="toolbar-label" style={{ color: 'var(--text)', fontWeight: 600 }}>{authUser}</span>
        <button
          className="toolbar-btn"
          onClick={logout}
          title="Sign out"
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}
        >
          <LogOut size={12} /> Sign out
        </button>
      </div>

      {/* Card manager */}
      <div className="toolbar-group" ref={panelRef} style={{ position: 'relative' }}>
        <button
          className="toolbar-btn"
          onClick={() => setShowCards(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, background: showCards ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', color: 'var(--text2)', fontSize: 12 }}
        >
          <LayoutGrid size={12} />
          Cards
        </button>

        {showCards && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300,
            background: '#1e293b', border: '1px solid var(--border)', borderRadius: 8,
            padding: 12, minWidth: 260, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Main Cards</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
              {SINGLETON_CARDS.map(c => {
                const active = instances.includes(c.id)
                return (
                  <button key={c.id}
                    onClick={() => onToggleCard(c.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
                      borderRadius: 5, padding: '5px 8px', cursor: 'pointer',
                      color: active ? 'var(--accent2)' : 'var(--muted)', fontSize: 11,
                    }}
                  >
                    {active ? <Eye size={10} /> : <EyeOff size={10} />}
                    {c.label}
                  </button>
                )
              })}
            </div>

            {/* Journal instances */}
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Journal ({journalCount})</div>
            <button
              onClick={() => { onAddCard('journal'); setShowCards(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 5, padding: '5px 10px', cursor: 'pointer', color: '#22c55e', fontSize: 11, marginBottom: 10 }}
            >
              <Plus size={11} /> Add Journal Card
            </button>

            {/* Individual GPU cards */}
            {gpus.length > 0 && (
              <>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Individual GPU Cards</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {gpus.map(g => {
                    const id = `singlegpu-${g.index}`
                    const active = instances.includes(id)
                    return (
                      <button key={id}
                        onClick={() => onToggleCard(id)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          background: active ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${active ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                          borderRadius: 5, padding: '5px 6px', cursor: 'pointer',
                          color: active ? '#f59e0b' : 'var(--muted)', fontSize: 11,
                        }}
                      >
                        GPU {g.index}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
        Drag cards · Resize edges · ⚙ visibility
      </div>
    </div>
  )
}
