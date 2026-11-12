'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { mensajeError, tx } from '@/lib/db'
import { CATEGORIAS } from '@/lib/catalogo'

export interface DatosProducto {
  categoria: string
  nombre: string
  descripcion: string | null
  precio_simple: number
  precio_doble: number | null
  precio_triple: number | null
}

type Resultado = { ok?: true; error?: string; id?: string }

export async function guardarProducto(d: DatosProducto, id?: string): Promise<Resultado> {
  await verifySession()
  if (!d.nombre.trim()) return { error: 'Falta el nombre.' }
  if (!(d.categoria in CATEGORIAS)) return { error: 'Categoría inválida.' }
  for (const p of [d.precio_simple, d.precio_doble, d.precio_triple]) {
    if (p != null && !(p >= 0)) return { error: 'Revisá los precios.' }
  }
  if (!(d.precio_simple >= 0)) return { error: 'Falta el precio principal.' }

  try {
    const nuevoId = await tx(async c => {
      if (id) {
        await c.query(
          `update productos set categoria = $2, nombre = $3, descripcion = nullif($4, ''),
                  precio_simple = $5, precio_doble = $6, precio_triple = $7 where id = $1`,
          [id, d.categoria, d.nombre.trim(), d.descripcion?.trim() ?? '', d.precio_simple, d.precio_doble, d.precio_triple]
        )
        return id
      }
      const r = await c.query(
        `insert into productos (categoria, nombre, descripcion, precio_simple, precio_doble, precio_triple)
         values ($1, $2, nullif($3, ''), $4, $5, $6) returning id`,
        [d.categoria, d.nombre.trim(), d.descripcion?.trim() ?? '', d.precio_simple, d.precio_doble, d.precio_triple]
      )
      return r.rows[0].id as string
    })
    revalidatePath('/', 'layout')
    return { ok: true, id: nuevoId }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}

export async function toggleProducto(id: string, activo: boolean): Promise<Resultado> {
  await verifySession()
  try {
    await tx(c => c.query('update productos set activo = $2 where id = $1', [id, activo]))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}

export interface ItemReceta {
  insumo_id: string
  cant_simple: number
  cant_doble: number
  cant_triple: number
}

// Reemplaza la receta completa del producto. Las ventas ya hechas no cambian.
export async function guardarReceta(productoId: string, items: ItemReceta[]): Promise<Resultado> {
  await verifySession()
  const validos = items.filter(i => i.insumo_id)
  if (new Set(validos.map(i => i.insumo_id)).size !== validos.length) return { error: 'Hay un insumo repetido en la receta.' }
  for (const i of validos) {
    if ([i.cant_simple, i.cant_doble, i.cant_triple].some(n => !(n >= 0))) return { error: 'Las cantidades no pueden ser negativas.' }
  }
  try {
    await tx(async c => {
      await c.query('delete from receta_items where producto_id = $1', [productoId])
      for (const i of validos) {
        if (i.cant_simple === 0 && i.cant_doble === 0 && i.cant_triple === 0) continue
        await c.query(
          'insert into receta_items (producto_id, insumo_id, cant_simple, cant_doble, cant_triple) values ($1, $2, $3, $4, $5)',
          [productoId, i.insumo_id, i.cant_simple, i.cant_doble, i.cant_triple]
        )
      }
    })
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}
