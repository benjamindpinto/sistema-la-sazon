'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { mensajeError, tx } from '@/lib/db'
import { TAMANOS } from '@/lib/catalogo'

export interface ConfigFidelidad {
  activo: boolean
  compras_necesarias: number
  ventana_dias: number | null
  monto_minimo: number
  premio_tipo: 'producto' | 'porcentaje' | 'monto'
  premio_valor: number | null
  premio_producto_id: string | null
  premio_tamano: string
  vencimiento_dias: number | null
  mensaje: string | null
}

export async function guardarConfigFidelidad(d: ConfigFidelidad): Promise<{ ok?: true; error?: string }> {
  await verifySession()
  if (!Number.isInteger(d.compras_necesarias) || d.compras_necesarias < 1 || d.compras_necesarias > 100) {
    return { error: 'La cantidad de compras tiene que estar entre 1 y 100.' }
  }
  if (d.ventana_dias != null && !(Number.isInteger(d.ventana_dias) && d.ventana_dias > 0)) return { error: 'El plazo en días no es válido.' }
  if (d.vencimiento_dias != null && !(Number.isInteger(d.vencimiento_dias) && d.vencimiento_dias > 0)) return { error: 'El vencimiento no es válido.' }
  if (!(d.monto_minimo >= 0)) return { error: 'El monto mínimo no puede ser negativo.' }
  if (d.premio_tipo === 'producto' && !d.premio_producto_id) return { error: 'Elegí qué producto se regala.' }
  if (d.premio_tipo === 'producto' && !TAMANOS.includes(d.premio_tamano as 'simple')) return { error: 'Elegí el tamaño del regalo.' }
  if (d.premio_tipo === 'porcentaje' && !(d.premio_valor != null && d.premio_valor > 0 && d.premio_valor <= 100)) return { error: 'El porcentaje tiene que estar entre 1 y 100.' }
  if (d.premio_tipo === 'monto' && !(d.premio_valor != null && d.premio_valor > 0)) return { error: 'Cargá el monto del descuento.' }

  try {
    await tx(c => c.query(
      `update fidelidad_config set activo = $1, compras_necesarias = $2, ventana_dias = $3, monto_minimo = $4,
              premio_tipo = $5, premio_valor = $6, premio_producto_id = $7, premio_tamano = $8,
              vencimiento_dias = $9, mensaje = nullif($10, '')
        where id = 1`,
      [d.activo, d.compras_necesarias, d.ventana_dias, d.monto_minimo, d.premio_tipo,
       d.premio_tipo === 'producto' ? null : d.premio_valor,
       d.premio_tipo === 'producto' ? d.premio_producto_id : null,
       d.premio_tamano, d.vencimiento_dias, d.mensaje?.trim() ?? '']
    ))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}
