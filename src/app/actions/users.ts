'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/dal'

export type FormResult = { ok?: string; error?: string } | undefined

export async function createUser(_: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser()
  const username = String(formData.get('username') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!/^[\w.@-]{3,40}$/.test(username)) return { error: 'Usuario: 3 a 40 caracteres, sin espacios' }
  if (password.length < 8) return { error: 'La contraseña tiene que tener al menos 8 caracteres' }
  const client = await db()
  try {
    await client.execute({
      sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      args: [username, await bcrypt.hash(password, 10)],
    })
  } catch {
    return { error: 'Ese usuario ya existe' }
  }
  revalidatePath('/usuarios')
  return { ok: `Usuario ${username} creado` }
}

export async function deleteUser(formData: FormData) {
  const me = await requireUser()
  const id = Number(formData.get('id'))
  if (!id || id === me.id) return
  const client = await db()
  await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] })
  revalidatePath('/usuarios')
}

export async function changePassword(_: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requireUser()
  const current = String(formData.get('current') ?? '')
  const next = String(formData.get('next') ?? '')
  if (next.length < 8) return { error: 'La nueva contraseña tiene que tener al menos 8 caracteres' }
  const client = await db()
  const { rows } = await client.execute({ sql: 'SELECT password_hash FROM users WHERE id = ?', args: [me.id] })
  if (!rows[0] || !(await bcrypt.compare(current, String(rows[0].password_hash)))) {
    return { error: 'La contraseña actual no es correcta' }
  }
  await client.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [await bcrypt.hash(next, 10), me.id],
  })
  return { ok: 'Contraseña actualizada' }
}
