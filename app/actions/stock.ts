'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { mensajeError, tx } from '@/lib/db'

export interface DatosInsumo {
  nombre: string
  categoria: string
  unidad: string
  unidad_compra: string
  equivalencia: number
  stock_minimo: number
  costo_compra: number | null   // precio por unidad de compra (se convierte a costo por unidad de stock)
  notas: string | null
  stock_inicial?: number | null // sólo al crear, en unidad de stock
}

type Resultado = { ok?: true; error?: string; id?: string }

function validar(d: DatosInsumo): string | null {
  if (!d.nombre.trim()) return 'Falta el nombre del insumo.'
  if (!d.unidad.trim() || !d.unidad_compra.trim()) return 'Completá las unidades.'
  if (!(d.equivalencia > 0)) return 'La equivalencia tiene que ser mayor a cero.'
  if (d.stock_minimo < 0) return 'El stock mínimo no puede ser negativo.'
  if (d.costo_compra != null && d.costo_compra < 0) return 'El costo no puede ser negativo.'
  return null
}

export async function guardarInsumo(d: DatosInsumo, id?: string): Promise<Resultado> {
  await verifySession()
  const err = validar(d)
  if (err) return { error: err }

  try {
    const nuevoId = await tx(async c => {
      const costoUnitario = d.costo_compra != null ? d.costo_compra / d.equivalencia : null
      if (id) {
        await c.query(
          `update insumos set nombre = $2, categoria = $3, unidad = $4, unidad_compra = $5, equivalencia = $6,
                  stock_minimo = $7, costo_unitario = coalesce($8, costo_unitario), notas = nullif($9, '')
            where id = $1`,
          [id, d.nombre.trim(), d.categoria, d.unidad.trim(), d.unidad_compra.trim(), d.equivalencia,
           d.stock_minimo, costoUnitario, d.notas?.trim() ?? '']
        )
        return id
      }
      const r = await c.query(
        `insert into insumos (nombre, categoria, unidad, unidad_compra, equivalencia, stock_minimo, costo_unitario, notas)
         values ($1, $2, $3, $4, $5, $6, coalesce($7, 0), nullif($8, '')) returning id`,
        [d.nombre.trim(), d.categoria, d.unidad.trim(), d.unidad_compra.trim(), d.equivalencia,
         d.stock_minimo, costoUnitario, d.notas?.trim() ?? '']
      )
      const insumoId = r.rows[0].id as string
      if (d.stock_inicial && d.stock_inicial > 0) {
        await c.query(
          `insert into movimientos_stock (insumo_id, tipo, cantidad, costo_unitario, nota)
           values ($1, 'inicial', $2, $3, 'Stock inicial al dar de alta')`,
          [insumoId, d.stock_inicial, costoUnitario ?? 0]
        )
      }
      return insumoId
    })
    revalidatePath('/', 'layout')
    return { ok: true, id: nuevoId }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}

export async function toggleInsumo(id: string, activo: boolean): Promise<Resultado> {
  await verifySession()
  try {
    await tx(c => c.query('update insumos set activo = $2 where id = $1', [id, activo]))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}

// Conteo físico: se carga lo que hay de verdad y el sistema registra la diferencia
export async function ajustarStock(id: string, conteo: number, nota: string | null): Promise<Resultado & { diferencia?: number }> {
  await verifySession()
  if (!Number.isFinite(conteo) || conteo < 0) return { error: 'Cargá una cantidad válida (0 o más).' }
  try {
    const diferencia = await tx(async c => {
      const r = await c.query('select stock_actual, costo_unitario from insumos where id = $1 for update', [id])
      if (!r.rows[0]) throw new Error('El insumo no existe')
      const dif = conteo - Number(r.rows[0].stock_actual)
      if (Math.abs(dif) > 0.0005) {
        await c.query(
          `insert into movimientos_stock (insumo_id, tipo, cantidad, costo_unitario, nota)
           values ($1, 'ajuste', $2, $3, $4)`,
          [id, dif, r.rows[0].costo_unitario, nota?.trim() || 'Conteo físico']
        )
      }
      return dif
    })
    revalidatePath('/', 'layout')
    return { ok: true, diferencia }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}

export async function registrarMerma(id: string, cantidad: number, motivo: string | null): Promise<Resultado> {
  await verifySession()
  if (!Number.isFinite(cantidad) || cantidad <= 0) return { error: 'La cantidad tiene que ser mayor a cero.' }
  try {
    await tx(c => c.query(
      `insert into movimientos_stock (insumo_id, tipo, cantidad, costo_unitario, nota)
       select id, 'merma', $2, costo_unitario, $3 from insumos where id = $1`,
      [id, -cantidad, motivo?.trim() || 'Merma']
    ))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}
