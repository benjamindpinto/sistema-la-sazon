import Sidebar from '@/components/Sidebar'
import { verifySession } from '@/lib/dal'
import { q1 } from '@/lib/db'

async function getContadores() {
  const fila = await q1<{ stock_bajo: number; compras: number; ventas: number }>(`
    select
      (select count(*) from insumos where activo and stock_actual <= stock_minimo)                    as stock_bajo,
      (select count(*) from compras where estado = 'pedida')                                          as compras,
      (select count(*) from pedidos where estado in ('pendiente','confirmado','en_preparacion','en_camino')) as ventas
  `)
  return {
    stockBajo: fila?.stock_bajo ?? 0,
    comprasPorRecibir: fila?.compras ?? 0,
    ventasEnCurso: fila?.ventas ?? 0,
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await verifySession()
  const contadores = await getContadores()

  return (
    <div className="min-h-screen md:flex">
      <Sidebar contadores={contadores} />
      <main className="flex-1 min-w-0 px-4 py-6 md:px-9 md:py-9">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
