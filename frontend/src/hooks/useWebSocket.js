import { useEffect, useRef, useState, useCallback } from 'react'

const STATES = { CONNECTING: 'connecting', CONNECTED: 'connected', DISCONNECTED: 'disconnected' }
const BASE_DELAY = 1000
const MAX_DELAY  = 30000
const HISTORY_MAX = 300

export function useWebSocket(path = '/ws') {
  const [status, setStatus]   = useState(STATES.CONNECTING)
  const [metrics, setMetrics] = useState(null)
  const historyRef = useRef([])
  const wsRef      = useRef(null)
  const delayRef   = useRef(BASE_DELAY)
  const timerRef   = useRef(null)
  const unmounted  = useRef(false)

  const connect = useCallback(() => {
    if (unmounted.current) return
    setStatus(STATES.CONNECTING)
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const url   = `${proto}://${location.host}${path}`
    const ws    = new WebSocket(url)
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

    ws.onclose  = () => {
      if (unmounted.current) return
      setStatus(STATES.DISCONNECTED)
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 2, MAX_DELAY)
        connect()
      }, delayRef.current)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [path])

  useEffect(() => {
    connect()
    return () => {
      unmounted.current = true
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { status, metrics, history: historyRef }
}
