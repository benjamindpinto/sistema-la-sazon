import Link from 'next/link'
import { q, q1 } from '@/lib/db'
import { fecha, linkWhatsApp, num, pesos } from '@/lib/formato'
import { ESTADO_CUPON, describirPremio, estadoCupon, mensajeCupon } from '@/lib/premios'
import KpiCard from '@/components/KpiCard'
import ConfigFidelidadForm from '@/components/ConfigFidelidadForm'
import type { ConfigFidelidad } from '@/app/actions/fidelidad'

export const dynamic = 'force-dynamic'

export default async function FidelizacionPage() {
  const [cfg, productos, stats, cerca, porVencer, ultimos] = await Promise.all([
    q1<ConfigFidelidad>('select * from fidelidad_config where id = 1'),
    q<{ id: string; nombre: string; categoria: string; precio_doble: number | null; precio_triple: number | null }>(
      'select id, nombre, categoria, precio_doble, precio_triple from productos where activo order by categoria, nombre'
    ),
    q1<{ emitidos: number; usados: number; regalado: number; ventas: number; ventas_identificadas: number; clientes_activos: number; vencidos: number }>(
      `select
         (select count(*) from cupones where creado_en >= now() - interval '30 days' and estado <> 'anulado')::int as emitidos,
         (select count(*) from cupones where usado_en >= now() - interval '30 days')::int as usados,
         (select count(*) from cupones where estado = 'disponible' and vence_en < now() and vence_en >= now() - interval '30 days')::int as vencidos,
         (select coalesce(sum(descuento), 0) from pedidos where estado <> 'cancelado' and creado_en >= now() - interval '30 days') as regalado,
         (select count(*) from pedidos where estado <> 'cancelado' and creado_en >= now() - interval '30 days')::int as ventas,
         (select count(*) from pedidos where estado <> 'cancelado' and cliente_id is not null and creado_en >= now() - interval '30 days')::int as ventas_identificadas,
         (select count(distinct cliente_id) from pedidos where estado <> 'cancelado' and creado_en >= now() - interval '30 days')::int as clientes_activos`
    ),
    q<{ id: string; nombre: string | null; telefono: string; compras_en_ciclo: number; compras_necesarias: number; ultima: string | null }>(
      `select cl.id, cl.nombre, cl.telefono, v.compras_en_ciclo, v.compras_necesarias,
              (select max(creado_en) from pedidos p where p.cliente_id = cl.id and p.estado <> 'cancelado') as ultima
         from clientes cl join v_progreso_fidelidad v on v.cliente_id = cl.id
        where v.programa_activo and v.compras_necesarias - v.compras_en_ciclo = 1
          and not exists (select 1 from cupones cu where cu.cliente_id = cl.id and cu.estado = 'disponible' and (cu.vence_en is null or cu.vence_en > now()))
        order by ultima desc nulls last limit 12`
    ),
    q<{ id: string; codigo: string; tipo: string; valor: number | null; tamano: string | null; vence_en: string; producto_nombre: string | null; producto_categoria: string | null; cliente_id: string; nombre: string | null; telefono: string }>(
      `select cu.id, cu.codigo, cu.tipo, cu.valor, cu.tamano, cu.vence_en, p.nombre as producto_nombre, p.categoria as producto_categoria,
              cl.id as cliente_id, cl.nombre, cl.telefono
         from cupones cu join clientes cl on cl.id = cu.cliente_id left join productos p on p.id = cu.producto_id
        where cu.estado = 'disponible' and cu.vence_en between now() and now() + interval '7 days'
        order by cu.vence_en`
    ),
    q<{ id: string; codigo: string; origen: string; tipo: string; valor: number | null; tamano: string | null; estado: string; creado_en: string; vence_en: string | null; producto_nombre: string | null; producto_categoria: string | null; cliente_id: string; nombre: string | null }>(
      `select cu.id, cu.codigo, cu.origen, cu.tipo, cu.valor, cu.tamano, cu.estado, cu.creado_en, cu.vence_en,
              p.nombre as producto_nombre, p.categoria as producto_categoria, cl.id as cliente_id, cl.nombre
         from cupones cu join clientes cl on cl.id = cu.cliente_id left join productos p on p.id = cu.producto_id
        order by cu.creado_en desc limit 20`
    ),
  ])

  if (!cfg) return <p className="sub">Falta la configuración de fidelización en la base.</p>

  const identificadas = stats?.ventas ? (stats.ventas_identificadas / stats.ventas) * 100 : 0
  const canje = stats && stats.usados + stats.vencidos > 0 ? (stats.usados / (stats.usados + stats.vencidos)) * 100 : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Fidelización</h1>
        <p className="sub mt-1">Premios automáticos para los clientes que vuelven. Las reglas se ajustan cuando quieras.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Premios entregados" value={String(stats?.emitidos ?? 0)} hint="últimos 30 días" accent="ember" />
        <KpiCard label="Canjeados" value={String(stats?.usados ?? 0)} hint={canje != null ? `${num(canje, 0)}% de los que vencían o se usaron` : 'últimos 30 días'} accent="ok" />
        <KpiCard label="Valor regalado" value={pesos(stats?.regalado ?? 0)} hint="en descuentos y productos" accent="ink" />
        <KpiCard
          label="Ventas con cliente"
          value={`${num(identificadas, 0)}%`}
          hint={identificadas < 60 ? 'Cargá el WhatsApp en cada venta para que sume' : `${stats?.clientes_activos ?? 0} clientes compraron`}
          accent={identificadas < 60 ? 'danger' : 'ok'}
        />
      </div>

      <ConfigFidelidadForm config={cfg} productos={productos} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="h2">A una compra del premio</h2>
              <p className="text-xs text-[var(--ink-soft)] mt-0.5">Un mensaje ahora suele traerlos de vuelta</p>
            </div>
          </div>
          {cerca.length === 0 ? <p className="px-6 py-6 sub">Nadie está a una compra del premio.</p> : (
            <ul className="divide-y divide-[var(--paper-line)]">
              {cerca.map(c => {
                const wa = linkWhatsApp(c.telefono, `¡Hola${c.nombre ? ' ' + c.nombre.split(' ')[0] : ''}! Te falta una sola compra en La Sazón para ganarte tu premio. ¡Te esperamos!`)
                return (
                  <li key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <Link href={`/clientes/${c.id}`} className="text-sm font-medium hover:underline">{c.nombre ?? c.telefono}</Link>
                      <p className="text-xs text-[var(--ink-soft)]">{c.compras_en_ciclo} de {c.compras_necesarias} · última compra {fecha(c.ultima)}</p>
                    </div>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Escribirle</a>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="h2">Cupones por vencer</h2>
              <p className="text-xs text-[var(--ink-soft)] mt-0.5">Vencen en los próximos 7 días y todavía no se usaron</p>
            </div>
          </div>
          {porVencer.length === 0 ? <p className="px-6 py-6 sub">No hay cupones por vencer.</p> : (
            <ul className="divide-y divide-[var(--paper-line)]">
              {porVencer.map(c => {
                const premio = describirPremio(c)
                const wa = linkWhatsApp(c.telefono, mensajeCupon(cfg.mensaje, { nombre: c.nombre, compras: cfg.compras_necesarias, premio, codigo: c.codigo, vence_en: c.vence_en }))
                return (
                  <li key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <Link href={`/clientes/${c.cliente_id}`} className="text-sm font-medium hover:underline">{c.nombre ?? c.telefono}</Link>
                      <p className="text-xs text-[var(--ink-soft)]">{premio} · vence {fecha(c.vence_en)}</p>
                    </div>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Recordarle</a>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2 className="h2">Últimos cupones</h2></div>
        <div className="overflow-x-auto">
          <table className="tabla">
            <thead><tr><th>Código</th><th>Cliente</th><th>Premio</th><th>Origen</th><th>Fecha</th><th>Estado</th></tr></thead>
            <tbody>
              {ultimos.map(c => {
                const est = estadoCupon(c)
                return (
                  <tr key={c.id}>
                    <td className="tabular text-xs tracking-wide">{c.codigo}</td>
                    <td><Link href={`/clientes/${c.cliente_id}`} className="hover:underline">{c.nombre ?? 'Sin nombre'}</Link></td>
                    <td className="text-sm">{describirPremio(c)}</td>
                    <td className="text-xs">{c.origen === 'fidelidad' ? 'Por compras' : 'Regalo manual'}</td>
                    <td className="text-xs whitespace-nowrap">{fecha(c.creado_en)}</td>
                    <td><span className={`chip ${ESTADO_CUPON[est].color}`}>{ESTADO_CUPON[est].label}</span></td>
                  </tr>
                )
              })}
              {ultimos.length === 0 && <tr><td colSpan={6} className="text-center sub py-6">Todavía no se generaron cupones.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
