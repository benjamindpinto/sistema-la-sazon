import Link from 'next/link'
import { notFound } from 'next/navigation'
import { q } from '@/lib/db'
import { duracionHoras, fechaHora, linkWhatsApp, num, pesos } from '@/lib/formato'
import { getProveedoresScore, SQL_PRECIO_VALIDO, SQL_PRECIOS_VIGENTES } from '@/lib/proveedores'
import { chipVelocidad } from '@/lib/score'
import KpiCard from '@/components/KpiCard'
import { BotonEditarProveedor, ListaPrecios, type PrecioLista } from '@/components/Proveedores'

export const dynamic = 'force-dynamic'

export default async function ProveedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [p] = await getProveedoresScore(id)
  if (!p) notFound()

  const [precios, insumos, compras] = await Promise.all([
    q<PrecioLista>(
      `with vig as (${SQL_PRECIOS_VIGENTES}),
            minimo as (select distinct on (v.insumo_id) v.insumo_id, v.precio, pr.nombre as proveedor
                         from vig v join proveedores pr on pr.id = v.proveedor_id
                        where v.proveedor_id <> $1
                        order by v.insumo_id, v.precio)
       select v.insumo_id, i.nombre as insumo, i.unidad_compra, v.precio, v.fecha, v.origen,
              m.precio as minimo, m.proveedor as proveedor_minimo,
              (select pp.precio from precios_proveedor pp
                where pp.proveedor_id = $1 and pp.insumo_id = v.insumo_id and pp.precio <> v.precio and pp.fecha <= v.fecha
                  and ${SQL_PRECIO_VALIDO}
                order by pp.fecha desc, pp.creado_en desc limit 1) as anterior
         from vig v
         join insumos i on i.id = v.insumo_id
         left join minimo m on m.insumo_id = v.insumo_id
        where v.proveedor_id = $1
        order by i.nombre`,
      [id]
    ),
    q<{ id: string; nombre: string; unidad_compra: string }>('select id, nombre, unidad_compra from insumos where activo order by nombre'),
    q<{ id: string; numero: number; estado: string; pedida_en: string; recibida_en: string | null; total: number; pagada: boolean; horas: number; completitud: number | null; items: number }>(
      `select c.id, c.numero, c.estado, c.pedida_en, c.recibida_en, c.total, c.pagada,
              extract(epoch from coalesce(c.recibida_en, now()) - c.pedida_en) / 3600 as horas,
              (select 100.0 * avg(least(ci.cantidad_recibida / ci.cantidad_pedida, 1)) from compra_items ci where ci.compra_id = c.id and c.estado = 'recibida') as completitud,
              (select count(*) from compra_items ci where ci.compra_id = c.id)::int as items
         from compras c where c.proveedor_id = $1
        order by c.pedida_en desc limit 30`,
      [id]
    ),
  ])

  const vel = chipVelocidad(p)
  const wa = linkWhatsApp(p.telefono, `Hola${p.contacto ? ' ' + p.contacto : ''}! Te escribo de La Sazón.`)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/proveedores" className="text-xs link">← Proveedores</Link>
        <div className="flex items-start justify-between flex-wrap gap-3 mt-1">
          <div>
            <h1 className="h1">{p.nombre}{!p.activo && <span className="chip chip-neutral ml-2 align-middle">Dado de baja</span>}</h1>
            <p className="sub mt-1">
              {[p.rubro, p.contacto && `Contacto: ${p.contacto}`, p.telefono, p.dias_entrega && `Entrega ${p.dias_entrega}`, p.condicion_pago && `Pago ${p.condicion_pago}`]
                .filter(Boolean).join(' · ')}
            </p>
            {(p.direccion || p.cuit || p.email || p.notas) && (
              <p className="text-xs text-[var(--ink-soft)] mt-1">{[p.direccion, p.cuit && `CUIT ${p.cuit}`, p.email, p.notas].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn">WhatsApp</a>}
            <BotonEditarProveedor proveedor={p} />
            <Link href={`/compras?nueva=1&proveedor=${p.id}`} className="btn btn-primary">Hacer pedido</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="eyebrow mb-2">Velocidad real</p>
          <span className={`chip ${vel.color}`}>{vel.texto}</span>
          <p className="text-xs text-[var(--ink-soft)] mt-2">
            {p.demora_prometida_horas != null ? `Promete ${duracionHoras(p.demora_prometida_horas)}` : 'No cargaste lo que promete'}
            {p.a_tiempo_pct != null ? ` · ${num(p.a_tiempo_pct, 0)}% a tiempo` : ''}
          </p>
        </div>
        <KpiCard label="Entrega completa" value={p.cumplimiento_pct != null ? `${num(p.cumplimiento_pct, 0)}%` : '-'} hint="de lo pedido, en las últimas 20" accent={p.cumplimiento_pct != null && p.cumplimiento_pct < 95 ? 'danger' : 'ok'} />
        <KpiCard label="Compras 30 días" value={pesos(p.gastado_30d)} hint={`${p.compras_recibidas} entregas medidas`} accent="ink" />
        <KpiCard label="Le debés" value={pesos(p.deuda)} hint={p.deuda > 0 ? 'compras recibidas sin pagar' : 'Al día'} accent={p.deuda > 0 ? 'danger' : 'ok'} />
      </div>

      <ListaPrecios proveedorId={p.id} precios={precios} insumos={insumos} />

      <div className="card">
        <div className="card-head"><h2 className="h2">Compras</h2><Link href="/compras" className="link text-xs">Ver todas →</Link></div>
        {compras.length === 0 ? (
          <p className="px-6 py-6 sub">Todavía no le compraste nada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>#</th><th>Pedida</th><th>Demora</th><th className="num">Completa</th><th className="num">Total</th><th>Estado</th></tr></thead>
              <tbody>
                {compras.map(c => {
                  const tarde = p.demora_prometida_horas != null && c.horas > p.demora_prometida_horas
                  return (
                    <tr key={c.id} className={c.estado === 'cancelada' ? 'opacity-50' : ''}>
                      <td><Link href={`/compras?ver=${c.id}`} className="link tabular">#{c.numero}</Link></td>
                      <td className="text-xs whitespace-nowrap">{fechaHora(c.pedida_en)}</td>
                      <td>
                        {c.estado === 'cancelada' ? '-' : (
                          <span className={`chip ${tarde ? (c.estado === 'pedida' ? 'chip-danger' : 'chip-warn') : c.estado === 'pedida' ? 'chip-info' : 'chip-ok'}`}>
                            {c.estado === 'pedida' ? `Esperando ${duracionHoras(c.horas)}` : duracionHoras(c.horas)}
                          </span>
                        )}
                      </td>
                      <td className={`num tabular ${c.completitud != null && c.completitud < 100 ? 'text-[var(--warn)] font-semibold' : ''}`}>
                        {c.completitud != null ? `${num(c.completitud, 0)}%` : '-'}
                      </td>
                      <td className="num tabular">{pesos(c.total)}</td>
                      <td>
                        {c.estado === 'cancelada' ? <span className="chip chip-danger">Anulada</span>
                          : c.estado === 'pedida' ? <span className="chip chip-info">Por recibir</span>
                          : <span className={`chip ${c.pagada ? 'chip-ok' : 'chip-danger'}`}>{c.pagada ? 'Pagada' : 'Sin pagar'}</span>}
                      </td>
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
