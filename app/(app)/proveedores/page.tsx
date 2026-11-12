import Link from 'next/link'
import { q } from '@/lib/db'
import { duracionHoras, fecha, linkWhatsApp, num, pesos } from '@/lib/formato'
import { getProveedoresScore, SQL_PRECIOS_VIGENTES, type ProveedorScore } from '@/lib/proveedores'
import { BotonNuevoProveedor } from '@/components/Proveedores'
import { chipVelocidad } from '@/lib/score'

export const dynamic = 'force-dynamic'

export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<{ vista?: string; todos?: string }> }) {
  const { vista, todos } = await searchParams
  const comparar = vista === 'comparar'

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">Proveedores</h1>
          <p className="sub mt-1">Precio, velocidad de entrega y cumplimiento de cada uno, medidos con las compras reales.</p>
        </div>
        <BotonNuevoProveedor />
      </div>

      <div className="flex gap-1 bg-[var(--paper-card)] border border-[var(--paper-line)] rounded-lg p-1 w-fit">
        <Link href="/proveedores" className={`px-3 py-1.5 rounded-md text-xs font-medium ${!comparar ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--paper)]'}`}>Proveedores</Link>
        <Link href="/proveedores?vista=comparar" className={`px-3 py-1.5 rounded-md text-xs font-medium ${comparar ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--paper)]'}`}>Comparar precios</Link>
      </div>

      {comparar ? <Comparativa todos={todos === '1'} /> : <Tarjetas />}
    </div>
  )
}

async function Tarjetas() {
  const proveedores = await getProveedoresScore()
  if (proveedores.length === 0) {
    return <div className="card px-6 py-10 text-center sub">Todavía no hay proveedores. Cargá el primero con el botón de arriba.</div>
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {proveedores.map(p => <TarjetaProveedor key={p.id} p={p} />)}
    </div>
  )
}

function TarjetaProveedor({ p }: { p: ProveedorScore }) {
  const vel = chipVelocidad(p)
  const wa = linkWhatsApp(p.telefono, `Hola${p.contacto ? ' ' + p.contacto : ''}! Te escribo de La Sazón.`)
  return (
    <div className={`card p-5 space-y-4 ${p.activo ? '' : 'opacity-55'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/proveedores/${p.id}`} className="font-display text-[19px] font-semibold hover:underline">{p.nombre}</Link>
          <p className="text-xs text-[var(--ink-soft)]">
            {[p.rubro, p.dias_entrega && `entrega ${p.dias_entrega}`, p.condicion_pago && `pago ${/^\d/.test(p.condicion_pago) ? 'a ' : ''}${p.condicion_pago.toLowerCase()}`]
              .filter(Boolean).join(' · ') || 'Sin datos'}
          </p>
        </div>
        <div className="flex gap-1.5">
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-sm">WhatsApp</a>}
          <Link href={`/compras?nueva=1&proveedor=${p.id}`} className="btn btn-sm btn-primary">Pedir</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Metrica titulo="Velocidad" ayuda={p.demora_prometida_horas != null ? `promete ${duracionHoras(p.demora_prometida_horas)}` : 'sin demora prometida'}>
          <span className={`chip ${vel.color}`}>{vel.texto}</span>
        </Metrica>
        <Metrica titulo="A tiempo" ayuda={`${p.compras_recibidas} entregas`}>
          <b className={`tabular ${p.a_tiempo_pct != null && p.a_tiempo_pct < 70 ? 'text-[var(--danger)]' : ''}`}>{p.a_tiempo_pct != null ? `${num(p.a_tiempo_pct, 0)}%` : '-'}</b>
        </Metrica>
        <Metrica titulo="Entrega completa" ayuda="cantidad recibida / pedida">
          <b className={`tabular ${p.cumplimiento_pct != null && p.cumplimiento_pct < 95 ? 'text-[var(--warn)]' : ''}`}>{p.cumplimiento_pct != null ? `${num(p.cumplimiento_pct, 0)}%` : '-'}</b>
        </Metrica>
        <Metrica titulo="Precio" ayuda={p.comparables ? `comparado en ${p.comparables} insumos` : `${p.insumos_en_lista} insumos en lista`}>
          {p.comparables > 0 ? (
            <b className="tabular">
              {p.mas_barato_en}/{p.comparables} <span className="font-normal text-xs">más barato</span>
            </b>
          ) : <span className="text-[var(--ink-soft)]">-</span>}
        </Metrica>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--ink-soft)] border-t border-[var(--paper-line)] pt-3">
        <span>Compras 30 días: <b className="text-[var(--ink)] tabular">{pesos(p.gastado_30d)}</b></span>
        {p.deuda > 0 && <span className="text-[var(--danger)]">Le debés <b className="tabular">{pesos(p.deuda)}</b></span>}
        {p.pendientes > 0 && <span className={p.atrasadas ? 'text-[var(--danger)]' : ''}>{p.pendientes} pedido{p.pendientes > 1 ? 's' : ''} en camino{p.atrasadas ? ` (${p.atrasadas} atrasado)` : ''}</span>}
        {p.sobreprecio_pct != null && p.sobreprecio_pct >= 1 && <span>En promedio {num(p.sobreprecio_pct, 0)}% arriba del más barato</span>}
        {p.ultima_compra && <span>Última entrega {fecha(p.ultima_compra)}</span>}
      </div>
    </div>
  )
}

