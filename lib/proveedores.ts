import 'server-only'
import { q } from '@/lib/db'

export interface ProveedorScore {
  id: string
  nombre: string
  rubro: string | null
  contacto: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  cuit: string | null
  dias_entrega: string | null
  demora_prometida_horas: number | null
  pedido_minimo: number | null
  condicion_pago: string | null
  notas: string | null
  activo: boolean
  compras_recibidas: number
  demora_prom_h: number | null
  a_tiempo_pct: number | null
  cumplimiento_pct: number | null
  ultima_compra: string | null
  gastado_30d: number
  deuda: number
  pendientes: number
  atrasadas: number
  insumos_en_lista: number
  comparables: number
  mas_barato_en: number
  sobreprecio_pct: number | null
}

// Los precios que salieron de una compra que después se anuló no cuentan
export const SQL_PRECIO_VALIDO = `not exists (select 1 from compras ca where ca.id = pp.compra_id and ca.estado = 'cancelada')`

// Precio vigente de cada proveedor para cada insumo (el último cargado)
export const SQL_PRECIOS_VIGENTES = `
  select distinct on (pp.proveedor_id, pp.insumo_id)
         pp.proveedor_id, pp.insumo_id, pp.precio, pp.fecha, pp.origen
    from precios_proveedor pp
    join proveedores pr on pr.id = pp.proveedor_id and pr.activo
   where ${SQL_PRECIO_VALIDO}
   order by pp.proveedor_id, pp.insumo_id, pp.fecha desc, pp.creado_en desc`

export async function getProveedoresScore(id?: string): Promise<ProveedorScore[]> {
  return q<ProveedorScore>(
    `with vig as (${SQL_PRECIOS_VIGENTES}),
     minimo as (
       select insumo_id, min(precio) as m, count(*) as n from vig group by insumo_id
     ),
     precios as (
       select v.proveedor_id,
              count(*)::int as insumos,
              count(*) filter (where mi.n > 1)::int as comparables,
              count(*) filter (where mi.n > 1 and v.precio <= mi.m)::int as mas_barato,
              avg((v.precio / nullif(mi.m, 0) - 1) * 100) filter (where mi.n > 1) as sobreprecio
         from vig v join minimo mi on mi.insumo_id = v.insumo_id
        group by v.proveedor_id
     )
     select pr.*,
            coalesce(s.recibidas, 0)::int as compras_recibidas,
            s.demora_prom_h, s.a_tiempo_pct, s.ultima_compra,
            cu.cumplimiento_pct,
            coalesce((select sum(total) from compras where proveedor_id = pr.id and estado = 'recibida'
                       and recibida_en >= now() - interval '30 days'), 0) as gastado_30d,
            coalesce((select sum(total) from compras where proveedor_id = pr.id and estado = 'recibida' and not pagada), 0) as deuda,
            (select count(*) from compras where proveedor_id = pr.id and estado = 'pedida')::int as pendientes,
            (select count(*) from compras where proveedor_id = pr.id and estado = 'pedida'
                and pr.demora_prometida_horas is not null
                and now() > pedida_en + make_interval(hours => pr.demora_prometida_horas))::int as atrasadas,
            coalesce(pc.insumos, 0) as insumos_en_lista,
            coalesce(pc.comparables, 0) as comparables,
            coalesce(pc.mas_barato, 0) as mas_barato_en,
            pc.sobreprecio as sobreprecio_pct
       from proveedores pr
       left join lateral (
         select count(*) as recibidas,
                avg(extract(epoch from c.recibida_en - c.pedida_en) / 3600) as demora_prom_h,
                100.0 * count(c.id) filter (where extract(epoch from c.recibida_en - c.pedida_en) / 3600 <= pr.demora_prometida_horas)
                      / nullif(count(c.id) filter (where pr.demora_prometida_horas is not null), 0) as a_tiempo_pct,
                max(c.recibida_en) as ultima_compra
           from (select * from compras where proveedor_id = pr.id and estado = 'recibida'
                  order by recibida_en desc limit 20) c
       ) s on true
       left join lateral (
         select 100.0 * avg(least(ci.cantidad_recibida / ci.cantidad_pedida, 1)) as cumplimiento_pct
           from compra_items ci
          where ci.compra_id in (select id from compras where proveedor_id = pr.id and estado = 'recibida'
                                  order by recibida_en desc limit 20)
       ) cu on true
       left join precios pc on pc.proveedor_id = pr.id
      where ($1::uuid is null or pr.id = $1::uuid)
      order by pr.activo desc, pr.nombre`,
    [id ?? null]
  )
}
