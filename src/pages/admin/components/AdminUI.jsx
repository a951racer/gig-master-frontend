import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

// Shared UI building blocks for the system-admin pages (#53), so the Users and
// Bands pages share a consistent table + detail-shell look in the app's dark
// purple theme.

export const inputCls =
  'bg-[#1e1b2e] border border-purple-800/40 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm'

export const btnPrimary =
  'bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors'

export const btnGhost =
  'text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-purple-900/30 transition-colors'

// Resolve a friendly error message from an axios error.
export function errMsg(err, fallback) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || fallback
}

// A simple entity table. `columns` is [{ key, header, render?, className? }].
// `rowKey(row)` returns a stable key. `onRowClick(row)` makes rows navigable.
export function AdminTable({ columns, rows, rowKey, onRowClick, empty = 'No records' }) {
  return (
    <div className="bg-[#2a2640] border border-purple-800/30 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-purple-900/40">
            {columns.map((c) => (
              <th key={c.key} className={`px-4 py-2.5 font-medium ${c.className || ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-purple-900/20 last:border-0 ${
                  onRowClick ? 'cursor-pointer hover:bg-purple-900/20' : ''
                }`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 text-gray-100 ${c.className || ''}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// Detail-page shell: a back link to the list plus a title, with children
// rendered as sectioned content below.
export function DetailShell({ backTo, backLabel = 'Back', title, subtitle, children }) {
  return (
    <div>
      <Link to={backTo} className="text-sm text-purple-300 hover:text-purple-200">
        ← {backLabel}
      </Link>
      <h1 className="text-2xl font-bold text-white mt-3 mb-1">{title}</h1>
      {subtitle && <p className="text-gray-400 text-sm mb-6">{subtitle}</p>}
      {!subtitle && <div className="mb-6" />}
      {children}
    </div>
  )
}

// A sectioned card used to group a widget (e.g. "Edit details", "Members").
export function Section({ title, children, className = '' }) {
  return (
    <section className={`bg-[#2a2640] border border-purple-800/30 rounded-xl p-5 mb-6 ${className}`}>
      {title && <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>}
      {children}
    </section>
  )
}

// A lightweight modal dialog (used for the Create flows). Closes on Escape and
// backdrop click; focuses the panel for accessibility.
export function Modal({ title, onClose, children }) {
  const panelRef = useRef(null)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md bg-[#2a2640] border border-purple-800/50 rounded-2xl p-6 shadow-2xl focus:outline-none"
      >
        <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}
