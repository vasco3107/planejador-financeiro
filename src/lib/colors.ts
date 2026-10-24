import { useSyncExternalStore } from 'react'
import type { DistributionBucket, TransactionType } from '@/domain/types'

/**
 * Cores semânticas fixas — as mesmas em cards, badges e gráficos.
 * Cada tema tem seus próprios tons, validados para daltonismo (deutan/protan/tritan)
 * contra a superfície correspondente.
 */
export const SEMANTIC_LIGHT = {
  receita: '#10b981',
  despesa: '#be123c',
  lucro: '#3b82f6',
  investimento: '#6d28d9',
  reserva: '#f59e0b',
  saldo: '#0f766e',
  retirada: '#db2777',
  pessoal: '#0891b2',
  neutral: '#94a3b8',
}

export const SEMANTIC_DARK: typeof SEMANTIC_LIGHT = {
  receita: '#059669',
  despesa: '#f43f5e',
  lucro: '#4f93f7',
  investimento: '#7c3aed',
  reserva: '#d97706',
  saldo: '#2dd4bf',
  retirada: '#db2777',
  pessoal: '#0891b2',
  neutral: '#64748b',
}

export type SemanticColors = typeof SEMANTIC_LIGHT
/** Usado fora de React (ex. PDF) */
export const SEMANTIC = SEMANTIC_LIGHT

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => obs.disconnect()
}
const isDark = () => document.documentElement.classList.contains('dark')

export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => false)
}

export function useColors(): SemanticColors {
  return useIsDark() ? SEMANTIC_DARK : SEMANTIC_LIGHT
}

export const TYPE_META: Record<TransactionType, { label: string; plural: string; newTitle: string }> = {
  receita: { label: 'Receita', plural: 'Receitas', newTitle: 'Nova receita' },
  despesa: { label: 'Despesa', plural: 'Despesas', newTitle: 'Nova despesa' },
  investimento: { label: 'Aporte', plural: 'Aportes', newTitle: 'Novo aporte' },
  reserva: { label: 'Guardado', plural: 'Guardados', newTitle: 'Guardar dinheiro' },
  retirada: { label: 'Retirada', plural: 'Retiradas de lucro', newTitle: 'Retirada de lucro' },
  pessoal: { label: 'Ganho pessoal', plural: 'Ganhos pessoais', newTitle: 'Novo ganho pessoal' },
  gasto: { label: 'Gasto', plural: 'Gastos', newTitle: 'Novo gasto' },
  caixa: { label: 'Reserva da empresa', plural: 'Reservas da empresa', newTitle: 'Guardar no caixa da empresa' },
}

/** Cor semântica de cada tipo de lançamento. */
export function typeColor(type: TransactionType, c: SemanticColors): string {
  return { receita: c.receita, despesa: c.despesa, investimento: c.investimento, reserva: c.reserva, retirada: c.retirada, pessoal: c.pessoal, gasto: c.despesa, caixa: c.saldo }[type]
}

/** Buckets com papel especial usam a cor semântica; os demais, a cor escolhida. */
export function bucketColor(b: Pick<DistributionBucket, 'role' | 'color' | 'partnerId'>, c: SemanticColors): string {
  if (b.role === 'investimentos') return c.investimento
  if (b.role === 'projetos') return c.reserva
  if (b.role === 'caixa') return c.saldo
  // Parte de sócio usa a cor do sócio; a sua parte usa a cor de retirada
  if (b.role === 'retirada') return b.partnerId ? b.color : c.retirada
  return b.color
}
