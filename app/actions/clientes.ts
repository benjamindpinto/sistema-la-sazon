'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { mensajeError, tx } from '@/lib/db'
import { TAMANOS } from '@/lib/catalogo'

type Resultado = { ok?: true; error?: string; id?: string; codigo?: string }

export interface DatosCliente {
  telefono: string
  nombre: string | null
  direccion_default: string | null
  notas: string | null
}

export async function guardarCliente(d: DatosCliente, id?: string): Promise<Resultado> {
  await verifySession()
  const telefono = d.telefono.trim()
  if (telefono.replace(/\D/g, '').length < 6) return { error: 'Cargá un WhatsApp válido.' }
  try {
    const nuevoId = await tx(async c => {
      if (id) {
        await c.query(
          `update clientes set telefono = $2, nombre = nullif($3, ''), direccion_default = nullif($4, ''), notas = nullif($5, '')
            where id = $1`,
          [id, telefono, d.nombre?.trim() ?? '', d.direccion_default?.trim() ?? '', d.notas?.trim() ?? '']
        )
        return id
      }
      const r = await c.query(
        `insert into clientes (telefono, nombre, direccion_default, notas)
         values ($1, nullif($2, ''), nullif($3, ''), nullif($4, '')) returning id`,
        [telefono, d.nombre?.trim() ?? '', d.direccion_default?.trim() ?? '', d.notas?.trim() ?? '']
      )
      return r.rows[0].id as string
    })
    revalidatePath('/', 'layout')
    return { ok: true, id: nuevoId }
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '23505') return { error: 'Ya hay un cliente con ese WhatsApp.' }
    return { error: mensajeError(e) }
  }
}

export interface DatosCupon {
  tipo: 'producto' | 'porcentaje' | 'monto'
  valor: number | null
  producto_id: string | null
  tamano: string | null
  vence_dias: number | null
  nota: string | null
}

// Cupón de regalo dado a mano (por ejemplo, para compensar un pedido que salió mal)
export async function darCuponManual(clienteId: string, d: DatosCupon): Promise<Resultado> {
  await verifySession()
  if (d.tipo === 'producto' && (!d.producto_id || !TAMANOS.includes((d.tamano ?? '') as 'simple'))) return { error: 'Elegí el producto y el tamaño.' }
  if (d.tipo === 'porcentaje' && !(d.valor != null && d.valor > 0 && d.valor <= 100)) return { error: 'El porcentaje tiene que estar entre 1 y 100.' }
  if (d.tipo === 'monto' && !(d.valor != null && d.valor > 0)) return { error: 'Cargá el monto del descuento.' }
  if (d.vence_dias != null && !(d.vence_dias > 0)) return { error: 'Los días de vencimiento tienen que ser más de cero.' }

  try {
    const codigo = await tx(async c => {
      let cod = ''
      for (;;) {
        cod = 'SAZ-' + Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0')
        const ex = await c.query('select 1 from cupones where codigo = $1', [cod])
        if (!ex.rowCount) break
      }
      await c.query(
        `insert into cupones (codigo, cliente_id, origen, tipo, valor, producto_id, tamano, vence_en, nota)
         values ($1, $2, 'manual', $3, $4, $5, $6,
                 case when $7::int is null then null else now() + make_interval(days => $7::int) end, nullif($8, ''))`,
        [cod, clienteId, d.tipo, d.tipo === 'producto' ? null : d.valor, d.tipo === 'producto' ? d.producto_id : null,
         d.tipo === 'producto' ? d.tamano : null, d.vence_dias, d.nota?.trim() ?? '']
      )
      return cod
    })
    revalidatePath('/', 'layout')
    return { ok: true, codigo }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}

export async function anularCupon(id: string): Promise<Resultado> {
  await verifySession()
  try {
    const r = await tx(c => c.query(
      `update cupones set estado = 'anulado', nota = coalesce(nota || ' · ', '') || 'Anulado a mano'
        where id = $1 and estado = 'disponible'`,
      [id]
    ))
    if (!r.rowCount) return { error: 'El cupón ya no está disponible.' }
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    return { error: mensajeError(e) }
  }
}
