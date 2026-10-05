import 'server-only'
import { db } from './db'
import type { ParsedOrder } from './parse'
import { normalize } from './text'
import { randomBytes } from 'node:crypto'

/** El cliente se identifica por su WhatsApp. Sin número, queda agrupado por nombre + dirección
 *  como "sin WhatsApp" (no suma estrellas) hasta que se le cargue el número. */
export function customerKey(o: Pick<ParsedOrder, 'phone' | 'customerName' | 'address'>) {
  if (o.phone) return `tel:${o.phone}`
  const addr = normalize(o.address).replace(/[^a-z0-9]/g, '')
  return `n:${normalize(o.customerName)}|${addr}`
}

export async function importOrders(orders: ParsedOrder[], filename: string, username: string) {
  const client = await db()
  const tx = await client.transaction('write')
  try {
    const existing = new Set<number>()
    if (orders.length) {
      const { rows } = await tx.execute({
        sql: `SELECT id FROM orders WHERE id IN (${orders.map(() => '?').join(',')})`,
        args: orders.map((o) => o.id),
      })
      rows.forEach((r) => existing.add(Number(r.id)))
    }
    const inserted = orders.filter((o) => !existing.has(o.id)).length
    const upload = await tx.execute({
      sql: 'INSERT INTO uploads (filename, username, inserted, updated) VALUES (?, ?, ?, ?)',
      args: [filename, username, inserted, orders.length - inserted],
    })
    const uploadId = Number(upload.lastInsertRowid)

    // De más viejo a más nuevo: así el nombre y la dirección del cliente quedan los de su último pedido
    for (const o of [...orders].sort((a, b) => a.date.localeCompare(b.date))) {
      const { rows } = await tx.execute({
        sql: `INSERT INTO customers (key, name, phone, address, zone, card_token) VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET name = excluded.name, phone = excluded.phone,
                address = excluded.address, zone = coalesce(nullif(excluded.zone, ''), zone)
              RETURNING id`,
        args: [customerKey(o), o.customerName, o.phone, o.address, o.zone, randomBytes(12).toString('hex')],
      })
      const customerId = Number(rows[0].id)
      await tx.execute({
        sql: `INSERT INTO orders (id, date, month, status, cancelled, paid, customer_id, total, payment_method,
                address, zone, cross_streets, note, products_raw, upload_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET date = excluded.date, month = excluded.month, status = excluded.status,
                cancelled = excluded.cancelled, paid = excluded.paid, customer_id = excluded.customer_id,
                total = excluded.total, payment_method = excluded.payment_method, address = excluded.address,
                zone = excluded.zone, cross_streets = excluded.cross_streets, note = excluded.note,
                products_raw = excluded.products_raw, upload_id = excluded.upload_id`,
        args: [
          o.id, o.date, o.date.slice(0, 7), o.status, o.cancelled ? 1 : 0, o.paid ? 1 : 0, customerId, o.total,
          o.paymentMethod, o.address, o.zone, o.crossStreets, o.note, o.productsRaw, uploadId,
        ],
      })
      await tx.execute({ sql: 'DELETE FROM order_items WHERE order_id = ?', args: [o.id] })
      for (const it of o.items) {
        await tx.execute({
          sql: 'INSERT INTO order_items (order_id, qty, category, product, extras) VALUES (?, ?, ?, ?, ?)',
          args: [o.id, it.qty, it.category, it.product, JSON.stringify(it.extras)],
        })
      }
    }
    // Clientes que quedaron sin pedidos (ej. un pedido re-importado con otro nombre)
    await tx.execute(`DELETE FROM customers WHERE id NOT IN (SELECT DISTINCT customer_id FROM orders)
      AND id NOT IN (SELECT customer_id FROM redemptions)`)
    await tx.commit()
    return { inserted, updated: orders.length - inserted }
  } catch (err) {
    await tx.rollback()
    throw err
  } finally {
    tx.close()
  }
}

export type Range = { from: string; to: string } // 'YYYY-MM-DD' inclusive

const n = (v: unknown) => Number(v ?? 0)
const s = (v: unknown) => String(v ?? '')

