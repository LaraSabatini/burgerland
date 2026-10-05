import { discountFor, STAR_GOAL, STAR_MAX } from '@/lib/loyalty'

function Star({ filled, goal, size }: { filled: boolean; goal: boolean; size: 'sm' | 'lg' }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={`${size === 'lg' ? 'size-6' : 'size-4'} ${filled ? (goal ? 'text-star-goal' : 'text-star') : 'text-grid'}`}>
      <path
        fill="currentColor"
        d="M10 1.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L10 14.9l-5.25 2.75 1-5.85L1.5 7.7l5.9-.9z"
      />
    </svg>
  )
}

/** Hasta 10 estrellas: hasta 4 en amarillo, desde 5 (con descuento) cambian de color. */
export function Stars({ count, size = 'sm' }: { count: number; size?: 'sm' | 'lg' }) {
  const n = Math.min(count, STAR_MAX)
  const goal = n >= STAR_GOAL
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${n} de ${STAR_MAX} estrellas`}>
      {Array.from({ length: STAR_MAX }, (_, i) => (
        <span key={i} className={i === STAR_GOAL ? (size === 'lg' ? 'ml-2' : 'ml-1.5') : undefined}>
          <Star filled={i < n} goal={goal} size={size} />
        </span>
      ))}
    </span>
  )
}

export function DiscountBadge({ stars }: { stars: number }) {
  const pct = discountFor(stars)
  if (!pct) return null
  if (stars >= STAR_MAX)
    return <span className="rounded-full bg-star-goal px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white">{pct}% · canjear</span>
  return (
    <span className="rounded-full border border-star-goal px-2 py-0.5 text-xs font-medium whitespace-nowrap text-star-goal">{pct}% OFF</span>
  )
}
