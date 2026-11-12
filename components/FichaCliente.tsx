'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { anularCupon, darCuponManual } from '@/app/actions/clientes'
import { labelTamano, tamanosDe, type Tamano } from '@/lib/catalogo'
import { fecha, linkWhatsApp } from '@/lib/formato'
import { ESTADO_CUPON, describirPremio, estadoCupon, mensajeCupon } from '@/lib/premios'
import { Campo, MensajeError, Modal } from '@/components/ui'
import ConfirmModal from '@/components/ConfirmModal'
import { ClienteModal } from '@/components/ListaClientes'

export interface CuponCliente {
  id: string
  codigo: string
  origen: string
  tipo: string
  valor: number | null
  tamano: string | null
  estado: string
  creado_en: string
  vence_en: string | null
  usado_en: string | null
  nota: string | null
  producto_nombre: string | null
  producto_categoria: string | null
  pedido_origen: number | null
  pedido_uso: number | null
}

export interface ProductoPremio {
  id: string
  nombre: string
  categoria: string
  precio_doble: number | null
  precio_triple: number | null
}

export default function FichaCliente({
  cliente,
  cupones,
  productos,
  plantilla,
}: {
  cliente: { id: string; telefono: string; nombre: string | null; direccion_default: string | null; notas: string | null; compras_necesarias: number }
  cupones: CuponCliente[]
  productos: ProductoPremio[]
  plantilla: string | null
}) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [dando, setDando] = useState(false)
  const [anulando, setAnulando] = useState<CuponCliente | null>(null)
  const [error, setError] = useState<string | null>(null)

  const waHola = linkWhatsApp(cliente.telefono, `Hola${cliente.nombre ? ' ' + cliente.nombre.split(' ')[0] : ''}! Te escribimos de La Sazón.`)

  return (
    <div className="card h-full">
      <div className="card-head">
        <h2 className="h2">Cupones</h2>
        <div className="flex gap-2 flex-wrap">
          {waHola && <a href={waHola} target="_blank" rel="noopener noreferrer" className="btn btn-sm">WhatsApp</a>}
          <button onClick={() => setEditando(true)} className="btn btn-sm">Editar cliente</button>
          <button onClick={() => setDando(true)} className="btn btn-sm btn-primary">Regalar cupón</button>
        </div>
      </div>
      {cupones.length === 0 ? (
        <p className="px-6 py-6 sub">Todavía no tiene cupones.</p>
      ) : (
        <ul className="divide-y divide-[var(--paper-line)]">
          {cupones.map(c => {
            const estado = estadoCupon(c)
            const premio = describirPremio(c)
            const wa = estado === 'disponible'
              ? linkWhatsApp(cliente.telefono, mensajeCupon(plantilla, { nombre: cliente.nombre, compras: cliente.compras_necesarias, premio, codigo: c.codigo, vence_en: c.vence_en }))
              : null
            return (
              <li key={c.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{premio}</p>
                  <p className="text-xs text-[var(--ink-soft)]">
                    <span className="tabular tracking-wide">{c.codigo}</span> ·{' '}
                    {c.origen === 'fidelidad' ? `ganado con la compra #${c.pedido_origen ?? '?'}` : 'regalado a mano'} el {fecha(c.creado_en)}
                    {c.vence_en && estado === 'disponible' ? ` · vence ${fecha(c.vence_en)}` : ''}
                    {c.pedido_uso ? ` · usado en la compra #${c.pedido_uso}` : ''}
                  </p>
                  {c.nota && <p className="text-[11px] text-[var(--ink-soft)]">{c.nota}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`chip ${ESTADO_CUPON[estado].color}`}>{ESTADO_CUPON[estado].label}</span>
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-sm">Avisar</a>}
                  {estado === 'disponible' && <button onClick={() => setAnulando(c)} className="btn btn-sm">Anular</button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="px-5 pb-3"><MensajeError error={error} /></div>

      {editando && <ClienteModal cliente={cliente} onClose={() => setEditando(false)} />}
      {dando && <CuponModal clienteId={cliente.id} productos={productos} onClose={() => setDando(false)} onSaved={() => { setDando(false); router.refresh() }} />}
      <ConfirmModal
        open={!!anulando}
        title={`¿Anular el cupón ${anulando?.codigo}?`}
        description="El cliente ya no lo va a poder usar."
        confirmLabel="Anular"
        danger
        onCancel={() => setAnulando(null)}
        onConfirm={async () => {
          const c = anulando
          setAnulando(null)
          if (!c) return
          const r = await anularCupon(c.id)
          if (r.error) setError(r.error)
          router.refresh()
        }}
      />
    </div>
  )
}

function CuponModal({ clienteId, productos, onClose, onSaved }: { clienteId: string; productos: ProductoPremio[]; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<'producto' | 'porcentaje' | 'monto'>('producto')
  const [productoId, setProductoId] = useState(productos[0]?.id ?? '')
  const [tamano, setTamano] = useState<Tamano>('simple')
  const [valor, setValor] = useState('')
  const [vence, setVence] = useState('30')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const producto = productos.find(p => p.id === productoId)
  const tamanos = producto ? tamanosDe(producto.categoria).filter(t => t === 'simple' || (t === 'doble' ? producto.precio_doble != null : producto.precio_triple != null)) : []

  async function guardar() {
    setGuardando(true)
    const r = await darCuponManual(clienteId, {
      tipo,
      valor: tipo === 'producto' ? null : Number(valor.replace(',', '.')),
      producto_id: tipo === 'producto' ? productoId : null,
      tamano: tipo === 'producto' ? tamano : null,
      vence_dias: vence.trim() ? Number(vence) : null,
      nota: nota || null,
    })
    setGuardando(false)
    if (r.error) return setError(r.error)
    onSaved()
  }

  return (
    <Modal open titulo="Regalar un cupón" subtitulo="Por ejemplo, para compensar un pedido que salió mal o por un cumpleaños" onClose={onClose} ancho="max-w-md">
      <div className="space-y-3">
        <div className="flex gap-1.5">
          {([['producto', 'Producto gratis'], ['porcentaje', '% descuento'], ['monto', '$ descuento']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTipo(v)} className={`btn btn-sm flex-1 ${tipo === v ? 'btn-primary' : ''}`}>{l}</button>
          ))}
        </div>
        {tipo === 'producto' ? (
          <div className="grid grid-cols-3 gap-2">
            <Campo label="Producto" className="col-span-2">
              <select className="input" value={productoId} onChange={e => { setProductoId(e.target.value); setTamano('simple') }}>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Tamaño">
              <select className="input" value={tamano} onChange={e => setTamano(e.target.value as Tamano)}>
                {tamanos.map(t => <option key={t} value={t}>{labelTamano(producto!.categoria, t)}</option>)}
              </select>
            </Campo>
          </div>
        ) : (
          <Campo label={tipo === 'porcentaje' ? 'Porcentaje' : 'Monto ($)'}>
            <input className="input" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder={tipo === 'porcentaje' ? '15' : '3000'} />
          </Campo>
        )}
        <Campo label="Vence en (días)" ayuda="Vacío = no vence"><input className="input" inputMode="numeric" value={vence} onChange={e => setVence(e.target.value)} /></Campo>
        <Campo label="Motivo"><input className="input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Pedido llegó frío" /></Campo>
        <MensajeError error={error} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="btn btn-primary">{guardando ? 'Guardando...' : 'Crear cupón'}</button>
        </div>
      </div>
    </Modal>
  )
}
