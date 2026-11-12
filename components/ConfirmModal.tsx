'use client'

import { useEffect } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="bg-[var(--paper-card)] rounded-lg border border-[var(--paper-line)] p-6 w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirm-modal-title" className="font-display text-[17px] font-semibold text-[var(--ink)]">{title}</h2>
        {description && <p className="text-sm text-[var(--ink-soft)] mt-2">{description}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-[var(--paper)] hover:bg-[var(--paper-line)] text-[var(--ink)] rounded-lg text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
              danger ? 'bg-[var(--danger)] hover:opacity-90' : 'bg-[var(--ink)] hover:bg-[var(--char-raised)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
