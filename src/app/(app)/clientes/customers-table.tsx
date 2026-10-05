'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { CustomerRow } from '@/lib/customers'
import { fmtDate, fmtMoney } from '@/lib/format'
import { normalize } from '@/lib/text'
import { fmtPhone } from '@/lib/phone'
import { STAR_GOAL } from '@/lib/loyalty'
import { DiscountBadge, Stars } from '@/components/stars'
import { Empty } from '@/components/ui'

const FILTERS = [
  { id: 'activos', label: 'Con estrellas' },
  { id: 'descuento', label: 'Con descuento' },
  { id: 'sin-whatsapp', label: 'Sin WhatsApp' },
  { id: 'todos', label: 'Todos' },
] as const

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('activos')

  const rows = useMemo(() => {
    const term = normalize(q)
    return customers.filter((c) => {
      if (filter === 'activos' && c.stars === 0) return false
      if (filter === 'descuento' && c.discount === 0) return false
      if (filter === 'sin-whatsapp' && c.phone) return false
      if (!term) return true
      const digits = q.replace(/\D/g, '')
      if (digits.length >= 3 && c.phone?.includes(digits)) return true
      return normalize(`${c.name} ${c.address} ${c.zone}`).includes(term)
    })
  }, [customers, q, filter])

  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, dirección, zona o teléfono…"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-page px-3 text-sm outline-none focus:border-accent sm:max-w-xs"
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-sm ${filter === f.id ? 'bg-surface-2 font-medium' : 'text-ink-2 hover:text-ink'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted">{rows.length} clientes</span>
      </div>

      {rows.length === 0 ? (
        <div className="p-4">
          <Empty>No hay clientes para mostrar.</Empty>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Estrellas activas</th>
                <th className="px-4 py-2 font-medium">Próximo vencimiento</th>
                <th className="px-4 py-2 text-right font-medium">Pedidos</th>
                <th className="px-4 py-2 text-right font-medium">Gastado</th>
                <th className="px-4 py-2 text-right font-medium">Última compra</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {rows.map((c) => (
                <tr key={c.id} className={`border-t border-line ${c.stars >= STAR_GOAL ? 'bg-goal-wash' : ''}`}>
                  <td className="px-4 py-2.5">
                    <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <p className="max-w-64 truncate text-xs text-muted">
                      {c.phone ? fmtPhone(c.phone) : <span className="text-critical">Sin WhatsApp</span>}
                      {[c.address, c.zone].filter(Boolean).map((x) => ` · ${x}`)}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    {!c.phone ? (
                      <span className="text-xs text-muted">Cargá el WhatsApp para sumar estrellas</span>
                    ) : (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Stars count={c.stars} />
                      <span className="w-5 text-xs text-ink-2">{c.stars}</span>
                      <DiscountBadge stars={c.stars} />
                    </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-2">
                    {c.nextExpiry ? fmtDate(c.nextExpiry) : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-ink-2">{c.totalOrders}</td>
                  <td className="px-4 py-2.5 text-right">{fmtMoney(c.totalSpent)}</td>
                  <td className="px-4 py-2.5 text-right text-ink-2">{fmtDate(c.lastOrder)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
