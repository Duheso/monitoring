/**
 * Authenticated fetch + WebSocket URL utilities.
 * All components should use authFetch instead of bare fetch() for API calls.
 */

export const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : `${window.location.protocol}//${window.location.host.replace(/:\d+$/, '')}:3001`

export const getToken = () => localStorage.getItem('dgx_token') || ''

/** fetch() wrapper that attaches the Bearer token and handles 401 globally. */
export const authFetch = async (path, options = {}) => {
  const token = getToken()
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem('dgx_token')
    window.dispatchEvent(new CustomEvent('dgx:auth-expired'))
  }
  return res
}

/** Build a URL with the token in the query string (for SSE / WebSocket). */
export const buildTokenUrl = (path) => {
  const token = getToken()
  const sep = path.includes('?') ? '&' : '?'
  return `${API_BASE}${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`
}

/** Build a ws:// / wss:// URL for the WebSocket (same host as API, token in QS). */
export const buildWsUrl = (path) => {
  const token = getToken()
  const host  = API_BASE.replace(/^https?:\/\//, '')
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const sep   = path.includes('?') ? '&' : '?'
  return `${proto}://${host}${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`
}
