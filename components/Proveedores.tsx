'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { guardarPrecio, guardarProveedor, quitarDeLista, toggleProveedor, type DatosProveedor } from '@/app/actions/proveedores'
import { fecha, num, pesos } from '@/lib/formato'
import { Campo, MensajeError, Modal } from '@/components/ui'

export interface ProveedorEditable extends DatosProveedor {
  id: string
  activo: boolean
}

export function BotonNuevoProveedor() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(true)} className="btn btn-primary">+ Proveedor</button>
      {abierto && (
        <ProveedorModal
          proveedor={null}
          onClose={() => setAbierto(false)}
          onSaved={id => { setAbierto(false); router.push(`/proveedores/${id}`) }}
        />
      )}
    </>
  )
}

export function BotonEditarProveedor({ proveedor }: { proveedor: ProveedorEditable }) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(true)} className="btn">Editar datos</button>
      {abierto && (
        <ProveedorModal
          proveedor={proveedor}
          onClose={() => setAbierto(false)}
          onSaved={() => { setAbierto(false); router.refresh() }}
        />
      )}
    </>
  )
}

function ProveedorModal({ proveedor, onClose, onSaved }: { proveedor: ProveedorEditable | null; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState({
    nombre: proveedor?.nombre ?? '',
    rubro: proveedor?.rubro ?? '',
    contacto: proveedor?.contacto ?? '',
    telefono: proveedor?.telefono ?? '',
    email: proveedor?.email ?? '',
    direccion: proveedor?.direccion ?? '',
    cuit: proveedor?.cuit ?? '',
    dias_entrega: proveedor?.dias_entrega ?? '',
    demora: proveedor?.demora_prometida_horas != null ? String(proveedor.demora_prometida_horas) : '',
    pedido_minimo: proveedor?.pedido_minimo != null ? String(proveedor.pedido_minimo) : '',
    condicion_pago: proveedor?.condicion_pago ?? '',
    notas: proveedor?.notas ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  async function guardar() {
    setGuardando(true)
    const r = await guardarProveedor({
      nombre: f.nombre,
      rubro: f.rubro || null,
      contacto: f.contacto || null,
      telefono: f.telefono || null,
      email: f.email || null,
      direccion: f.direccion || null,
      cuit: f.cuit || null,
      dias_entrega: f.dias_entrega || null,
      demora_prometida_horas: f.demora === '' ? null : Number(f.demora),
      pedido_minimo: f.pedido_minimo === '' ? null : Number(f.pedido_minimo),
      condicion_pago: f.condicion_pago || null,
      notas: f.notas || null,
    }, proveedor?.id)
    setGuardando(false)
    if (r.error || !r.id) return setError(r.error ?? 'No se pudo guardar.')
    onSaved(r.id)
  }

  async function cambiarActivo() {
    if (!proveedor) return
    setGuardando(true)
    const r = await toggleProveedor(proveedor.id, !proveedor.activo)
    setGuardando(false)
    if (r.error) return setError(r.error)
    onSaved(proveedor.id)
  }

  return (
    <Modal open titulo={proveedor ? `Editar ${proveedor.nombre}` : 'Nuevo proveedor'} onClose={onClose} ancho="max-w-2xl">
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Nombre"><input className="input" value={f.nombre} onChange={set('nombre')} autoFocus /></Campo>
          <Campo label="Rubro"><input className="input" value={f.rubro} onChange={set('rubro')} placeholder="Carnes, verdulería..." /></Campo>
          <Campo label="Contacto"><input className="input" value={f.contacto} onChange={set('contacto')} placeholder="Con quién hablás" /></Campo>
          <Campo label="WhatsApp"><input className="input" value={f.telefono} onChange={set('telefono')} inputMode="tel" placeholder="3815123456" /></Campo>
          <Campo label="Días de entrega"><input className="input" value={f.dias_entrega} onChange={set('dias_entrega')} placeholder="Lun, Mié y Vie" /></Campo>
          <Campo label="Tarda en entregar (horas)" ayuda="Lo que promete. El sistema mide lo que tarda de verdad.">
            <input className="input" value={f.demora} onChange={set('demora')} inputMode="numeric" placeholder="24" />
          </Campo>
          <Campo label="Condición de pago">
            <input className="input" list="condiciones-pago" value={f.condicion_pago} onChange={set('condicion_pago')} placeholder="Contado" />
            <datalist id="condiciones-pago">{['Contado', 'Contra entrega', '7 días', '15 días', '30 días', 'Cuenta corriente'].map(c => <option key={c} value={c} />)}</datalist>
          </Campo>
          <Campo label="Pedido mínimo ($)"><input className="input" value={f.pedido_minimo} onChange={set('pedido_minimo')} inputMode="numeric" /></Campo>
          <Campo label="Email"><input className="input" value={f.email} onChange={set('email')} type="email" /></Campo>
          <Campo label="CUIT"><input className="input" value={f.cuit} onChange={set('cuit')} /></Campo>
          <Campo label="Dirección" className="sm:col-span-2"><input className="input" value={f.direccion} onChange={set('direccion')} /></Campo>
          <Campo label="Notas" className="sm:col-span-2"><input className="input" value={f.notas} onChange={set('notas')} /></Campo>
        </div>
        <MensajeError error={error} />
        <div className="flex justify-between gap-2">
          {proveedor ? (
            <button onClick={cambiarActivo} disabled={guardando} className="text-xs text-[var(--ink-soft)] hover:text-[var(--danger)]">
              {proveedor.activo ? 'Dar de baja' : 'Reactivar'}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn">Cancelar</button>
            <button onClick={guardar} disabled={guardando} className="btn btn-primary">{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export interface PrecioLista {
  insumo_id: string
  insumo: string
  unidad_compra: string
  precio: number
  fecha: string
  origen: string
  anterior: number | null
  minimo: number | null
  proveedor_minimo: string | null
}

export function ListaPrecios({
  proveedorId,
  precios,
  insumos,
}: {
  proveedorId: string
  precios: PrecioLista[]
  insumos: { id: string; nombre: string; unidad_compra: string }[]
}) {
  const router = useRouter()
  const [insumoId, setInsumoId] = useState('')
  const [precio, setPrecio] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [precioEdit, setPrecioEdit] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enLista = new Set(precios.map(p => p.insumo_id))
  const insumoSel = insumos.find(i => i.id === insumoId)

  async function agregar() {
    setError(null)
    setGuardando(true)
    const r = await guardarPrecio(proveedorId, insumoId, Number(precio.replace(',', '.')), null)
    setGuardando(false)
    if (r.error) return setError(r.error)
    setInsumoId('')
    setPrecio('')
    router.refresh()
  }

  async function actualizar(insumo: string) {
    setGuardando(true)
    const r = await guardarPrecio(proveedorId, insumo, Number(precioEdit.replace(',', '.')), null)
    setGuardando(false)
    if (r.error) return setError(r.error)
    setEditando(null)
    router.refresh()
  }

  async function quitar(insumo: string) {
    setGuardando(true)
    const r = await quitarDeLista(proveedorId, insumo)
    setGuardando(false)
    if (r.error) return setError(r.error)
    router.refresh()
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="h2">Lista de precios</h2>
          <p className="text-xs text-[var(--ink-soft)] mt-0.5">Se actualiza sola con cada compra recibida. También podés cargar precios que te pasen por WhatsApp.</p>
        </div>
      </div>
      <div className="px-5 py-3 flex flex-wrap gap-2 items-center border-b border-[var(--paper-line)] bg-[var(--paper)]/60">
        <select className="input input-sm w-auto min-w-[180px]" value={insumoId} onChange={e => setInsumoId(e.target.value)}>
          <option value="">Agregar o actualizar insumo...</option>
          {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre}{enLista.has(i.id) ? ' (actualizar)' : ''}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <span className="text-xs">$</span>
          <input className="input input-sm w-28" inputMode="decimal" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="Precio" />
          {insumoSel && <span className="text-xs text-[var(--ink-soft)]">por {insumoSel.unidad_compra}</span>}
        </div>
        <button onClick={agregar} disabled={guardando || !insumoId || precio === ''} className="btn btn-sm btn-primary">Guardar precio</button>
        <MensajeError error={error} />
      </div>
      {precios.length === 0 ? (
        <p className="px-6 py-6 sub">Todavía no hay precios cargados para este proveedor.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Insumo</th><th className="num">Precio</th><th className="num">Variación</th><th>Comparado</th><th>Fecha</th><th></th></tr></thead>
            <tbody>
              {precios.map(p => {
                const variacion = p.anterior ? ((p.precio - p.anterior) / p.anterior) * 100 : null
                const dif = p.minimo ? ((p.precio - p.minimo) / p.minimo) * 100 : 0
                return (
                  <tr key={p.insumo_id}>
                    <td className="font-medium">{p.insumo}<span className="text-[11px] text-[var(--ink-soft)]"> · por {p.unidad_compra}</span></td>
                    <td className="num">
                      {editando === p.insumo_id ? (
                        <div className="flex gap-1 justify-end">
                          <input className="input input-sm w-24" value={precioEdit} onChange={e => setPrecioEdit(e.target.value)} autoFocus inputMode="decimal" />
                          <button onClick={() => actualizar(p.insumo_id)} disabled={guardando} className="btn btn-sm btn-primary">OK</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditando(p.insumo_id); setPrecioEdit(String(p.precio)) }} className="tabular font-semibold hover:underline" title="Actualizar precio">
                          {pesos(p.precio)}
                        </button>
                      )}
                    </td>
                    <td className="num text-xs">
                      {variacion != null && Math.abs(variacion) >= 0.5
                        ? <span className={variacion > 0 ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}>{variacion > 0 ? '↑' : '↓'} {num(Math.abs(variacion), 1)}%</span>
                        : <span className="text-[var(--ink-soft)]">-</span>}
                    </td>
                    <td className="text-xs">
                      {p.proveedor_minimo == null
                        ? <span className="text-[var(--ink-soft)]">sólo lo tiene él</span>
                        : dif < 0.5
                          ? <span className="chip chip-ok">El más barato</span>
                          : <span className="text-[var(--danger)]">+{num(dif, 1)}% vs {p.proveedor_minimo}</span>}
                    </td>
                    <td className="text-xs text-[var(--ink-soft)] whitespace-nowrap">{fecha(p.fecha)}{p.origen === 'compra' ? ' · compra' : ''}</td>
                    <td className="text-right"><button onClick={() => quitar(p.insumo_id)} className="text-xs text-[var(--ink-soft)] hover:text-[var(--danger)]">Quitar</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
