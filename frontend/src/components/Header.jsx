import React, { useState, useEffect } from 'react'
import { Activity, PanelTopClose, PanelTopOpen } from 'lucide-react'
import Toolbar from './Toolbar'

export default function Header({ status, toolbarProps }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('dgx_header_collapsed') === 'true')

  useEffect(() => {
    localStorage.setItem('dgx_header_collapsed', collapsed)
  }, [collapsed])

  const labels = { connected: 'Connected', connecting: 'Connecting…', disconnected: 'Disconnected' }

  return (
    <>
      <div className={`app-header-wrapper${collapsed ? ' collapsed' : ''}`}>
        <header className="app-header">
          <div className="header-left">
            <div className="logo">
              <Activity size={18} />
              DGX Monitor
            </div>
            {toolbarProps && (
              <div className="header-toolbar">
                <Toolbar {...toolbarProps} />
              </div>
            )}
          </div>
          <div className="header-right">
            <div className="conn-badge">
              <div className={`conn-dot ${status}`} />
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>{labels[status] ?? status}</span>
            </div>
          </div>
        </header>
      </div>
      <button
        className={`header-toggle-btn${collapsed ? ' header-toggle-btn--collapsed' : ''}`}
        onClick={() => setCollapsed(v => !v)}
        title={collapsed ? 'Show header' : 'Hide header'}
      >
        {collapsed ? <PanelTopOpen size={14} /> : <PanelTopClose size={14} />}
      </button>
    </>
  )
}
