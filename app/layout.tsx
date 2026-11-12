import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'La Sazón · Gestión',
  description: 'Sistema de gestión de La Sazón: ventas, stock, proveedores y fidelización',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1c1815',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
        {children}
      </body>
    </html>
  )
}
