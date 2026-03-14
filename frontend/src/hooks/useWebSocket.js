import { useEffect, useRef, useState, useCallback } from 'react'

const STATES = { CONNECTING: 'connecting', CONNECTED: 'connected', DISCONNECTED: 'disconnected' }
const BASE_DELAY = 1000
const MAX_DELAY  = 30000
const HISTORY_MAX = 300

/**
 * @param {string} url  Full ws:// URL (may include ?token=...) OR a path like '/ws'.
 *                       Pass null/'' to stay disconnected.
 */
export function useWebSocket(url = '/ws') {
  const [status, setStatus]   = useState(STATES.CONNECTING)
  const [metrics, setMetrics] = useState(null)
  const historyRef = useRef([])
  const wsRef      = useRef(null)
  const delayRef   = useRef(BASE_DELAY)
  const timerRef   = useRef(null)
  const unmounted  = useRef(false)

  const connect = useCallback(() => {
    if (unmounted.current || !url) return
    setStatus(STATES.CONNECTING)
    // Accept full ws:// URL or a bare path
    const fullUrl = url.startsWith('ws') ? url
      : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${url}`
    const ws = new WebSocket(fullUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return }
      delayRef.current = BASE_DELAY
      setStatus(STATES.CONNECTED)
    }

    ws.onmessage = (ev) => {
      if (unmounted.current) return
      try {
        const data = JSON.parse(ev.data)
        setMetrics(data)
        historyRef.current = [...historyRef.current.slice(-(HISTORY_MAX - 1)), data]
      } catch (_) {}
    }

    ws.onclose = (ev) => {
      if (unmounted.current) return
      // Code 4001 = auth rejected — do not reconnect
      if (ev.code === 4001) {
        setStatus(STATES.DISCONNECTED)
        window.dispatchEvent(new CustomEvent('dgx:auth-expired'))
        return
      }
      setStatus(STATES.DISCONNECTED)
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 2, MAX_DELAY)
        connect()
      }, delayRef.current)
    }

    ws.onerror = () => { ws.close() }
  }, [url])

  useEffect(() => {
    unmounted.current = false
    delayRef.current  = BASE_DELAY
    connect()
    return () => {
      unmounted.current = true
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { status, metrics, history: historyRef }
}
