'use server'

import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { mensajeError, q, tx } from '@/lib/db'
import { CANALES, ESTADOS_VENTA, MEDIOS_PAGO, MODALIDADES, TAMANOS, precioDe, type Tamano } from '@/lib/catalogo'

export interface ItemVenta {
  producto_id: string
  tamano: Tamano
  cantidad: number
}

export interface DatosVenta {
  cliente: { telefono: string; nombre: string | null; direccion: string | null } | null
  canal: string
  modalidad: string
  medio_pago: string
  estado: string
  direccion_entrega: string | null
  notas: string | null
  items: ItemVenta[]
  cupon_id: string | null
}

export interface CuponGanado {
  codigo: string
  tipo: string
  valor: number | null
  producto_nombre: string | null
  producto_categoria: string | null
  tamano: string | null
  vence_en: string | null
  cliente_nombre: string | null
  cliente_telefono: string
  compras: number
}

export interface AlertaStock {
  nombre: string
  stock_actual: number
  stock_minimo: number
  unidad: string
}

export type ResultadoVenta =
  | { ok: true; numero: number; total: number; cuponGanado: CuponGanado | null; alertas: AlertaStock[] }
  | { ok?: false; error: string }

export async function crearVenta(d: DatosVenta): Promise<ResultadoVenta> {
  await verifySession()

  if (!d.items.length) return { error: 'Agregá al menos un producto.' }
  if (!(d.canal in CANALES) || !(d.modalidad in MODALIDADES) || !(d.medio_pago in MEDIOS_PAGO)) {
    return { error: 'Revisá canal, modalidad y medio de pago.' }
  }
  if (!ESTADOS_VENTA.includes(d.estado as (typeof ESTADOS_VENTA)[number]) || d.estado === 'cancelado') {
    return { error: 'Estado de venta inválido.' }
  }
  for (const it of d.items) {
    if (!TAMANOS.includes(it.tamano) || !Number.isInteger(it.cantidad) || it.cantidad < 1 || it.cantidad > 99) {
      return { error: 'Hay un producto con cantidad o tamaño inválido.' }
    }
  }
  const telefono = d.cliente?.telefono.trim() ?? ''
  if (d.cupon_id && !telefono) return { error: 'Para usar un cupón tiene que haber un cliente cargado.' }
  if (d.modalidad === 'delivery' && !d.direccion_entrega?.trim()) return { error: 'Falta la dirección de entrega.' }

  try {
    return await tx(async c => {
      // 1. Cliente (opcional): se crea o se actualiza por su WhatsApp
      let clienteId: string | null = null
      if (telefono) {
        const cli = await c.query(
          `insert into clientes (telefono, nombre, direccion_default)
           values ($1, nullif($2, ''), nullif($3, ''))
           on conflict (telefono) do update set
             nombre = coalesce(nullif(excluded.nombre, ''), clientes.nombre),
             direccion_default = coalesce(nullif(excluded.direccion_default, ''), clientes.direccion_default)
           returning id`,
          [telefono, d.cliente?.nombre?.trim() ?? '', d.modalidad === 'delivery' ? (d.direccion_entrega ?? '').trim() : '']
        )
        clienteId = cli.rows[0].id
      }

      // 2. Precios (siempre los del servidor, nunca los del navegador)
      const ids = [...new Set(d.items.map(i => i.producto_id))]
      const prods = await c.query(
        'select id, nombre, activo, precio_simple, precio_doble, precio_triple from productos where id = any($1::uuid[])',
        [ids]
      )
      const porId = new Map(prods.rows.map(p => [p.id as string, p]))
      const lineas: { producto_id: string; tamano: string; cantidad: number; precio: number; regalo: boolean }[] = []
      for (const it of d.items) {
        const p = porId.get(it.producto_id)
        if (!p) throw new ErrorVisible('Un producto del pedido ya no existe.')
        const precio = precioDe(p, it.tamano)
        if (precio == null) throw new ErrorVisible(`${p.nombre} no tiene precio para ese tamaño.`)
        lineas.push({ producto_id: it.producto_id, tamano: it.tamano, cantidad: it.cantidad, precio, regalo: false })
      }
      const subtotalProductos = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0)

      // 3. Cupón
      let descuento = 0
      if (d.cupon_id) {
        const cup = await c.query(
          `select cu.*, p.precio_simple, p.precio_doble, p.precio_triple
             from cupones cu left join productos p on p.id = cu.producto_id
            where cu.id = $1 for update of cu`,
          [d.cupon_id]
        )
        const cupon = cup.rows[0]
        if (!cupon || cupon.cliente_id !== clienteId) throw new ErrorVisible('El cupón no es de este cliente.')
        if (cupon.estado !== 'disponible') throw new ErrorVisible('El cupón ya fue usado o anulado.')
        if (cupon.vence_en && new Date(cupon.vence_en).getTime() < Date.now()) throw new ErrorVisible('El cupón está vencido.')

        if (cupon.tipo === 'producto') {
          const precio = precioDe(cupon, cupon.tamano ?? 'simple')
          if (!cupon.producto_id || precio == null) throw new ErrorVisible('El producto del cupón ya no está en el menú.')
          lineas.push({ producto_id: cupon.producto_id, tamano: cupon.tamano ?? 'simple', cantidad: 1, precio, regalo: true })
          descuento = precio
        } else if (cupon.tipo === 'porcentaje') {
          descuento = Math.round(subtotalProductos * Number(cupon.valor ?? 0) / 100)
        } else {
          descuento = Math.min(Number(cupon.valor ?? 0), subtotalProductos)
        }
      }
      const subtotal = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0)
      const total = Math.max(0, subtotal - descuento)

      // 4. Venta + ítems
      const ped = await c.query(
        `insert into pedidos (cliente_id, canal, modalidad, estado, direccion_entrega, medio_pago, subtotal, descuento, total, cupon_id, notas)
         values ($1, $2, $3, $4, nullif($5, ''), $6, $7, $8, $9, $10, nullif($11, ''))
         returning id, numero`,
        [clienteId, d.canal, d.modalidad, d.estado, d.modalidad === 'delivery' ? d.direccion_entrega?.trim() ?? '' : '',
         d.medio_pago, subtotal, descuento, total, d.cupon_id, d.notas?.trim() ?? '']
      )
      const pedidoId: string = ped.rows[0].id
      for (const l of lineas) {
        await c.query(
          `insert into pedido_items (pedido_id, producto_id, tamano, cantidad, precio_unitario, es_regalo)
           values ($1, $2, $3, $4, $5, $6)`,
          [pedidoId, l.producto_id, l.tamano, l.cantidad, l.precio, l.regalo]
        )
      }
      if (d.cupon_id) {
        await c.query(`update cupones set estado = 'usado', usado_en = now(), pedido_uso_id = $2 where id = $1`, [d.cupon_id, pedidoId])
      }

      // 5. Costo, stock y fidelización (en la base, dentro de la misma transacción)
      const proc = await c.query('select procesar_pedido($1) as cupon_id', [pedidoId])
      const cuponGanadoId: string | null = proc.rows[0].cupon_id

      let cuponGanado: CuponGanado | null = null
      if (cuponGanadoId) {
        const g = await c.query(
          `select cu.codigo, cu.tipo, cu.valor, cu.tamano, cu.vence_en,
                  p.nombre as producto_nombre, p.categoria as producto_categoria,
                  cl.nombre as cliente_nombre, cl.telefono as cliente_telefono,
                  (select compras_necesarias from fidelidad_config where id = 1) as compras
             from cupones cu
             join clientes cl on cl.id = cu.cliente_id
             left join productos p on p.id = cu.producto_id
            where cu.id = $1`,
          [cuponGanadoId]
        )
        cuponGanado = g.rows[0] as CuponGanado
      }

      const alertas = await c.query(
        `select nombre, stock_actual, stock_minimo, unidad
           from insumos
          where id in (select insumo_id from movimientos_stock where pedido_id = $1)
            and stock_actual <= stock_minimo
          order by stock_actual / nullif(stock_minimo, 0)`,
        [pedidoId]
      )

      return { ok: true as const, numero: ped.rows[0].numero as number, total, cuponGanado, alertas: alertas.rows as AlertaStock[] }
    })
  } catch (err) {
    if (err instanceof ErrorVisible) return { error: err.message }
    return { error: mensajeError(err, 'No se pudo registrar la venta. Probá de nuevo.') }
  } finally {
    revalidatePath('/', 'layout')
  }
}

