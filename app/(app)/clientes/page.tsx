import { q, q1 } from '@/lib/db'
import ListaClientes, { type ClienteFila } from '@/components/ListaClientes'

export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  const [clientes, cfg] = await Promise.all([
    q<ClienteFila>(`
      select cl.id, cl.telefono, cl.nombre, cl.direccion_default, cl.creado_en,
             coalesce(s.compras, 0)::int as compras,
             coalesce(s.gastado, 0) as gastado,
             s.ultima,
             v.compras_en_ciclo, v.compras_necesarias,
             (select count(*) from cupones cu where cu.cliente_id = cl.id and cu.estado = 'disponible'
                and (cu.vence_en is null or cu.vence_en > now()))::int as cupones
        from clientes cl
        join v_progreso_fidelidad v on v.cliente_id = cl.id
        left join (
          select cliente_id, count(*) as compras, sum(total) as gastado, max(creado_en) as ultima
            from pedidos where estado <> 'cancelado' and cliente_id is not null
           group by cliente_id
        ) s on s.cliente_id = cl.id
       order by s.ultima desc nulls last, cl.creado_en desc
    `),
    q1<{ activo: boolean }>('select activo from fidelidad_config where id = 1'),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Clientes</h1>
        <p className="sub mt-1">{clientes.length} clientes registrados. Se cargan solos al registrar una venta con su WhatsApp.</p>
      </div>
      <ListaClientes clientes={clientes} programaActivo={cfg?.activo ?? false} />
    </div>
  )
}
