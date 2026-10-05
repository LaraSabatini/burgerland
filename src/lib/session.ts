import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export type SessionPayload = { userId: number; username: string }

const COOKIE = 'session'
const MAX_AGE_DAYS = 7

function key() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET debe tener al menos 32 caracteres')
  }
  return new TextEncoder().encode(secret)
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_DAYS}d`)
    .sign(key())
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] })
    if (typeof payload.userId !== 'number' || typeof payload.username !== 'string') return null
    return { userId: payload.userId, username: payload.username }
  } catch {
    return null
  }
}

export async function createSession(payload: SessionPayload) {
  const token = await encrypt(payload)
  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_DAYS * 24 * 60 * 60,
  })
}

export async function readSession() {
  const store = await cookies()
  return decrypt(store.get(COOKIE)?.value)
}

export async function deleteSession() {
  const store = await cookies()
  store.delete(COOKIE)
}
