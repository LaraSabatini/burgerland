import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getCustomer, type StarStatus } from '@/lib/customers'
import { fmtDate, fmtMoney } from '@/lib/format'
import { nextTier, STAR_DAYS, STAR_MAX, whatsappLink, whatsappMessage } from '@/lib/loyalty'
import { cardUrl } from '@/lib/url'
import { fmtPhone } from '@/lib/phone'
import { redeem, undoRedeem } from '@/app/actions/customers'
import { DiscountBadge, Stars } from '@/components/stars'
import { Button, Card, PageHeader } from '@/components/ui'
import { CopyButton, PhoneForm } from './client'

const STAR_LABEL: Record<StarStatus, { text: string; className: string }> = {
  activa: { text: '⭐ activa', className: 'text-star-goal' },
  vencida: { text: 'vencida', className: 'text-muted' },
  canjeada: { text: 'canjeada', className: 'text-muted' },
  cancelado: { text: 'cancelado, no suma', className: 'text-critical' },
  'sin-whatsapp': { text: 'sin WhatsApp, no suma', className: 'text-critical' },
}

export default async function CustomerPage({ params, searchParams }: PageProps<'/clientes/[id]'>) {
  await requireUser()
  const { id } = await params
  const merged = (await searchParams).unificado === '1'
  const c = await getCustomer(Number(id))
  if (!c) notFound()

  const valid = c.orders.filter((o) => o.star !== 'cancelado')
  const spent = valid.reduce((acc, o) => acc + o.total, 0)
  const next = nextTier(c.stars)
  const url = await cardUrl(c.cardToken)

  return (
    <>
      <Link href="/clientes" className="text-sm text-ink-2 hover:text-ink">
        ← Clientes
      </Link>
      <PageHeader title={c.name} subtitle={[c.phone && `WhatsApp ${fmtPhone(c.phone)}`, c.address, c.zone].filter(Boolean).join(' · ')} />

      {merged && (
        <p className="mb-6 rounded-lg border border-line bg-goal-wash px-4 py-3 text-sm">
          ✓ Ese número ya era de este cliente: se unificaron las compras y las estrellas.
        </p>
      )}
      {!c.phone && (
        <p className="mb-6 rounded-lg border border-critical/30 bg-critical-wash px-4 py-3 text-sm">
          <strong>Este cliente no tiene WhatsApp.</strong> Los clientes se identifican por su número, así que sus compras no suman
          estrellas hasta que lo cargues abajo. Si el número ya es de otro cliente, se unifican.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card title="Fidelización">
            <div className="flex flex-wrap items-center gap-3">
              <Stars count={c.stars} size="lg" />
            </div>
            <p className="mt-3 text-2xl font-semibold">
              {c.stars} <span className="text-base font-normal text-ink-2">de {STAR_MAX} estrellas</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {c.discount ? <DiscountBadge stars={c.stars} /> : <span className="text-ink-2">Sin descuento todavía</span>}
              {next && (
                <span className="text-ink-2">
                  · {next.missing === 1 ? 'Falta 1' : `Faltan ${next.missing}`} para el {next.discount}%
                </span>
              )}
            </div>
            {c.activeStars.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                La próxima estrella vence el {fmtDate(c.activeStars[0].expiresAt, true)}. {c.expiredStars > 0 && `${c.expiredStars} vencidas en este ciclo.`}
              </p>
            )}

            {c.stars >= STAR_MAX && (
              <form action={redeem} className="mt-4">
                <input type="hidden" name="id" value={c.id} />
                <Button type="submit" className="w-full">
                  Registrar canje del {c.discount}% (vuelve a 0)
                </Button>
              </form>
            )}
            {c.redemptions.length > 0 && (
              <div className="mt-4 border-t border-line pt-3 text-xs text-ink-2">
                <p className="mb-1 font-medium text-ink">Canjes</p>
                {c.redemptions.map((r) => (
                  <p key={r.id}>
                    {fmtDate(r.redeemedAt, true)}: {r.discount}% ({r.username})
                  </p>
                ))}
                <form action={undoRedeem} className="mt-2">
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-critical hover:underline">Deshacer último canje</button>
                </form>
              </div>
            )}
          </Card>

          <Card title="Avisar al cliente" subtitle="Tarjeta digital y mensaje por WhatsApp">
            <PhoneForm id={c.id} phone={c.phone} />
            <div className="mt-4 flex flex-wrap gap-2">
              {c.phone ? (
                <a
                  href={whatsappLink(c.phone, whatsappMessage(c.name, c.stars, url))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:opacity-90"
                >
                  Enviar por WhatsApp
                </a>
              ) : (
                <p className="w-full text-xs text-muted">Cargá el WhatsApp para que sume estrellas y tenga su tarjeta.</p>
              )}
              {c.phone && (
                <>
                  <CopyButton text={url} label="Copiar link de la tarjeta" />
                  <a href={url} target="_blank" className="inline-flex h-10 items-center px-2 text-sm text-accent hover:underline">
                    Ver tarjeta
                  </a>
                </>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Mini label="Pedidos" value={String(valid.length)} />
            <Mini label="Gastado" value={fmtMoney(spent)} />
          </div>
        </div>

        <Card title="Compras" subtitle={`Cada estrella vence a los ${STAR_DAYS} días de la compra`} className="lg:col-span-2">
          <ul className="divide-y divide-line">
            {c.orders.map((o) => (
              <li key={o.id} className={`py-3 text-sm ${o.star === 'cancelado' ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    #{o.id} · {fmtDate(o.date, true)}
                  </span>
                  <span className="tabular font-semibold">{fmtMoney(o.total)}</span>
                </div>
                <p className="mt-0.5 text-xs">
                  <span className={STAR_LABEL[o.star].className}>{STAR_LABEL[o.star].text}</span>
                  {o.star === 'activa' && <span className="text-muted">, vence el {fmtDate(o.expiresAt)}</span>}
                  <span className="text-muted">
                    {' '}· {o.paymentMethod} · {o.status}
                    {!o.paid && ' · sin cobrar'}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-line text-ink-2">{o.products}</p>
                {o.note && <p className="mt-1 text-xs italic text-ink-2">“{o.note}”</p>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}
