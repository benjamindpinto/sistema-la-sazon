'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { guardarConfigFidelidad, type ConfigFidelidad } from '@/app/actions/fidelidad'
import { labelTamano, tamanosDe, type Tamano } from '@/lib/catalogo'
import { describirPremio, mensajeCupon } from '@/lib/premios'
import { Campo, MensajeError } from '@/components/ui'

interface Producto {
  id: string
  nombre: string
  categoria: string
  precio_doble: number | null
  precio_triple: number | null
}

export default function ConfigFidelidadForm({ config, productos }: { config: ConfigFidelidad; productos: Producto[] }) {
  const router = useRouter()
  const [activo, setActivo] = useState(config.activo)
  const [compras, setCompras] = useState(String(config.compras_necesarias))
  const [conPlazo, setConPlazo] = useState(config.ventana_dias != null)
  const [plazo, setPlazo] = useState(String(config.ventana_dias ?? 60))
  const [minimo, setMinimo] = useState(config.monto_minimo ? String(config.monto_minimo) : '')
  const [tipo, setTipo] = useState(config.premio_tipo)
  const [valor, setValor] = useState(config.premio_valor != null ? String(config.premio_valor) : '')
  const [productoId, setProductoId] = useState(config.premio_producto_id ?? productos[0]?.id ?? '')
  const [tamano, setTamano] = useState<Tamano>((config.premio_tamano as Tamano) ?? 'simple')
  const [vence, setVence] = useState(config.vencimiento_dias != null ? String(config.vencimiento_dias) : '')
  const [mensaje, setMensaje] = useState(config.mensaje ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const producto = productos.find(p => p.id === productoId)
  const tamanos = producto ? tamanosDe(producto.categoria).filter(t => t === 'simple' || (t === 'doble' ? producto.precio_doble != null : producto.precio_triple != null)) : []
  const n = Number(compras) || 0
  const premio = describirPremio({ tipo, valor: Number(valor) || 0, producto_nombre: producto?.nombre, producto_categoria: producto?.categoria, tamano })
  const [ahora] = useState(() => Date.now())
  const ejemploVence = vence.trim() ? new Date(ahora + Number(vence) * 86400000).toISOString() : null

  const resumen = `Cada ${n || '…'} ${n === 1 ? 'compra' : 'compras'}${conPlazo ? ` dentro de ${plazo || '…'} días` : ''}${Number(minimo) > 0 ? ` de al menos $${Number(minimo).toLocaleString('es-AR')}` : ''}, el cliente gana ${premio}${vence.trim() ? `, para usar en los ${vence} días siguientes` : ' (sin vencimiento)'}.`

  async function guardar() {
    setError(null)
    setOk(false)
    setGuardando(true)
    const r = await guardarConfigFidelidad({
      activo,
      compras_necesarias: Number(compras),
      ventana_dias: conPlazo ? Number(plazo) : null,
      monto_minimo: Number(minimo.replace(',', '.')) || 0,
      premio_tipo: tipo,
      premio_valor: tipo === 'producto' ? null : Number(valor.replace(',', '.')),
      premio_producto_id: tipo === 'producto' ? productoId : null,
      premio_tamano: tamano,
      vencimiento_dias: vence.trim() ? Number(vence) : null,
      mensaje: mensaje || null,
    })
    setGuardando(false)
    if (r.error) return setError(r.error)
    setOk(true)
    router.refresh()
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="h2">Reglas del programa</h2>
          <p className="text-xs text-[var(--ink-soft)] mt-0.5">Los cambios aplican a las compras que se registren desde ahora.</p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
          <span className={activo ? 'text-[var(--ok)] font-semibold' : 'text-[var(--ink-soft)]'}>{activo ? 'Programa activo' : 'Programa pausado'}</span>
        </label>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Compras para el premio">
              <input className="input" inputMode="numeric" value={compras} onChange={e => setCompras(e.target.value)} />
            </Campo>
            <Campo label="Compra mínima ($)" ayuda="Vacío = cualquier compra cuenta">
              <input className="input" inputMode="numeric" value={minimo} onChange={e => setMinimo(e.target.value)} placeholder="0" />
            </Campo>
          </div>

          <div>
            <p className="label">Plazo</p>
            <div className="flex gap-1.5">
              <button onClick={() => setConPlazo(false)} className={`btn btn-sm flex-1 ${!conPlazo ? 'btn-primary' : ''}`}>Sin límite de tiempo</button>
              <button onClick={() => setConPlazo(true)} className={`btn btn-sm flex-1 ${conPlazo ? 'btn-primary' : ''}`}>Dentro de un plazo</button>
            </div>
            {conPlazo && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                <span>Las compras tienen que ser dentro de</span>
                <input className="input input-sm w-20" inputMode="numeric" value={plazo} onChange={e => setPlazo(e.target.value)} />
                <span>días</span>
              </div>
            )}
          </div>

          <div>
            <p className="label">Premio</p>
            <div className="flex gap-1.5">
              {([['producto', 'Producto gratis'], ['porcentaje', '% de descuento'], ['monto', '$ de descuento']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setTipo(v)} className={`btn btn-sm flex-1 ${tipo === v ? 'btn-primary' : ''}`}>{l}</button>
              ))}
            </div>
            <div className="mt-2">
              {tipo === 'producto' ? (
                <div className="grid grid-cols-3 gap-2">
                  <select className="input col-span-2" value={productoId} onChange={e => { setProductoId(e.target.value); setTamano('simple') }}>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <select className="input" value={tamano} onChange={e => setTamano(e.target.value as Tamano)}>
                    {tamanos.map(t => <option key={t} value={t}>{labelTamano(producto!.categoria, t)}</option>)}
                  </select>
                </div>
              ) : (
                <input className="input" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder={tipo === 'porcentaje' ? 'Ej. 15 (%)' : 'Ej. 3000 ($)'} />
              )}
            </div>
          </div>

          <Campo label="El cupón vence a los (días)" ayuda="Vacío = no vence">
            <input className="input" inputMode="numeric" value={vence} onChange={e => setVence(e.target.value)} />
          </Campo>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-[var(--paper)] p-4">
            <p className="eyebrow mb-1">Cómo queda</p>
            <p className="text-[15px] leading-snug">{resumen}</p>
          </div>
          <Campo label="Mensaje de WhatsApp para avisarle" ayuda="Podés usar {nombre}, {compras}, {premio}, {codigo} y {vence}">
            <textarea className="input min-h-[96px]" value={mensaje} onChange={e => setMensaje(e.target.value)} />
          </Campo>
          <div className="rounded-lg border border-dashed border-[var(--paper-line)] p-3 text-sm bg-[var(--paper-card)]">
            <p className="eyebrow mb-1">Vista previa</p>
            <p className="whitespace-pre-line">{mensajeCupon(mensaje, { nombre: 'Martina', compras: n, premio, codigo: 'SAZ-4F7K2Q', vence_en: ejemploVence })}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 flex items-center justify-end gap-3">
        <MensajeError error={error} />
        {ok && <span className="text-sm text-[var(--ok)]">Guardado</span>}
        <button onClick={guardar} disabled={guardando} className="btn btn-primary">{guardando ? 'Guardando...' : 'Guardar reglas'}</button>
      </div>
    </div>
  )
}
