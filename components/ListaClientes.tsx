'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { guardarCliente } from '@/app/actions/clientes'
import { fecha, haceCuanto, pesos } from '@/lib/formato'
import { Barra, Campo, MensajeError, Modal } from '@/components/ui'
import Paginacion from '@/components/Paginacion'
import { usePaginacion } from '@/components/usePaginacion'

export interface ClienteFila {
  id: string
  telefono: string
  nombre: string | null
  direccion_default: string | null
  creado_en: string
  compras: number
  gastado: number
  ultima: string | null
  compras_en_ciclo: number
  compras_necesarias: number
  cupones: number
}

const ORDENES: Record<string, { label: string; fn: (a: ClienteFila, b: ClienteFila) => number }> = {
  recientes: { label: 'Compraron hace poco', fn: (a, b) => (b.ultima ?? '').localeCompare(a.ultima ?? '') },
  compras: { label: 'Más compras', fn: (a, b) => b.compras - a.compras },
  gastado: { label: 'Más gastado', fn: (a, b) => b.gastado - a.gastado },
  premio: { label: 'Cerca del premio', fn: (a, b) => (b.compras_en_ciclo / b.compras_necesarias) - (a.compras_en_ciclo / a.compras_necesarias) },
  dormidos: { label: 'No vuelven hace rato', fn: (a, b) => (a.ultima ?? '9').localeCompare(b.ultima ?? '9') },
}

export default function ListaClientes({ clientes, programaActivo }: { clientes: ClienteFila[]; programaActivo: boolean }) {
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState('recientes')
  const [nuevo, setNuevo] = useState(false)

  const t = busqueda.trim().toLowerCase()
  const digitos = t.replace(/\D/g, '')
  const filtrados = clientes
    .filter(c => !t || (c.nombre ?? '').toLowerCase().includes(t) || (digitos.length >= 3 && c.telefono.replace(/\D/g, '').includes(digitos)))
    .sort(ORDENES[orden].fn)
  const { pagina, setPagina, totalPaginas, itemsPagina } = usePaginacion(filtrados, 25)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }} placeholder="Buscar por nombre o WhatsApp..." className="input flex-1 min-w-[200px]" />
        <select value={orden} onChange={e => { setOrden(e.target.value); setPagina(1) }} className="input w-auto">
          {Object.entries(ORDENES).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
        </select>
        <button onClick={() => setNuevo(true)} className="btn btn-primary">+ Cliente</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Cliente</th>
              <th className="num">Compras</th>
              <th className="num">Gastado</th>
              <th>Última compra</th>
              {programaActivo && <th>Premio</th>}
            </tr>
          </thead>
          <tbody>
            {itemsPagina.map(c => (
              <tr key={c.id}>
                <td>
                  <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">{c.nombre ?? 'Sin nombre'}</Link>
                  <p className="text-[11px] text-[var(--ink-soft)]">{c.telefono}</p>
                </td>
                <td className="num tabular">{c.compras}</td>
                <td className="num tabular">{pesos(c.gastado)}</td>
                <td className="text-xs">
                  {c.ultima ? <>{fecha(c.ultima)} <span className="text-[var(--ink-soft)]">· {haceCuanto(c.ultima)}</span></> : <span className="text-[var(--ink-soft)]">Nunca</span>}
                </td>
                {programaActivo && (
                  <td className="min-w-[170px]">
                    {c.cupones > 0 ? (
                      <span className="chip chip-ok">{c.cupones === 1 ? 'Tiene un cupón' : `Tiene ${c.cupones} cupones`}</span>
                    ) : (
                      <div>
                        <div className="flex justify-between text-[11px] text-[var(--ink-soft)] mb-1">
                          <span>{c.compras_en_ciclo} de {c.compras_necesarias}</span>
                          {c.compras_necesarias - c.compras_en_ciclo === 1 && <span className="text-[var(--ember-dark)] font-semibold">¡le falta 1!</span>}
                        </div>
                        <Barra valor={c.compras_en_ciclo} max={c.compras_necesarias} />
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {itemsPagina.length === 0 && <tr><td colSpan={5} className="text-center sub py-8">No hay clientes que coincidan.</td></tr>}
          </tbody>
        </table>
      </div>
      <Paginacion pagina={pagina} totalPaginas={totalPaginas} onChange={setPagina} />

      {nuevo && <ClienteModal cliente={null} onClose={() => setNuevo(false)} />}
    </div>
  )
}

export function ClienteModal({
  cliente,
  onClose,
}: {
  cliente: { id: string; telefono: string; nombre: string | null; direccion_default: string | null; notas?: string | null } | null
  onClose: () => void
}) {
  const router = useRouter()
  const [f, setF] = useState({
    telefono: cliente?.telefono ?? '',
    nombre: cliente?.nombre ?? '',
    direccion: cliente?.direccion_default ?? '',
    notas: cliente?.notas ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true)
    const r = await guardarCliente({ telefono: f.telefono, nombre: f.nombre || null, direccion_default: f.direccion || null, notas: f.notas || null }, cliente?.id)
    setGuardando(false)
    if (r.error || !r.id) return setError(r.error ?? 'No se pudo guardar.')
    onClose()
    if (cliente) router.refresh()
    else router.push(`/clientes/${r.id}`)
  }

  return (
    <Modal open titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'} onClose={onClose} ancho="max-w-md">
      <div className="space-y-3">
        <Campo label="WhatsApp"><input className="input" value={f.telefono} onChange={e => setF({ ...f, telefono: e.target.value })} inputMode="tel" autoFocus /></Campo>
        <Campo label="Nombre"><input className="input" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} /></Campo>
        <Campo label="Dirección"><input className="input" value={f.direccion} onChange={e => setF({ ...f, direccion: e.target.value })} /></Campo>
        <Campo label="Notas"><input className="input" value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} placeholder="Celíaco, sin cebolla..." /></Campo>
        <MensajeError error={error} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="btn btn-primary">{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </Modal>
  )
}