export async function getDashboard({ from, to }: Range) {
  const client = await db()
  const where = `o.cancelled = 0 AND o.date >= ? AND o.date < date(?, '+1 day')`
  const args = [from, to]
  const [kpi, payments, products, extras, zones, hours, days, topCustomers, cancelled] = await client.batch(
    [
      {
        sql: `SELECT COUNT(*) AS orders, COALESCE(SUM(total),0) AS revenue, COUNT(DISTINCT customer_id) AS customers,
                COALESCE(SUM(CASE WHEN paid = 0 THEN total END),0) AS unpaid,
                (SELECT COALESCE(SUM(qty),0) FROM order_items i JOIN orders o ON o.id = i.order_id WHERE ${where}) AS units
              FROM orders o WHERE ${where}`,
        args: [...args, ...args],
      },
      {
        sql: `SELECT payment_method AS label, COUNT(*) AS orders, SUM(total) AS revenue FROM orders o
              WHERE ${where} GROUP BY payment_method ORDER BY revenue DESC`,
        args,
      },
      {
        sql: `SELECT i.category, i.product AS label, SUM(i.qty) AS units, COUNT(DISTINCT o.id) AS orders
              FROM order_items i JOIN orders o ON o.id = i.order_id
              WHERE ${where} GROUP BY i.category, i.product ORDER BY units DESC, label`,
        args,
      },
      {
        sql: `SELECT j.value AS label, SUM(i.qty) AS units
              FROM order_items i JOIN orders o ON o.id = i.order_id, json_each(i.extras) j
              WHERE ${where} GROUP BY j.value ORDER BY units DESC, label`,
        args,
      },
      {
        sql: `SELECT COALESCE(NULLIF(zone,''),'Sin zona') AS label, COUNT(*) AS orders, SUM(total) AS revenue
              FROM orders o WHERE ${where} GROUP BY label ORDER BY orders DESC, label`,
        args,
      },
      {
        sql: `SELECT CAST(substr(date, 12, 2) AS INTEGER) AS hour, COUNT(*) AS orders, SUM(total) AS revenue
              FROM orders o WHERE ${where} GROUP BY hour ORDER BY hour`,
        args,
      },
      {
        sql: `SELECT substr(date, 1, 10) AS day, COUNT(*) AS orders, SUM(total) AS revenue
              FROM orders o WHERE ${where} GROUP BY day ORDER BY day`,
        args,
      },
      {
        sql: `SELECT c.id, c.name, COUNT(*) AS orders, SUM(o.total) AS revenue
              FROM orders o JOIN customers c ON c.id = o.customer_id
              WHERE ${where} GROUP BY c.id ORDER BY revenue DESC LIMIT 8`,
        args,
      },
      {
        sql: `SELECT COUNT(*) AS n FROM orders o WHERE o.cancelled = 1 AND o.date >= ? AND o.date < date(?, '+1 day')`,
        args,
      },
    ],
    'read',
  )
  const k = kpi.rows[0]
  return {
    orders: n(k.orders),
    revenue: n(k.revenue),
    customers: n(k.customers),
    unpaid: n(k.unpaid),
    units: n(k.units),
    cancelled: n(cancelled.rows[0].n),
    payments: payments.rows.map((r) => ({ label: s(r.label), orders: n(r.orders), revenue: n(r.revenue) })),
    products: products.rows.map((r) => ({ category: s(r.category), label: s(r.label), units: n(r.units), orders: n(r.orders) })),
    extras: extras.rows.map((r) => ({ label: s(r.label), units: n(r.units) })),
    zones: zones.rows.map((r) => ({ label: s(r.label), orders: n(r.orders), revenue: n(r.revenue) })),
    hours: hours.rows.map((r) => ({ hour: n(r.hour), orders: n(r.orders), revenue: n(r.revenue) })),
    days: days.rows.map((r) => ({ day: s(r.day), orders: n(r.orders), revenue: n(r.revenue) })),
    topCustomers: topCustomers.rows.map((r) => ({ id: n(r.id), name: s(r.name), orders: n(r.orders), revenue: n(r.revenue) })),
  }
}

/** Primer y último día con pedidos cargados */
export async function getBounds() {
  const client = await db()
  const { rows } = await client.execute(
    'SELECT MIN(substr(date,1,10)) AS first, MAX(substr(date,1,10)) AS last FROM orders',
  )
  return {
    firstDay: rows[0].first ? s(rows[0].first) : null,
    lastDay: rows[0].last ? s(rows[0].last) : null,
  }
}

export async function getUploads(limit = 10) {
  const client = await db()
  const { rows } = await client.execute({
    sql: 'SELECT id, filename, username, inserted, updated, created_at FROM uploads ORDER BY id DESC LIMIT ?',
    args: [limit],
  })
  return rows.map((r) => ({
    id: n(r.id),
    filename: s(r.filename),
    username: s(r.username),
    inserted: n(r.inserted),
    updated: n(r.updated),
    createdAt: s(r.created_at),
  }))
}
