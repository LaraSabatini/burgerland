import 'server-only'
import { createClient, type Client } from '@libsql/client'
import bcrypt from 'bcryptjs'

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    zone TEXT,
    reset_at TEXT,
    card_token TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    redeemed_at TEXT NOT NULL,
    stars INTEGER NOT NULL,
    discount INTEGER NOT NULL,
    username TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    username TEXT NOT NULL,
    inserted INTEGER NOT NULL,
    updated INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    month TEXT NOT NULL,
    status TEXT NOT NULL,
    cancelled INTEGER NOT NULL DEFAULT 0,
    paid INTEGER NOT NULL DEFAULT 1,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    total REAL NOT NULL,
    payment_method TEXT NOT NULL,
    address TEXT,
    zone TEXT,
    cross_streets TEXT,
    note TEXT,
    products_raw TEXT,
    upload_id INTEGER REFERENCES uploads(id)
  )`,
  `CREATE INDEX IF NOT EXISTS orders_date ON orders(date)`,
  `CREATE INDEX IF NOT EXISTS orders_customer_month ON orders(customer_id, month)`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL,
    category TEXT NOT NULL,
    product TEXT NOT NULL,
    extras TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id)`,
]

let ready: Promise<Client> | undefined

async function init(): Promise<Client> {
  const client = createClient({
    url: process.env.DATABASE_URL ?? 'file:local.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  })
  await client.batch(SCHEMA, 'write')

  // Migración de bases creadas antes del sistema de vencimiento y tarjetas
  const { rows: cols } = await client.execute('PRAGMA table_info(customers)')
  const has = new Set(cols.map((c) => String(c.name)))
  if (!has.has('reset_at')) await client.execute('ALTER TABLE customers ADD COLUMN reset_at TEXT')
  if (!has.has('card_token')) await client.execute('ALTER TABLE customers ADD COLUMN card_token TEXT')
  await client.batch(
    [
      'UPDATE customers SET card_token = lower(hex(randomblob(12))) WHERE card_token IS NULL',
      'CREATE UNIQUE INDEX IF NOT EXISTS customers_card_token ON customers(card_token)',
    ],
    'write',
  )

  // Primer arranque: crea el usuario admin desde las variables de entorno.
  const { rows } = await client.execute('SELECT COUNT(*) AS n FROM users')
  if (Number(rows[0].n) === 0) {
    const username = process.env.ADMIN_USERNAME
    const password = process.env.ADMIN_PASSWORD
    if (username && password) {
      await client.execute({
        sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        args: [username, await bcrypt.hash(password, 10)],
      })
    }
  }
  return client
}

export function db(): Promise<Client> {
  if (!ready) {
    ready = init().catch((err) => {
      ready = undefined
      throw err
    })
  }
  return ready
}
