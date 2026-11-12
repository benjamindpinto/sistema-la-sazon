'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { guardarProducto, toggleProducto } from '@/app/actions/menu'
import { CATEGORIAS, ORDEN_CATEGORIAS, labelTamano, precioDe, tamanosDe, type Tamano } from '@/lib/catalogo'
import { pesos } from '@/lib/formato'
import { Campo, MensajeError, Modal } from '@/components/ui'

export interface ProductoMenu {
  id: string
  categoria: string
  nombre: string
  descripcion: string | null
  precio_simple: number
  precio_doble: number | null
  precio_triple: number | null
  activo: boolean
  costo_simple: number
  costo_doble: number
  costo_triple: number
  insumos_en_receta: number
  vendidas_30d: number
}

export function colorMargen(m: number): string {
  if (m >= 65) return 'text-[var(--ok)]'
  if (m >= 55) return 'text-[var(--warn)]'
  return 'text-[var(--danger)]'
}

function costoDe(p: ProductoMenu, t: Tamano) {
  return t === 'simple' ? p.costo_simple : t === 'doble' ? p.costo_doble : p.costo_triple
}

export default function TablaMenu({ productos }: { productos: ProductoMenu[] }) {
  const router = useRouter()
  const [editando, setEditando] = useState<ProductoMenu | 'nuevo' | null>(null)
  const [verInactivos, setVerInactivos] = useState(true)
  const categorias = ORDEN_CATEGORIAS.filter(c => productos.some(p => p.categoria === c))

  async function cambiarActivo(p: ProductoMenu) {
    await toggleProducto(p.id, !p.activo)
    router.refresh()
  }

  return (
    <div className="space-y-7">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] cursor-pointer">
          <input type="checkbox" checked={verInactivos} onChange={e => setVerInactivos(e.target.checked)} /> Mostrar productos desactivados
        </label>
        <button onClick={() => setEditando('nuevo')} className="btn btn-primary">+ Producto</button>
      </div>

      {categorias.map(cat => {
        const items = productos.filter(p => p.categoria === cat && (verInactivos || p.activo))
        if (items.length === 0) return null
        const tamanos = tamanosDe(cat)
        return (
          <div key={cat}>
            <h2 className="eyebrow font-semibold mb-2.5">{CATEGORIAS[cat]?.label ?? cat}</h2>
            <div className="card overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Producto</th>
                    {tamanos.map(t => <th key={t} className="num">{labelTamano(cat, t)}</th>)}
                    <th className="num">Vendidas 30 d</th>
                    <th>Receta</th>
                    <th>Activo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(p => (
                    <tr key={p.id} className={p.activo ? '' : 'opacity-50'}>
                      <td className="max-w-[340px]">
                        <p className="font-medium">{p.nombre}</p>
                        {p.descripcion && <p className="text-xs text-[var(--ink-soft)] line-clamp-2">{p.descripcion}</p>}
                      </td>
                      {tamanos.map(t => {
                        const precio = precioDe(p, t)
                        const costo = costoDe(p, t)
                        if (precio == null) return <td key={t} className="num text-[var(--ink-soft)]">-</td>
                        const margen = precio > 0 ? ((precio - costo) / precio) * 100 : 0
                        return (
                          <td key={t} className="num">
                            <p className="tabular font-semibold">{pesos(precio)}</p>
                            {p.insumos_en_receta > 0 && (
                              <p className="text-[11px] tabular text-[var(--ink-soft)]">
                                costo {pesos(costo)} · <span className={`font-semibold ${colorMargen(margen)}`}>{Math.round(margen)}%</span>
                              </p>
                            )}
                          </td>
                        )
                      })}
                      <td className="num tabular">{p.vendidas_30d}</td>
                      <td>
                        <Link href={`/menu/${p.id}`} className={`chip ${p.insumos_en_receta > 0 ? 'chip-neutral' : 'chip-warn'} hover:underline`}>
                          {p.insumos_en_receta > 0 ? `${p.insumos_en_receta} insumos` : 'Cargar receta'}
                        </Link>
                      </td>
                      <td>
                        <button onClick={() => cambiarActivo(p)} className={`chip ${p.activo ? 'chip-ok' : 'chip-neutral'} cursor-pointer`}>{p.activo ? 'Sí' : 'No'}</button>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button onClick={() => setEditando(p)} className="btn btn-sm">Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      <p className="text-xs text-[var(--ink-soft)]">
        Margen = (precio − costo de receta) ÷ precio. Verde desde 65%, amarillo entre 55% y 65%, rojo debajo. El costo usa el último precio de compra de cada insumo.
      </p>

      {editando && (
        <ProductoModal
          producto={editando === 'nuevo' ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={(id, nuevo) => { setEditando(null); if (nuevo) router.push(`/menu/${id}`); else router.refresh() }}
        />
      )}
    </div>
  )
}

export function ProductoModal({
  producto,
  onClose,
  onSaved,
}: {
  producto: Pick<ProductoMenu, 'id' | 'categoria' | 'nombre' | 'descripcion' | 'precio_simple' | 'precio_doble' | 'precio_triple'> | null
  onClose: () => void
  onSaved: (id: string, nuevo: boolean) => void
}) {
  const [categoria, setCategoria] = useState(producto?.categoria ?? 'hamburguesa')
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '')
  const [precios, setPrecios] = useState<Record<Tamano, string>>({
    simple: producto ? String(producto.precio_simple) : '',
    doble: producto?.precio_doble != null ? String(producto.precio_doble) : '',
    triple: producto?.precio_triple != null ? String(producto.precio_triple) : '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tamanos = tamanosDe(categoria)
  const valor = (t: Tamano) => (tamanos.includes(t) && precios[t].trim() !== '' ? Number(precios[t].replace(',', '.')) : null)

  async function guardar() {
    setError(null)
    if (valor('simple') == null) return setError(`Falta el precio ${labelTamano(categoria, 'simple').toLowerCase()}.`)
    setGuardando(true)
    const r = await guardarProducto({
      categoria, nombre, descripcion: descripcion || null,
      precio_simple: valor('simple')!, precio_doble: valor('doble'), precio_triple: valor('triple'),
    }, producto?.id)
    setGuardando(false)
    if (r.error || !r.id) return setError(r.error ?? 'No se pudo guardar.')
    onSaved(r.id, !producto)
  }

  return (
    <Modal open titulo={producto ? `Editar ${producto.nombre}` : 'Nuevo producto'} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Categoría">
            <select className="input" value={categoria} onChange={e => setCategoria(e.target.value)}>
              {ORDEN_CATEGORIAS.map(c => <option key={c} value={c}>{CATEGORIAS[c].label}</option>)}
            </select>
          </Campo>
          <Campo label="Nombre"><input className="input" value={nombre} onChange={e => setNombre(e.target.value)} autoFocus /></Campo>
        </div>
        <Campo label="Descripción"><input className="input" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ingredientes, como figura en la carta" /></Campo>
        <div className={`grid gap-3 ${tamanos.length === 3 ? 'grid-cols-3' : tamanos.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {tamanos.map(t => (
            <Campo key={t} label={`Precio ${labelTamano(categoria, t)}`}>
              <input className="input" inputMode="decimal" value={precios[t]} onChange={e => setPrecios({ ...precios, [t]: e.target.value })} placeholder={t === 'simple' ? '' : 'Vacío = no se vende'} />
            </Campo>
          ))}
        </div>
        <MensajeError error={error} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="btn btn-primary">{guardando ? 'Guardando...' : producto ? 'Guardar' : 'Crear y cargar receta'}</button>
        </div>
      </div>
    </Modal>
  )
}
