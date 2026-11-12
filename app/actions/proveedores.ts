'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { mensajeError, tx } from '@/lib/db'

export interface DatosProveedor {
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
}

type Resultado = { ok?: true; error?: string; id?: string }

export async function guardarProveedor(d: DatosProveedor, id?: string): Promise<Resultado> {
  await verifySession()
  if (!d.nombre.trim()) return { error: 'Falta el nombre del proveedor.' }
  if (d.demora_prometida_horas != null && d.demora_prometida_horas < 0) return { error: 'La demora no puede ser negativa.' }

  const valores = [
    d.nombre.trim(), d.rubro?.trim() ?? '', d.contacto?.trim() ?? '', d.telefono?.trim() ?? '', d.email?.trim() ?? '',
    d.direccion?.trim() ?? '', d.cuit?.trim() ?? '', d.dias_entrega?.trim() ?? '', d.demora_prometida_horas,
    d.pedido_minimo, d.condicion_pago?.trim() ?? '', d.notas?.trim() ?? '',
  ]
  try {
    const nuevoId = await tx(async c => {
      if (id) {
        await c.query(
          `update proveedores set nombre = $2, rubro = nullif($3, ''), contacto = nullif($4, ''), telefono = nullif($5, ''),
                  email = nullif($6, ''), direccion = nullif($7, ''), cuit = nullif($8, ''), dias_entrega = nullif($9, ''),
                  demora_prometida_horas = $10, pedido_minimo = $11, condicion_pago = nullif($12, ''), notas = nullif($13, '')
            where id = $1`,
          [id, ...valores]
        )
        return id
      }
      const r = await c.query(
        `insert into proveedores (nombre, rubro, contacto, telefono, email, direccion, cuit, dias_entrega,
                                  demora_prometida_horas, pedido_minimo, condicion_pago, notas)
         values ($1, nullif($2, ''), nullif($3, ''), nullif($4, ''), nullif($5, ''), nullif($6, ''), nullif($7, ''),
                 nullif($8, ''), $9, $10, nullif($11, ''), nullif($12, ''))
         returning id`,
        valores
      )
      return r.rows[0].id as string
    })
    revalidatePath('/', 'layout')
    return { ok: true, id: nuevoId }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}

export async function toggleProveedor(id: string, activo: boolean): Promise<Resultado> {
  await verifySession()
  try {
    await tx(c => c.query('update proveedores set activo = $2 where id = $1', [id, activo]))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}

// Carga o actualiza el precio de lista de un insumo para un proveedor (por unidad de compra)
export async function guardarPrecio(proveedorId: string, insumoId: string, precio: number, nota: string | null): Promise<Resultado> {
  await verifySession()
  if (!insumoId) return { error: 'Elegí el insumo.' }
  if (!(precio >= 0)) return { error: 'El precio no es válido.' }
  try {
    await tx(c => c.query(
      `insert into precios_proveedor (proveedor_id, insumo_id, precio, fecha, origen, nota)
       values ($1, $2, $3, (now() at time zone 'America/Argentina/Buenos_Aires')::date, 'lista', nullif($4, ''))`,
      [proveedorId, insumoId, precio, nota?.trim() ?? '']
    ))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}

// Saca un insumo de la lista de un proveedor (deja de compararse). Las compras hechas no se tocan.
export async function quitarDeLista(proveedorId: string, insumoId: string): Promise<Resultado> {
  await verifySession()
  try {
    await tx(c => c.query(
      `delete from precios_proveedor where proveedor_id = $1 and insumo_id = $2`,
      [proveedorId, insumoId]
    ))
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}
