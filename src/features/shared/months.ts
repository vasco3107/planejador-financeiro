import { ALL_TIME, currentMonthKey, lastNMonths, monthKey, monthsBetween } from '@/domain/period'
import type { DateRange, Transaction } from '@/domain/types'
import { parseISO } from 'date-fns'

/**
 * Meses exibidos nos gráficos de série temporal para o período escolhido.
 * Períodos curtos (hoje/semana/mês) mostram os 6 meses até ele, para dar contexto.
 */
export function chartMonths(range: DateRange, all: Transaction[], minMonths = 6): string[] {
  if (range.start === ALL_TIME.start) {
    if (all.length === 0) return lastNMonths(minMonths)
    const first = all.reduce((m, t) => (t.date < m ? t.date : m), all[0].date)
    const months = monthsBetween(first, `${currentMonthKey()}-01`)
    return months.length >= 2 ? months : lastNMonths(minMonths)
  }
  const months = monthsBetween(range.start, range.end)
  if (months.length >= 2) return months
  return lastNMonths(minMonths, parseISO(`${monthKey(range.end)}-01`))
}

/** Mês de referência para insights: o último mês do período, sem passar do atual. */
export function referenceMonth(range: DateRange): string {
  const end = monthKey(range.end)
  const cur = currentMonthKey()
  return end > cur ? cur : end
}
