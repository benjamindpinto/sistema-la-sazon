// Utilidades de stock compartidas entre servidor y cliente

export function estadoStock(i: { stock_actual: number; stock_minimo: number }): { label: string; color: string; orden: number } {
  if (i.stock_actual <= 0) return { label: 'Sin stock', color: 'chip-danger', orden: 0 }
  if (i.stock_actual <= i.stock_minimo) return { label: 'Bajo mínimo', color: 'chip-danger', orden: 1 }
  if (i.stock_actual <= i.stock_minimo * 1.3) return { label: 'Justo', color: 'chip-warn', orden: 2 }
  return { label: 'OK', color: 'chip-ok', orden: 3 }
}
