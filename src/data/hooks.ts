import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import {
  computeDestination,
  computePersonalTotals,
  computeTotals,
  filterByRange,
  profitBase,
} from '@/domain/finance'
import { previousRange, type PeriodPreset } from '@/domain/period'
import { useUI } from '@/store/ui'
import {
  COMPANY_TYPES,
  isPersonal,
  type Category,
  type DateRange,
  type DistributionConfig,
  type DistributionScope,
  type ExpectedReceipt,
  type Goal,
  type Partner,
  type Project,
  type Settings,
  type Transaction,
} from '@/domain/types'
import {
  categoriesRepo,
  distributionsRepo,
  expectedRepo,
  goalsRepo,
  partnersRepo,
  projectsRepo,
  settingsRepo,
  transactionsRepo,
} from './repositories'

const EMPTY: never[] = []

// Consultas reativas: qualquer alteração no banco re-renderiza quem usa o hook.
export const useTransactions = (): Transaction[] | undefined => useLiveQuery(transactionsRepo.list)
export const useCategories = (): Category[] | undefined => useLiveQuery(categoriesRepo.list)
export const useDistributions = (scope: DistributionScope): DistributionConfig[] | undefined =>
  useLiveQuery(() => distributionsRepo.list(scope), [scope])
export const useProjects = (): Project[] | undefined => useLiveQuery(projectsRepo.list)
export const useGoals = (): Goal[] | undefined => useLiveQuery(goalsRepo.list)
export const usePartners = (): Partner[] | undefined => useLiveQuery(partnersRepo.list)
export const useExpected = (): ExpectedReceipt[] | undefined => useLiveQuery(expectedRepo.list)
export const useSettings = (): Settings | undefined => useLiveQuery(settingsRepo.get)

/** Lançamentos da sua carteira: suas retiradas, outras rendas, aportes e reservas. */
export function usePersonalTransactions(): Transaction[] | undefined {
  const txs = useTransactions()
  return useMemo(() => txs?.filter(isPersonal), [txs])
}

export function useCategoryMap() {
  const cats = useCategories()
  return useMemo(() => new Map((cats ?? EMPTY).map((c) => [c.id, c])), [cats])
}

/** Números da EMPRESA (da conta aberta: CPF ou CNPJ) para um período. */
export function useFinance(range: DateRange, preset: PeriodPreset) {
  const txs = useTransactions()
  const configs = useDistributions('empresa')
  const entity = useUI((s) => s.entity)

  return useMemo(() => {
    const all = (txs ?? EMPTY).filter((t) => COMPANY_TYPES.includes(t.type) && (t.entity ?? 'cpf') === entity)
    const inPeriod = filterByRange(all, range)
    const prev = previousRange(preset, range)
    return {
      loading: !txs || !configs,
      all,
      inPeriod,
      totals: computeTotals(inPeriod),
      prevTotals: prev ? computeTotals(filterByRange(all, prev)) : null,
      /** Divisão do lucro do período (você, sócios, fica na empresa) */
      destination: computeDestination(inPeriod, configs ?? EMPTY, profitBase),
      configs: configs ?? EMPTY,
      entity,
    }
  }, [txs, configs, range, preset, entity])
}

/** Números da SUA CARTEIRA para um período: o que entrou e quanto foi gasto, investido e guardado. */
export function usePersonalFinance(range: DateRange, preset: PeriodPreset) {
  const personal = usePersonalTransactions()

  return useMemo(() => {
    const all = personal ?? EMPTY
    const inPeriod = filterByRange(all, range)
    const prev = previousRange(preset, range)
    return {
      loading: !personal,
      all,
      inPeriod,
      totals: computePersonalTotals(inPeriod),
      prevTotals: prev ? computePersonalTotals(filterByRange(all, prev)) : null,
    }
  }, [personal, range, preset])
}
