import {
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DateRange } from './types'

export type PeriodPreset = 'hoje' | 'semana' | 'mes' | 'ano' | 'tudo' | 'custom'

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  hoje: 'Hoje',
  semana: 'Esta semana',
  mes: 'Este mês',
  ano: 'Este ano',
  tudo: 'Tudo',
  custom: 'Personalizado',
}

export const ALL_TIME: DateRange = { start: '1900-01-01', end: '2999-12-31' }

export const toISO = (d: Date) => format(d, 'yyyy-MM-dd')
export const todayISO = () => toISO(new Date())
export const monthKey = (iso: string) => iso.slice(0, 7)
export const currentMonthKey = () => monthKey(todayISO())

export function rangeForPreset(preset: PeriodPreset, custom?: DateRange, now = new Date()): DateRange {
  switch (preset) {
    case 'hoje':
      return { start: toISO(now), end: toISO(now) }
    case 'semana':
      return {
        start: toISO(startOfWeek(now, { weekStartsOn: 1 })),
        end: toISO(endOfWeek(now, { weekStartsOn: 1 })),
      }
    case 'mes':
      return { start: toISO(startOfMonth(now)), end: toISO(endOfMonth(now)) }
    case 'ano':
      return { start: toISO(startOfYear(now)), end: toISO(endOfYear(now)) }
    case 'tudo':
      return ALL_TIME
    case 'custom':
      return custom ?? { start: toISO(startOfMonth(now)), end: toISO(endOfMonth(now)) }
  }
}

/** Período imediatamente anterior, de mesma natureza, para comparação. */
export function previousRange(preset: PeriodPreset, range: DateRange): DateRange | null {
  const start = parseISO(range.start)
  switch (preset) {
    case 'hoje':
      return { start: toISO(subDays(start, 1)), end: toISO(subDays(start, 1)) }
    case 'semana':
      return { start: toISO(subDays(start, 7)), end: toISO(subDays(start, 1)) }
    case 'mes': {
      const p = subMonths(start, 1)
      return { start: toISO(startOfMonth(p)), end: toISO(endOfMonth(p)) }
    }
    case 'ano': {
      const p = subYears(start, 1)
      return { start: toISO(startOfYear(p)), end: toISO(endOfYear(p)) }
    }
    case 'tudo':
      return null
    case 'custom': {
      const days = differenceInCalendarDays(parseISO(range.end), start) + 1
      return { start: toISO(subDays(start, days)), end: toISO(subDays(start, 1)) }
    }
  }
}

export const PREVIOUS_LABELS: Record<PeriodPreset, string> = {
  hoje: 'vs. ontem',
  semana: 'vs. semana anterior',
  mes: 'vs. mês anterior',
  ano: 'vs. ano anterior',
  tudo: '',
  custom: 'vs. período anterior',
}

export const inRange = (iso: string, r: DateRange) => iso >= r.start && iso <= r.end

/** Chaves yyyy-mm entre duas datas (inclusivo). */
export function monthsBetween(startISO: string, endISO: string): string[] {
  const out: string[] = []
  let [y, m] = startISO.slice(0, 7).split('-').map(Number)
  const [ey, em] = endISO.slice(0, 7).split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

export function previousMonthKey(key: string): string {
  return format(subMonths(parseISO(`${key}-01`), 1), 'yyyy-MM')
}

export function lastNMonths(n: number, now = new Date()): string[] {
  return monthsBetween(toISO(subMonths(now, n - 1)), toISO(now))
}

export const monthRange = (key: string): DateRange => ({
  start: `${key}-01`,
  end: toISO(endOfMonth(parseISO(`${key}-01`))),
})

export const formatDateBR = (iso: string) => format(parseISO(iso), 'dd/MM/yyyy')
export const formatDateShort = (iso: string) => format(parseISO(iso), 'dd MMM', { locale: ptBR })

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const monthName = (key: string) => cap(format(parseISO(`${key}-01`), 'MMMM', { locale: ptBR }))
export const monthLabel = (key: string) =>
  cap(format(parseISO(`${key}-01`), "MMMM 'de' yyyy", { locale: ptBR }))
export const monthShort = (key: string) =>
  cap(format(parseISO(`${key}-01`), 'MMM/yy', { locale: ptBR })).replace('.', '')

export function formatRangeBR(r: DateRange): string {
  if (r.start === ALL_TIME.start) return 'Todo o período'
  if (r.start === r.end) return formatDateBR(r.start)
  return `${formatDateBR(r.start)} – ${formatDateBR(r.end)}`
}

/** "dd/mm/aaaa" → ISO, ou null. */
export function parseDateBR(input: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim())
  if (!m) return null
  const iso = `${m[3]}-${m[2]}-${m[1]}`
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime()) || toISO(d) !== iso) return null
  return iso
}
