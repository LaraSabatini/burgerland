import Link from 'next/link'
import { requireUser } from '@/lib/dal'
import { getBounds, getDashboard, type Range } from '@/lib/orders'
import { addDays, fmtDate, fmtMoney, fmtNum, fmtPct, today } from '@/lib/format'
import { BarList } from '@/components/bar-list'
import { DaysChart, HoursChart } from '@/components/charts'
import { Card, Empty, PageHeader } from '@/components/ui'

export const metadata = { title: 'Resumen · Burgerland' }

const PRESETS = [
  { id: 'ultimo', label: 'Último día cargado' },
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'mes', label: 'Este mes' },
  { id: 'todo', label: 'Todo' },
] as const

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

function resolveRange(params: Record<string, string | string[] | undefined>, lastDay: string | null, firstDay: string | null) {
  const t = today()
  if (isDay(params.desde) && isDay(params.hasta)) {
    const [from, to] = [params.desde, params.hasta].sort()
    return { preset: 'custom', range: { from, to } }
  }
  const preset = typeof params.r === 'string' ? params.r : '30d'
  const ranges: Record<string, Range> = {
    ultimo: { from: lastDay ?? t, to: lastDay ?? t },
    hoy: { from: t, to: t },
    '7d': { from: addDays(t, -6), to: t },
    '30d': { from: addDays(t, -29), to: t },
    mes: { from: `${t.slice(0, 8)}01`, to: t },
    todo: { from: firstDay ?? t, to: lastDay ?? t },
  }
  return ranges[preset] ? { preset, range: ranges[preset] } : { preset: '30d', range: ranges['30d'] }
}

export default async function DashboardPage({ searchParams }: PageProps<'/'>) {
  await requireUser()
  const params = await searchParams
  const bounds = await getBounds()
  const { preset, range } = resolveRange(params, bounds.lastDay, bounds.firstDay)
  const d = await getDashboard(range)

  const avgTicket = d.orders ? d.revenue / d.orders : 0
  const categories = Object.entries(
    d.products.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.category]: (acc[p.category] ?? 0) + p.units }), {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <>
      <PageHeader
        title="Resumen"
        subtitle={range.from === range.to ? fmtDate(range.from) : `Del ${fmtDate(range.from)} al ${fmtDate(range.to)}`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Link
            key={p.id}
            href={`/?r=${p.id}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              preset === p.id ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink-2 hover:text-ink'
            }`}
          >
            {p.label}
          </Link>
        ))}
        <form className="flex flex-wrap items-center gap-2 text-sm sm:ml-auto">
          <input type="date" name="desde" defaultValue={range.from} aria-label="Desde" className="h-9 rounded-lg border border-line bg-surface px-2" />
          <span className="text-muted">a</span>
          <input type="date" name="hasta" defaultValue={range.to} aria-label="Hasta" className="h-9 rounded-lg border border-line bg-surface px-2" />
          <button className="h-9 rounded-lg border border-line bg-surface px-3 hover:bg-surface-2">Aplicar</button>
        </form>
      </div>

      {bounds.lastDay === null ? (
        <Empty>
          Todavía no hay pedidos cargados.{' '}
          <Link href="/subir" className="font-medium text-accent underline">
            Subí el primer Excel
          </Link>
          .
        </Empty>
      ) : d.orders === 0 ? (
        <Empty>
          No hay pedidos en este período. El último pedido cargado es del {fmtDate(bounds.lastDay)}.{' '}
          <Link href="/?r=ultimo" className="font-medium text-accent underline">
            Ver ese día
          </Link>
        </Empty>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Stat label="Ventas" value={fmtMoney(d.revenue)} />
            <Stat label="Pedidos" value={fmtNum(d.orders)} note={d.cancelled ? `${d.cancelled} cancelados aparte` : undefined} />
            <Stat label="Ticket promedio" value={fmtMoney(avgTicket)} />
            <Stat label="Clientes" value={fmtNum(d.customers)} />
            <Stat label="Unidades vendidas" value={fmtNum(d.units)} />
            <Stat label="Sin cobrar" value={fmtMoney(d.unpaid)} warn={d.unpaid > 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Plata por medio de pago" subtitle="Total cobrado y porcentaje sobre las ventas">
              <BarList
                items={d.payments.map((p) => ({
                  key: p.label,
                  label: (
                    <>
                      {p.label} <span className="text-muted">· {fmtNum(p.orders)} pedidos</span>
                    </>
                  ),
                  value: p.revenue,
                  display: `${fmtMoney(p.revenue)} · ${fmtPct(p.revenue / d.revenue)}`,
                }))}
              />
            </Card>

            <Card title="Ventas por zona" subtitle="Pedidos y facturación por zona de entrega">
              <BarList
                limit={8}
                items={d.zones.map((z) => ({
                  key: z.label,
                  label: z.label,
                  value: z.orders,
                  display: `${fmtNum(z.orders)} · ${fmtMoney(z.revenue)}`,
                }))}
              />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card
              title="Unidades vendidas por producto"
              subtitle={categories.map(([c, u]) => `${c}: ${fmtNum(u)}`).join(' · ')}
              className="lg:col-span-2"
            >
              <BarList
                items={d.products.map((p) => ({
                  key: `${p.category}|${p.label}`,
                  label: (
                    <>
                      {p.label} <span className="text-xs text-muted">{p.category}</span>
                    </>
                  ),
                  value: p.units,
                  display: `${fmtNum(p.units)} u.`,
                  hint: `Aparece en ${p.orders} pedidos`,
                }))}
              />
            </Card>
            <Card title="Extras y agregados" subtitle="Lo que más suman a los productos">
              {d.extras.length ? (
                <BarList
                  limit={12}
                  items={d.extras.map((e) => ({ key: e.label, label: e.label, value: e.units, display: `${fmtNum(e.units)}` }))}
                />
              ) : (
                <p className="text-sm text-muted">Sin extras en este período.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Pedidos por hora" subtitle="Cuándo entran los pedidos">
              <HoursChart data={d.hours} />
            </Card>
            {d.days.length > 1 ? (
              <Card title="Ventas por día">
                <DaysChart data={d.days} />
              </Card>
            ) : (
              <TopCustomers rows={d.topCustomers} />
            )}
          </div>

          {d.days.length > 1 && <TopCustomers rows={d.topCustomers} />}
        </div>
      )}
    </>
  )
}

function Stat({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-ink-2">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${warn ? 'text-critical' : ''}`}>
        {warn && <span aria-hidden>⚠ </span>}
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  )
}

function TopCustomers({ rows }: { rows: { id: number; name: string; orders: number; revenue: number }[] }) {
  return (
    <Card title="Mejores clientes del período" action={<Link href="/clientes" className="text-xs text-accent">Ver todos</Link>}>
      <table className="w-full text-sm">
        <tbody className="tabular">
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-line first:border-0">
              <td className="py-2">
                <Link href={`/clientes/${c.id}`} className="hover:underline">
                  {c.name}
                </Link>
              </td>
              <td className="py-2 text-right text-ink-2">{c.orders} ped.</td>
              <td className="py-2 text-right font-medium">{fmtMoney(c.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
