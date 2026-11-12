'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const OPCIONES = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: 'mes', label: 'Este mes' },
]

export default function PeriodoSelector({ porDefecto = 'hoy' }: { porDefecto?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const actual = params.get('periodo') ?? porDefecto

  function elegir(valor: string) {
    const p = new URLSearchParams(params.toString())
    p.set('periodo', valor)
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <div className="flex gap-1 bg-[var(--paper-card)] border border-[var(--paper-line)] rounded-lg p-1">
      {OPCIONES.map(o => (
        <button
          key={o.value}
          onClick={() => elegir(o.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            actual === o.value ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--paper)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
