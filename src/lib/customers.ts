import 'server-only'
import { db } from './db'
import { nowStamp, shiftStamp } from './format'
import { discountFor, STAR_DAYS, STAR_MAX } from './loyalty'

const n = (v: unknown) => Number(v ?? 0)
const s = (v: unknown) => String(v ?? '')

/**
 * Reglas:
 * - Cada pedido (no cancelado) suma 1 estrella, que vence a los STAR_DAYS días.
 * - Se cuentan solo los pedidos posteriores al último canje (reset_at).
 * - Máximo STAR_MAX estrellas activas.
 */
function window() {
  const now = nowStamp()
  return { now, cutoff: shiftStamp(now, -STAR_DAYS) }
}

export type CustomerRow = {
  id: number
  name: string
  phone: string | null
  address: string
  zone: string
  cardToken: string
  stars: number
  discount: number
  expiredStars: number
  nextExpiry: string | null
  totalOrders: number
  totalSpent: number
  lastOrder: string
}

export async function getCustomers(): Promise<CustomerRow[]> {
  const { cutoff } = window()
  const client = await db()
  const cycle = `o.date > COALESCE(c.reset_at, '')`
  const { rows } = await client.execute({
    sql: `SELECT c.id, c.name, c.phone, c.address, c.zone, c.card_token,
            SUM(CASE WHEN ${cycle} AND o.date > ? THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN ${cycle} AND o.date <= ? THEN 1 ELSE 0 END) AS expired,
            MIN(CASE WHEN ${cycle} AND o.date > ? THEN o.date END) AS first_active,
            COUNT(*) AS total_orders, SUM(o.total) AS total_spent, MAX(o.date) AS last_order
          FROM customers c JOIN orders o ON o.customer_id = c.id AND o.cancelled = 0
          GROUP BY c.id
          ORDER BY c.phone IS NULL, active DESC, last_order DESC`,
    args: [cutoff, cutoff, cutoff],
  })
  return rows.map((r) => {
    // Sin WhatsApp no hay estrellas: el número es lo que identifica al cliente
    const hasPhone = Boolean(r.phone)
    const stars = hasPhone ? Math.min(n(r.active), STAR_MAX) : 0
    return {
      id: n(r.id),
      name: s(r.name),
      phone: r.phone ? s(r.phone) : null,
      address: s(r.address),
      zone: s(r.zone),
      cardToken: s(r.card_token),
      stars,
      discount: discountFor(stars),
      expiredStars: hasPhone ? n(r.expired) : 0,
      nextExpiry: hasPhone && r.first_active ? shiftStamp(s(r.first_active), STAR_DAYS) : null,
      totalOrders: n(r.total_orders),
      totalSpent: n(r.total_spent),
      lastOrder: s(r.last_order),
    }
  })
}

export type StarStatus = 'activa' | 'vencida' | 'canjeada' | 'cancelado' | 'sin-whatsapp'

async function loadCustomer(where: 'id' | 'card_token', value: string | number) {
  const { cutoff } = window()
  const client = await db()
  const { rows } = await client.execute({
    sql: `SELECT id, name, phone, address, zone, reset_at, card_token FROM customers WHERE ${where} = ?`,
    args: [value],
  })
  if (rows.length === 0) return null
  const c = rows[0]
  const resetAt = c.reset_at ? s(c.reset_at) : null
  const [orders, redemptions] = await client.batch(
    [
      {
        sql: `SELECT id, date, status, cancelled, paid, total, payment_method, products_raw, note
              FROM orders WHERE customer_id = ? ORDER BY date DESC`,
        args: [c.id],
      },
      {
        sql: 'SELECT id, redeemed_at, stars, discount, username FROM redemptions WHERE customer_id = ? ORDER BY redeemed_at DESC',
        args: [c.id],
      },
    ],
    'read',
  )

  const list = orders.rows.map((o) => {
    const date = s(o.date)
    const cancelled = n(o.cancelled) === 1
    const status: StarStatus = cancelled
      ? 'cancelado'
      : !c.phone
        ? 'sin-whatsapp'
        : resetAt && date <= resetAt
        ? 'canjeada'
        : date > cutoff
          ? 'activa'
          : 'vencida'
    return {
      id: n(o.id),
      date,
      expiresAt: shiftStamp(date, STAR_DAYS),
      star: status,
      status: s(o.status),
      paid: n(o.paid) === 1,
      total: n(o.total),
      paymentMethod: s(o.payment_method),
      products: s(o.products_raw).trim(),
      note: s(o.note),
    }
  })
  const active = list.filter((o) => o.star === 'activa')
  const stars = Math.min(active.length, STAR_MAX)
  return {
    id: n(c.id),
    name: s(c.name),
    phone: c.phone ? s(c.phone) : null,
    address: s(c.address),
    zone: s(c.zone),
    cardToken: s(c.card_token),
    resetAt,
    stars,
    discount: discountFor(stars),
    expiredStars: list.filter((o) => o.star === 'vencida').length,
    // Estrellas activas, de la que vence primero a la última
    activeStars: active.map((o) => ({ date: o.date, expiresAt: o.expiresAt })).reverse(),
    orders: list,
    redemptions: redemptions.rows.map((r) => ({
      id: n(r.id),
      redeemedAt: s(r.redeemed_at),
      stars: n(r.stars),
      discount: n(r.discount),
      username: s(r.username),
    })),
  }
}

export const getCustomer = (id: number) => loadCustomer('id', id)
export const getCustomerByCard = (token: string) => loadCustomer('card_token', token)
