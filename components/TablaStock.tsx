'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ajustarStock, guardarInsumo, registrarMerma, toggleInsumo, type DatosInsumo } from '@/app/actions/stock'
import { CATEGORIAS_INSUMO, UNIDADES_COMPRA, UNIDADES_STOCK } from '@/lib/catalogo'
import { cantidad, num, pesos, plural } from '@/lib/formato'
import { estadoStock } from '@/lib/stock'
import { Campo, MensajeError, Modal } from '@/components/ui'

export interface InsumoFila {
  id: string
  nombre: string
  categoria: string
  unidad: string
  unidad_compra: string
  equivalencia: number
  stock_actual: number
  stock_minimo: number
  costo_unitario: number
  activo: boolean
  notas: string | null
  consumo_diario: number
  en_camino: number
  en_camino_de: string | null
  mejor_proveedor: string | null
  mejor_precio: number | null
  usos: number
}

// "44 bollos" → "≈ 4,4 kg"
function enUnidadCompra(i: Pick<InsumoFila, 'stock_actual' | 'equivalencia' | 'unidad_compra' | 'unidad'>): string | null {
  if (i.equivalencia === 1 && i.unidad === i.unidad_compra) return null
  return `≈ ${num(i.stock_actual / i.equivalencia, 2)} ${i.unidad_compra}`
}

export default function TablaStock({ insumos }: { insumos: InsumoFila[] }) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [soloBajos, setSoloBajos] = useState(false)
  const [verInactivos, setVerInactivos] = useState(false)
  const [editando, setEditando] = useState<InsumoFila | 'nuevo' | null>(null)
  const [ajustando, setAjustando] = useState<InsumoFila | null>(null)
  const [mermando, setMermando] = useState<InsumoFila | null>(null)

  const categorias = useMemo(() => [...new Set(insumos.map(i => i.categoria))].sort(), [insumos])

  const filas = insumos
    .filter(i => verInactivos || i.activo)
    .filter(i => !categoria || i.categoria === categoria)
    .filter(i => !soloBajos || i.stock_actual <= i.stock_minimo)
    .filter(i => !busqueda.trim() || i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    .sort((a, b) => estadoStock(a).orden - estadoStock(b).orden || a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre))

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="h2">Insumos</h2>
        <button onClick={() => setEditando('nuevo')} className="btn btn-sm btn-primary">+ Nuevo insumo</button>
      </div>
      <div className="px-4 md:px-5 py-3 flex flex-wrap gap-2 items-center border-b border-[var(--paper-line)]">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar insumo..." className="input input-sm flex-1 min-w-[160px] max-w-xs" />
        <select value={categoria} onChange={e => setCategoria(e.target.value)} className="input input-sm w-auto">
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] cursor-pointer">
          <input type="checkbox" checked={soloBajos} onChange={e => setSoloBajos(e.target.checked)} /> Sólo bajo mínimo
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)] cursor-pointer">
          <input type="checkbox" checked={verInactivos} onChange={e => setVerInactivos(e.target.checked)} /> Ver dados de baja
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="tabla">
          <thead>
            <tr>
              <th>Insumo</th>
              <th className="num">Stock</th>
              <th className="num">Mínimo</th>
              <th className="num">Dura</th>
              <th className="num">Costo</th>
              <th className="num">Valor</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(i => {
              const est = estadoStock(i)
              const dias = i.consumo_diario > 0 ? Math.max(0, i.stock_actual) / i.consumo_diario : null
              const equivalente = enUnidadCompra(i)
              return (
                <tr key={i.id} className={i.activo ? '' : 'opacity-50'}>
                  <td>
                    <Link href={`/stock/${i.id}`} className="font-medium hover:underline">{i.nombre}</Link>
                    <p className="text-[11px] text-[var(--ink-soft)]">
                      {i.categoria}{i.usos > 0 ? ` · en ${i.usos} ${i.usos === 1 ? 'receta' : 'recetas'}` : ' · sin receta'}
                    </p>
                  </td>
                  <td className="num">
                    <span className="tabular font-semibold">{cantidad(i.stock_actual, i.unidad)}</span>
                    {equivalente && <p className="text-[11px] text-[var(--ink-soft)] tabular">{equivalente}</p>}
                    {i.en_camino > 0 && <p className="text-[11px] text-[var(--info)] tabular">+{cantidad(i.en_camino, i.unidad)} en camino</p>}
                  </td>
                  <td className="num tabular text-[var(--ink-soft)]">{cantidad(i.stock_minimo, i.unidad)}</td>
                  <td className="num tabular">
                    {dias == null ? <span className="text-[var(--ink-soft)]">-</span> : (
                      <span className={dias < 2 ? 'text-[var(--danger)] font-semibold' : dias < 4 ? 'text-[var(--warn)] font-semibold' : ''}>
                        {dias < 1 ? '< 1 día' : `${Math.floor(dias)} ${Math.floor(dias) === 1 ? 'día' : 'días'}`}
                      </span>
                    )}
                  </td>
                  <td className="num tabular">
                    {pesos(i.costo_unitario * i.equivalencia)}<span className="text-[11px] text-[var(--ink-soft)]">/{i.unidad_compra}</span>
                    {i.equivalencia !== 1 && (
                      <p className="text-[11px] text-[var(--ink-soft)]">
                        {i.costo_unitario < 10 ? `$${num(i.costo_unitario, 2)}` : pesos(i.costo_unitario)}/{i.unidad}
                      </p>
                    )}
                  </td>
                  <td className="num tabular">{pesos(Math.max(0, i.stock_actual) * i.costo_unitario)}</td>
                  <td><span className={`chip ${est.color}`}>{est.label}</span></td>
                  <td className="whitespace-nowrap text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setAjustando(i)} className="btn btn-sm" title="Cargar lo que hay de verdad">Contar</button>
                      <button onClick={() => setMermando(i)} className="btn btn-sm" title="Registrar pérdida">Merma</button>
                      <button onClick={() => setEditando(i)} className="btn btn-sm">Editar</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filas.length === 0 && <tr><td colSpan={8} className="text-center sub py-8">No hay insumos con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      {editando && (
        <InsumoModal
          insumo={editando === 'nuevo' ? null : editando}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); router.refresh() }}
        />
      )}
      {ajustando && <AjusteModal insumo={ajustando} onClose={() => setAjustando(null)} onSaved={() => { setAjustando(null); router.refresh() }} />}
      {mermando && <MermaModal insumo={mermando} onClose={() => setMermando(null)} onSaved={() => { setMermando(null); router.refresh() }} />}
    </div>
  )
}

