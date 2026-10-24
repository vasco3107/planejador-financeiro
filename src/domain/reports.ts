import {
  computeDestination,
  computePersonalTotals,
  computeTotals,
  groupByMonth,
  growth,
  profitBase,
  type PersonalTotals,
  type Totals,
} from './finance'
import type { Allocation } from './distribution'
import { monthsBetween, previousMonthKey } from './period'
import type { Category, CategoryKind, Cents, DistributionConfig, Transaction } from './types'

function resolveMonths(grouped: Map<string, Transaction[]>, months?: string[]): string[] {
  if (months) return months
  const all = [...grouped.keys()].sort()
  return all.length ? monthsBetween(`${all[0]}-01`, `${all[all.length - 1]}-01`) : []
}

export interface MonthSummary extends Totals {
  month: string
  /** Divisão do lucro do mês (você, sócios, fica na empresa) */
  allocations: Allocation[]
  receitaGrowth: number | null
  despesaGrowth: number | null
  lucroGrowth: number | null
  lucroDelta: Cents | null
}

/** Resumo mensal da empresa. Sem `months`, cobre do primeiro ao último lançamento. */
export function monthlySummaries(txs: Transaction[], companyConfigs: DistributionConfig[], months?: string[]): MonthSummary[] {
  const grouped = groupByMonth(txs)
  const keys = resolveMonths(grouped, months)
  const out: MonthSummary[] = []
  // O primeiro mês compara com o anterior, mesmo que esteja fora do período
  const before = keys.length ? grouped.get(previousMonthKey(keys[0])) : undefined
  let prev: Totals | null = before ? computeTotals(before) : null
  for (const month of keys) {
    const list = grouped.get(month) ?? []
    const totals = computeTotals(list)
    out.push({
      ...totals,
      month,
      allocations: computeDestination(list, companyConfigs, profitBase).allocations,
      receitaGrowth: prev ? growth(totals.receita, prev.receita) : null,
      despesaGrowth: prev ? growth(totals.despesa, prev.despesa) : null,
      lucroGrowth: prev ? growth(totals.lucro, prev.lucro) : null,
      lucroDelta: prev ? totals.lucro - prev.lucro : null,
    })
    prev = totals
  }
  return out
}

export interface PersonalMonthSummary extends PersonalTotals {
  month: string
}

/** Resumo mensal da sua carteira. */
export function personalMonthlySummaries(txs: Transaction[], months?: string[]): PersonalMonthSummary[] {
  const grouped = groupByMonth(txs)
  return resolveMonths(grouped, months).map((month) => ({ ...computePersonalTotals(grouped.get(month) ?? []), month }))
}

export interface YearSummary extends Totals {
  year: string
  months: number
}

export function yearlySummaries(txs: Transaction[]): YearSummary[] {
  const byYear = new Map<string, Transaction[]>()
  for (const t of txs) {
    const y = t.date.slice(0, 4)
    const list = byYear.get(y)
    if (list) list.push(t)
    else byYear.set(y, [t])
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, list]) => ({
      ...computeTotals(list),
      year,
      months: new Set(list.map((t) => t.date.slice(0, 7))).size,
    }))
}

export interface CategoryTotal {
  categoryId: string
  name: string
  color: string
  cents: number
  share: number
  count: number
}

export function totalsByCategory(txs: Transaction[], categories: Category[], kind: CategoryKind): CategoryTotal[] {
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const acc = new Map<string, { cents: number; count: number }>()
  let total = 0
  for (const t of txs) {
    if (t.type !== kind) continue
    // Receita conta o faturamento lançado; despesa e gasto, o valor confirmado
    const value = kind === 'receita' ? t.amountCents : t.status === 'confirmado' ? t.amountCents : 0
    if (value <= 0) continue
    const id = t.categoryId && catMap.has(t.categoryId) ? t.categoryId : '__none__'
    const cur = acc.get(id) ?? { cents: 0, count: 0 }
    cur.cents += value
    cur.count++
    acc.set(id, cur)
    total += value
  }
  return [...acc.entries()]
    .map(([id, v]) => {
      const c = catMap.get(id)
      return {
        categoryId: id,
        name: c?.name ?? 'Sem categoria',
        color: c?.color ?? '#94a3b8',
        cents: v.cents,
        count: v.count,
        share: total ? (v.cents / total) * 100 : 0,
      }
    })
    .sort((a, b) => b.cents - a.cents)
}

export interface CumulativePoint {
  month: string
  value: Cents
  cumulative: Cents
}

/** Série acumulada mês a mês de um valor. */
export function cumulativeSeries<T extends { month: string }>(
  summaries: T[],
  pick: (s: T) => Cents,
  startingBalance: Cents = 0,
): CumulativePoint[] {
  let acc = startingBalance
  return summaries.map((s) => {
    const value = pick(s)
    acc += value
    return { month: s.month, value, cumulative: acc }
  })
}
