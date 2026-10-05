import { requireUser } from '@/lib/dal'
import { getCustomers } from '@/lib/customers'
import { STAR_DAYS, STAR_GOAL, STAR_MAX, TIERS } from '@/lib/loyalty'
import { PageHeader } from '@/components/ui'
import { CustomersTable } from './customers-table'

export const metadata = { title: 'Clientes · Burgerland' }

export default async function CustomersPage() {
  await requireUser()
  const customers = await getCustomers()

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={`Cada compra suma una estrella que vence a los ${STAR_DAYS} días. Desde ${STAR_GOAL} estrellas hay descuento, y con ${STAR_MAX} se canjea el máximo y el tablero vuelve a 0.`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Mini label="Con estrellas activas" value={customers.filter((c) => c.stars > 0).length} />
        <Mini label="Sin WhatsApp (no suman)" value={customers.filter((c) => !c.phone).length} warn />
        <Mini label="Con descuento disponible" value={customers.filter((c) => c.discount > 0).length} goal />
        <Mini label={`Listos para canjear (${STAR_MAX} ⭐)`} value={customers.filter((c) => c.stars >= STAR_MAX).length} goal />
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-ink-2">Descuentos por nivel</p>
          <p className="tabular mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs">
            {TIERS.map(([s, p]) => (
              <span key={s}>
                <span className="text-muted">{s}⭐</span> <strong>{p}%</strong>
              </span>
            ))}
          </p>
        </div>
      </div>

      <CustomersTable customers={customers} />
    </>
  )
}

function Mini({ label, value, goal, warn }: { label: string; value: number; goal?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-ink-2">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${goal && value > 0 ? 'text-star-goal' : ''} ${warn && value > 0 ? 'text-critical' : ''}`}>{value}</p>
    </div>
  )
}
