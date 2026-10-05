const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('es-AR')
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })

export const fmtMoney = (v: number) => money.format(v)
export const fmtNum = (v: number) => num.format(v)
export const fmtCompactMoney = (v: number) => `$${compact.format(v)}`
export const fmtPct = (v: number) => `${Math.round(v * 100)}%`

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** 'YYYY-MM-DD[ HH:MM]' -> '04/10/2026[ 21:05]' */
export function fmtDate(date: string, withTime = false) {
  const [d, t] = date.split(' ')
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}${withTime && t ? ` ${t}` : ''}`
}

/** 'YYYY-MM-DD' -> '4 oct' */
export function fmtShortDay(day: string) {
  const [, m, d] = day.split('-').map(Number)
  return `${d} ${MONTHS[m - 1].slice(0, 3)}`
}

/** Fecha de hoy en Argentina como 'YYYY-MM-DD' */
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
}

export function addDays(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

/** Fecha y hora actual en Argentina como 'YYYY-MM-DD HH:MM' (mismo formato que los pedidos) */
export function nowStamp() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`
}

/** Suma días a un 'YYYY-MM-DD HH:MM' */
export function shiftStamp(stamp: string, days: number) {
  const d = new Date(`${stamp.replace(' ', 'T')}:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 16).replace('T', ' ')
}
