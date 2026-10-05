'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/dal'
import { getCustomer } from '@/lib/customers'
import { nowStamp } from '@/lib/format'
import { STAR_MAX } from '@/lib/loyalty'
import { normalizePhone } from '@/lib/phone'

/** Registra el uso del descuento de 10 estrellas: el tablero del cliente vuelve a 0. */
export async function redeem(formData: FormData) {
  const user = await requireUser()
  const customer = await getCustomer(Number(formData.get('id')))
  if (!customer || customer.stars < STAR_MAX) return
  const now = nowStamp()
  const client = await db()
  await client.batch(
    [
      {
        sql: 'INSERT INTO redemptions (customer_id, redeemed_at, stars, discount, username) VALUES (?, ?, ?, ?, ?)',
        args: [customer.id, now, customer.stars, customer.discount, user.username],
      },
      { sql: 'UPDATE customers SET reset_at = ? WHERE id = ?', args: [now, customer.id] },
    ],
    'write',
  )
  revalidatePath('/clientes', 'layout')
}

/** Deshace el último canje (por si se registró por error). */
export async function undoRedeem(formData: FormData) {
  await requireUser()
  const id = Number(formData.get('id'))
  const client = await db()
  const tx = await client.transaction('write')
  try {
    const { rows } = await tx.execute({
      sql: 'SELECT id FROM redemptions WHERE customer_id = ? ORDER BY redeemed_at DESC LIMIT 1',
      args: [id],
    })
    if (rows.length) {
      await tx.execute({ sql: 'DELETE FROM redemptions WHERE id = ?', args: [rows[0].id] })
      await tx.execute({
        sql: `UPDATE customers SET reset_at = (SELECT MAX(redeemed_at) FROM redemptions WHERE customer_id = ?) WHERE id = ?`,
        args: [id, id],
      })
    }
    await tx.commit()
  } finally {
    tx.close()
  }
  revalidatePath('/clientes', 'layout')
}

export type PhoneState = { ok?: string; error?: string } | undefined

/**
 * Carga o cambia el WhatsApp de un cliente. Como el número identifica al cliente,
 * si ya existe otro cliente con ese número se unifican: las compras pasan a ese cliente.
 */
export async function updatePhone(_: PhoneState, formData: FormData): Promise<PhoneState> {
  await requireUser()
  const id = Number(formData.get('id'))
  const raw = String(formData.get('phone') ?? '').trim()
  if (!raw) return { error: 'Ingresá el número de WhatsApp' }
  const phone = normalizePhone(raw)
  if (!phone) return { error: 'No parece un celular válido. Ej: 11 2345-6789' }

  const client = await db()
  const tx = await client.transaction('write')
  let targetId = id
  try {
    const { rows: self } = await tx.execute({ sql: 'SELECT id, phone, reset_at FROM customers WHERE id = ?', args: [id] })
    if (!self.length) return { error: 'Cliente no encontrado' }
    if (self[0].phone === phone) return { ok: 'Sin cambios' }

    const { rows: other } = await tx.execute({
      sql: 'SELECT id, reset_at FROM customers WHERE key = ? AND id != ?',
      args: [`tel:${phone}`, id],
    })
    if (other.length) {
      targetId = Number(other[0].id)
      const resets = [self[0].reset_at, other[0].reset_at].filter(Boolean).map(String).sort()
      await tx.batch([
        { sql: 'UPDATE orders SET customer_id = ? WHERE customer_id = ?', args: [targetId, id] },
        { sql: 'UPDATE redemptions SET customer_id = ? WHERE customer_id = ?', args: [targetId, id] },
        { sql: 'UPDATE customers SET reset_at = ? WHERE id = ?', args: [resets.at(-1) ?? null, targetId] },
        { sql: 'DELETE FROM customers WHERE id = ?', args: [id] },
      ])
    } else {
      await tx.execute({ sql: 'UPDATE customers SET key = ?, phone = ? WHERE id = ?', args: [`tel:${phone}`, phone, id] })
    }
    await tx.commit()
  } finally {
    tx.close()
  }
  revalidatePath('/clientes', 'layout')
  if (targetId !== id) redirect(`/clientes/${targetId}?unificado=1`)
  return { ok: 'Guardado' }
}
