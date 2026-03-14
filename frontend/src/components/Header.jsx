import React from 'react'
import { Activity } from 'lucide-react'
import Toolbar from './Toolbar'

export default function Header({ status, toolbarProps }) {
  const labels = { connected: 'Connected', connecting: 'Connecting…', disconnected: 'Disconnected' }
  return (
    <header className="app-header">
      <div className="header-top-row">
        <div className="logo">
          <Activity size={18} />
          DGX Monitor
        </div>
        <div className="conn-badge">
          <div className={`conn-dot ${status}`} />
          <span style={{ color: 'var(--muted)', fontSize: 11 }}>{labels[status] ?? status}</span>
        </div>
      </div>
      {toolbarProps && (
        <div className="header-toolbar">
          <Toolbar {...toolbarProps} />
        </div>
      )}
    </header>
  )
}
