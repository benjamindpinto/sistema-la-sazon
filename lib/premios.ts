import { labelTamano } from '@/lib/catalogo'
import { fecha, num, pesos } from '@/lib/formato'

export interface PremioInfo {
  tipo: string
  valor: number | null
  producto_nombre?: string | null
  producto_categoria?: string | null
  tamano?: string | null
}

export function describirPremio(p: PremioInfo): string {
  if (p.tipo === 'producto') {
    const tam = p.tamano && p.producto_categoria ? ` ${labelTamano(p.producto_categoria, p.tamano).toLowerCase()}` : ''
    return `1 ${p.producto_nombre ?? 'producto'}${tam} gratis`
  }
  if (p.tipo === 'porcentaje') return `${num(p.valor ?? 0)}% de descuento`
  return `${pesos(p.valor ?? 0)} de descuento`
}

export function mensajeCupon(
  plantilla: string | null | undefined,
  datos: { nombre: string | null; compras: number; premio: string; codigo: string; vence_en: string | null }
): string {
  const base = plantilla?.trim() ||
    '¡Hola {nombre}! Gracias por elegirnos {compras} veces. Te ganaste {premio}. Mostrá el código {codigo} en tu próximo pedido{vence}.'
  return base
    .replaceAll('{nombre}', datos.nombre?.split(' ')[0] ?? '')
    .replaceAll('{compras}', String(datos.compras))
    .replaceAll('{premio}', datos.premio)
    .replaceAll('{codigo}', datos.codigo)
    .replaceAll('{vence}', datos.vence_en ? ` (vale hasta el ${fecha(datos.vence_en)})` : '')
    .replace(/\s+([!,.])/g, '$1')
    .replace('¡Hola !', '¡Hola!')
}

// Estado real de un cupón (los vencidos siguen guardados como "disponible")
export function estadoCupon(c: { estado: string; vence_en: string | null }): 'disponible' | 'usado' | 'vencido' | 'anulado' {
  if (c.estado === 'disponible' && c.vence_en && new Date(c.vence_en).getTime() < Date.now()) return 'vencido'
  return c.estado as 'disponible' | 'usado' | 'anulado'
}

export const ESTADO_CUPON: Record<string, { label: string; color: string }> = {
  disponible: { label: 'Disponible', color: 'chip-ok' },
  usado: { label: 'Usado', color: 'chip-neutral' },
  vencido: { label: 'Vencido', color: 'chip-warn' },
  anulado: { label: 'Anulado', color: 'chip-danger' },
}
