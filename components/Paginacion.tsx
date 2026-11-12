'use client'

interface PaginacionProps {
  pagina: number
  totalPaginas: number
  onChange: (pagina: number) => void
}

export default function Paginacion({ pagina, totalPaginas, onChange }: PaginacionProps) {
  if (totalPaginas <= 1) return null

  return (
    <div className="flex items-center justify-between px-1 py-2">
      <p className="text-xs text-[var(--ink-soft)]">Página {pagina} de {totalPaginas}</p>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(pagina - 1)}
          disabled={pagina <= 1}
          className="px-3 py-1.5 bg-[var(--paper)] hover:bg-[var(--paper-line)] disabled:opacity-40 disabled:hover:bg-[var(--paper)] text-[var(--ink)] rounded-lg text-xs font-medium"
        >
          Anterior
        </button>
        <button
          onClick={() => onChange(pagina + 1)}
          disabled={pagina >= totalPaginas}
          className="px-3 py-1.5 bg-[var(--paper)] hover:bg-[var(--paper-line)] disabled:opacity-40 disabled:hover:bg-[var(--paper)] text-[var(--ink)] rounded-lg text-xs font-medium"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}