function Metrica({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1">{titulo}</p>
      {children}
      {ayuda && <p className="text-[10.5px] text-[var(--ink-soft)] mt-0.5">{ayuda}</p>}
    </div>
  )
}

async function Comparativa({ todos }: { todos: boolean }) {
  const [precios, ahorro] = await Promise.all([
    q<{ proveedor_id: string; proveedor: string; insumo_id: string; insumo: string; categoria: string; unidad_compra: string; precio: number; fecha: string; viejo: boolean }>(
      `select v.proveedor_id, pr.nombre as proveedor, v.insumo_id, i.nombre as insumo, i.categoria, i.unidad_compra, v.precio, v.fecha,
              v.fecha < current_date - 30 as viejo
         from (${SQL_PRECIOS_VIGENTES}) v
         join proveedores pr on pr.id = v.proveedor_id
         join insumos i on i.id = v.insumo_id and i.activo
        order by i.categoria, i.nombre, v.precio`
    ),
    q<{ insumo: string; proveedor_mejor: string; ahorro: number }>(
      `with vig as (${SQL_PRECIOS_VIGENTES}),
            minimo as (select distinct on (insumo_id) insumo_id, proveedor_id, precio from vig order by insumo_id, precio)
       select i.nombre as insumo, pr.nombre as proveedor_mejor,
              sum((ci.precio_unitario - m.precio) * ci.cantidad_recibida) as ahorro
         from compra_items ci
         join compras c on c.id = ci.compra_id and c.estado = 'recibida' and c.recibida_en >= now() - interval '30 days'
         join minimo m on m.insumo_id = ci.insumo_id and ci.precio_unitario > m.precio and c.proveedor_id <> m.proveedor_id
         join insumos i on i.id = ci.insumo_id
         join proveedores pr on pr.id = m.proveedor_id
        group by i.nombre, pr.nombre
        order by ahorro desc`
    ),
  ])

  // por defecto sólo lo que se puede comparar (lo vende más de un proveedor)
  const cuantos = new Map<string, number>()
  for (const p of precios) cuantos.set(p.insumo_id, (cuantos.get(p.insumo_id) ?? 0) + 1)
  const unicos = [...cuantos.values()].filter(n => n === 1).length
  const visibles = precios.filter(p => todos || (cuantos.get(p.insumo_id) ?? 0) > 1)
  const proveedores = [...new Map(visibles.map(p => [p.proveedor_id, p.proveedor])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const insumos = [...new Map(visibles.map(p => [p.insumo_id, { nombre: p.insumo, categoria: p.categoria, unidad: p.unidad_compra }])).entries()]
    .sort((a, b) => (cuantos.get(b[0]) ?? 0) - (cuantos.get(a[0]) ?? 0) || a[1].nombre.localeCompare(b[1].nombre))
  const totalAhorro = ahorro.reduce((a, x) => a + x.ahorro, 0)

  return (
    <div className="space-y-5">
      {totalAhorro > 0 && (
        <div className="card p-5 border-[var(--warn)]/40 bg-[var(--warn-bg)]">
          <p className="text-sm">
            Comprando todo al proveedor más barato, en los últimos 30 días se hubieran ahorrado <b className="tabular text-[var(--warn)] text-base">{pesos(totalAhorro)}</b> (a precios de hoy).
          </p>
          <ul className="mt-2 text-xs space-y-0.5 text-[var(--ink-soft)]">
            {ahorro.slice(0, 4).map(a => (
              <li key={a.insumo}>{a.insumo}: {pesos(a.ahorro)} comprándole a <b className="text-[var(--ink)]">{a.proveedor_mejor}</b></li>
            ))}
          </ul>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="card-head">
          <div>
            <h2 className="h2">Precio vigente por insumo</h2>
            <p className="text-xs text-[var(--ink-soft)] mt-0.5">por unidad de compra · en verde el más barato</p>
          </div>
          {unicos > 0 && (
            <Link href={todos ? '/proveedores?vista=comparar' : '/proveedores?vista=comparar&todos=1'} className="link text-xs">
              {todos ? 'Ver sólo los que se pueden comparar' : `Ver también ${unicos} insumos con un solo proveedor`}
            </Link>
          )}
        </div>
        {insumos.length === 0 ? (
          <p className="px-6 py-8 sub">Cargá precios en la ficha de cada proveedor para poder comparar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Insumo</th>
                  {proveedores.map(([id, nombre]) => <th key={id} className="num"><Link href={`/proveedores/${id}`} className="hover:underline">{nombre}</Link></th>)}
                  <th className="num">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map(([insumoId, ins]) => {
                  const fila = precios.filter(p => p.insumo_id === insumoId)
                  const min = Math.min(...fila.map(f => f.precio))
                  const max = Math.max(...fila.map(f => f.precio))
                  return (
                    <tr key={insumoId}>
                      <td className="whitespace-nowrap">
                        <Link href={`/stock/${insumoId}`} className="font-medium hover:underline">{ins.nombre}</Link>
                        <p className="text-[11px] text-[var(--ink-soft)]">por {ins.unidad}</p>
                      </td>
                      {proveedores.map(([provId]) => {
                        const c = fila.find(f => f.proveedor_id === provId)
                        if (!c) return <td key={provId} className="num text-[var(--paper-line)]">—</td>
                        const esMin = c.precio === min && fila.length > 1
                        const dif = min > 0 ? ((c.precio - min) / min) * 100 : 0
                        const viejo = c.viejo
                        return (
                          <td key={provId} className="num">
                            <span className={`tabular font-semibold ${esMin ? 'text-[var(--ok)]' : ''}`}>{pesos(c.precio)}</span>
                            {fila.length > 1 && !esMin && <p className="text-[11px] text-[var(--danger)]">+{num(dif, 1)}%</p>}
                            {esMin && <p className="text-[11px] text-[var(--ok)]">más barato</p>}
                            {viejo && <p className="text-[10.5px] text-[var(--warn)]" title={`Precio del ${fecha(c.fecha)}`}>precio viejo</p>}
                          </td>
                        )
                      })}
                      <td className="num text-xs">{fila.length > 1 ? <b className="tabular">{num(((max - min) / min) * 100, 0)}%</b> : <span className="text-[var(--ink-soft)]">un solo proveedor</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
