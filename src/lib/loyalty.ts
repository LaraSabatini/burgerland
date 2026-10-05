import { waNumber } from './phone'

export const BRAND = 'Burgerland'

/** Desde cuántas estrellas hay descuento (las estrellas cambian de color) */
export const STAR_GOAL = 5
/** Máximo de estrellas activas */
export const STAR_MAX = 10
/** Cada estrella vence a los 30 días de la compra */
export const STAR_DAYS = 30

/** [estrellas, % de descuento] */
export const TIERS: [number, number][] = [
  [5, 10],
  [6, 15],
  [7, 20],
  [8, 25],
  [9, 30],
  [10, 40],
]

export function discountFor(stars: number) {
  let pct = 0
  for (const [s, p] of TIERS) if (stars >= s) pct = p
  return pct
}

export function nextTier(stars: number) {
  const t = TIERS.find(([s]) => s > stars)
  return t ? { stars: t[0], discount: t[1], missing: t[0] - stars } : null
}

/** Link de WhatsApp con mensaje prearmado (phone ya normalizado a 10 dígitos) */
export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`
}

export function whatsappMessage(name: string, stars: number, cardUrl: string) {
  const first = name.split(' ')[0]
  const pct = discountFor(stars)
  const next = nextTier(stars)
  let body: string
  if (stars >= STAR_MAX) body = `¡Llegaste a las ${STAR_MAX} estrellas! Tenés ${pct}% de descuento en tu próxima compra 🎉`
  else if (pct > 0) body = `Tenés ${stars} ⭐ y ${pct}% de descuento en tu próxima compra. Con ${next!.missing} más pasás al ${next!.discount}%.`
  else body = `Tenés ${stars} ⭐. Te ${next!.missing === 1 ? 'falta 1' : `faltan ${next!.missing}`} para tu primer descuento del ${next!.discount}%.`
  return `¡Hola ${first}! ${body}\nAcordate que cada estrella vence a los ${STAR_DAYS} días.\nMirá tu tarjeta: ${cardUrl}`
}
