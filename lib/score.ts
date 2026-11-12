import { duracionHoras } from '@/lib/formato'

// Cómo viene la velocidad real de un proveedor contra lo que promete
export function chipVelocidad(p: { demora_prom_h: number | null; demora_prometida_horas: number | null }) {
  if (p.demora_prom_h == null) return { texto: 'Sin entregas medidas', color: 'chip-neutral' }
  if (p.demora_prometida_horas == null) return { texto: `Tarda ${duracionHoras(p.demora_prom_h)}`, color: 'chip-info' }
  const ratio = p.demora_prom_h / Math.max(p.demora_prometida_horas, 1)
  if (ratio <= 1.05) return { texto: `Cumple: ${duracionHoras(p.demora_prom_h)}`, color: 'chip-ok' }
  if (ratio <= 1.5) return { texto: `Algo lento: ${duracionHoras(p.demora_prom_h)}`, color: 'chip-warn' }
  return { texto: `Lento: ${duracionHoras(p.demora_prom_h)}`, color: 'chip-danger' }
}
