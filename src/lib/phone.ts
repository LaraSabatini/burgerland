/**
 * Normaliza un celular argentino a 10 dígitos (código de área + número, sin 0 ni 15),
 * para que "+54 9 11 2345-6789", "011 15 2345 6789" y "1123456789" sean el mismo cliente.
 * Devuelve null si no parece un número válido.
 */
export function normalizePhone(raw: string | number | null | undefined): string | null {
  if (raw == null) return null
  let d = (typeof raw === 'number' ? Math.round(raw).toString() : raw).replace(/\D/g, '')
  d = d.replace(/^00/, '')
  if (d.startsWith('54') && d.length >= 12) d = d.slice(2)
  if (d.startsWith('9') && d.length === 11) d = d.slice(1)
  d = d.replace(/^0/, '')
  // "15" después del código de área (2 a 4 dígitos): 11 15 2345 6789 -> 11 2345 6789
  if (d.length === 12) {
    for (const i of [2, 3, 4]) {
      if (d.slice(i, i + 2) === '15') {
        d = d.slice(0, i) + d.slice(i + 2)
        break
      }
    }
  }
  return d.length === 10 ? d : null
}

/** 1123456789 -> 11 2345-6789 · 3514567890 -> 351 456-7890 */
export function fmtPhone(phone: string) {
  if (phone.length !== 10) return phone
  const area = phone.startsWith('11') ? 2 : 3
  const rest = phone.slice(area)
  return `${phone.slice(0, area)} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`
}

/** Para wa.me: 54 9 + número */
export function waNumber(phone: string) {
  return `549${phone}`
}
