import React, { useRef, useCallback } from 'react'

/**
 * ResizableTable — table with draggable column resize handles and column visibility.
 *
 * Props:
 *  columns        - [{key, label, defaultWidth?, render?, align?, className?}]
 *  data           - array of row objects
 *  keyFn          - fn(row, i) => string  (row key)
 *  colSettings    - {key: {visible, width}} from useColumnSettings
 *  onSetWidth     - fn(key, width) from useColumnSettings
 *  emptyMsg       - text when data is empty
 *  rowClassName   - fn(row) => string?
 */
export default function ResizableTable({ columns, data = [], keyFn, colSettings, onSetWidth, emptyMsg = 'No data', rowClassName }) {
  const dragging = useRef(null)

  const visibleCols = columns.filter(col => colSettings?.[col.key]?.visible !== false)

  const onMouseDown = useCallback((colKey, e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = colSettings?.[colKey]?.width ?? 120

    dragging.current = colKey
    const el = e.currentTarget
    el.classList.add('dragging')

    const onMove = (ev) => {
      const delta = ev.clientX - startX
      onSetWidth?.(colKey, Math.max(50, startW + delta))
    }
    const onUp = () => {
      el.classList.remove('dragging')
      dragging.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [colSettings, onSetWidth])

  return (
    <div className="rtable-wrap">
      <table className="rtable">
        <thead>
          <tr>
            {visibleCols.map(col => (
              <th key={col.key} style={{ width: colSettings?.[col.key]?.width ?? col.defaultWidth ?? 120 }}>
                {col.label}
                <div
                  className="col-resize-handle"
                  onMouseDown={(e) => onMouseDown(col.key, e)}
                  title="Drag to resize"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={visibleCols.length} style={{ textAlign: 'center', color: 'var(--muted)', padding: '12px' }}>{emptyMsg}</td></tr>
          ) : data.map((row, i) => (
            <tr key={keyFn ? keyFn(row, i) : i} className={rowClassName ? rowClassName(row) : ''}>
              {visibleCols.map(col => (
                <td key={col.key} className={col.className} style={{ textAlign: col.align }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
