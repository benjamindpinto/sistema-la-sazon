import { q } from '@/lib/db'
import TablaMenu, { type ProductoMenu } from '@/components/TablaMenu'

export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  const productos = await q<ProductoMenu>(`
    select p.id, p.categoria, p.nombre, p.descripcion, p.precio_simple, p.precio_doble, p.precio_triple, p.activo,
           v.costo_simple, v.costo_doble, v.costo_triple, v.insumos_en_receta,
           coalesce(s.vendidas, 0)::int as vendidas_30d
      from productos p
      join v_costo_receta v on v.producto_id = p.id
      left join (
        select pi.producto_id, sum(pi.cantidad) as vendidas
          from pedido_items pi join pedidos pe on pe.id = pi.pedido_id
         where pe.estado <> 'cancelado' and pe.creado_en >= now() - interval '30 days' and not pi.es_regalo
         group by pi.producto_id
      ) s on s.producto_id = p.id
     order by p.categoria, p.nombre
  `)
  const sinReceta = productos.filter(p => p.activo && p.insumos_en_receta === 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Menú y recetas</h1>
        <p className="sub mt-1">Precios, costo de cada producto según su receta y margen por tamaño.</p>
      </div>
      {sinReceta.length > 0 && (
        <div className="card px-5 py-3 bg-[var(--warn-bg)] border-[var(--warn)]/30 text-sm">
          <b className="text-[var(--warn)]">{sinReceta.length} {sinReceta.length === 1 ? 'producto no tiene' : 'productos no tienen'} receta:</b>{' '}
          {sinReceta.map(p => p.nombre).join(', ')}. Sus ventas no descuentan stock hasta que la cargues.
        </div>
      )}
      <TablaMenu productos={productos} />
    </div>
  )
}
