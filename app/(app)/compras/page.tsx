import { q, q1 } from '@/lib/db'
import { pesos } from '@/lib/formato'
import { SQL_PRECIOS_VIGENTES } from '@/lib/proveedores'
import KpiCard from '@/components/KpiCard'
import Compras, { type CompraFila, type DatosFormCompra } from '@/components/Compras'

export const dynamic = 'force-dynamic'

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; nueva?: string; proveedor?: string; ver?: string }>
}) {
  const sp = await searchParams
  const filtro = ['por_recibir', 'sin_pagar'].includes(sp.filtro ?? '') ? sp.filtro! : 'todas'

  const [compras, kpis, proveedores, insumos, precios] = await Promise.all([
    q<CompraFila>(
      `select c.id, c.numero, c.estado, c.pedida_en, c.recibida_en, c.total, c.pagada, c.medio_pago, c.comprobante, c.notas,
              pr.id as proveedor_id, pr.nombre as proveedor, pr.telefono as proveedor_telefono, pr.contacto as proveedor_contacto,
              pr.demora_prometida_horas,
              extract(epoch from coalesce(c.recibida_en, now()) - c.pedida_en) / 3600 as horas,
              (select json_agg(json_build_object(
                        'id', ci.id, 'insumo_id', i.id, 'nombre', i.nombre, 'unidad', i.unidad, 'unidad_compra', i.unidad_compra,
                        'equivalencia', i.equivalencia, 'cantidad_pedida', ci.cantidad_pedida,
                        'cantidad_recibida', ci.cantidad_recibida, 'precio', ci.precio_unitario) order by i.nombre)
                 from compra_items ci join insumos i on i.id = ci.insumo_id where ci.compra_id = c.id) as items
         from compras c join proveedores pr on pr.id = c.proveedor_id
        where ($1 = 'todas' and (c.pedida_en >= now() - interval '45 days' or c.estado = 'pedida' or c.id::text = $2))
           or ($1 = 'por_recibir' and c.estado = 'pedida')
           or ($1 = 'sin_pagar' and c.estado = 'recibida' and not c.pagada)
        order by (c.estado = 'pedida') desc, c.pedida_en desc
        limit 150`,
      [filtro, sp.ver ?? '']
    ),
    q1<{ gastado_mes: number; por_recibir: number; por_recibir_monto: number; atrasadas: number; deuda: number; proveedores_deuda: number }>(
      `select
         coalesce(sum(c.total) filter (where c.estado = 'recibida'
           and c.recibida_en >= date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires'), 0) as gastado_mes,
         count(*) filter (where c.estado = 'pedida')::int as por_recibir,
         coalesce(sum(c.total) filter (where c.estado = 'pedida'), 0) as por_recibir_monto,
         count(*) filter (where c.estado = 'pedida' and pr.demora_prometida_horas is not null
                            and now() > c.pedida_en + make_interval(hours => pr.demora_prometida_horas))::int as atrasadas,
         coalesce(sum(c.total) filter (where c.estado = 'recibida' and not c.pagada), 0) as deuda,
         count(distinct c.proveedor_id) filter (where c.estado = 'recibida' and not c.pagada)::int as proveedores_deuda
       from compras c join proveedores pr on pr.id = c.proveedor_id`
    ),
    q<DatosFormCompra['proveedores'][number]>(
      `select id, nombre, telefono, contacto, dias_entrega, demora_prometida_horas, pedido_minimo, condicion_pago
         from proveedores where activo order by nombre`
    ),
    q<DatosFormCompra['insumos'][number]>(
      `select i.id, i.nombre, i.categoria, i.unidad, i.unidad_compra, i.equivalencia, i.stock_actual, i.stock_minimo, i.costo_unitario,
              coalesce((select sum(ci.cantidad_pedida * i.equivalencia) from compra_items ci join compras c on c.id = ci.compra_id
                         where c.estado = 'pedida' and ci.insumo_id = i.id), 0) as en_camino,
              coalesce((select -sum(m.cantidad) from movimientos_stock m
                         where m.insumo_id = i.id and m.tipo in ('venta', 'cancelacion')
                           and m.creado_en >= now() - interval '7 days'), 0) / 7 as consumo_diario
         from insumos i where i.activo order by i.nombre`
    ),
    q<DatosFormCompra['precios'][number]>(`select proveedor_id, insumo_id, precio, fecha from (${SQL_PRECIOS_VIGENTES}) v`),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Compras</h1>
        <p className="sub mt-1">Lo que se le pide a cada proveedor. Al recibirla, el stock se suma solo y el precio queda registrado.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Gastado este mes" value={pesos(kpis?.gastado_mes ?? 0)} hint="compras recibidas" accent="ink" />
        <KpiCard label="Por recibir" value={String(kpis?.por_recibir ?? 0)} hint={kpis?.por_recibir ? pesos(kpis.por_recibir_monto) : 'Nada pendiente'} accent="neutral" />
        <KpiCard label="Atrasadas" value={String(kpis?.atrasadas ?? 0)} hint="pasaron la demora prometida" accent={kpis?.atrasadas ? 'danger' : 'ok'} />
        <KpiCard label="Deuda con proveedores" value={pesos(kpis?.deuda ?? 0)} hint={kpis?.proveedores_deuda ? `${kpis.proveedores_deuda} proveedores` : 'Todo pagado'} accent={kpis?.deuda ? 'danger' : 'ok'} />
      </div>

      <Compras
        compras={compras}
        filtro={filtro}
        abrirNueva={sp.nueva === '1'}
        proveedorInicial={sp.proveedor ?? null}
        verId={sp.ver ?? null}
        form={{ proveedores, insumos, precios }}
      />
    </div>
  )
}
