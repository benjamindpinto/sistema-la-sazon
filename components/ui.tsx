'use client'

import { useEffect } from 'react'

export function Modal({
  open,
  titulo,
  subtitulo,
  onClose,
  children,
  ancho = 'max-w-lg',
}: {
  open: boolean
  titulo: string
  subtitulo?: string
  onClose: () => void
  children: React.ReactNode
  ancho?: string
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`card w-full ${ancho} shadow-xl max-h-[92vh] overflow-y-auto rounded-b-none sm:rounded-b-lg`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h2 className="font-display text-[19px] font-semibold text-[var(--ink)]">{titulo}</h2>
            {subtitulo && <p className="text-sm text-[var(--ink-soft)] mt-0.5">{subtitulo}</p>}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-[var(--ink-soft)] hover:text-[var(--ink)] text-xl leading-none px-1">×</button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}

export function Campo({ label, children, ayuda, className = '' }: { label: string; children: React.ReactNode; ayuda?: string; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {ayuda && <p className="text-[11px] text-[var(--ink-soft)] mt-1">{ayuda}</p>}
    </div>
  )
}

export function MensajeError({ error }: { error: string | null | undefined }) {
  if (!error) return null
  return <p className="text-[var(--danger)] text-xs" role="alert">{error}</p>
}

export function Barra({ valor, max, color = 'var(--ember)' }: { valor: number; max: number; color?: string }) {
  const ancho = max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0
  return (
    <div className="barra" role="progressbar" aria-valuenow={valor} aria-valuemax={max}>
      <span style={{ width: `${ancho}%`, background: color }} />
    </div>
  )
}