export function InsumoModal({ insumo, onClose, onSaved }: { insumo: InsumoFila | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    nombre: insumo?.nombre ?? '',
    categoria: insumo?.categoria ?? 'Otros',
    unidad: insumo?.unidad ?? 'unidad',
    unidad_compra: insumo?.unidad_compra ?? 'kg',
    equivalencia: String(insumo?.equivalencia ?? 1),
    stock_minimo: String(insumo?.stock_minimo ?? 0),
    costo_compra: insumo ? String(Math.round(insumo.costo_unitario * insumo.equivalencia * 100) / 100) : '',
    stock_inicial: '',
    notas: insumo?.notas ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmarBaja, setConfirmarBaja] = useState(false)

  const eq = Number(f.equivalencia.replace(',', '.')) || 0
  const costo = f.costo_compra === '' ? null : Number(f.costo_compra.replace(',', '.'))

  async function guardar() {
    setError(null)
    const datos: DatosInsumo = {
      nombre: f.nombre,
      categoria: f.categoria,
      unidad: f.unidad,
      unidad_compra: f.unidad_compra,
      equivalencia: eq,
      stock_minimo: Number(f.stock_minimo.replace(',', '.')) || 0,
      costo_compra: costo,
      notas: f.notas || null,
      stock_inicial: insumo ? null : Number(f.stock_inicial.replace(',', '.')) || 0,
    }
    setGuardando(true)
    const r = await guardarInsumo(datos, insumo?.id)
    setGuardando(false)
    if (r.error) return setError(r.error)
    onSaved()
  }

  async function darDeBaja() {
    if (!insumo) return
    setGuardando(true)
    const r = await toggleInsumo(insumo.id, !insumo.activo)
    setGuardando(false)
    if (r.error) return setError(r.error)
    onSaved()
  }

  return (
    <Modal open titulo={insumo ? `Editar ${insumo.nombre}` : 'Nuevo insumo'} onClose={onClose}>
      <datalist id="unidades-stock">{UNIDADES_STOCK.map(u => <option key={u} value={u} />)}</datalist>
      <datalist id="unidades-compra">{UNIDADES_COMPRA.map(u => <option key={u} value={u} />)}</datalist>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Nombre"><input className="input" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} placeholder="Bollo de carne" autoFocus /></Campo>
          <Campo label="Categoría">
            <select className="input" value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value })}>
              {CATEGORIAS_INSUMO.map(c => <option key={c}>{c}</option>)}
            </select>
          </Campo>
        </div>

        <div className="rounded-lg bg-[var(--paper)] p-3 space-y-3">
          <p className="text-xs text-[var(--ink-soft)]">
            <b>Cómo se cuenta y cómo se compra.</b> Las recetas y el stock usan la unidad de uso; las compras, la unidad de compra.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Unidad de uso"><input className="input" list="unidades-stock" value={f.unidad} onChange={e => setF({ ...f, unidad: e.target.value })} placeholder="bollo" /></Campo>
            <Campo label="Se compra por"><input className="input" list="unidades-compra" value={f.unidad_compra} onChange={e => setF({ ...f, unidad_compra: e.target.value })} placeholder="kg" /></Campo>
          </div>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span>1 {f.unidad_compra || '…'} =</span>
            <input className="input input-sm w-24" inputMode="decimal" value={f.equivalencia} onChange={e => setF({ ...f, equivalencia: e.target.value })} />
            <span>{plural(f.unidad || '…', eq)}</span>
          </div>
          {eq > 0 && f.unidad && f.unidad_compra && (
            <p className="text-xs text-[var(--ink)]">
              Ejemplo: si comprás 15 {f.unidad_compra}, suman <b>{num(15 * eq)} {plural(f.unidad, 15 * eq)}</b> al stock.
              {costo != null && costo > 0 && <> Cada {f.unidad} cuesta <b>${num(costo / eq, 2)}</b>.</>}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label={`Costo por ${f.unidad_compra || 'unidad de compra'}`} ayuda={insumo ? 'Se actualiza solo con cada compra recibida' : 'Precio de referencia hasta la primera compra'}>
            <input className="input" inputMode="decimal" value={f.costo_compra} onChange={e => setF({ ...f, costo_compra: e.target.value })} placeholder="9500" />
          </Campo>
          <Campo label={`Stock mínimo (${f.unidad || 'unidades'})`} ayuda="Por debajo de esto aparece la alerta">
            <input className="input" inputMode="decimal" value={f.stock_minimo} onChange={e => setF({ ...f, stock_minimo: e.target.value })} />
          </Campo>
        </div>

        {!insumo && (
          <Campo label={`Stock actual (${f.unidad || 'unidades'})`} ayuda="Lo que hay hoy en el local. Después se mueve solo con compras y ventas.">
            <input className="input" inputMode="decimal" value={f.stock_inicial} onChange={e => setF({ ...f, stock_inicial: e.target.value })} placeholder="0" />
          </Campo>
        )}

        <Campo label="Notas"><input className="input" value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })} placeholder="Opcional" /></Campo>

        <MensajeError error={error} />

        <div className="flex justify-between gap-2 pt-1">
          {insumo ? (
            confirmarBaja ? (
              <div className="flex items-center gap-2 text-xs">
                <span>{insumo.activo ? '¿Dar de baja?' : '¿Reactivar?'}</span>
                <button onClick={darDeBaja} disabled={guardando} className="btn btn-sm btn-danger">Sí</button>
                <button onClick={() => setConfirmarBaja(false)} className="btn btn-sm">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmarBaja(true)} className="text-xs text-[var(--ink-soft)] hover:text-[var(--danger)]">
                {insumo.activo ? 'Dar de baja' : 'Reactivar'}
              </button>
            )
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

export function AjusteModal({ insumo, onClose, onSaved }: { insumo: InsumoFila; onClose: () => void; onSaved: () => void }) {
  const [enCompra, setEnCompra] = useState(false)
  const [valor, setValor] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ingresado = Number(valor.replace(',', '.'))
  const conteo = valor === '' || Number.isNaN(ingresado) ? null : enCompra ? ingresado * insumo.equivalencia : ingresado
  const diferencia = conteo == null ? null : conteo - insumo.stock_actual

  async function guardar() {
    if (conteo == null) return setError('Cargá cuánto hay.')
    setGuardando(true)
    const r = await ajustarStock(insumo.id, conteo, nota || null)
    setGuardando(false)
    if (r.error) return setError(r.error)
    onSaved()
  }

  return (
    <Modal open titulo={`Contar ${insumo.nombre}`} subtitulo={`El sistema dice que hay ${cantidad(insumo.stock_actual, insumo.unidad)}`} onClose={onClose} ancho="max-w-md">
      <div className="space-y-3">
        <Campo label="¿Cuánto hay de verdad?">
          <div className="flex gap-2">
            <input className="input" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} autoFocus />
            {insumo.equivalencia !== 1 && (
              <select className="input w-auto" value={enCompra ? 'c' : 'u'} onChange={e => setEnCompra(e.target.value === 'c')}>
                <option value="u">{plural(insumo.unidad, 2)}</option>
                <option value="c">{insumo.unidad_compra}</option>
              </select>
            )}
          </div>
        </Campo>
        {diferencia != null && Math.abs(diferencia) > 0.0005 && (
          <p className={`text-sm ${diferencia < 0 ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}`}>
            Diferencia: {diferencia > 0 ? '+' : ''}{cantidad(diferencia, insumo.unidad)}
            {diferencia < 0 && <> · {pesos(-diferencia * insumo.costo_unitario)} de mercadería que no aparece</>}
          </p>
        )}
        <Campo label="Nota"><input className="input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Conteo del cierre" /></Campo>
        <MensajeError error={error} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn">Cancelar</button>
          <button onClick={guardar} disabled={guardando || conteo == null} className="btn btn-primary">{guardando ? 'Guardando...' : 'Guardar conteo'}</button>
        </div>
      </div>
    </Modal>
  )
}

