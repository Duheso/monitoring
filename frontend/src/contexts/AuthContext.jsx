import React, { createContext, useContext, useEffect, useState } from 'react'
import { API_BASE } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(() => localStorage.getItem('dgx_token') || '')
  const [loading, setLoading] = useState(true)

  // Verify token on mount (handles page refresh)
  useEffect(() => {
    const t = localStorage.getItem('dgx_token')
    if (!t) { setLoading(false); return }
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.username) {
          setUser(d.username)
          setToken(t)
        } else {
          localStorage.removeItem('dgx_token')
          setToken('')
        }
      })
      .catch(() => { localStorage.removeItem('dgx_token'); setToken('') })
      .finally(() => setLoading(false))
  }, []) // only on mount

  // Listen for 401 from any authFetch call
  useEffect(() => {
    const handler = () => { setUser(null); setToken('') }
    window.addEventListener('dgx:auth-expired', handler)
    return () => window.removeEventListener('dgx:auth-expired', handler)
  }, [])

  const login = (username, accessToken) => {
    localStorage.setItem('dgx_token', accessToken)
    setToken(accessToken)
    setUser(username)
  }

  const logout = () => {
    localStorage.removeItem('dgx_token')
    setToken('')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
