import React, { useState, useRef, useEffect } from 'react'
import { Settings } from 'lucide-react'

/**
 * CardWrapper — professional card container.
 * Props:
 *  title, icon, children, extra
 *  columns       - [{key, label, isHeader?}]
 *  colSettings   - {key: {visible}}
 *  onToggleCol   - fn(key)
 *  columnGroups  - [{label, keys}]  optional grouping in dropdown
 */
export default function CardWrapper({ title, icon, children, columns, colSettings, onToggleCol, extra, columnGroups }) {
  const [open, setOpen] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const hasSettings = columns && columns.filter(c => !c.isHeader).length > 0

  const renderRows = (cols) =>
    cols.map(col => (
      <label key={col.key} className="col-row">
        <input
          type="checkbox"
          checked={colSettings?.[col.key]?.visible !== false}
          onChange={() => onToggleCol?.(col.key)}
        />
        {col.label}
      </label>
    ))

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-drag">
          {icon && <span className="card-icon">{icon}</span>}
          <span className="card-title">{title}</span>
        </div>
        {extra}
        {hasSettings && (
          <div className="card-settings-wrap" ref={dropRef}>
            <button className="icon-btn" onClick={() => setOpen(v => !v)} title="Toggle visibility">
              <Settings size={13} />
            </button>
            {open && (
              <div className="card-settings-drop">
                {columnGroups ? (
                  columnGroups.map(group => {
                    const groupCols = columns.filter(c => group.keys.includes(c.key))
                    return (
                      <React.Fragment key={group.label}>
                        <div className="card-settings-title">{group.label}</div>
                        {renderRows(groupCols)}
                      </React.Fragment>
                    )
                  })
                ) : (
                  <>
                    <div className="card-settings-title">Visibility</div>
                    {renderRows(columns.filter(c => !c.isHeader))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="card-body">{children}</div>
    </div>
  )
}
