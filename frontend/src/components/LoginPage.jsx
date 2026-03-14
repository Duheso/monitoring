import React, { useState } from 'react'
import { Activity, Lock, User, Loader2, AlertCircle } from 'lucide-react'
import { API_BASE } from '../lib/api'

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (res.ok) {
        onLogin(data.username, data.access_token)
      } else {
        setError(data.detail || 'Invalid credentials')
      }
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <Activity size={36} strokeWidth={1.5} />
        </div>
        <h1 className="login-title">DGX Monitor</h1>
        <p className="login-sub">Sign in with your server credentials</p>

        <form className="login-form" onSubmit={handleSubmit} autoComplete="on">
          <div className="login-field">
            <User size={14} className="login-field-icon" />
            <input
              className="login-input"
              type="text"
              name="username"
              autoComplete="username"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <Lock size={14} className="login-field-icon" />
            <input
              className="login-input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="login-error">
              <AlertCircle size={13} />
              <span>{error}</span>
            </div>
          )}

          <button className="login-btn" type="submit" disabled={loading || !username.trim() || !password}>
            {loading ? <Loader2 size={15} className="spin" /> : <Lock size={15} />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="login-hint">Linux system account required</p>
      </div>
    </div>
  )
}
