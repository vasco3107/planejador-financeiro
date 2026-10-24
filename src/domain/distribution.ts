import type { Bps, Cents, DistributionBucket, DistributionConfig } from './types'

export const TOTAL_BPS = 10000

export interface Allocation extends DistributionBucket {
  cents: Cents
}

/**
 * Distribui um valor entre buckets pelo método do maior resto:
 * a soma das partes é sempre exatamente igual ao total, centavo a centavo.
 */
export function allocate(totalCents: Cents, buckets: DistributionBucket[]): Allocation[] {
  const sumBps = buckets.reduce((s, b) => s + b.bps, 0)
  if (totalCents <= 0 || sumBps === 0) return buckets.map((b) => ({ ...b, cents: 0 }))

  const raw = buckets.map((b, i) => {
    const exact = (totalCents * b.bps) / sumBps
    const floor = Math.floor(exact)
    return { i, floor, rest: exact - floor }
  })
  let remaining = totalCents - raw.reduce((s, r) => s + r.floor, 0)
  const extra = new Array<number>(buckets.length).fill(0)
  for (const r of [...raw].sort((a, b) => b.rest - a.rest || a.i - b.i)) {
    if (remaining <= 0) break
    extra[r.i] = 1
    remaining--
  }
  return buckets.map((b, i) => ({ ...b, cents: raw[i].floor + extra[i] }))
}

export interface DistributionValidation {
  valid: boolean
  totalBps: Bps
  diffBps: Bps
  message: string | null
}

const pctText = (bps: Bps) =>
  `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(bps / 100)}%`

export function validateDistribution(buckets: DistributionBucket[]): DistributionValidation {
  const totalBps = buckets.reduce((s, b) => s + b.bps, 0)
  const diffBps = TOTAL_BPS - totalBps
  const fail = (message: string) => ({ valid: false, totalBps, diffBps, message })

  if (buckets.length === 0) return fail('Adicione ao menos uma categoria de destino.')
  if (buckets.some((b) => b.bps < 0 || !Number.isInteger(b.bps))) return fail('Percentuais inválidos.')
  if (buckets.some((b) => !b.name.trim())) return fail('Todas as categorias precisam de um nome.')
  const names = buckets.map((b) => b.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) return fail('Existem categorias com nomes repetidos.')
  if (diffBps > 0) {
    return fail(
      `Suas categorias somam ${pctText(totalBps)}. Defina mais ${pctText(diffBps)} para completar a distribuição.`,
    )
  }
  if (diffBps < 0) {
    return fail(
      `Suas categorias somam ${pctText(totalBps)}. Remova ${pctText(-diffBps)} para voltar a 100%.`,
    )
  }
  return { valid: true, totalBps, diffBps: 0, message: null }
}

/** Versão da distribuição vigente para um mês (yyyy-mm). */
export function configForMonth(configs: DistributionConfig[], month: string): DistributionConfig | null {
  if (configs.length === 0) return null
  const sorted = [...configs].sort(
    (a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.createdAt - b.createdAt,
  )
  let current: DistributionConfig | null = null
  for (const c of sorted) {
    if (c.effectiveFrom <= month) current = c
  }
  // Antes da primeira versão, vale a regra inicial do usuário
  return current ?? sorted[0]
}

export const DEFAULT_BUCKETS: DistributionBucket[] = [
  { key: 'investimentos', name: 'Investimentos', color: '#7c3aed', bps: 4000, role: 'investimentos' },
  { key: 'projetos', name: 'Projetos futuros', color: '#d97706', bps: 6000, role: 'projetos' },
]

/** Divisão do lucro da empresa quando ainda não há sócios: tudo é seu. */
export const COMPANY_DEFAULT_BUCKETS: DistributionBucket[] = [
  { key: 'minha-parte', name: 'Você', color: '#db2777', bps: TOTAL_BPS, role: 'retirada' },
]

/** Parte do lucro que continua na empresa (capital de giro). */
export const CAIXA_BUCKET: DistributionBucket = { key: 'caixa', name: 'Fica na empresa', color: '#0f766e', bps: 0, role: 'caixa' }

/** Reescala percentuais para somar exatamente 100% (maior resto). */
export function normalizeBps(buckets: DistributionBucket[]): DistributionBucket[] {
  const alloc = allocate(TOTAL_BPS, buckets)
  return buckets.map((b, i) => ({ ...b, bps: alloc[i].cents }))
}

/** "12,5" → 1250 bps; null se inválido. */
export function parsePercentToBps(input: string): Bps | null {
  const s = input.replace('%', '').trim().replace(',', '.')
  if (!s) return 0
  if (!/^\d*\.?\d{0,2}$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return Math.round(n * 100)
}

export const bpsToInput = (bps: Bps) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, useGrouping: false }).format(bps / 100)
