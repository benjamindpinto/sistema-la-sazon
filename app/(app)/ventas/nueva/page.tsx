import { q, q1 } from '@/lib/db'
import PuntoDeVenta, { type ProductoCaja } from '@/components/PuntoDeVenta'

export const dynamic = 'force-dynamic'

async function getDatos() {
  const [productos, posibles, config] = await Promise.all([
    q<ProductoCaja>(
      `select id, categoria, nombre, descripcion, precio_simple, precio_doble, precio_triple
         from productos where activo order by categoria, nombre`
    ),
    // cuántas unidades de cada producto/tamaño alcanzan con el stock actual
    q<{ producto_id: string; simple: number | null; doble: number | null; triple: number | null }>(
      `select ri.producto_id,
              min(case when ri.cant_simple > 0 then floor(greatest(i.stock_actual, 0) / ri.cant_simple) end)::int as simple,
              min(case when ri.cant_doble  > 0 then floor(greatest(i.stock_actual, 0) / ri.cant_doble)  end)::int as doble,
              min(case when ri.cant_triple > 0 then floor(greatest(i.stock_actual, 0) / ri.cant_triple) end)::int as triple
         from receta_items ri join insumos i on i.id = ri.insumo_id
        group by ri.producto_id`
    ),
    q1<{ activo: boolean; compras_necesarias: number; mensaje: string | null }>(
      'select activo, compras_necesarias, mensaje from fidelidad_config where id = 1'
    ),
  ])

  const alcance: Record<string, Partial<Record<string, number | null>>> = {}
  for (const p of posibles) alcance[p.producto_id] = { simple: p.simple, doble: p.doble, triple: p.triple }

  return { productos, alcance, config }
}

export default async function NuevaVentaPage() {
  const { productos, alcance, config } = await getDatos()

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Nueva venta</h1>
        <p className="sub mt-1">Tocá el producto en el tamaño que se vendió. El stock se descuenta solo al registrar.</p>
      </div>
      <PuntoDeVenta productos={productos} alcance={alcance} fidelidad={config ?? { activo: false, compras_necesarias: 5, mensaje: null }} />
    </div>
  )
}
