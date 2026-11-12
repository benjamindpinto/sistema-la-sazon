'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { logout } from '@/app/actions/auth'

interface Contadores {
  stockBajo: number
  comprasPorRecibir: number
  ventasEnCurso: number
}

const LINKS = [
  { href: '/', label: 'Dashboard', icon: IconDashboard },
  { href: '/ventas', label: 'Ventas', icon: IconVentas, contador: 'ventasEnCurso' as const },
  { href: '/stock', label: 'Stock', icon: IconStock, contador: 'stockBajo' as const, alerta: true },
  { href: '/compras', label: 'Compras', icon: IconCompras, contador: 'comprasPorRecibir' as const },
  { href: '/proveedores', label: 'Proveedores', icon: IconProveedores },
  { href: '/menu', label: 'Menú y recetas', icon: IconMenu },
  { href: '/clientes', label: 'Clientes', icon: IconClientes },
  { href: '/fidelizacion', label: 'Fidelización', icon: IconCupon },
]

function estaActivo(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  if (href === '/ventas') return pathname.startsWith('/ventas') && !pathname.startsWith('/ventas/nueva')
  return pathname.startsWith(href)
}

export default function Sidebar({ contadores }: { contadores: Contadores }) {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)

  // en el celular, el menú se cierra al tocar cualquier opción
  const cerrar = () => setAbierto(false)

  const nav = (
    <>
      <div className="px-3 pt-4">
        <Link
          href="/ventas/nueva"
          onClick={cerrar}
          className={`flex items-center justify-center gap-2 rounded-md py-2.5 text-[14px] font-semibold transition-colors ${
            pathname.startsWith('/ventas/nueva') ? 'bg-[var(--ember-dark)] text-white' : 'bg-[var(--ember)] text-white hover:bg-[var(--ember-dark)]'
          }`}
        >
          <span className="text-lg leading-none">+</span> Nueva venta
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 relative">
        {LINKS.map(({ href, label, icon: Icon, contador, alerta }) => {
          const activo = estaActivo(pathname, href)
          const valor = contador ? contadores[contador] : 0
          return (
            <Link
              key={href}
              href={href}
              onClick={cerrar}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-[13.5px] font-medium transition-colors border-l-2 ${
                activo
                  ? 'bg-white/[0.07] text-[#f7ede6] border-[var(--ember)]'
                  : 'text-white/60 border-transparent hover:bg-white/[0.04] hover:text-white/85'
              }`}
            >
              <Icon className="w-[17px] h-[17px] flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {valor > 0 && (
                <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                  alerta ? 'bg-[var(--ember)] text-white' : 'bg-white/15 text-white/85'
                }`}>
                  {valor}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-3 relative">
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13.5px] font-medium text-white/45 hover:bg-white/[0.04] hover:text-white/75 transition-colors"
          >
            <IconSalir className="w-[17px] h-[17px] flex-shrink-0" />
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="px-6 py-4 border-t border-white/[0.08] relative">
        <p className="text-[10.5px] text-white/30 tracking-wide">GIBEN IA · automatización</p>
      </div>
    </>
  )

  return (
    <>
      {/* Barra superior en celular */}
      <header className="md:hidden sticky top-0 z-40 bg-[var(--char)] flex items-center justify-between px-4 h-14">
        <Link href="/" className="font-display text-[20px] font-semibold text-[var(--ember)]">La Sazón</Link>
        <div className="flex items-center gap-2">
          <Link href="/ventas/nueva" className="btn btn-ember btn-sm">+ Venta</Link>
          <button
            onClick={() => setAbierto(v => !v)}
            aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={abierto}
            className="w-10 h-10 flex items-center justify-center text-white/80"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {abierto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </header>

      {abierto && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setAbierto(false)}>
          <aside
            className="absolute top-14 left-0 bottom-0 w-72 bg-[var(--char)] flex flex-col overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {nav}
          </aside>
        </div>
      )}

      {/* Barra lateral en compu/tablet */}
      <aside className="hidden md:flex w-60 flex-shrink-0 min-h-screen flex-col bg-[var(--char)] relative sticky top-0 h-screen overflow-y-auto">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '18px 18px' }}
        />
        <div className="px-6 pt-7 pb-5 border-b border-white/[0.08] relative">
          <span className="font-display text-[22px] font-semibold text-[var(--ember)] tracking-tight">La Sazón</span>
          <p className="text-[11px] text-white/40 mt-1 tracking-wide">Gestión del local</p>
        </div>
        {nav}
      </aside>
    </>
  )
}

type IconProps = { className?: string }

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function IconDashboard(p: IconProps) {
  return <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></Svg>
}
function IconVentas(p: IconProps) {
  return <Svg {...p}><path d="M3 7h18l-1.5 12.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 7Z" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></Svg>
}
function IconStock(p: IconProps) {
  return <Svg {...p}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="M3 8l9 5 9-5" /><path d="M12 13v8" /></Svg>
}
function IconCompras(p: IconProps) {
  return <Svg {...p}><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" /><circle cx="10" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></Svg>
}
function IconProveedores(p: IconProps) {
  return <Svg {...p}><path d="M3 17V7a1 1 0 0 1 1-1h10v11" /><path d="M14 10h4l3 3.5V17h-7" /><circle cx="7.5" cy="17.5" r="1.8" /><circle cx="17.5" cy="17.5" r="1.8" /></Svg>
}
function IconMenu(p: IconProps) {
  return <Svg {...p}><path d="M4 6h16M4 12h16M4 18h10" /></Svg>
}
function IconClientes(p: IconProps) {
  return <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5c1.7.3 3 1.8 3 3.5s-1.3 3.2-3 3.5" /><path d="M18 13.5c2 .5 3.5 2.2 3.5 4.5" /></Svg>
}
function IconCupon(p: IconProps) {
  return <Svg {...p}><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z" /><path d="M10 5v2M10 11v2M10 17v2" /></Svg>
}
function IconSalir(p: IconProps) {
  return <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Svg>
}
