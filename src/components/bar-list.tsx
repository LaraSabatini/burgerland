import type { ReactNode } from 'react'

export type BarListItem = { key: string; label: ReactNode; value: number; display: string; hint?: string }

/** Lista de barras horizontales: legible con etiquetas largas y sin JS. */
export function BarList({ items, limit }: { items: BarListItem[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items
  const max = Math.max(1, ...shown.map((i) => i.value))
  return (
    <ul className="space-y-2.5">
      {shown.map((i) => (
        <li key={i.key} title={i.hint} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{i.label}</span>
            <span className="tabular shrink-0 font-medium">{i.display}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div
              className="h-2 rounded-full bg-[var(--series-1)] transition-opacity group-hover:opacity-80"
              style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
