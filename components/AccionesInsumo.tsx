'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AjusteModal, InsumoModal, MermaModal, type InsumoFila } from '@/components/TablaStock'

export default function AccionesInsumo({ insumo }: { insumo: InsumoFila }) {
  const router = useRouter()
  const [modal, setModal] = useState<'contar' | 'merma' | 'editar' | null>(null)
  const listo = () => { setModal(null); router.refresh() }

  return (
    <div className="flex gap-2">
      <button onClick={() => setModal('contar')} className="btn">Contar</button>
      <button onClick={() => setModal('merma')} className="btn">Merma</button>
      <button onClick={() => setModal('editar')} className="btn btn-primary">Editar</button>
      {modal === 'contar' && <AjusteModal insumo={insumo} onClose={() => setModal(null)} onSaved={listo} />}
      {modal === 'merma' && <MermaModal insumo={insumo} onClose={() => setModal(null)} onSaved={listo} />}
      {modal === 'editar' && <InsumoModal insumo={insumo} onClose={() => setModal(null)} onSaved={listo} />}
    </div>
  )
}
