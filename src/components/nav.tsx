'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Resumen' },
  { href: '/subir', label: 'Subir pedidos' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/usuarios', label: 'Usuarios' },
] as const

export function Nav() {
  const path = usePathname()
  return (
    <nav className="-mx-2 flex gap-1 overflow-x-auto text-sm">
      {LINKS.map((l) => {
        const active = l.href === '/' ? path === '/' : path.startsWith(l.href)
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 ${
              active ? 'bg-surface-2 font-medium text-ink' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {l.label}
          </Link>
        )
      })}
    </nav>
  )
}
