import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCustomerByCard } from '@/lib/customers'
import { fmtDate } from '@/lib/format'
import { BRAND, nextTier, STAR_DAYS, STAR_MAX, TIERS } from '@/lib/loyalty'
import { Stars } from '@/components/stars'

export const metadata: Metadata = {
  title: `Mi tarjeta · ${BRAND}`,
  robots: { index: false, follow: false },
}

export default async function CardPage({ params }: PageProps<'/tarjeta/[token]'>) {
  const { token } = await params
  if (!/^[a-f0-9]{24}$/.test(token)) notFound()
  const c = await getCustomerByCard(token)
  if (!c || !c.phone) notFound()

  const first = c.name.split(' ')[0]
  const next = nextTier(c.stars)

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-8">
      <p className="text-center text-sm font-semibold tracking-widest text-ink-2 uppercase">{BRAND}</p>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
        <p className="text-sm text-ink-2">Hola, {first}</p>
        <p className="mt-1 text-4xl font-bold">
          {c.stars}
          <span className="text-lg font-normal text-ink-2"> / {STAR_MAX} ⭐</span>
        </p>
        <div className="mt-4 flex justify-center">
          <Stars count={c.stars} size="lg" />
        </div>

        <div className={`mt-5 rounded-xl px-4 py-3 ${c.discount ? 'bg-star-goal text-white' : 'bg-surface-2'}`}>
          {c.discount ? (
            <>
              <p className="text-3xl font-bold">{c.discount}% OFF</p>
              <p className="text-sm opacity-90">en tu próxima compra</p>
            </>
          ) : (
            <p className="text-sm">
              {next!.missing === 1 ? 'Te falta 1 estrella' : `Te faltan ${next!.missing} estrellas`} para tu primer descuento del{' '}
              <strong>{next!.discount}%</strong>
            </p>
          )}
        </div>
        {c.discount > 0 && next && (
          <p className="mt-3 text-sm text-ink-2">
            Con {next.missing === 1 ? '1 compra más' : `${next.missing} compras más`} pasás al {next.discount}%
          </p>
        )}
        {c.stars >= STAR_MAX && <p className="mt-3 text-sm text-ink-2">¡Llegaste al máximo! Al usarlo, tu tarjeta empieza de nuevo.</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Niveles</h2>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-center">
          {TIERS.map(([s, p]) => {
            const reached = c.stars >= s
            const current = c.discount === p
            return (
              <li
                key={s}
                className={`rounded-lg border px-2 py-2 ${
                  current ? 'border-star-goal bg-goal-wash' : 'border-line'
                } ${reached ? '' : 'opacity-50'}`}
              >
                <p className="text-xs text-ink-2">{s} ⭐</p>
                <p className={`font-semibold ${current ? 'text-star-goal' : ''}`}>{p}%</p>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold">Tus estrellas</h2>
        <p className="mt-0.5 text-xs text-muted">Cada estrella vence a los {STAR_DAYS} días de la compra.</p>
        {c.activeStars.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">No tenés estrellas activas. ¡Sumá una con tu próxima compra!</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {c.activeStars.map((s) => (
              <li key={s.date} className="flex justify-between py-2">
                <span>⭐ Compra del {fmtDate(s.date)}</span>
                <span className="text-ink-2">vence {fmtDate(s.expiresAt)}</span>
              </li>
            ))}
          </ul>
        )}
        {c.expiredStars > 0 && (
          <p className="mt-3 text-xs text-muted">
            {c.expiredStars === 1 ? '1 estrella vencida' : `${c.expiredStars} estrellas vencidas`}
          </p>
        )}
      </section>
    </main>
  )
}
