import Link from 'next/link'
import { q } from '@/lib/db'
import { cantidad, fechaHora, pesos } from '@/lib/formato'
import { TIPO_MOVIMIENTO, labelTamano, tamanosDe } from '@/lib/catalogo'
import TablaStock, { type InsumoFila } from '@/components/TablaStock'
import KpiCard from '@/components/KpiCard'
import { SQL_PRECIO_VALIDO } from '@/lib/proveedores'

export const dynamic = 'force-dynamic'

async function getInsumos(): Promise<InsumoFila[]> {
  return q<InsumoFila>(`
    with dias as (
      -- días con datos de ventas (máx. 14) para el consumo promedio
      select greatest(1, least(14, ceil(extract(epoch from now() - min(creado_en)) / 86400)))::numeric as n
        from movimientos_stock where tipo = 'venta' and creado_en >= now() - interval '14 days'
    ),
    consumo as (
      select insumo_id, -sum(cantidad) as total
        from movimientos_stock
       where tipo in ('venta', 'cancelacion') and creado_en >= now() - interval '14 days'
       group by insumo_id
    ),
    en_camino as (
      select ci.insumo_id, sum(ci.cantidad_pedida * i.equivalencia) as cantidad,
             string_agg(distinct pr.nombre, ', ') as proveedores
        from compras co
        join compra_items ci on ci.compra_id = co.id
        join insumos i on i.id = ci.insumo_id
        join proveedores pr on pr.id = co.proveedor_id
       where co.estado = 'pedida'
       group by ci.insumo_id
    )
    select i.id, i.nombre, i.categoria, i.unidad, i.unidad_compra, i.equivalencia, i.stock_actual, i.stock_minimo,
           i.costo_unitario, i.activo, i.notas,
           coalesce(c.total, 0) / coalesce((select n from dias), 14) as consumo_diario,
           coalesce(e.cantidad, 0) as en_camino,
           e.proveedores as en_camino_de,
           mp.proveedor as mejor_proveedor,
           mp.precio as mejor_precio,
           (select count(*) from receta_items ri where ri.insumo_id = i.id)::int as usos
      from insumos i
      left join consumo c on c.insumo_id = i.id
      left join en_camino e on e.insumo_id = i.id
      left join lateral (
        select pr.nombre as proveedor, x.precio
          from (select distinct on (pp.proveedor_id) pp.proveedor_id, pp.precio
                  from precios_proveedor pp
                 where pp.insumo_id = i.id and ${SQL_PRECIO_VALIDO}
                 order by pp.proveedor_id, pp.fecha desc, pp.creado_en desc) x
          join proveedores pr on pr.id = x.proveedor_id and pr.activo
         order by x.precio
         limit 1
      ) mp on true
     order by i.nombre
  `)
}