export async function cambiarEstadoVenta(id: string, nuevoEstado: string): Promise<{ ok?: true; error?: string; aviso?: string }> {
  await verifySession()
  if (!ESTADOS_VENTA.includes(nuevoEstado as (typeof ESTADOS_VENTA)[number])) return { error: 'Estado inválido.' }

  try {
    const aviso = await tx(async c => {
      const r = await c.query('select estado, cupon_id from pedidos where id = $1 for update', [id])
      const pedido = r.rows[0]
      if (!pedido) throw new ErrorVisible('La venta no existe.')
      const anterior: string = pedido.estado
      if (anterior === nuevoEstado) return undefined

      await c.query('update pedidos set estado = $2 where id = $1', [id, nuevoEstado])
      let mensaje: string | undefined

      if (nuevoEstado === 'cancelado') {
        // El cupón que se usó en esta venta vuelve a quedar disponible
        if (pedido.cupon_id) {
          await c.query(
            `update cupones set estado = 'disponible', usado_en = null, pedido_uso_id = null
              where id = $1 and pedido_uso_id = $2`,
            [pedido.cupon_id, id]
          )
        }
        // El premio que generó esta venta se anula si todavía no se usó
        const anulados = await c.query(
          `update cupones set estado = 'anulado', nota = coalesce(nota || ' · ', '') || 'Anulado: se canceló la venta que lo generó'
            where pedido_origen_id = $1 and estado = 'disponible' returning codigo`,
          [id]
        )
        if (anulados.rowCount) mensaje = `Se anuló el cupón ${anulados.rows[0].codigo} que había ganado con esta venta.`
      } else if (anterior === 'cancelado' && pedido.cupon_id) {
        await c.query(
          `update cupones set estado = 'usado', usado_en = now(), pedido_uso_id = $2
            where id = $1 and estado = 'disponible'`,
          [pedido.cupon_id, id]
        )
      }

      // Devuelve o vuelve a descontar el stock y reevalúa el premio
      await c.query('select procesar_pedido($1)', [id])
      return mensaje
    })
    revalidatePath('/', 'layout')
    return { ok: true, aviso }
  } catch (err) {
    if (err instanceof ErrorVisible) return { error: err.message }
    return { error: mensajeError(err, 'No se pudo cambiar el estado.') }
  }
}