export function MermaModal({ insumo, onClose, onSaved }: { insumo: InsumoFila; onClose: () => void; onSaved: () => void }) {
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const n = Number(valor.replace(',', '.'))

  async function guardar() {
    setGuardando(true)
    const r = await registrarMerma(insumo.id, n, motivo || null)
    setGuardando(false)
    if (r.error) return setError(r.error)
    onSaved()
  }

  return (
    <Modal open titulo={`Merma de ${insumo.nombre}`} subtitulo="Lo que se tiró, se quemó o se venció" onClose={onClose} ancho="max-w-md">
      <div className="space-y-3">
        <Campo label={`Cantidad (${plural(insumo.unidad, 2)})`}>
          <input className="input" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} autoFocus />
        </Campo>
        {n > 0 && <p className="text-sm text-[var(--danger)]">Pérdida: {pesos(n * insumo.costo_unitario)}</p>}
        <Campo label="Motivo">
          <input className="input" list="motivos-merma" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Se venció" />
          <datalist id="motivos-merma">
            {['Se venció', 'Se quemó', 'Se cayó', 'Mal estado', 'Consumo del personal', 'Prueba / degustación'].map(m => <option key={m} value={m} />)}
          </datalist>
        </Campo>
        <MensajeError error={error} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn">Cancelar</button>
          <button onClick={guardar} disabled={guardando || !(n > 0)} className="btn btn-danger">{guardando ? 'Guardando...' : 'Registrar merma'}</button>
        </div>
      </div>
    </Modal>
  )
}
