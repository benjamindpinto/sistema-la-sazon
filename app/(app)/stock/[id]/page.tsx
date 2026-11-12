import Link from 'next/link'
import { notFound } from 'next/navigation'
import { q, q1 } from '@/lib/db'
import { cantidad, fecha, fechaHora, num, pesos, plural } from '@/lib/formato'
import { TIPO_MOVIMIENTO, labelTamano, tamanosDe } from '@/lib/catalogo'
import { medianocheAR } from '@/lib/periodo'
import BarChart from '@/components/BarChart'
import AccionesInsumo from '@/components/AccionesInsumo'
import type { InsumoFila } from '@/components/TablaStock'
import { estadoStock } from '@/lib/stock'

export const dynamic = 'force-dynamic'

export default async function InsumoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const insumo = await q1<InsumoFila>(
    `select i.*, 0::numeric as consumo_diario, 0::numeric as en_camino, null::text as en_camino_de,
            null::text as mejor_proveedor, null::numeric as mejor_precio, 0 as usos
       from insumos i where i.id = $1`,
    [id]
  )
  if (!insumo) notFound()

  const desde = medianocheAR(13)
  const [recetas, precios, movimientos, consumoDiario] = await Promise.all([
    q<{ producto_id: string; nombre: string; categoria: string; cant_simple: number; cant_doble: number; cant_triple: number; precio_doble: number | null; precio_triple: number | null; activo: boolean }>(
      `select p.id as producto_id, p.nombre, p.categoria, p.activo, p.precio_doble, p.precio_triple,
              ri.cant_simple, ri.cant_doble, ri.cant_triple
         from receta_items ri join productos p on p.id = ri.producto_id
        where ri.insumo_id = $1 order by p.categoria, p.nombre`,
      [id]
    ),
    q<{ proveedor_id: string; proveedor: string; precio: number; fecha: string; origen: string; anterior: number | null; demora_prometida_horas: number | null }>(
      `select distinct on (pp.proveedor_id)
              pp.proveedor_id, pr.nombre as proveedor, pp.precio, pp.fecha, pp.origen, pr.demora_prometida_horas,
              (select pp2.precio from precios_proveedor pp2
                where pp2.proveedor_id = pp.proveedor_id and pp2.insumo_id = pp.insumo_id and pp2.precio <> pp.precio
                  and (pp2.fecha, pp2.creado_en) < (pp.fecha, pp.creado_en)
                order by pp2.fecha desc, pp2.creado_en desc limit 1) as anterior
         from precios_proveedor pp join proveedores pr on pr.id = pp.proveedor_id
        where pp.insumo_id = $1 and pr.activo
        order by pp.proveedor_id, pp.fecha desc, pp.creado_en desc`,
      [id]
    ),
    q<{ id: string; tipo: string; cantidad: number; nota: string | null; creado_en: string; venta_numero: number | null; compra_numero: number | null; compra_id: string | null }>(
      `select m.id, m.tipo, m.cantidad, m.nota, m.creado_en, pe.numero as venta_numero, co.numero as compra_numero, co.id as compra_id
         from movimientos_stock m
         left join pedidos pe on pe.id = m.pedido_id
         left join compras co on co.id = m.compra_id
        where m.insumo_id = $1
        order by m.creado_en desc limit 60`,
      [id]
    ),
    q<{ dia: string; consumo: number }>(
      `select to_char((m.creado_en at time zone 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD') as dia,
              -sum(m.cantidad) as consumo
         from movimientos_stock m
        where m.insumo_id = $1 and m.tipo in ('venta', 'cancelacion') and m.creado_en >= $2
        group by 1`,
      [id, desde.toISOString()]
    ),
  ])

  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const serie = Array.from({ length: 14 }, (_, k) => {
    const d = new Date(desde.getTime() + k * 86400000 + 12 * 3600000)
    const clave = d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
    return { label: `${DIAS[d.getUTCDay()]} ${clave.slice(8)}`, value: Math.round(consumoDiario.find(c => c.dia === clave)?.consumo ?? 0) }
  })
  const promedio = serie.reduce((a, s) => a + s.value, 0) / 14
  const est = estadoStock(insumo)
  const masBarato = precios.length ? Math.min(...precios.map(p => p.precio)) : null

  return (
    <div className="space-y-6">
      <div>
        <Link href="/stock" className="text-xs link">← Stock</Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-1">
          <div>
            <h1 className="h1">{insumo.nombre}</h1>
            <p className="sub mt-1">
              {insumo.categoria} · se usa por {insumo.unidad}, se compra por {insumo.unidad_compra}
              {insumo.equivalencia !== 1 && ` (1 ${insumo.unidad_compra} = ${num(insumo.equivalencia)} ${plural(insumo.unidad, insumo.equivalencia)})`}
            </p>
          </div>
          <AccionesInsumo insumo={insumo} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="eyebrow mb-2">Stock</p>
          <p className="font-display text-[28px] font-semibold tabular leading-tight">{cantidad(insumo.stock_actual, insumo.unidad)}</p>
          <span className={`chip ${est.color} mt-1`}>{est.label}</span>
        </div>
        <div className="card p-5">
          <p className="eyebrow mb-2">Mínimo</p>
          <p className="font-display text-[28px] font-semibold tabular leading-tight">{cantidad(insumo.stock_minimo, insumo.unidad)}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow mb-2">Consumo promedio</p>
          <p className="font-display text-[28px] font-semibold tabular leading-tight">{cantidad(promedio, insumo.unidad)}</p>
          <p className="text-xs text-[var(--ink-soft)]">por día · últimos 14 días</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow mb-2">Alcanza para</p>
          <p className="font-display text-[28px] font-semibold tabular leading-tight">
            {promedio > 0 ? `${num(Math.max(0, insumo.stock_actual) / promedio, 1)} días` : '-'}
          </p>
          <p className="text-xs text-[var(--ink-soft)]">al ritmo de venta actual</p>
        </div>
      </div>

      {recetas.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="h2">Qué ventas representa el stock</h2>
              <p className="text-xs text-[var(--ink-soft)] mt-0.5">
                Con {cantidad(insumo.stock_actual, insumo.unidad)} se pueden hacer, sólo mirando este insumo:
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr><th>Producto</th><th>Lleva</th><th>Alcanza para</th></tr>
              </thead>
              <tbody>
                {recetas.map(r => {
                  const tamanos = tamanosDe(r.categoria).filter(t => (t === 'simple' || (t === 'doble' ? r.precio_doble != null : r.precio_triple != null)))
                  const cant = (t: string) => (t === 'simple' ? r.cant_simple : t === 'doble' ? r.cant_doble : r.cant_triple)
                  return (
                    <tr key={r.producto_id} className={r.activo ? '' : 'opacity-50'}>
                      <td><Link href={`/menu/${r.producto_id}`} className="font-medium hover:underline">{r.nombre}</Link></td>
                      <td className="text-xs text-[var(--ink-soft)]">
                        {tamanos.filter(t => cant(t) > 0).map(t => `${labelTamano(r.categoria, t)}: ${cantidad(cant(t), insumo.unidad)}`).join(' · ')}
                      </td>
                      <td className="text-sm">
                        {tamanos.filter(t => cant(t) > 0).map(t => (
                          <span key={t} className="mr-3 whitespace-nowrap">
                            <b className="tabular">{Math.floor(Math.max(0, insumo.stock_actual) / cant(t))}</b> {labelTamano(r.categoria, t).toLowerCase()}
                          </span>
                        ))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="card-head">
            <h2 className="h2">Consumo por día</h2>
            <span className="text-xs text-[var(--ink-soft)]">{plural(insumo.unidad, 2)} · últimos 14 días</span>
          </div>
          <div className="p-4 h-60"><BarChart data={serie} /></div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2 className="h2">Precio por proveedor</h2>
            <span className="text-xs text-[var(--ink-soft)]">por {insumo.unidad_compra}</span>
          </div>
          {precios.length === 0 ? (
            <p className="px-6 py-6 sub">Ningún proveedor tiene precio cargado. Cargalo desde Proveedores.</p>
          ) : (
            <table className="tabla">
              <thead><tr><th>Proveedor</th><th className="num">Precio</th><th className="num">vs. más barato</th><th>Actualizado</th></tr></thead>
              <tbody>
                {precios.sort((a, b) => a.precio - b.precio).map(p => {
                  const dif = masBarato ? ((p.precio - masBarato) / masBarato) * 100 : 0
                  const variacion = p.anterior ? ((p.precio - p.anterior) / p.anterior) * 100 : null
                  return (
                    <tr key={p.proveedor_id}>
                      <td><Link href={`/proveedores/${p.proveedor_id}`} className="font-medium hover:underline">{p.proveedor}</Link></td>
                      <td className="num tabular font-semibold">
                        {pesos(p.precio)}
                        {variacion != null && Math.abs(variacion) >= 0.5 && (
                          <p className={`text-[11px] ${variacion > 0 ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}`}>{variacion > 0 ? '↑' : '↓'} {num(Math.abs(variacion), 1)}%</p>
                        )}
                      </td>
                      <td className="num">{dif < 0.5 ? <span className="chip chip-ok">Más barato</span> : <span className="text-[var(--danger)] text-xs font-semibold">+{num(dif, 1)}%</span>}</td>
                      <td className="text-xs text-[var(--ink-soft)]">{fecha(p.fecha)}{p.origen === 'compra' ? ' · compra' : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2 className="h2">Movimientos</h2><span className="text-xs text-[var(--ink-soft)]">últimos 60</span></div>
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Fecha</th><th>Tipo</th><th className="num">Cantidad</th><th>Detalle</th></tr></thead>
            <tbody>
              {movimientos.map(m => (
                <tr key={m.id}>
                  <td className="text-xs text-[var(--ink-soft)] whitespace-nowrap">{fechaHora(m.creado_en)}</td>
                  <td><span className={`chip ${TIPO_MOVIMIENTO[m.tipo]?.color}`}>{TIPO_MOVIMIENTO[m.tipo]?.label ?? m.tipo}</span></td>
                  <td className={`num tabular font-medium ${m.cantidad < 0 ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}`}>
                    {m.cantidad > 0 ? '+' : ''}{cantidad(m.cantidad, insumo.unidad)}
                  </td>
                  <td className="text-xs text-[var(--ink-soft)]">
                    {m.venta_numero ? `Venta #${m.venta_numero}` : m.compra_numero ? <Link href={`/compras?ver=${m.compra_id}`} className="link">Compra #{m.compra_numero}</Link> : m.nota ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
