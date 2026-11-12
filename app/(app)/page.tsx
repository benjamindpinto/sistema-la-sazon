import Link from 'next/link'
import { q, q1 } from '@/lib/db'
import { CANALES, ESTADO_COLOR, ESTADO_LABEL, MEDIOS_PAGO, MODALIDADES, labelCategoria } from '@/lib/catalogo'
import { cantidad, haceCuanto, num, pesos, ZONA_AR } from '@/lib/formato'
import { PERIODOS, medianocheAR, parsePeriodo, rangoPeriodo } from '@/lib/periodo'
import KpiCard from '@/components/KpiCard'
import BarChart from '@/components/BarChart'
import DonutChart from '@/components/DonutChart'
import PeriodoSelector from '@/components/PeriodoSelector'
import AlertaCard from '@/components/AlertaCard'

export const dynamic = 'force-dynamic'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const COLORES_CAT: Record<string, string> = { hamburguesa: '#d94f2b', pizzita: '#c9962a', acompanamiento: '#4f7a44', bebida: '#3d6b8c', postre: '#8a5a83' }

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { periodo: p } = await searchParams
  const periodo = parsePeriodo(p, 'hoy')
  const { inicio, dias } = rangoPeriodo(periodo)
  const diasSerie = Math.max(dias, 14)
  const inicioSerie = medianocheAR(diasSerie - 1)
  const desde = inicio.toISOString()

  const [kpis, serie, productos, canales, enCurso, stockCritico, alertas] = await Promise.all([
    q1<{ ventas: number; canceladas: number; ingresos: number; cmv: number; descuentos: number; clientes: number; nuevos: number }>(
      `select count(*) filter (where p.estado <> 'cancelado')::int as ventas,
              count(*) filter (where p.estado = 'cancelado')::int as canceladas,
              coalesce(sum(p.total) filter (where p.estado <> 'cancelado'), 0) as ingresos,
              coalesce(sum(c.costo) filter (where p.estado <> 'cancelado'), 0) as cmv,
              coalesce(sum(p.descuento) filter (where p.estado <> 'cancelado'), 0) as descuentos,
              count(distinct p.cliente_id) filter (where p.estado <> 'cancelado')::int as clientes,
              (select count(*) from clientes where creado_en >= $1)::int as nuevos
         from pedidos p
         left join lateral (select sum(pi.cantidad * coalesce(pi.costo_unitario, 0)) as costo from pedido_items pi where pi.pedido_id = p.id) c on true
        where p.creado_en >= $1`,
      [desde]
    ),
    q<{ dia: string; ventas: number; ingresos: number }>(
      `select to_char((creado_en at time zone '${ZONA_AR}')::date, 'YYYY-MM-DD') as dia,
              count(*)::int as ventas, coalesce(sum(total), 0) as ingresos
         from pedidos where estado <> 'cancelado' and creado_en >= $1
        group by 1`,
      [inicioSerie.toISOString()]
    ),
    q<{ id: string; nombre: string; categoria: string; simple: number; doble: number; triple: number; total: number; ingresos: number; costo: number }>(
      `select pr.id, pr.nombre, pr.categoria,
              coalesce(sum(pi.cantidad) filter (where pi.tamano = 'simple'), 0)::int as simple,
              coalesce(sum(pi.cantidad) filter (where pi.tamano = 'doble'), 0)::int as doble,
              coalesce(sum(pi.cantidad) filter (where pi.tamano = 'triple'), 0)::int as triple,
              sum(pi.cantidad)::int as total,
              sum(pi.cantidad * pi.precio_unitario) filter (where not pi.es_regalo) as ingresos,
              sum(pi.cantidad * coalesce(pi.costo_unitario, 0)) as costo
         from pedido_items pi
         join pedidos p on p.id = pi.pedido_id and p.estado <> 'cancelado' and p.creado_en >= $1
         join productos pr on pr.id = pi.producto_id
        group by pr.id, pr.nombre, pr.categoria
        order by total desc`,
      [desde]
    ),
    q<{ tipo: string; clave: string; ventas: number; ingresos: number }>(
      `select 'canal' as tipo, canal as clave, count(*)::int as ventas, sum(total) as ingresos from pedidos
        where estado <> 'cancelado' and creado_en >= $1 group by canal
       union all
       select 'pago', medio_pago, count(*)::int, sum(total) from pedidos
        where estado <> 'cancelado' and creado_en >= $1 group by medio_pago
       order by 1, 3 desc`,
      [desde]
    ),
    q<{ id: string; numero: number; estado: string; modalidad: string; total: number; creado_en: string; nombre: string | null }>(
      `select p.id, p.numero, p.estado, p.modalidad, p.total, p.creado_en, coalesce(cl.nombre, cl.telefono) as nombre
         from pedidos p left join clientes cl on cl.id = p.cliente_id
        where p.estado in ('pendiente', 'confirmado', 'en_preparacion', 'en_camino')
        order by p.creado_en limit 8`
    ),
    q<{ id: string; nombre: string; unidad: string; stock_actual: number; stock_minimo: number; dias: number | null }>(
      `select i.id, i.nombre, i.unidad, i.stock_actual, i.stock_minimo,
              greatest(i.stock_actual, 0) / nullif(c.diario, 0) as dias
         from insumos i
         left join (select insumo_id, -sum(cantidad) / 7.0 as diario from movimientos_stock
                     where tipo in ('venta', 'cancelacion') and creado_en >= now() - interval '7 days' group by insumo_id) c
           on c.insumo_id = i.id
        where i.activo and (i.stock_actual <= i.stock_minimo or greatest(i.stock_actual, 0) / nullif(c.diario, 0) < 3)
        order by greatest(i.stock_actual, 0) / nullif(c.diario, 0) nulls last, i.stock_actual / nullif(i.stock_minimo, 0)
        limit 6`
    ),
    q1<{ stock_bajo: number; compras_atrasadas: number; compras_atrasadas_detalle: string | null; ventas_demoradas: number; ventas_demoradas_desde: string | null; cupones_por_vencer: number; deuda: number }>(
      `select
         (select count(*) from insumos where activo and stock_actual <= stock_minimo)::int as stock_bajo,
         (select count(*) from compras c join proveedores pr on pr.id = c.proveedor_id
           where c.estado = 'pedida' and pr.demora_prometida_horas is not null
             and now() > c.pedida_en + make_interval(hours => pr.demora_prometida_horas))::int as compras_atrasadas,
         (select string_agg(distinct pr.nombre, ', ') from compras c join proveedores pr on pr.id = c.proveedor_id
           where c.estado = 'pedida' and pr.demora_prometida_horas is not null
             and now() > c.pedida_en + make_interval(hours => pr.demora_prometida_horas)) as compras_atrasadas_detalle,
         (select count(*) from pedidos where (estado = 'pendiente' and creado_en < now() - interval '15 minutes')
             or (estado in ('confirmado', 'en_preparacion') and creado_en < now() - interval '40 minutes'))::int as ventas_demoradas,
         (select min(creado_en) from pedidos where (estado = 'pendiente' and creado_en < now() - interval '15 minutes')
             or (estado in ('confirmado', 'en_preparacion') and creado_en < now() - interval '40 minutes')) as ventas_demoradas_desde,
         (select count(*) from cupones where estado = 'disponible' and vence_en between now() and now() + interval '7 days')::int as cupones_por_vencer,
         (select coalesce(sum(total), 0) from compras where estado = 'recibida' and not pagada) as deuda`
    ),
  ])

  // serie diaria completa (días sin ventas en 0)
  const porDia = new Map(serie.map(s => [s.dia, s]))
  const dias14 = Array.from({ length: diasSerie }, (_, k) => {
    const d = new Date(inicioSerie.getTime() + k * 86400000 + 12 * 3600000)
    const clave = d.toLocaleDateString('en-CA', { timeZone: ZONA_AR })
    const fila = porDia.get(clave)
    return { label: diasSerie > 16 ? clave.slice(8) : DIAS[d.getUTCDay()], ventas: fila?.ventas ?? 0, ingresos: fila?.ingresos ?? 0 }
  })

  const ventas = kpis?.ventas ?? 0
  const ingresos = kpis?.ingresos ?? 0
  const cmv = kpis?.cmv ?? 0
  const margen = ingresos > 0 ? ((ingresos - cmv) / ingresos) * 100 : null
  const ticket = ventas > 0 ? ingresos / ventas : 0
  const etiqueta = PERIODOS[periodo].toLowerCase()

  const porCategoria = new Map<string, number>()
  for (const pr of productos) porCategoria.set(pr.categoria, (porCategoria.get(pr.categoria) ?? 0) + pr.total)
  const donut = [...porCategoria.entries()].map(([c, v]) => ({ label: labelCategoria(c), value: v, color: COLORES_CAT[c] ?? '#a89c88' }))
  const hamburguesas = productos.filter(pr => pr.categoria === 'hamburguesa')
  const totHamb = hamburguesas.reduce((a, h) => ({ s: a.s + h.simple, d: a.d + h.doble, t: a.t + h.triple }), { s: 0, d: 0, t: 0 })
  const totalHamb = totHamb.s + totHamb.d + totHamb.t

  const ahora = new Date()
  const fechaLegible = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA_AR })
  const horaLegible = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: ZONA_AR })

  const hayAlertas = alertas && (alertas.stock_bajo || alertas.compras_atrasadas || alertas.ventas_demoradas || alertas.cupones_por_vencer)

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow mb-1.5">{fechaLegible} · {horaLegible} hs</p>
          <h1 className="h1">Cómo viene {periodo === 'hoy' ? 'el día' : periodo === 'mes' ? 'el mes' : 'la semana'}</h1>
        </div>
        <PeriodoSelector />
      </div>

      {hayAlertas ? (
        <div>
          <p className="eyebrow mb-2">Necesita atención</p>
          <div className="flex flex-wrap gap-3">
            {alertas!.ventas_demoradas > 0 && (
              <AlertaCard count={alertas!.ventas_demoradas} label={alertas!.ventas_demoradas === 1 ? 'Venta demorada' : 'Ventas demoradas'} detail={`La más vieja: ${haceCuanto(alertas!.ventas_demoradas_desde)}`} href="/ventas?estado=confirmado" urgente />
            )}
            {alertas!.stock_bajo > 0 && (
              <AlertaCard count={alertas!.stock_bajo} label={alertas!.stock_bajo === 1 ? 'Insumo bajo el mínimo' : 'Insumos bajo el mínimo'} detail="Hay que reponer" href="/stock" urgente />
            )}
            {alertas!.compras_atrasadas > 0 && (
              <AlertaCard count={alertas!.compras_atrasadas} label={alertas!.compras_atrasadas === 1 ? 'Compra atrasada' : 'Compras atrasadas'} detail={alertas!.compras_atrasadas_detalle ?? ''} href="/compras?filtro=por_recibir" />
            )}
            {alertas!.cupones_por_vencer > 0 && (
              <AlertaCard count={alertas!.cupones_por_vencer} label="Cupones por vencer" detail="En los próximos 7 días" href="/fidelizacion" />
            )}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label={`Ventas · ${etiqueta}`} value={String(ventas)} hint={kpis?.canceladas ? `${kpis.canceladas} canceladas` : undefined} sparkline={dias14.map(d => d.ventas)} accent="ember" />
        <KpiCard label={`Ingresos · ${etiqueta}`} value={pesos(ingresos)} sparkline={dias14.map(d => d.ingresos)} accent="ember" />
        <KpiCard label="Ticket promedio" value={ventas ? pesos(ticket) : '-'} hint={`${kpis?.clientes ?? 0} clientes identificados`} accent="ink" />
        <KpiCard
          label="Margen bruto"
          value={margen != null ? `${num(margen, 0)}%` : '-'}
          hint={ingresos ? `ganancia ${pesos(ingresos - cmv)} · mercadería ${pesos(cmv)}` : 'sin ventas'}
          accent={margen == null ? 'neutral' : margen >= 60 ? 'ok' : 'danger'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card">
          <div className="card-head">
            <h2 className="h2">Ventas por día</h2>
            <span className="text-xs text-[var(--ink-soft)]">Últimos {diasSerie} días</span>
          </div>
          <div className="p-4 h-64"><BarChart data={dias14.map(d => ({ label: d.label, value: d.ventas }))} /></div>
        </div>
        <div className="card">
          <div className="card-head">
            <h2 className="h2">Por categoría</h2>
            <span className="text-xs text-[var(--ink-soft)]">unidades · {etiqueta}</span>
          </div>
          <div className="p-6 space-y-5">
            {donut.length ? <DonutChart data={donut} /> : <p className="sub text-center py-8">Sin ventas en este período</p>}
            {totalHamb > 0 && (
              <div>
                <p className="eyebrow mb-1.5">Hamburguesas por tamaño</p>
                <div className="flex h-2.5 rounded-full overflow-hidden">
                  <span style={{ width: `${(totHamb.s / totalHamb) * 100}%`, background: '#e8a48f' }} />
                  <span style={{ width: `${(totHamb.d / totalHamb) * 100}%`, background: '#d94f2b' }} />
                  <span style={{ width: `${(totHamb.t / totalHamb) * 100}%`, background: '#8f2f15' }} />
                </div>
                <div className="flex justify-between text-xs mt-1.5 tabular">
                  <span>Simple {totHamb.s}</span><span>Doble {totHamb.d}</span><span>Triple {totHamb.t}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="h2">Lo que más se vendió</h2>
          <span className="text-xs text-[var(--ink-soft)]">{etiqueta} · unidades por tamaño</span>
        </div>
        {productos.length === 0 ? <p className="px-6 py-6 sub">Sin ventas en este período.</p> : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead>
                <tr><th>Producto</th><th className="num">Simple / 4 p.</th><th className="num">Doble / 8 p.</th><th className="num">Triple</th><th className="num">Total</th><th className="num">Ingresos</th><th className="num">Margen</th></tr>
              </thead>
              <tbody>
                {productos.slice(0, 10).map(pr => {
                  const m = pr.ingresos > 0 ? ((pr.ingresos - pr.costo) / pr.ingresos) * 100 : null
                  return (
                    <tr key={pr.id}>
                      <td><Link href={`/menu/${pr.id}`} className="font-medium hover:underline">{pr.nombre}</Link><span className="text-[11px] text-[var(--ink-soft)]"> · {labelCategoria(pr.categoria)}</span></td>
                      <td className="num tabular">{pr.simple || '-'}</td>
                      <td className="num tabular">{pr.doble || '-'}</td>
                      <td className="num tabular">{pr.categoria === 'hamburguesa' ? pr.triple || '-' : ''}</td>
                      <td className="num tabular font-semibold">{pr.total}</td>
                      <td className="num tabular">{pesos(pr.ingresos)}</td>
                      <td className="num tabular">{m != null ? `${num(m, 0)}%` : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card">
          <div className="card-head"><h2 className="h2">En curso</h2><Link href="/ventas" className="link text-xs">Ver ventas →</Link></div>
          {enCurso.length === 0 ? <p className="px-6 py-6 sub">No hay ventas abiertas.</p> : (
            <ul className="divide-y divide-[var(--paper-line)]">
              {enCurso.map(v => (
                <li key={v.id} className="px-5 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">#{v.numero} · {v.nombre ?? 'Consumidor final'}</p>
                    <p className="text-xs text-[var(--ink-soft)]">{MODALIDADES[v.modalidad]} · {haceCuanto(v.creado_en)}</p>
                  </div>
                  <span className={`chip ${ESTADO_COLOR[v.estado]}`}>{ESTADO_LABEL[v.estado]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2 className="h2">Stock crítico</h2><Link href="/stock" className="link text-xs">Ver stock →</Link></div>
          {stockCritico.length === 0 ? <p className="px-6 py-6 sub">Todo el stock está bien.</p> : (
            <ul className="divide-y divide-[var(--paper-line)]">
              {stockCritico.map(i => (
                <li key={i.id} className="px-5 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <Link href={`/stock/${i.id}`} className="text-sm font-medium hover:underline">{i.nombre}</Link>
                    <p className="text-xs text-[var(--ink-soft)]">quedan {cantidad(i.stock_actual, i.unidad)} · mín. {cantidad(i.stock_minimo, i.unidad)}</p>
                  </div>
                  <span className={`chip ${i.dias != null && i.dias < 1.5 ? 'chip-danger' : 'chip-warn'}`}>
                    {i.dias == null ? 'Bajo mínimo' : i.dias < 1 ? 'Menos de 1 día' : Math.floor(i.dias) === 1 ? '1 día' : `${Math.floor(i.dias)} días`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2 className="h2">Canal y pago</h2><span className="text-xs text-[var(--ink-soft)]">{etiqueta}</span></div>
          <div className="px-5 py-3 space-y-4">
            {(['canal', 'pago'] as const).map(tipo => {
              const filas = canales.filter(c => c.tipo === tipo)
              const total = filas.reduce((a, f) => a + f.ventas, 0)
              return (
                <div key={tipo}>
                  <p className="eyebrow mb-1">{tipo === 'canal' ? 'Por dónde compran' : 'Cómo pagan'}</p>
                  {filas.length === 0 ? <p className="sub">-</p> : (
                    <ul className="space-y-1 text-sm">
                      {filas.map(f => (
                        <li key={f.clave} className="flex justify-between">
                          <span>{(tipo === 'canal' ? CANALES : MEDIOS_PAGO)[f.clave] ?? f.clave}</span>
                          <span className="tabular text-[var(--ink-soft)]">{num((f.ventas / total) * 100, 0)}% · {pesos(f.ingresos)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
            {alertas && alertas.deuda > 0 && (
              <p className="text-xs border-t border-[var(--paper-line)] pt-3">
                Deuda con proveedores: <Link href="/compras?filtro=sin_pagar" className="link">{pesos(alertas.deuda)}</Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
