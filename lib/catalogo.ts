// Catálogos compartidos entre servidor y cliente

export type Tamano = 'simple' | 'doble' | 'triple'
export const TAMANOS: Tamano[] = ['simple', 'doble', 'triple']

export const CATEGORIAS: Record<string, { label: string; tamanos: Partial<Record<Tamano, string>> }> = {
  hamburguesa:    { label: 'Hamburguesitas',  tamanos: { simple: 'Simple', doble: 'Doble', triple: 'Triple' } },
  pizzita:        { label: 'Pizzitas',        tamanos: { simple: '4 porc.', doble: '8 porc.' } },
  acompanamiento: { label: 'Acompañamientos', tamanos: { simple: 'Chica', doble: 'Grande' } },
  bebida:         { label: 'Bebidas',         tamanos: { simple: 'Única' } },
  postre:         { label: 'Postres',         tamanos: { simple: 'Única' } },
}
export const ORDEN_CATEGORIAS = Object.keys(CATEGORIAS)

export function labelCategoria(categoria: string): string {
  return CATEGORIAS[categoria]?.label ?? categoria
}

export function labelTamano(categoria: string, tamano: string): string {
  return CATEGORIAS[categoria]?.tamanos[tamano as Tamano] ?? tamano
}

export function tamanosDe(categoria: string): Tamano[] {
  return TAMANOS.filter(t => CATEGORIAS[categoria]?.tamanos[t])
}

export interface PreciosProducto {
  precio_simple: number
  precio_doble: number | null
  precio_triple: number | null
}

export function precioDe(p: PreciosProducto | undefined | null, tamano: string): number | null {
  if (!p) return null
  if (tamano === 'triple') return p.precio_triple
  if (tamano === 'doble') return p.precio_doble
  return p.precio_simple
}

export const ESTADOS_VENTA = ['pendiente', 'confirmado', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'] as const
export const ESTADOS_ACTIVOS = ['pendiente', 'confirmado', 'en_preparacion', 'en_camino']

export const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  en_preparacion: 'En preparación',
  en_camino: 'En camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'chip-warn',
  confirmado: 'chip-info',
  en_preparacion: 'chip-warn',
  en_camino: 'chip-info',
  entregado: 'chip-ok',
  cancelado: 'chip-danger',
}

export const CANALES: Record<string, string> = {
  mostrador: 'Mostrador',
  whatsapp: 'WhatsApp',
  telefono: 'Teléfono',
  app: 'App de delivery',
  otro: 'Otro',
}

export const MODALIDADES: Record<string, string> = {
  take_away: 'Take away',
  delivery: 'Delivery',
  salon: 'Salón',
}

export const MEDIOS_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  debito: 'Débito',
  credito: 'Crédito',
  mercado_pago: 'Mercado Pago',
}

export const CATEGORIAS_INSUMO = [
  'Carnes', 'Panificados', 'Lácteos y quesos', 'Fiambres', 'Verduras',
  'Salsas y aderezos', 'Almacén', 'Congelados', 'Bebidas', 'Descartables', 'Limpieza', 'Otros',
]

export const UNIDADES_STOCK = ['unidad', 'bollo', 'pan', 'feta', 'porción', 'g', 'ml']
export const UNIDADES_COMPRA = ['unidad', 'kg', 'litro', 'docena', 'maple x30', 'caja', 'paquete', 'bolsa', 'frasco', 'atado', 'horma', 'bidón']

export const TIPO_MOVIMIENTO: Record<string, { label: string; color: string }> = {
  inicial:     { label: 'Stock inicial', color: 'chip-info' },
  compra:      { label: 'Compra',        color: 'chip-ok' },
  venta:       { label: 'Venta',         color: 'chip-neutral' },
  cancelacion: { label: 'Venta anulada', color: 'chip-info' },
  ajuste:      { label: 'Ajuste',        color: 'chip-warn' },
  merma:       { label: 'Merma',         color: 'chip-danger' },
}

export const TIPO_PREMIO: Record<string, string> = {
  producto: 'Producto gratis',
  porcentaje: '% de descuento',
  monto: '$ de descuento',
}
