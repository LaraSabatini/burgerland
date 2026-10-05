import 'server-only'
import ExcelJS from 'exceljs'
import { normalize } from './text'
import { normalizePhone } from './phone'

export type ParsedItem = { qty: number; category: string; product: string; extras: string[] }

export type ParsedOrder = {
  id: number
  date: string // 'YYYY-MM-DD HH:MM' hora local, sin zona
  status: string
  cancelled: boolean
  paid: boolean
  customerName: string
  phone: string | null
  total: number
  paymentMethod: string
  address: string
  zone: string
  crossStreets: string
  note: string
  productsRaw: string
  items: ParsedItem[]
}

export type ParseResult = {
  orders: ParsedOrder[]
  errors: string[]
  /** true si se invirtieron día y mes de las fechas */
  swapped: boolean
  /** de dónde salió la decisión de invertir o no */
  swapReason: 'archivo' | 'manual' | 'por defecto'
}

const HEADERS: Record<string, string> = {
  pedido: 'id',
  fecha: 'date',
  estado: 'status',
  productos: 'products',
  cobrado: 'paid',
  cliente: 'customer',
  whatsapp: 'phone',
  telefono: 'phone',
  total: 'total',
  'metodo pago': 'payment',
  'metodo de pago': 'payment',
  direccion: 'address',
  zona: 'zone',
  'campos personalizados': 'custom',
  nota: 'note',
}

export function parseProducts(raw: string): ParsedItem[] {
  const items: ParsedItem[] = []
  for (const line of raw.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d+)\s*x\s*(.+)$/i)
    if (!m) continue
    const qty = Number(m[1])
    let rest = m[2].trim()
    let category = 'Otros'
    const dash = rest.indexOf(' - ')
    if (dash > -1) {
      category = rest.slice(0, dash).trim()
      rest = rest.slice(dash + 3)
    }
    // Un segmento en minúscula continúa el extra anterior: "Medallon + cheddar" es un solo extra
    const parts: string[] = []
    for (const seg of rest.split(' + ').map((s) => s.trim())) {
      if (parts.length > 1 && /^[a-záéíóúñ]/.test(seg)) parts[parts.length - 1] += ` + ${seg}`
      else parts.push(seg)
    }
    const [base, ...adds] = parts
    // "NUGGETS DE POLLO * Salsa Cheddar": lo que va después de * es una opción del producto
    const [product, ...options] = base.split(' * ').map((s) => s.trim())
    items.push({ qty, category, product, extras: [...options, ...adds].filter(Boolean) })
  }
  return items
}

const pad = (n: number) => String(n).padStart(2, '0')

type DateParts = { y: number; m: number; d: number; hh: number; mm: number; text?: boolean }

function cellDate(value: ExcelJS.CellValue, text: string): DateParts | null {
  // exceljs devuelve las fechas como Date en UTC que representan la hora local del Excel
  if (value instanceof Date) {
    return {
      y: value.getUTCFullYear(),
      m: value.getUTCMonth() + 1,
      d: value.getUTCDate(),
      hh: value.getUTCHours(),
      mm: value.getUTCMinutes(),
    }
  }
  if (typeof value === 'number') {
    const ms = Math.round((value - 25569) * 86400 * 1000)
    return cellDate(new Date(ms), text)
  }
  // Texto tipo "13/10/26 21:05" -> siempre día/mes/año
  const m = text.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2}))?/)
  if (m) {
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
    return { y, m: Number(m[2]), d: Number(m[1]), hh: Number(m[4] ?? 0), mm: Number(m[5] ?? 0), text: true }
  }
  return null
}

