import Link from 'next/link'
import { notFound } from 'next/navigation'
import { q, q1 } from '@/lib/db'
import { CANALES, ESTADO_COLOR, ESTADO_LABEL, labelTamano } from '@/lib/catalogo'
import { fecha, fechaHora, haceCuanto, num, pesos } from '@/lib/formato'
import KpiCard from '@/components/KpiCard'
import { Barra } from '@/components/ui'
import FichaCliente, { type CuponCliente, type ProductoPremio } from '@/components/FichaCliente'

export const dynamic = 'force-dynamic'

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const cliente = await q1<{ id: string; telefono: string; nombre: string | null; direccion_default: string | null; notas: string | null; creado_en: string; compras_en_ciclo: number; compras_necesarias: number; programa_activo: boolean }>(
    `select cl.*, v.compras_en_ciclo, v.compras_necesarias, v.programa_activo
       from clientes cl join v_progreso_fidelidad v on v.cliente_id = cl.id where cl.id = $1`,
    [id]
  )
  if (!cliente) notFound()

  const [stats, favoritos, cupones, ventas, productos, cfg] = await Promise.all([
    q1<{ compras: number; gastado: number; primera: string | null; ultima: string | null; ahorro: number }>(
      `select count(*)::int as compras, coalesce(sum(total), 0) as gastado, min(creado_en) as primera, max(creado_en) as ultima,
              coalesce(sum(descuento), 0) as ahorro
         from pedidos where cliente_id = $1 and estado <> 'cancelado'`,
      [id]
    ),
    q<{ nombre: string; categoria: string; tamano: string; unidades: number }>(
      `select pr.nombre, pr.categoria, pi.tamano, sum(pi.cantidad)::int as unidades
         from pedido_items pi join pedidos p on p.id = pi.pedido_id join productos pr on pr.id = pi.producto_id
        where p.cliente_id = $1 and p.estado <> 'cancelado' and not pi.es_regalo
        group by pr.nombre, pr.categoria, pi.tamano order by unidades desc limit 3`,
      [id]
    ),
    q<CuponCliente>(
      `select cu.id, cu.codigo, cu.origen, cu.tipo, cu.valor, cu.tamano, cu.estado, cu.creado_en, cu.vence_en, cu.usado_en, cu.nota,
              p.nombre as producto_nombre, p.categoria as producto_categoria,
              po.numero as pedido_origen, pu.numero as pedido_uso
         from cupones cu
         left join productos p on p.id = cu.producto_id
         left join pedidos po on po.id = cu.pedido_origen_id
         left join pedidos pu on pu.id = cu.pedido_uso_id
        where cu.cliente_id = $1 order by cu.creado_en desc`,
      [id]
    ),
    q<{ id: string; numero: number; estado: string; canal: string; total: number; descuento: number; creado_en: string; detalle: string }>(
      `select p.id, p.numero, p.estado, p.canal, p.total, p.descuento, p.creado_en,
              (select string_agg(pi.cantidad || '× ' || pr.nombre || case when pi.es_regalo then ' (regalo)' else '' end, ', ' order by pr.nombre)
                 from pedido_items pi join productos pr on pr.id = pi.producto_id where pi.pedido_id = p.id) as detalle
         from pedidos p where p.cliente_id = $1 order by p.creado_en desc limit 40`,
      [id]
    ),
    q<ProductoPremio>('select id, nombre, categoria, precio_doble, precio_triple from productos where activo order by categoria, nombre'),
    q1<{ mensaje: string | null }>('select mensaje from fidelidad_config where id = 1'),
  ])

  const compras = stats?.compras ?? 0
  const frecuencia = compras > 1 && stats?.primera && stats?.ultima
    ? (new Date(stats.ultima).getTime() - new Date(stats.primera).getTime()) / 86400000 / (compras - 1)
    : null
  const falta = cliente.compras_necesarias - cliente.compras_en_ciclo

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clientes" className="text-xs link">← Clientes</Link>
        <h1 className="h1 mt-1">{cliente.nombre ?? 'Sin nombre'}</h1>
        <p className="sub mt-1">
          {cliente.telefono}{cliente.direccion_default ? ` · ${cliente.direccion_default}` : ''} · cliente desde {fecha(cliente.creado_en)}
        </p>
        {cliente.notas && <p className="text-sm mt-1"><span className="chip chip-info">Nota</span> {cliente.notas}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Compras"
          value={String(compras)}
          hint={frecuencia == null ? undefined : frecuencia < 1.5 ? 'casi una por día' : `una cada ${num(frecuencia, 0)} días`}
          accent="ink"
        />
        <KpiCard label="Gastado" value={pesos(stats?.gastado ?? 0)} hint={compras ? `ticket promedio ${pesos((stats?.gastado ?? 0) / compras)}` : undefined} accent="ink" />
        <KpiCard label="Última compra" value={stats?.ultima ? haceCuanto(stats.ultima) : '-'} hint={stats?.ultima ? fecha(stats.ultima) : undefined} accent="ink" />
        <KpiCard label="Ahorró con cupones" value={pesos(stats?.ahorro ?? 0)} accent="ok" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 space-y-4">
          <h2 className="h2">Fidelización</h2>
          {cliente.programa_activo ? (
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span>{cliente.compras_en_ciclo} de {cliente.compras_necesarias} compras</span>
                <span className="text-[var(--ink-soft)]">{falta <= 0 ? 'Gana en la próxima' : `faltan ${falta}`}</span>
              </div>
              <Barra valor={cliente.compras_en_ciclo} max={cliente.compras_necesarias} />
            </div>
          ) : (
            <p className="sub">El programa está pausado.</p>
          )}
          {favoritos.length > 0 && (
            <div>
              <p className="eyebrow mb-1">Lo que más pide</p>
              <ul className="text-sm space-y-0.5">
                {favoritos.map(f => <li key={f.nombre + f.tamano}>{f.nombre} {labelTamano(f.categoria, f.tamano).toLowerCase()} <span className="text-[var(--ink-soft)]">· {f.unidades}</span></li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <FichaCliente cliente={cliente} cupones={cupones} productos={productos} plantilla={cfg?.mensaje ?? null} />
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2 className="h2">Historial de compras</h2></div>
        {ventas.length === 0 ? (
          <p className="px-6 py-6 sub">Todavía no compró.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabla">
              <thead><tr><th>#</th><th>Fecha</th><th>Detalle</th><th>Canal</th><th className="num">Total</th><th>Estado</th></tr></thead>
              <tbody>
                {ventas.map(v => (
                  <tr key={v.id} className={v.estado === 'cancelado' ? 'opacity-50' : ''}>
                    <td className="tabular text-xs">#{v.numero}</td>
                    <td className="text-xs whitespace-nowrap">{fechaHora(v.creado_en)}</td>
                    <td className="text-xs max-w-[380px]">{v.detalle}</td>
                    <td className="text-xs">{CANALES[v.canal] ?? v.canal}</td>
                    <td className="num tabular">{pesos(v.total)}{v.descuento > 0 && <p className="text-[11px] text-[var(--ok)]">−{pesos(v.descuento)} cupón</p>}</td>
                    <td><span className={`chip ${ESTADO_COLOR[v.estado]}`}>{ESTADO_LABEL[v.estado]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
