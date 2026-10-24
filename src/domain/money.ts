import type { Bps, Cents } from './types'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const brlInt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Evita exibir "-R$ 0,00". */
const clean = (n: number) => (Object.is(n, -0) ? 0 : n)

export function formatBRL(cents: Cents): string {
  return brl.format(clean(cents) / 100)
}

/** Formato curto para eixos de gráfico: "R$ 12,5 mil". */
export function formatBRLCompact(cents: Cents): string {
  if (Math.abs(cents) < 1_000_00) return brlInt.format(clean(Math.round(cents / 100)))
  return brlCompact.format(cents / 100)
}

/** 123456 → "1.234,56" (sem símbolo) */
export function formatDecimal(cents: Cents): string {
  return num.format(clean(cents) / 100)
}

/**
 * Converte texto no padrão brasileiro para centavos.
 * Aceita "1.234,56", "1234,5", "R$ 10.000", "10000". Retorna null se inválido.
 */
export function parseBRL(input: string): Cents | null {
  const s = input.replace(/R\$|\s/g, '').trim()
  if (!s) return null
  if (!/^-?[\d.]*(,\d{0,2})?$/.test(s)) return null
  const negative = s.startsWith('-')
  const [intPart, decPart = ''] = s.replace('-', '').split(',')
  const digits = intPart.replace(/\./g, '')
  if (!digits && !decPart) return null
  const cents = Number(digits || '0') * 100 + Number(decPart.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) return null
  return negative ? -cents : cents
}

/** Máscara de digitação estilo app bancário: cada dígito entra pelos centavos. */
export function maskBRLInput(raw: string): { text: string; cents: Cents } {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13)
  const cents = Number(digits || '0')
  return { text: digits ? formatDecimal(cents) : '', cents }
}

/** Pontos-base → "40%" / "12,5%" */
export function formatBps(bps: Bps): string {
  return `${pct.format(bps / 100)}%`
}

/** Percentual decimal (ex. 43.75) → "43,75%" */
export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits }).format(clean(value))}%`
}

/** Razão a/b em %, null quando b = 0. */
export function ratioPercent(a: number, b: number): number | null {
  if (b === 0) return null
  return (a / b) * 100
}

export function sumCents(values: Cents[]): Cents {
  let total = 0
  for (const v of values) total += v
  return total
}