function fmt(p: DateParts) {
  return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.hh)}:${pad(p.mm)}`
}

/** Rango de fechas del nombre de archivo, ej. "pedidos_2026-10-04T00_00 - 2026-10-04T23_59.xlsx" */
function filenameRange(filename: string): [string, string] | null {
  const dates = filename.match(/\d{4}-\d{2}-\d{2}/g)
  if (!dates || dates.length === 0) return null
  return [dates[0], dates[dates.length - 1]]
}

function cellText(cell: ExcelJS.Cell) {
  const v = cell.value
  if (v == null) return ''
  if (typeof v === 'object' && 'richText' in v) return v.richText.map((r) => r.text).join('')
  // Texto que Excel convirtió en fecha (ej. una dirección "2/28/78"): lo mostramos como m/d/aa
  if (v instanceof Date) return `${v.getUTCMonth() + 1}/${v.getUTCDate()}/${String(v.getUTCFullYear()).slice(-2)}`
  return cell.text ?? String(v)
}

export async function parseOrdersFile(
  buffer: ArrayBuffer,
  filename: string,
  forceSwap?: boolean,
): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) return { orders: [], errors: ['El archivo no tiene hojas'], swapped: false, swapReason: 'por defecto' }

  const cols: Record<string, number> = {}
  ws.getRow(1).eachCell((cell, col) => {
    const key = HEADERS[normalize(cellText(cell))]
    if (key) cols[key] = col
  })
  const missing = ['id', 'date', 'products', 'customer', 'total', 'payment'].filter((k) => !cols[k])
  if (missing.length) {
    return {
      orders: [],
      errors: [`Faltan columnas en el Excel: ${missing.join(', ')}`],
      swapped: false,
      swapReason: 'por defecto',
    }
  }

  const errors: string[] = []
  const raw: { parts: DateParts; order: Omit<ParsedOrder, 'date'> }[] = []

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const get = (k: string) => (cols[k] ? cellText(row.getCell(cols[k])).trim() : '')
    const idText = get('id')
    if (!idText) continue
    const id = Number(idText)
    if (!Number.isInteger(id)) {
      errors.push(`Fila ${r}: número de pedido inválido "${idText}"`)
      continue
    }
    const dateCell = row.getCell(cols.date)
    const parts = cellDate(dateCell.value, cellText(dateCell))
    if (!parts) {
      errors.push(`Pedido ${id}: fecha inválida`)
      continue
    }
    const totalCell = row.getCell(cols.total).value
    const total = typeof totalCell === 'number' ? totalCell : Number(get('total').replace(/[^\d,.-]/g, '').replace(',', '.'))
    if (!Number.isFinite(total)) {
      errors.push(`Pedido ${id}: total inválido`)
      continue
    }
    const status = get('status') || 'Sin estado'
    const phoneValue = cols.phone ? row.getCell(cols.phone).value : null
    const phone = normalizePhone(typeof phoneValue === 'number' ? phoneValue : get('phone'))
    const productsRaw = get('products')
    raw.push({
      parts,
      order: {
        id,
        status,
        cancelled: /cancel|rechaz|anulad/i.test(status),
        paid: !/^no$/i.test(get('paid')),
        customerName: get('customer').replace(/\s+/g, ' ') || 'Sin nombre',
        phone,
        total,
        paymentMethod: get('payment') || 'Sin especificar',
        address: get('address'),
        zone: get('zone').toUpperCase(),
        crossStreets: get('custom').replace(/^entrecalles:\s*/i, '').trim(),
        note: get('note'),
        productsRaw,
        items: parseProducts(productsRaw),
      },
    })
  }

  // El exportador guarda "4/10/26" (día/mes) como fecha mes/día. Decidimos si invertir:
  // 1) si el usuario lo eligió, 2) si el nombre del archivo trae el rango, 3) por defecto sí.
  let swapped = true
  let swapReason: ParseResult['swapReason'] = 'por defecto'
  if (forceSwap !== undefined) {
    swapped = forceSwap
    swapReason = 'manual'
  } else {
    const range = filenameRange(filename)
    const dateCells = raw.filter((r) => !r.parts.text)
    if (range && dateCells.length) {
      const inRange = (p: DateParts) => {
        const d = fmt(p).slice(0, 10)
        return d >= range[0] && d <= range[1]
      }
      const asIs = dateCells.filter((r) => inRange(r.parts)).length
      const inverted = dateCells.filter((r) => r.parts.d <= 12 && inRange({ ...r.parts, m: r.parts.d, d: r.parts.m })).length
      if (asIs !== inverted) {
        swapped = inverted > asIs
        swapReason = 'archivo'
      }
    }
  }

  const orders = raw.map(({ parts, order }) => {
    // Las fechas en texto ya se leyeron como día/mes; solo se invierten las que Excel interpretó.
    const p = swapped && !parts.text && parts.d <= 12 ? { ...parts, m: parts.d, d: parts.m } : parts
    return { ...order, date: fmt(p) }
  })

  return { orders, errors, swapped, swapReason }
}
