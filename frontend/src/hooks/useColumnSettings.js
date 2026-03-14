import { useState, useCallback } from 'react'

/**
 * Manages per-card column visibility and widths, persisted to localStorage.
 *
 * @param {string} cardId   - unique key for this card
 * @param {Array}  columns  - [{ key, label, defaultWidth?, defaultVisible? }]
 */
export function useColumnSettings(cardId, columns) {
  const storageKey = `dgx_cols_${cardId}`

  const load = () => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : null
    } catch (_) {
      return null
    }
  }

  const [settings, setSettings] = useState(() => {
    const saved = load()
    return columns.reduce((acc, col) => {
      acc[col.key] = {
        visible: saved?.[col.key]?.visible ?? (col.defaultVisible !== false),
        width:   saved?.[col.key]?.width   ?? (col.defaultWidth   ?? 120),
      }
      return acc
    }, {})
  })

  const save = (next) => {
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch (_) {}
  }

  const toggleVisible = useCallback((key) => {
    setSettings(prev => {
      const next = { ...prev, [key]: { ...prev[key], visible: !prev[key].visible } }
      save(next)
      return next
    })
  }, [])

  const setWidth = useCallback((key, width) => {
    setSettings(prev => {
      const next = { ...prev, [key]: { ...prev[key], width } }
      save(next)
      return next
    })
  }, [])

  const visibleColumns = columns.filter(col => settings[col.key]?.visible !== false)

  return { settings, toggleVisible, setWidth, visibleColumns }
}
