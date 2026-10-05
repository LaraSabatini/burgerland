import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { readSession } from './session'
import { db } from './db'

/** Verifica la sesión contra la base. Usar en cada página y acción protegida. */
export const requireUser = cache(async () => {
  const session = await readSession()
  if (!session) redirect('/login')
  const client = await db()
  const { rows } = await client.execute({
    sql: 'SELECT id, username FROM users WHERE id = ?',
    args: [session.userId],
  })
  if (rows.length === 0) redirect('/login')
  return { id: Number(rows[0].id), username: String(rows[0].username) }
})
