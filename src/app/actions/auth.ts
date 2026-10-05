'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { createSession, deleteSession } from '@/lib/session'

export type LoginState = { error?: string; username?: string } | undefined

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!username || !password) return { error: 'Ingresá usuario y contraseña', username }

  const client = await db()
  const { rows } = await client.execute({
    sql: 'SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE',
    args: [username],
  })
  const user = rows[0]
  const ok = user ? await bcrypt.compare(password, String(user.password_hash)) : false
  if (!user || !ok) return { error: 'Usuario o contraseña incorrectos', username }

  await createSession({ userId: Number(user.id), username: String(user.username) })
  redirect('/')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