export default async function StockPage() {
  const [insumos, produccion, movimientos] = await Promise.all([
    getInsumos(),
    q<{ id: string; nombre: string; categoria: string; tamano: string; posibles: number; limitante: string; precio: number | null }>(`
      select p.id, p.nombre, p.categoria, x.tamano,
             min(floor(greatest(i.stock_actual, 0) / x.cant))::int as posibles,
             (array_agg(i.nombre order by greatest(i.stock_actual, 0) / x.cant))[1] as limitante,
             case x.tamano when 'simple' then p.precio_simple when 'doble' then p.precio_doble else p.precio_triple end as precio
        from productos p
        join receta_items ri on ri.producto_id = p.id
        join insumos i on i.id = ri.insumo_id
        cross join lateral (values ('simple', ri.cant_simple), ('doble', ri.cant_doble), ('triple', ri.cant_triple)) as x(tamano, cant)
       where p.activo and x.cant > 0
       group by p.id, p.nombre, p.categoria, x.tamano, p.precio_simple, p.precio_doble, p.precio_triple
       order by p.categoria, p.nombre
    `),
    q<{ id: string; tipo: string; cantidad: number; nota: string | null; creado_en: string; insumo: string; insumo_id: string; unidad: string; compra_numero: number | null }>(`
      select m.id, m.tipo, m.cantidad, m.nota, m.creado_en, i.nombre as insumo, i.id as insumo_id, i.unidad,
             co.numero as compra_numero
        from movimientos_stock m
        join insumos i on i.id = m.insumo_id
        left join compras co on co.id = m.compra_id
       where m.tipo not in ('venta', 'cancelacion')
       order by m.creado_en desc
       limit 15
    `),
  ])

  const activos = insumos.filter(i => i.activo)
  const valorStock = activos.reduce((acc, i) => acc + Math.max(0, i.stock_actual) * i.costo_unitario, 0)
  const bajos = activos.filter(i => i.stock_actual <= i.stock_minimo)
  const sinStock = activos.filter(i => i.stock_actual <= 0)
  const enCamino = activos.filter(i => i.en_camino > 0)

  // producción posible agrupada por producto
  const porProducto = new Map<string, { nombre: string; categoria: string; tamanos: Record<string, { posibles: number; limitante: string }> }>()
  for (const f of produccion) {
    if (f.precio == null || !tamanosDe(f.categoria).includes(f.tamano as 'simple')) continue
    const e = porProducto.get(f.id) ?? { nombre: f.nombre, categoria: f.categoria, tamanos: {} }
    e.tamanos[f.tamano] = { posibles: f.posibles, limitante: f.limitante }
    porProducto.set(f.id, e)
  }
  const categoriasProd = [...new Set([...porProducto.values()].map(p => p.categoria))]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">Stock</h1>
          <p className="sub mt-1">Cada venta descuenta los insumos según la receta del producto y el tamaño.</p>
        </div>
        <Link href="/compras?nueva=1" className="btn btn-primary">+ Cargar compra</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Valor del stock" value={pesos(valorStock)} hint="a último costo de compra" accent="ink" />
        <KpiCard label="Bajo el mínimo" value={String(bajos.length)} hint={bajos.length ? bajos.slice(0, 3).map(b => b.nombre).join(', ') : 'Todo en orden'} accent={bajos.length ? 'danger' : 'ok'} />
        <KpiCard label="Sin stock" value={String(sinStock.length)} hint={sinStock.length ? sinStock.map(b => b.nombre).join(', ') : 'Ninguno'} accent={sinStock.length ? 'danger' : 'ok'} />
        <KpiCard label="Insumos en camino" value={String(enCamino.length)} hint="compras pedidas sin recibir" accent="neutral" />
      </div>

      {bajos.length > 0 && (
        <div className="card border-[var(--danger)]/30">
          <div className="card-head bg-[var(--danger-bg)] rounded-t-lg">
            <h2 className="h2 text-[var(--danger)]">Hay que reponer</h2>
            <Link href="/compras?nueva=1" className="link text-sm">Armar compra →</Link>
          </div>
          <ul className="divide-y divide-[var(--paper-line)]">
            {bajos.sort((a, b) => a.stock_actual / (a.stock_minimo || 1) - b.stock_actual / (b.stock_minimo || 1)).map(i => {
              const dias = i.consumo_diario > 0 ? Math.max(0, i.stock_actual) / i.consumo_diario : null
              return (
                <li key={i.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <Link href={`/stock/${i.id}`} className="font-semibold hover:underline">{i.nombre}</Link>
                    <span className="text-[var(--ink-soft)]"> · quedan {cantidad(i.stock_actual, i.unidad)} (mínimo {cantidad(i.stock_minimo, i.unidad)})</span>
                    {dias != null && <span className="text-[var(--danger)] font-medium"> · alcanza para {dias < 1 ? 'menos de 1 día' : `~${Math.floor(dias)} ${Math.floor(dias) === 1 ? 'día' : 'días'}`}</span>}
                  </div>
                  <div className="text-xs text-[var(--ink-soft)] text-right">
                    {i.en_camino > 0
                      ? <span className="chip chip-info">En camino: {cantidad(i.en_camino, i.unidad)} de {i.en_camino_de}</span>
                      : i.mejor_proveedor
                        ? <>Más barato: <b>{i.mejor_proveedor}</b> a {pesos(i.mejor_precio)}/{i.unidad_compra}</>
                        : 'Sin proveedor cargado'}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <TablaStock insumos={insumos} />

      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="h2">¿Para cuántas ventas alcanza?</h2>
            <p className="text-xs text-[var(--ink-soft)] mt-0.5">Unidades que se pueden hacer de cada producto con el stock de hoy, y qué insumo se termina primero</p>
          </div>
        </div>
        {porProducto.size === 0 ? (
          <p className="px-6 py-6 sub">Cargá las recetas en Menú y recetas para ver este cálculo.</p>
        ) : (
          <div className="overflow-x-auto">
            {categoriasProd.map(cat => {
              const tamanos = tamanosDe(cat)
              return (
                <table key={cat} className="tabla">
                  <thead>
                    <tr>
                      <th>{cat === 'hamburguesa' ? 'Hamburguesitas' : cat === 'pizzita' ? 'Pizzitas' : cat}</th>
                      {tamanos.map(t => <th key={t} className="num">{labelTamano(cat, t)}</th>)}
                      <th>Se termina primero</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...porProducto.entries()].filter(([, p]) => p.categoria === cat).map(([id, p]) => {
                      const primero = Object.values(p.tamanos).sort((a, b) => a.posibles - b.posibles)[0]
                      return (
                        <tr key={id}>
                          <td className="font-medium">{p.nombre}</td>
                          {tamanos.map(t => {
                            const v = p.tamanos[t]
                            return (
                              <td key={t} className={`num tabular ${v && v.posibles <= 5 ? 'text-[var(--danger)] font-semibold' : v && v.posibles <= 15 ? 'text-[var(--warn)] font-semibold' : ''}`}>
                                {v ? v.posibles : '-'}
                              </td>
                            )
                          })}
                          <td className="text-[var(--ink-soft)] text-xs">{primero?.limitante ?? '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="h2">Últimos movimientos manuales y compras</h2>
          <span className="text-xs text-[var(--ink-soft)]">Los consumos por venta se ven en el detalle de cada insumo</span>
        </div>
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead>
              <tr><th>Fecha</th><th>Insumo</th><th>Tipo</th><th className="num">Cantidad</th><th>Detalle</th></tr>
            </thead>
            <tbody>
              {movimientos.map(m => (
                <tr key={m.id}>
                  <td className="text-xs text-[var(--ink-soft)] whitespace-nowrap">{fechaHora(m.creado_en)}</td>
                  <td><Link href={`/stock/${m.insumo_id}`} className="hover:underline">{m.insumo}</Link></td>
                  <td><span className={`chip ${TIPO_MOVIMIENTO[m.tipo]?.color}`}>{TIPO_MOVIMIENTO[m.tipo]?.label ?? m.tipo}</span></td>
                  <td className={`num tabular font-medium ${m.cantidad < 0 ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}`}>
                    {m.cantidad > 0 ? '+' : ''}{cantidad(m.cantidad, m.unidad)}
                  </td>
                  <td className="text-xs text-[var(--ink-soft)]">{m.compra_numero ? `Compra #${m.compra_numero}` : m.nota ?? ''}</td>
                </tr>
              ))}
              {movimientos.length === 0 && <tr><td colSpan={5} className="text-center sub py-6">Todavía no hay movimientos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
