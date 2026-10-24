import { receivedOf } from './finance'
import type { Cents, Transaction } from './types'

/**
 * Distribui um total recebido entre as receitas, das mais antigas para as mais novas:
 * cada uma recebe até o seu valor, e o que sobrar vai para a seguinte.
 * Devolve quanto cada receita passa a ter de recebido.
 */
export function distributeReceived(receitas: Transaction[], totalCents: Cents): Map<string, Cents> {
  const order = [...receitas].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
  let left = Math.max(totalCents, 0)
  const out = new Map<string, Cents>()
  for (const t of order) {
    const value = Math.min(left, t.amountCents)
    out.set(t.id, value)
    left -= value
  }
  return out
}

/**
 * Distribui um valor recém-recebido entre as receitas que ainda têm saldo a receber,
 * das mais antigas para as mais novas. Não mexe no que já foi recebido antes.
 */
export function distributeAdditional(receitas: Transaction[], deltaCents: Cents): Map<string, Cents> {
  const order = [...receitas].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
  let left = Math.max(deltaCents, 0)
  const out = new Map<string, Cents>()
  for (const t of order) {
    const room = t.amountCents - receivedOf(t)
    if (room <= 0 || left <= 0) continue
    const value = Math.min(left, room)
    out.set(t.id, value)
    left -= value
  }
  return out
}

/** Soma dos valores lançados (faturamento do período, recebido ou não). */
export const billed = (receitas: Transaction[]) => receitas.reduce((s, t) => s + t.amountCents, 0)

/** Soma do que já caiu na conta. */
export const receivedTotal = (receitas: Transaction[]) => receitas.reduce((s, t) => s + receivedOf(t), 0)