export interface ClienteCaja {
  id: string
  telefono: string
  nombre: string | null
  direccion_default: string | null
  compras_en_ciclo: number
  compras_necesarias: number
  programa_activo: boolean
  total_compras: number
  cupones: {
    id: string
    codigo: string
    tipo: string
    valor: number | null
    tamano: string | null
    vence_en: string | null
    producto_id: string | null
    producto_nombre: string | null
    producto_categoria: string | null
  }[]
}

export async function buscarClientes(texto: string): Promise<ClienteCaja[]> {
  await verifySession()
  const t = texto.trim()
  if (t.length < 2) return []
  const soloDigitos = t.replace(/\D/g, '')

  return q<ClienteCaja>(
    `select cl.id, cl.telefono, cl.nombre, cl.direccion_default,
            v.compras_en_ciclo, v.compras_necesarias, v.programa_activo,
            (select count(*) from pedidos p where p.cliente_id = cl.id and p.estado <> 'cancelado')::int as total_compras,
            coalesce((
              select json_agg(json_build_object(
                       'id', cu.id, 'codigo', cu.codigo, 'tipo', cu.tipo, 'valor', cu.valor, 'tamano', cu.tamano,
                       'vence_en', cu.vence_en, 'producto_id', cu.producto_id,
                       'producto_nombre', p.nombre, 'producto_categoria', p.categoria)
                     order by cu.creado_en)
                from cupones cu left join productos p on p.id = cu.producto_id
               where cu.cliente_id = cl.id and cu.estado = 'disponible' and (cu.vence_en is null or cu.vence_en > now())
            ), '[]'::json) as cupones
       from clientes cl
       join v_progreso_fidelidad v on v.cliente_id = cl.id
      where ($2 <> '' and regexp_replace(cl.telefono, '\\D', '', 'g') like '%' || $2 || '%')
         or cl.nombre ilike '%' || $1 || '%'
      order by cl.nombre nulls last
      limit 6`,
    [t, soloDigitos.length >= 3 ? soloDigitos : '']
  )
}

class ErrorVisible extends Error {}
