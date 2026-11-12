import Link from 'next/link'
import { notFound } from 'next/navigation'
import { q, q1 } from '@/lib/db'
import { labelCategoria } from '@/lib/catalogo'
import EditorReceta, { type InsumoReceta, type LineaReceta, type ProductoReceta } from '@/components/EditorReceta'

export const dynamic = 'force-dynamic'

export default async function RecetaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const producto = await q1<ProductoReceta>(
    'select id, categoria, nombre, descripcion, precio_simple, precio_doble, precio_triple, activo from productos where id = $1',
    [id]
  )
  if (!producto) notFound()

  const [insumos, recetas, otros] = await Promise.all([
    q<InsumoReceta>('select id, nombre, categoria, unidad, costo_unitario, stock_actual, activo from insumos order by nombre'),
    q<LineaReceta & { producto_id: string }>(
      `select ri.producto_id, ri.insumo_id, ri.cant_simple, ri.cant_doble, ri.cant_triple
         from receta_items ri join insumos i on i.id = ri.insumo_id
        order by i.categoria, i.nombre`
    ),
    q<{ id: string; nombre: string; categoria: string }>(
      `select p.id, p.nombre, p.categoria from productos p
        where p.id <> $1 and exists (select 1 from receta_items ri where ri.producto_id = p.id)
        order by (p.categoria = $2) desc, p.categoria, p.nombre`,
      [id, producto.categoria]
    ),
  ])

  const recetasPorProducto: Record<string, LineaReceta[]> = {}
  for (const r of recetas) {
    const { producto_id, ...linea } = r
    ;(recetasPorProducto[producto_id] ??= []).push(linea)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/menu" className="text-xs link">← Menú y recetas</Link>
        <h1 className="h1 mt-1">{producto.nombre}</h1>
        <p className="sub mt-1">{labelCategoria(producto.categoria)}{producto.descripcion ? ` · ${producto.descripcion}` : ''}</p>
      </div>
      <EditorReceta
        producto={producto}
        inicial={recetasPorProducto[id] ?? []}
        insumos={insumos}
        otros={otros.map(o => ({ ...o, receta: recetasPorProducto[o.id] ?? [] }))}
      />
    </div>
  )
}
