'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { mensajeError, tx } from '@/lib/db'

export interface DatosCompra {
  proveedor_id: string
  items: { insumo_id: string; cantidad: number; precio: number }[]   // cantidad y precio en unidad de compra
  recibida: boolean
  fecha: string | null          // ISO; si viene, es cuándo se pidió (y se recibió, si ya llegó)
  pagada: boolean
  medio_pago: string | null
  comprobante: string | null
  notas: string | null
}

type Resultado = { ok?: true; error?: string; id?: string; numero?: number }

export async function crearCompra(d: DatosCompra): Promise<Resultado> {
  await verifySession()
  if (!d.proveedor_id) return { error: 'Elegí el proveedor.' }
  const items = d.items.filter(i => i.insumo_id)
  if (items.length === 0) return { error: 'Agregá al menos un insumo.' }
  if (new Set(items.map(i => i.insumo_id)).size !== items.length) return { error: 'Hay un insumo repetido.' }
  for (const i of items) {
    if (!(i.cantidad > 0)) return { error: 'Todas las cantidades tienen que ser mayores a cero.' }
    if (!(i.precio >= 0)) return { error: 'Revisá los precios.' }
  }
  const fecha = d.fecha ? new Date(d.fecha) : new Date()
  if (Number.isNaN(fecha.getTime()) || fecha.getTime() > Date.now() + 60_000) return { error: 'La fecha no es válida.' }

  try {
    const r = await tx(async c => {
      const comp = await c.query(
        `insert into compras (proveedor_id, pedida_en, pagada, medio_pago, comprobante, notas, total)
         values ($1, $2, $3, nullif($4, ''), nullif($5, ''), nullif($6, ''), $7)
         returning id, numero`,
        [d.proveedor_id, fecha.toISOString(), d.pagada, d.medio_pago ?? '', d.comprobante?.trim() ?? '', d.notas?.trim() ?? '',
         items.reduce((acc, i) => acc + i.cantidad * i.precio, 0)]
      )
      const id = comp.rows[0].id as string
      for (const i of items) {
        await c.query(
          'insert into compra_items (compra_id, insumo_id, cantidad_pedida, precio_unitario) values ($1, $2, $3, $4)',
          [id, i.insumo_id, i.cantidad, i.precio]
        )
      }
      if (d.recibida) await c.query('select recibir_compra($1, $2)', [id, fecha.toISOString()])
      return { id, numero: comp.rows[0].numero as number }
    })
    revalidatePath('/', 'layout')
    return { ok: true, ...r }
  } catch (e) {
    return { error: mensajeError(e, 'No se pudo guardar la compra.') }
  }
}

export async function recibirCompra(
  id: string,
  items: { id: string; cantidad_recibida: number; precio: number }[],
  fecha: string | null
): Promise<Resultado> {
  await verifySession()
  for (const i of items) {
    if (!(i.cantidad_recibida >= 0) || !(i.precio >= 0)) return { error: 'Revisá cantidades y precios.' }
  }
  const cuando = fecha ? new Date(fecha) : new Date()
  if (Number.isNaN(cuando.getTime()) || cuando.getTime() > Date.now() + 60_000) return { error: 'La fecha no es válida.' }

  try {
    await tx(async c => {
      const comp = await c.query('select pedida_en from compras where id = $1', [id])
      if (comp.rows[0] && new Date(comp.rows[0].pedida_en) > cuando) {
        throw Object.assign(new Error('La recepción no puede ser anterior al pedido.'), { code: 'P0001' })
      }
      for (const i of items) {
        await c.query(
          'update compra_items set cantidad_recibida = $3, precio_unitario = $4 where id = $1 and compra_id = $2',
          [i.id, id, i.cantidad_recibida, i.precio]
        )
      }
      await c.query('select recibir_compra($1, $2)', [id, cuando.toISOString()])
    })
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e, 'No se pudo registrar la recepción.') }
  }
}

export async function marcarPagada(id: string, pagada: boolean, medioPago: string | null): Promise<Resultado> {
  await verifySession()
  try {
    await tx(c => c.query(
      'update compras set pagada = $2, medio_pago = coalesce(nullif($3, \'\'), medio_pago) where id = $1',
      [id, pagada, medioPago ?? '']
    ))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}

export async function anularCompra(id: string): Promise<Resultado> {
  await verifySession()
  try {
    await tx(c => c.query('select anular_compra($1)', [id]))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e, 'No se pudo anular la compra.') }
  }
}
