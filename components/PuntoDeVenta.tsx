'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { buscarClientes, crearVenta, type ClienteCaja, type ResultadoVenta } from '@/app/actions/ventas'
import {
  CANALES, CATEGORIAS, MEDIOS_PAGO, MODALIDADES, ORDEN_CATEGORIAS, ESTADO_LABEL,
  labelTamano, precioDe, tamanosDe, type Tamano,
} from '@/lib/catalogo'
import { cantidad as fmtCantidad, fecha, linkWhatsApp, pesos } from '@/lib/formato'
import { describirPremio, mensajeCupon } from '@/lib/premios'
import { Barra, MensajeError } from '@/components/ui'

export interface ProductoCaja {
  id: string
  categoria: string
  nombre: string
  descripcion: string | null
  precio_simple: number
  precio_doble: number | null
  precio_triple: number | null
}

interface Linea {
  producto_id: string
  tamano: Tamano
  cantidad: number
}

type Alcance = Record<string, Partial<Record<string, number | null>>>

export default function PuntoDeVenta({
  productos,
  alcance,
  fidelidad,
}: {
  productos: ProductoCaja[]
  alcance: Alcance
  fidelidad: { activo: boolean; compras_necesarias: number; mensaje: string | null }
}) {
  const router = useRouter()
  const categorias = ORDEN_CATEGORIAS.filter(c => productos.some(p => p.categoria === c))
    .concat([...new Set(productos.map(p => p.categoria))].filter(c => !ORDEN_CATEGORIAS.includes(c)))
  const [categoria, setCategoria] = useState(categorias[0] ?? 'hamburguesa')
  const [filtro, setFiltro] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])

  // cliente
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ClienteCaja[]>([])
  const [buscando, setBuscando] = useState(false)
  const [cliente, setCliente] = useState<ClienteCaja | null>(null)
  const [nuevoCliente, setNuevoCliente] = useState<{ telefono: string; nombre: string } | null>(null)
  const [cuponId, setCuponId] = useState<string | null>(null)

  // datos de la venta
  const [canal, setCanal] = useState('mostrador')
  const [modalidad, setModalidad] = useState('take_away')
  const [medioPago, setMedioPago] = useState('efectivo')
  const [estadoManual, setEstadoManual] = useState<string | null>(null)
  const [direccion, setDireccion] = useState('')
  const [notas, setNotas] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Extract<ResultadoVenta, { ok: true }> | null>(null)

  const porId = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos])
  const estadoAuto = canal === 'mostrador' && modalidad !== 'delivery' ? 'entregado' : 'confirmado'
  const estado = estadoManual ?? estadoAuto

  // búsqueda de clientes con un pequeño retraso
  useEffect(() => {
    const texto = busqueda.trim()
    if (texto.length < 2) return
    let vigente = true
    const t = setTimeout(async () => {
      setBuscando(true)
      const r = await buscarClientes(texto)
      if (vigente) {
        setResultados(r)
        setBuscando(false)
      }
    }, 250)
    return () => { vigente = false; clearTimeout(t) }
  }, [busqueda])

  function agregar(producto_id: string, tamano: Tamano) {
    setError(null)
    setLineas(prev => {
      const i = prev.findIndex(l => l.producto_id === producto_id && l.tamano === tamano)
      if (i >= 0) return prev.map((l, j) => (j === i ? { ...l, cantidad: l.cantidad + 1 } : l))
      return [...prev, { producto_id, tamano, cantidad: 1 }]
    })
  }

  function cambiarCantidad(idx: number, delta: number) {
    setLineas(prev => prev.flatMap((l, j) => {
      if (j !== idx) return [l]
      const n = l.cantidad + delta
      return n <= 0 ? [] : [{ ...l, cantidad: n }]
    }))
  }

  function elegirCliente(c: ClienteCaja) {
    setCliente(c)
    setNuevoCliente(null)
    setBusqueda('')
    setResultados([])
    setCuponId(null)
    if (c.direccion_default && !direccion) setDireccion(c.direccion_default)
  }

  function quitarCliente() {
    setCliente(null)
    setNuevoCliente(null)
    setCuponId(null)
  }

  const subtotalProductos = lineas.reduce((acc, l) => acc + (precioDe(porId.get(l.producto_id), l.tamano) ?? 0) * l.cantidad, 0)
  const cupon = cliente?.cupones.find(c => c.id === cuponId) ?? null
  let descuento = 0
  let regalo: { nombre: string; precio: number; tamano: string; categoria: string } | null = null
  if (cupon) {
    if (cupon.tipo === 'producto') {
      const p = cupon.producto_id ? porId.get(cupon.producto_id) : undefined
      const precio = precioDe(p, cupon.tamano ?? 'simple') ?? 0
      regalo = { nombre: cupon.producto_nombre ?? 'Producto', precio, tamano: cupon.tamano ?? 'simple', categoria: cupon.producto_categoria ?? '' }
      descuento = precio
    } else if (cupon.tipo === 'porcentaje') {
      descuento = Math.round(subtotalProductos * (cupon.valor ?? 0) / 100)
    } else {
      descuento = Math.min(cupon.valor ?? 0, subtotalProductos)
    }
  }
  const total = Math.max(0, subtotalProductos + (regalo?.precio ?? 0) - descuento)
  const unidades = lineas.reduce((acc, l) => acc + l.cantidad, 0)

  async function registrar() {
    setError(null)
    if (lineas.length === 0) return setError('Agregá al menos un producto.')
    if (modalidad === 'delivery' && !direccion.trim()) return setError('Falta la dirección de entrega.')
    if (nuevoCliente && !nuevoCliente.telefono.trim()) return setError('Falta el WhatsApp del cliente nuevo.')

    const datosCliente = cliente
      ? { telefono: cliente.telefono, nombre: null, direccion: null }
      : nuevoCliente
        ? { telefono: nuevoCliente.telefono.trim(), nombre: nuevoCliente.nombre.trim() || null, direccion: null }
        : null

    setEnviando(true)
    const r = await crearVenta({
      cliente: datosCliente,
      canal,
      modalidad,
      medio_pago: medioPago,
      estado,
      direccion_entrega: modalidad === 'delivery' ? direccion.trim() : null,
      notas: notas.trim() || null,
      items: lineas,
      cupon_id: cuponId,
    })
    setEnviando(false)
    if (!('ok' in r) || !r.ok) {
      setError('error' in r ? r.error : 'No se pudo registrar la venta.')
      return
    }
    setResultado(r)
    router.refresh()
  }

  function nuevaVenta() {
    setLineas([])
    quitarCliente()
    setCanal('mostrador')
    setModalidad('take_away')
    setMedioPago('efectivo')
    setEstadoManual(null)
    setDireccion('')
    setNotas('')
    setError(null)
    setResultado(null)
    window.scrollTo({ top: 0 })
  }

  if (resultado) {
    return <VentaRegistrada resultado={resultado} plantilla={fidelidad.mensaje} onNueva={nuevaVenta} />
  }

  const visibles = productos.filter(p =>
    filtro.trim() ? p.nombre.toLowerCase().includes(filtro.trim().toLowerCase()) : p.categoria === categoria
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start pb-24 lg:pb-0">
      {/* ---------------- Productos ---------------- */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          {categorias.map(c => (
            <button
              key={c}
              onClick={() => { setCategoria(c); setFiltro('') }}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                categoria === c && !filtro ? 'bg-[var(--ink)] text-white border-[var(--ink)]' : 'bg-[var(--paper-card)] border-[var(--paper-line)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
              }`}
            >
              {CATEGORIAS[c]?.label ?? c}
            </button>
          ))}
          <input
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            placeholder="Buscar producto..."
            className="input flex-1 min-w-[160px] max-w-[260px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibles.map(p => {
            const tamanos = tamanosDe(p.categoria).filter(t => precioDe(p, t) != null)
            return (
              <div key={p.id} className="card p-3.5">
                <p className="font-semibold text-[15px] text-[var(--ink)] leading-tight">{p.nombre}</p>
                {p.descripcion && <p className="text-xs text-[var(--ink-soft)] mt-0.5 line-clamp-1">{p.descripcion}</p>}
                <div className={`grid gap-2 mt-3 ${tamanos.length === 3 ? 'grid-cols-3' : tamanos.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {tamanos.map(t => {
                    const quedan = alcance[p.id]?.[t]
                    const enCarrito = lineas.find(l => l.producto_id === p.id && l.tamano === t)?.cantidad ?? 0
                    const restante = quedan == null ? null : quedan - enCarrito
                    return (
                      <button
                        key={t}
                        onClick={() => agregar(p.id, t)}
                        className={`relative rounded-lg border px-2 py-2.5 text-center transition-colors active:scale-[0.98] ${
                          enCarrito > 0
                            ? 'border-[var(--ember)] bg-[color-mix(in_srgb,var(--ember)_8%,var(--paper-card))]'
                            : 'border-[var(--paper-line)] bg-[var(--paper)] hover:border-[var(--ember)]'
                        }`}
                      >
                        <span className="block text-[13px] font-semibold text-[var(--ink)]">{labelTamano(p.categoria, t)}</span>
                        <span className="block text-xs text-[var(--ink-soft)] tabular">{pesos(precioDe(p, t))}</span>
                        {restante != null && restante <= 5 && (
                          <span className={`block text-[10.5px] font-semibold mt-0.5 ${restante <= 0 ? 'text-[var(--danger)]' : 'text-[var(--warn)]'}`}>
                            {restante <= 0 ? 'Sin stock' : `Quedan ${restante}`}
                          </span>
                        )}
                        {enCarrito > 0 && (
                          <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-[var(--ember)] text-white text-[11px] font-bold flex items-center justify-center">
                            {enCarrito}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {visibles.length === 0 && <p className="sub col-span-full py-6 text-center">No hay productos que coincidan.</p>}
        </div>
      </div>

      {/* ---------------- Ticket ---------------- */}
      <div id="ticket" className="card lg:sticky lg:top-6">
        <div className="card-head">
          <h2 className="h2">Ticket</h2>
          {lineas.length > 0 && (
            <button onClick={() => setLineas([])} className="text-xs text-[var(--ink-soft)] hover:text-[var(--danger)]">Vaciar</button>
          )}
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* líneas */}
          {lineas.length === 0 && !regalo ? (
            <p className="text-sm text-[var(--ink-soft)] text-center py-3">Todavía no cargaste productos.</p>
          ) : (
            <ul className="space-y-2">
              {lineas.map((l, i) => {
                const p = porId.get(l.producto_id)
                const precio = precioDe(p, l.tamano) ?? 0
                return (
                  <li key={`${l.producto_id}-${l.tamano}`} className="flex items-center gap-2">
                    <div className="flex items-center border border-[var(--paper-line)] rounded-md">
                      <button onClick={() => cambiarCantidad(i, -1)} className="w-7 h-7 text-[var(--ink-soft)] hover:text-[var(--ink)]" aria-label="Uno menos">−</button>
                      <span className="w-6 text-center text-sm font-semibold tabular">{l.cantidad}</span>
                      <button onClick={() => cambiarCantidad(i, 1)} className="w-7 h-7 text-[var(--ink-soft)] hover:text-[var(--ink)]" aria-label="Uno más">+</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--ink)] truncate">{p?.nombre}</p>
                      <p className="text-[11px] text-[var(--ink-soft)]">{p ? labelTamano(p.categoria, l.tamano) : l.tamano}</p>
                    </div>
                    <span className="text-sm tabular">{pesos(precio * l.cantidad)}</span>
                  </li>
                )
              })}
              {regalo && (
                <li className="flex items-center gap-2 rounded-md bg-[var(--ok-bg)] px-2 py-1.5">
                  <span className="chip chip-ok">Regalo</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--ink)] truncate">{regalo.nombre}</p>
                    <p className="text-[11px] text-[var(--ink-soft)]">{labelTamano(regalo.categoria, regalo.tamano)} · cupón {cupon?.codigo}</p>
                  </div>
                  <span className="text-sm tabular line-through text-[var(--ink-soft)]">{pesos(regalo.precio)}</span>
                </li>
              )}
            </ul>
          )}

          {/* cliente */}
          <div className="border-t border-[var(--paper-line)] pt-4">
            <p className="label">Cliente</p>
            {cliente ? (
              <div className="rounded-lg border border-[var(--paper-line)] p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{cliente.nombre ?? 'Sin nombre'}</p>
                    <p className="text-xs text-[var(--ink-soft)]">{cliente.telefono} · {cliente.total_compras} {cliente.total_compras === 1 ? 'compra' : 'compras'}</p>
                  </div>
                  <button onClick={quitarCliente} className="text-xs text-[var(--ink-soft)] hover:text-[var(--danger)]">Quitar</button>
                </div>
                {cliente.programa_activo && (
                  <div>
                    <div className="flex justify-between text-[11px] text-[var(--ink-soft)] mb-1">
                      <span>Fidelización</span>
                      <span className="tabular">
                        {cliente.compras_en_ciclo} de {cliente.compras_necesarias}
                        {cliente.compras_en_ciclo + 1 >= cliente.compras_necesarias ? ' · ¡con esta compra gana el premio!' : ''}
                      </span>
                    </div>
                    <Barra valor={cliente.compras_en_ciclo} max={cliente.compras_necesarias} />
                  </div>
                )}
                {cliente.cupones.length > 0 && (
                  <div className="space-y-1.5">
                    {cliente.cupones.map(c => (
                      <div key={c.id} className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 border ${cuponId === c.id ? 'border-[var(--ok)] bg-[var(--ok-bg)]' : 'border-dashed border-[var(--ok)]/50'}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--ok)]">{describirPremio(c)}</p>
                          <p className="text-[10.5px] text-[var(--ink-soft)]">{c.codigo}{c.vence_en ? ` · vence ${fecha(c.vence_en)}` : ''}</p>
                        </div>
                        <button onClick={() => setCuponId(cuponId === c.id ? null : c.id)} className="btn btn-sm">
                          {cuponId === c.id ? 'Quitar' : 'Usar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : nuevoCliente ? (
              <div className="rounded-lg border border-[var(--paper-line)] p-3 space-y-2">
                <input value={nuevoCliente.telefono} onChange={e => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} placeholder="WhatsApp (ej. 3815123456)" inputMode="tel" className="input input-sm" autoFocus />
                <input value={nuevoCliente.nombre} onChange={e => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} placeholder="Nombre (opcional)" className="input input-sm" />
                <button onClick={() => setNuevoCliente(null)} className="text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]">Cancelar</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={busqueda}
                  onChange={e => { setBusqueda(e.target.value); if (e.target.value.trim().length < 2) setResultados([]) }}
                  placeholder="Buscar por WhatsApp o nombre..."
                  className="input"
                />
                {busqueda.trim().length >= 2 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 card shadow-lg overflow-hidden">
                    {resultados.map(r => (
                      <button key={r.id} onClick={() => elegirCliente(r)} className="w-full text-left px-3 py-2 hover:bg-[var(--paper)] border-b border-[var(--paper-line)] last:border-b-0">
                        <p className="text-sm font-medium">{r.nombre ?? 'Sin nombre'}</p>
                        <p className="text-xs text-[var(--ink-soft)]">
                          {r.telefono}
                          {r.cupones.length > 0 && <span className="text-[var(--ok)] font-semibold"> · {r.cupones.length} cupón disponible</span>}
                        </p>
                      </button>
                    ))}
                    {!buscando && resultados.length === 0 && <p className="px-3 py-2 text-xs text-[var(--ink-soft)]">No hay clientes con ese dato.</p>}
                    <button
                      onClick={() => {
                        const digitos = busqueda.replace(/\D/g, '')
                        setNuevoCliente({ telefono: digitos.length >= 6 ? busqueda.trim() : '', nombre: digitos.length >= 6 ? '' : busqueda.trim() })
                        setBusqueda('')
                        setResultados([])
                      }}
                      className="w-full text-left px-3 py-2 text-sm link bg-[var(--paper)]"
                    >
                      + Cargar cliente nuevo
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-[var(--ink-soft)] mt-1">
                  Opcional. Cargalo para que la compra sume a su premio{fidelidad.activo ? ` (cada ${fidelidad.compras_necesarias} compras)` : ''}.
                </p>
              </div>
            )}
          </div>

          {/* canal, modalidad, pago */}
          <div className="border-t border-[var(--paper-line)] pt-4 space-y-3">
            <Opciones label="Canal" valor={canal} opciones={CANALES} onChange={v => { setCanal(v); if (v === 'mostrador' && modalidad === 'delivery') setModalidad('take_away') }} />
            <Opciones label="Modalidad" valor={modalidad} opciones={MODALIDADES} onChange={setModalidad} />
            {modalidad === 'delivery' && (
              <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección de entrega" className="input" />
            )}
            <Opciones label="Pago" valor={medioPago} opciones={MEDIOS_PAGO} onChange={setMedioPago} />
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Notas (sin cebolla, timbre 2B...)" className="input" />
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[var(--ink-soft)]">Queda como</span>
              <select value={estado} onChange={e => setEstadoManual(e.target.value)} className="input input-sm w-auto">
                {['entregado', 'confirmado', 'en_preparacion', 'pendiente'].map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
              </select>
            </div>
          </div>

          {/* totales */}
          <div className="border-t border-[var(--paper-line)] pt-3 space-y-1 text-sm">
            <p className="flex justify-between text-[var(--ink-soft)]"><span>Subtotal</span><span className="tabular">{pesos(subtotalProductos + (regalo?.precio ?? 0))}</span></p>
            {descuento > 0 && (
              <p className="flex justify-between text-[var(--ok)]"><span>Cupón {cupon?.codigo}</span><span className="tabular">−{pesos(descuento)}</span></p>
            )}
            <p className="flex justify-between text-lg font-bold pt-1"><span>Total</span><span className="tabular">{pesos(total)}</span></p>
          </div>

          <MensajeError error={error} />

          <button onClick={registrar} disabled={enviando || lineas.length === 0} className="btn btn-ember w-full py-3 text-base">
            {enviando ? 'Registrando...' : `Registrar venta · ${pesos(total)}`}
          </button>
        </div>
      </div>

      {/* barra fija en celular */}
      {lineas.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[var(--char)] px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-white text-sm">{unidades} {unidades === 1 ? 'producto' : 'productos'} · <b className="tabular">{pesos(total)}</b></span>
          <a href="#ticket" className="btn btn-ember btn-sm">Ver ticket y cobrar</a>
        </div>
      )}
    </div>
  )
}

function Opciones({ label, valor, opciones, onChange }: { label: string; valor: string; opciones: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(opciones).map(([v, l]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              valor === v ? 'bg-[var(--ink)] text-white border-[var(--ink)]' : 'border-[var(--paper-line)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function VentaRegistrada({
  resultado,
  plantilla,
  onNueva,
}: {
  resultado: Extract<ResultadoVenta, { ok: true }>
  plantilla: string | null
  onNueva: () => void
}) {
  const g = resultado.cuponGanado
  const premio = g ? describirPremio(g) : ''
  const wa = g
    ? linkWhatsApp(g.cliente_telefono, mensajeCupon(plantilla, { nombre: g.cliente_nombre, compras: g.compras, premio, codigo: g.codigo, vence_en: g.vence_en }))
    : null

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="card p-6 text-center">
        <p className="eyebrow">Venta #{resultado.numero} registrada</p>
        <p className="font-display text-[40px] font-semibold tabular mt-1">{pesos(resultado.total)}</p>
        <p className="sub">El stock ya se descontó según la receta de cada producto.</p>
      </div>

      {g && (
        <div className="card p-5 border-[var(--ok)] bg-[var(--ok-bg)]">
          <p className="font-display text-[19px] font-semibold text-[var(--ok)]">
            {g.cliente_nombre?.split(' ')[0] ?? 'El cliente'} ganó su premio por {g.compras} compras
          </p>
          <p className="text-sm mt-1">{premio}</p>
          <p className="text-sm mt-2">
            Código <b className="tabular tracking-wider">{g.codigo}</b>
            {g.vence_en ? ` · vale hasta el ${fecha(g.vence_en)}` : ''}
          </p>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-3">Avisarle por WhatsApp</a>
          )}
        </div>
      )}

      {resultado.alertas.length > 0 && (
        <div className="card p-5 border-[var(--warn)]/40 bg-[var(--warn-bg)]">
          <p className="text-sm font-semibold text-[var(--warn)]">Stock bajo el mínimo</p>
          <ul className="mt-1.5 space-y-0.5 text-sm">
            {resultado.alertas.map(a => (
              <li key={a.nombre}>
                {a.nombre}: quedan {fmtCantidad(a.stock_actual, a.unidad)} (mínimo {fmtCantidad(a.stock_minimo, a.unidad)})
              </li>
            ))}
          </ul>
          <Link href="/compras?nueva=1" className="link text-sm mt-2 inline-block">Cargar una compra →</Link>
        </div>
      )}

      <div className="flex gap-2 justify-center">
        <button onClick={onNueva} className="btn btn-ember px-6">Nueva venta</button>
        <Link href="/ventas" className="btn">Ver ventas</Link>
      </div>
    </div>
  )
}
