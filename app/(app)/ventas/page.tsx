import Link from 'next/link'
import { q, q1 } from '@/lib/db'
import { pesos } from '@/lib/formato'
import { PERIODOS, parsePeriodo, rangoPeriodo } from '@/lib/periodo'
import ListaVentas, { type VentaFila } from '@/components/ListaVentas'
import PeriodoSelector from '@/components/PeriodoSelector'

export const dynamic = 'force-dynamic'

const POR_PAGINA = 25

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; estado?: string; q?: string; pagina?: string }>
}) {
  const sp = await searchParams
  const periodo = parsePeriodo(sp.periodo, 'hoy')
  const { inicio } = rangoPeriodo(periodo)
  const estado = sp.estado ?? ''
  const texto = (sp.q ?? '').trim()
  const pagina = Math.max(1, Number(sp.pagina) || 1)

  // Con un estado "en curso" mostramos todos los abiertos aunque sean de otro día
  const desde = estado && estado !== 'entregado' && estado !== 'cancelado' ? new Date(0) : inicio
  const filtros = `
    p.creado_en >= $1
    and ($2 = '' or p.estado = $2)
    and ($3 = '' or cl.nombre ilike '%' || $3 || '%' or cl.telefono like '%' || $3 || '%' or p.numero::text = $3)`
  const params = [desde.toISOString(), estado, texto]

  const [ventas, resumen] = await Promise.all([
    q<VentaFila>(
      `select p.id, p.numero, p.estado, p.canal, p.modalidad, p.medio_pago, p.subtotal, p.descuento, p.total,
              p.notas, p.direccion_entrega, p.creado_en,
              cl.id as cliente_id, cl.nombre as cliente_nombre, cl.telefono as cliente_telefono,
              cu.codigo as cupon_codigo,
              (select json_agg(json_build_object('nombre', pr.nombre, 'categoria', pr.categoria, 'tamano', pi.tamano,
                                                 'cantidad', pi.cantidad, 'precio', pi.precio_unitario, 'regalo', pi.es_regalo)
                               order by pi.es_regalo, pr.nombre)
                 from pedido_items pi join productos pr on pr.id = pi.producto_id
                where pi.pedido_id = p.id) as items,
              (select coalesce(sum(pi.cantidad * pi.costo_unitario), 0) from pedido_items pi where pi.pedido_id = p.id) as costo
         from pedidos p
         left join clientes cl on cl.id = p.cliente_id
         left join cupones cu on cu.id = p.cupon_id
        where ${filtros}
        order by p.creado_en desc
        limit ${POR_PAGINA} offset ${(pagina - 1) * POR_PAGINA}`,
      params
    ),
    q1<{ cantidad: number; validas: number; ingresos: number; descuentos: number }>(
      `select count(*)::int as cantidad,
              count(*) filter (where p.estado <> 'cancelado')::int as validas,
              coalesce(sum(p.total) filter (where p.estado <> 'cancelado'), 0) as ingresos,
              coalesce(sum(p.descuento) filter (where p.estado <> 'cancelado'), 0) as descuentos
         from pedidos p left join clientes cl on cl.id = p.cliente_id
        where ${filtros}`,
      params
    ),
  ])

  const total = resumen?.cantidad ?? 0
  const validas = resumen?.validas ?? 0
  const ticket = validas > 0 ? (resumen?.ingresos ?? 0) / validas : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">Ventas</h1>
          <p className="sub mt-1">{PERIODOS[periodo]}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <PeriodoSelector />
          <Link href="/ventas/nueva" className="btn btn-ember">+ Nueva venta</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Resumen label="Ventas" valor={String(validas)} detalle={total > validas ? `${total - validas} canceladas` : undefined} />
        <Resumen label="Ingresos" valor={pesos(resumen?.ingresos ?? 0)} />
        <Resumen label="Ticket promedio" valor={pesos(ticket)} />
        <Resumen label="Regalado con cupones" valor={pesos(resumen?.descuentos ?? 0)} />
      </div>

      <ListaVentas
        ventas={ventas}
        pagina={pagina}
        totalPaginas={Math.max(1, Math.ceil(total / POR_PAGINA))}
        filtros={{ estado, q: texto }}
      />
    </div>
  )
}

function Resumen({ label, valor, detalle }: { label: string; valor: string; detalle?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className="font-display text-[22px] font-semibold tabular mt-0.5">{valor}</p>
      {detalle && <p className="text-[11px] text-[var(--ink-soft)]">{detalle}</p>}
    </div>
  )
}
