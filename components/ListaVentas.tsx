'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cambiarEstadoVenta } from '@/app/actions/ventas'
import { CANALES, ESTADO_COLOR, ESTADO_LABEL, ESTADOS_VENTA, MEDIOS_PAGO, MODALIDADES, labelTamano } from '@/lib/catalogo'
import { fechaHora, pesos } from '@/lib/formato'
import ConfirmModal from '@/components/ConfirmModal'

export interface VentaFila {
  id: string
  numero: number
  estado: string
  canal: string
  modalidad: string
  medio_pago: string
  subtotal: number
  descuento: number
  total: number
  notas: string | null
  direccion_entrega: string | null
  creado_en: string
  cliente_id: string | null
  cliente_nombre: string | null
  cliente_telefono: string | null
  cupon_codigo: string | null
  costo: number
  items: { nombre: string; categoria: string; tamano: string; cantidad: number; precio: number; regalo: boolean }[]
}

export default function ListaVentas({
  ventas: inicial,
  pagina,
  totalPaginas,
  filtros,
}: {
  ventas: VentaFila[]
  pagina: number
  totalPaginas: number
  filtros: { estado: string; q: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  // estados cambiados acá mientras llega la lista actualizada del servidor
  const [cambios, setCambios] = useState<Record<string, string>>({})
  const ventas = inicial.map(v => (cambios[v.id] ? { ...v, estado: cambios[v.id] } : v))
  const [abierta, setAbierta] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState(filtros.q)
  const [aviso, setAviso] = useState<string | null>(null)
  const [aCancelar, setACancelar] = useState<VentaFila | null>(null)

  function irA(cambios: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    if (!('pagina' in cambios)) p.delete('pagina')
    router.push(`${pathname}?${p.toString()}`)
  }

  // búsqueda con retraso
  useEffect(() => {
    if (busqueda === filtros.q) return
    const t = setTimeout(() => irA({ q: busqueda.trim() }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  async function cambiarEstado(v: VentaFila, nuevo: string) {
    setGuardando(v.id)
    setAviso(null)
    const r = await cambiarEstadoVenta(v.id, nuevo)
    setGuardando(null)
    if (r.error) {
      setAviso(r.error)
      return
    }
    setCambios(prev => ({ ...prev, [v.id]: nuevo }))
    if (r.aviso) setAviso(r.aviso)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por cliente, WhatsApp o número de venta..."
          className="input flex-1 min-w-[220px]"
        />
        <select value={filtros.estado} onChange={e => irA({ estado: e.target.value })} className="input w-auto">
          <option value="">Todos los estados</option>
          {ESTADOS_VENTA.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
        </select>
      </div>

      {aviso && (
        <div className="card px-4 py-2.5 text-sm bg-[var(--info-bg)] border-[var(--info)]/30 text-[var(--info)] flex justify-between gap-3">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso">×</button>
        </div>
      )}

      <div className="card overflow-hidden">
        {ventas.length === 0 ? (
          <p className="px-6 py-10 text-center sub">No hay ventas con estos filtros.</p>
        ) : (
          <ul className="divide-y divide-[var(--paper-line)]">
            {ventas.map(v => {
              const resumen = v.items.filter(i => !i.regalo).map(i => `${i.cantidad}× ${i.nombre} ${labelTamano(i.categoria, i.tamano).toLowerCase()}`).join(', ')
              const margen = v.total > 0 ? Math.round(((v.total - v.costo) / v.total) * 100) : null
              return (
                <li key={v.id} className={v.estado === 'cancelado' ? 'opacity-60' : ''}>
                  <div className="px-4 md:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button onClick={() => setAbierta(abierta === v.id ? null : v.id)} className="flex-1 min-w-[220px] text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[var(--ink-soft)] tabular">#{v.numero}</span>
                        <span className="text-sm font-semibold">{v.cliente_nombre ?? (v.cliente_telefono || 'Consumidor final')}</span>
                        <span className="text-xs text-[var(--ink-soft)]">· {fechaHora(v.creado_en)} · {CANALES[v.canal] ?? v.canal} · {MODALIDADES[v.modalidad] ?? v.modalidad}</span>
                        {v.cupon_codigo && <span className="chip chip-ok">Cupón</span>}
                      </div>
                      <p className="text-xs text-[var(--ink-soft)] mt-0.5 line-clamp-1">{resumen}</p>
                    </button>
                    <span className="text-sm font-semibold tabular w-24 text-right">{pesos(v.total)}</span>
                    <select
                      value={v.estado}
                      disabled={guardando === v.id}
                      onChange={e => (e.target.value === 'cancelado' ? setACancelar(v) : cambiarEstado(v, e.target.value))}
                      className={`chip ${ESTADO_COLOR[v.estado]} border-0 cursor-pointer pr-1`}
                      aria-label="Estado de la venta"
                    >
                      {ESTADOS_VENTA.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                    </select>
                  </div>

                  {abierta === v.id && (
                    <div className="px-4 md:px-5 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--paper)]/60">
                      <ul className="space-y-1 pt-3">
                        {v.items.map((it, i) => (
                          <li key={i} className="text-sm flex justify-between gap-3">
                            <span>
                              {it.cantidad}× {it.nombre} <span className="text-[var(--ink-soft)]">({labelTamano(it.categoria, it.tamano)})</span>
                              {it.regalo && <span className="chip chip-ok ml-1.5">Regalo</span>}
                            </span>
                            <span className="tabular text-[var(--ink-soft)]">{pesos(it.precio * it.cantidad)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="text-sm space-y-1 pt-3">
                        <Dato label="Cliente">
                          {v.cliente_id ? <Link href={`/clientes/${v.cliente_id}`} className="link">{v.cliente_nombre ?? v.cliente_telefono}</Link> : 'Consumidor final'}
                        </Dato>
                        <Dato label="Pago">{MEDIOS_PAGO[v.medio_pago] ?? v.medio_pago}</Dato>
                        {v.direccion_entrega && <Dato label="Dirección">{v.direccion_entrega}</Dato>}
                        {v.notas && <Dato label="Notas">{v.notas}</Dato>}
                        {v.descuento > 0 && <Dato label={`Cupón ${v.cupon_codigo ?? ''}`}>−{pesos(v.descuento)}</Dato>}
                        <Dato label="Costo de mercadería">{pesos(v.costo)}{margen != null ? ` · margen ${margen}%` : ''}</Dato>
                        <p className="flex justify-between pt-2 border-t border-[var(--paper-line)] font-semibold">
                          <span>Total</span><span className="tabular">{pesos(v.total)}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--ink-soft)]">Página {pagina} de {totalPaginas}</p>
          <div className="flex gap-2">
            <button className="btn btn-sm" disabled={pagina <= 1} onClick={() => irA({ pagina: String(pagina - 1) })}>Anterior</button>
            <button className="btn btn-sm" disabled={pagina >= totalPaginas} onClick={() => irA({ pagina: String(pagina + 1) })}>Siguiente</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!aCancelar}
        title={`¿Cancelar la venta #${aCancelar?.numero}?`}
        description="Los insumos vuelven al stock. Si usó un cupón, el cupón vuelve a quedar disponible; si con esta venta ganó un premio que todavía no usó, se anula."
        confirmLabel="Cancelar venta"
        cancelLabel="Volver"
        danger
        onCancel={() => setACancelar(null)}
        onConfirm={() => {
          const v = aCancelar
          setACancelar(null)
          if (v) cambiarEstado(v, 'cancelado')
        }}
      />
    </div>
  )
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="flex justify-between gap-4">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className="text-right">{children}</span>
    </p>
  )
}
