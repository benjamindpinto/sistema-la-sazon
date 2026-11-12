'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { guardarReceta } from '@/app/actions/menu'
import { labelTamano, precioDe, tamanosDe, type Tamano } from '@/lib/catalogo'
import { cantidad, num, pesos, plural } from '@/lib/formato'
import { MensajeError } from '@/components/ui'
import { ProductoModal, colorMargen } from '@/components/TablaMenu'

export interface ProductoReceta {
  id: string
  categoria: string
  nombre: string
  descripcion: string | null
  precio_simple: number
  precio_doble: number | null
  precio_triple: number | null
  activo: boolean
}

export interface InsumoReceta {
  id: string
  nombre: string
  categoria: string
  unidad: string
  costo_unitario: number
  stock_actual: number
  activo: boolean
}

export interface LineaReceta {
  insumo_id: string
  cant_simple: number
  cant_doble: number
  cant_triple: number
}

type LineaForm = { insumo_id: string } & Record<Tamano, string>

const aForm = (l: LineaReceta): LineaForm => ({
  insumo_id: l.insumo_id,
  simple: l.cant_simple ? String(l.cant_simple) : '',
  doble: l.cant_doble ? String(l.cant_doble) : '',
  triple: l.cant_triple ? String(l.cant_triple) : '',
})

const n = (v: string) => Number(v.replace(',', '.')) || 0

