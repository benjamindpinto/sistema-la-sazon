export const ZONA_AR = 'America/Argentina/Buenos_Aires'

export function pesos(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '-'
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

// Número con hasta `dec` decimales, sin ceros de más
export function num(n: number | null | undefined, dec = 2): string {
  if (n == null || Number.isNaN(n)) return '-'
  return n.toLocaleString('es-AR', { maximumFractionDigits: dec })
}

export function pct(n: number | null | undefined, dec = 0): string {
  if (n == null || !Number.isFinite(n)) return '-'
  return `${n.toLocaleString('es-AR', { maximumFractionDigits: dec })}%`
}

export function fecha(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: ZONA_AR })
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: ZONA_AR })
}

export function hora(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: ZONA_AR })
}

export function haceCuanto(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return '-'
  const min = Math.round((ahora - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`
}

// Duración en horas → "18 h" / "1,5 días"
export function duracionHoras(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return '-'
  if (h < 36) return `${num(h, h < 10 ? 1 : 0)} h`
  return `${num(h / 24, 1)} días`
}

// Cantidad de stock con su unidad: 4500 g → "4,5 kg"; 150 → "150 bollos"
export function cantidad(n: number | null | undefined, unidad: string): string {
  if (n == null || Number.isNaN(n)) return '-'
  if (unidad === 'g' && Math.abs(n) >= 1000) return `${num(n / 1000, 2)} kg`
  if (unidad === 'ml' && Math.abs(n) >= 1000) return `${num(n / 1000, 2)} l`
  const etiqueta = ['g', 'ml', 'kg', 'l'].includes(unidad) ? unidad : plural(unidad, n)
  return `${num(n, unidad === 'g' || unidad === 'ml' ? 0 : 2)} ${etiqueta}`
}

const SIN_PLURAL = new Set(['g', 'kg', 'ml', 'l', 'cc', 'cm3', 'mg', 'oz', 'lb'])

export function plural(palabra: string, n: number): string {
  if (Math.abs(n) === 1 || /\s/.test(palabra) || SIN_PLURAL.has(palabra.toLowerCase())) return palabra
  if (/[aeiou]$/i.test(palabra)) return palabra + 's'
  if (/ón$/.test(palabra)) return palabra.replace(/ón$/, 'ones')
  return palabra + 'es'
}

// Fecha (YYYY-MM-DD) de hoy en Argentina
export function hoyAR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_AR })
}

export function linkWhatsApp(telefono: string | null | undefined, texto: string): string | null {
  if (!telefono) return null
  let digitos = telefono.replace(/\D/g, '')
  if (!digitos) return null
  // Números locales sin código de país (381 1234567) → +54 9
  if (digitos.length === 10) digitos = '549' + digitos
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`
}
