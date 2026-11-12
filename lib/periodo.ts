import { ZONA_AR } from '@/lib/formato'

export type Periodo = 'hoy' | '7d' | '30d' | 'mes'

export const PERIODOS: Record<Periodo, string> = {
  hoy: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  mes: 'Este mes',
}

export function parsePeriodo(valor: string | undefined, porDefecto: Periodo = 'hoy'): Periodo {
  return valor && valor in PERIODOS ? (valor as Periodo) : porDefecto
}

// Medianoche de Argentina (UTC-3) de hace `diasAtras` días
export function medianocheAR(diasAtras = 0): Date {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: ZONA_AR })
  const d = new Date(`${hoy}T00:00:00-03:00`)
  d.setDate(d.getDate() - diasAtras)
  return d
}

export function rangoPeriodo(p: Periodo): { inicio: Date; dias: number } {
  if (p === 'mes') {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: ZONA_AR })
    const inicio = new Date(`${hoy.slice(0, 7)}-01T00:00:00-03:00`)
    const dias = Math.round((medianocheAR(0).getTime() - inicio.getTime()) / 86400000) + 1
    return { inicio, dias }
  }
  const dias = p === 'hoy' ? 1 : p === '7d' ? 7 : 30
  return { inicio: medianocheAR(dias - 1), dias }
}
