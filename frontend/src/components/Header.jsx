import React from 'react'
import { Activity } from 'lucide-react'
import Toolbar from './Toolbar'

export default function Header({ status, toolbarProps }) {
  const labels = { connected: 'Connected', connecting: 'Connecting…', disconnected: 'Disconnected' }
  return (
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
      <div className="conn-badge">
        <div className={`conn-dot ${status}`} />
        <span style={{ color: 'var(--muted)', fontSize: 11 }}>{labels[status] ?? status}</span>
      </div>
    </header>
  )
}