export default function EditorReceta({
  producto,
  inicial,
  insumos,
  otros,
}: {
  producto: ProductoReceta
  inicial: LineaReceta[]
  insumos: InsumoReceta[]
  otros: { id: string; nombre: string; categoria: string; receta: LineaReceta[] }[]
}) {
  const router = useRouter()
  const [lineas, setLineas] = useState<LineaForm[]>(() => (inicial.length ? inicial.map(aForm) : [{ insumo_id: '', simple: '', doble: '', triple: '' }]))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [editandoProducto, setEditandoProducto] = useState(false)
  const [copiarDe, setCopiarDe] = useState('')

  const porId = useMemo(() => new Map(insumos.map(i => [i.id, i])), [insumos])
  const tamanos = tamanosDe(producto.categoria).filter(t => precioDe(producto, t) != null)
  const usados = new Set(lineas.map(l => l.insumo_id))

  function cambiar(idx: number, cambios: Partial<LineaForm>) {
    setOk(false)
    setLineas(prev => prev.map((l, i) => (i === idx ? { ...l, ...cambios } : l)))
  }

  function copiar() {
    const o = otros.find(x => x.id === copiarDe)
    if (!o) return
    setLineas(o.receta.map(aForm))
    setOk(false)
    setCopiarDe('')
  }

  // Si la doble/triple están vacías, propone multiplicar lo de la simple (carne, cheddar)
  function completarTamanos() {
    setLineas(prev => prev.map(l => {
      const s = n(l.simple)
      if (!s) return l
      return { ...l, doble: l.doble || (tamanos.includes('doble') ? String(s * 2) : ''), triple: l.triple || (tamanos.includes('triple') ? String(s * 3) : '') }
    }))
  }

  const costos = Object.fromEntries(tamanos.map(t => [t, lineas.reduce((acc, l) => acc + n(l[t]) * (porId.get(l.insumo_id)?.costo_unitario ?? 0), 0)])) as Record<Tamano, number>

  async function guardar() {
    setError(null)
    setGuardando(true)
    const r = await guardarReceta(producto.id, lineas.filter(l => l.insumo_id).map(l => ({
      insumo_id: l.insumo_id, cant_simple: n(l.simple), cant_doble: n(l.doble), cant_triple: n(l.triple),
    })))
    setGuardando(false)
    if (r.error) return setError(r.error)
    setOk(true)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tamanos.map(t => {
          const precio = precioDe(producto, t) ?? 0
          const costo = costos[t]
          const margen = precio > 0 ? ((precio - costo) / precio) * 100 : 0
          const sugerido = costo / 0.3
          return (
            <div key={t} className="card p-5">
              <p className="eyebrow mb-1">{labelTamano(producto.categoria, t)}</p>
              <p className="font-display text-[26px] font-semibold tabular">{pesos(precio)}</p>
              <div className="text-sm mt-1 space-y-0.5">
                <p className="flex justify-between"><span className="text-[var(--ink-soft)]">Costo de receta</span><span className="tabular">{pesos(costo)}</span></p>
                <p className="flex justify-between"><span className="text-[var(--ink-soft)]">Ganancia bruta</span><span className="tabular">{pesos(precio - costo)}</span></p>
                <p className="flex justify-between"><span className="text-[var(--ink-soft)]">Margen</span><span className={`tabular font-semibold ${colorMargen(margen)}`}>{num(margen, 0)}%</span></p>
                {costo > 0 && margen < 65 && (
                  <p className="text-[11px] text-[var(--ink-soft)] pt-1">Para un costo del 30% debería valer {pesos(Math.ceil(sugerido / 100) * 100)}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="h2">Receta</h2>
            <p className="text-xs text-[var(--ink-soft)] mt-0.5">Cuánto lleva de cada insumo, en su unidad de uso. Es lo que se descuenta del stock con cada venta.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setEditandoProducto(true)} className="btn btn-sm">Editar precios</button>
            {otros.length > 0 && (
              <div className="flex gap-1">
                <select className="input input-sm w-auto" value={copiarDe} onChange={e => setCopiarDe(e.target.value)}>
                  <option value="">Copiar receta de...</option>
                  {otros.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
                <button onClick={copiar} disabled={!copiarDe} className="btn btn-sm">Copiar</button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr>
                <th>Insumo</th>
                {tamanos.map(t => <th key={t}>{labelTamano(producto.categoria, t)}</th>)}
                <th className="num">Costo {labelTamano(producto.categoria, tamanos[tamanos.length - 1] ?? 'simple').toLowerCase()}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, idx) => {
                const ins = porId.get(l.insumo_id)
                const ultimo = tamanos[tamanos.length - 1] ?? 'simple'
                return (
                  <tr key={idx}>
                    <td className="min-w-[200px]">
                      <select className="input input-sm" value={l.insumo_id} onChange={e => cambiar(idx, { insumo_id: e.target.value })}>
                        <option value="">Elegir insumo...</option>
                        {insumos.filter(i => i.activo || i.id === l.insumo_id).map(i => (
                          <option key={i.id} value={i.id} disabled={usados.has(i.id) && i.id !== l.insumo_id}>{i.nombre} ({i.unidad})</option>
                        ))}
                      </select>
                    </td>
                    {tamanos.map(t => (
                      <td key={t}>
                        <div className="flex items-center gap-1">
                          <input className="input input-sm w-20" inputMode="decimal" value={l[t]} onChange={e => cambiar(idx, { [t]: e.target.value })} placeholder="0" />
                          <span className="text-[11px] text-[var(--ink-soft)] whitespace-nowrap">{ins ? plural(ins.unidad, n(l[t]) || 2) : ''}</span>
                        </div>
                      </td>
                    ))}
                    <td className="num tabular text-xs">{ins ? pesos(n(l[ultimo]) * ins.costo_unitario) : '-'}</td>
                    <td className="text-right">
                      <button onClick={() => { setOk(false); setLineas(prev => prev.filter((_, i) => i !== idx)) }} className="text-[var(--ink-soft)] hover:text-[var(--danger)] text-lg px-1" aria-label="Quitar">×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--paper-line)]">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setLineas(prev => [...prev, { insumo_id: '', simple: '', doble: '', triple: '' }])} className="btn btn-sm">+ Agregar insumo</button>
            {tamanos.length > 1 && <button onClick={completarTamanos} className="btn btn-sm" title="Completa los tamaños vacíos multiplicando la simple">Completar ×2 / ×3</button>}
            <Link href="/stock" className="btn btn-sm">¿Falta un insumo? Crealo en Stock</Link>
          </div>
          <div className="flex items-center gap-3">
            {ok && <span className="text-sm text-[var(--ok)]">Receta guardada</span>}
            <button onClick={guardar} disabled={guardando} className="btn btn-primary">{guardando ? 'Guardando...' : 'Guardar receta'}</button>
          </div>
        </div>
        <div className="px-5 pb-4"><MensajeError error={error} /></div>
      </div>

      {lineas.some(l => l.insumo_id) && (
        <div className="card p-5">
          <h2 className="h2 mb-2">Con el stock de hoy alcanza para</h2>
          <div className="flex flex-wrap gap-6">
            {tamanos.map(t => {
              const usadas = lineas.filter(l => l.insumo_id && n(l[t]) > 0)
              if (usadas.length === 0) return null
              const limites = usadas.map(l => {
                const ins = porId.get(l.insumo_id)!
                return { nombre: ins.nombre, posibles: Math.floor(Math.max(0, ins.stock_actual) / n(l[t])), stock: cantidad(ins.stock_actual, ins.unidad) }
              }).sort((a, b) => a.posibles - b.posibles)
              return (
                <div key={t}>
                  <p className="font-display text-[24px] font-semibold tabular">{limites[0].posibles}</p>
                  <p className="text-sm">{labelTamano(producto.categoria, t).toLowerCase()}</p>
                  <p className="text-[11px] text-[var(--ink-soft)]">se termina primero: {limites[0].nombre} ({limites[0].stock})</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editandoProducto && (
        <ProductoModal
          producto={producto}
          onClose={() => setEditandoProducto(false)}
          onSaved={() => { setEditandoProducto(false); router.refresh() }}
        />
      )}
    </div>
  )
}
