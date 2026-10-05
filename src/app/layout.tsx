import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Burgerland',
  description: 'Carga de pedidos, resumen de ventas y fidelidad de clientes',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
