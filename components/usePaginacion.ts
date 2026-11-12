import { useMemo, useState } from 'react'

export function usePaginacion<T>(items: T[], porPagina: number) {
  const [paginaElegida, setPagina] = useState(1)
  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina))
  // si los filtros achican la lista, la página nunca queda fuera de rango
  const pagina = Math.min(paginaElegida, totalPaginas)

  const itemsPagina = useMemo(() => {
    const inicio = (pagina - 1) * porPagina
    return items.slice(inicio, inicio + porPagina)
  }, [items, pagina, porPagina])

  return { pagina, setPagina, totalPaginas, itemsPagina }
}
