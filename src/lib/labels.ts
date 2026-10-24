import type { ExpenseKind, TransactionStatus, TransactionType } from '@/domain/types'
import type { ReceiptState } from '@/domain/finance'

export const RECEIPT_LABELS: Record<ReceiptState, string> = {
  recebido: 'Recebido',
  parcial: 'Recebido em parte',
  aguardando: 'A receber',
}

export function statusLabel(type: TransactionType, status: TransactionStatus): string {
  if (status === 'confirmado') {
    if (type === 'receita' || type === 'pessoal') return 'Recebido'
    if (type === 'despesa' || type === 'gasto') return 'Pago'
    if (type === 'retirada') return 'Transferido'
    if (type === 'caixa') return 'Guardado'
    return 'Realizado'
  }
  if (type === 'receita' || type === 'pessoal') return 'A receber'
  if (type === 'despesa' || type === 'gasto') return 'A pagar'
  if (type === 'retirada' || type === 'caixa') return 'Planejado'
  return 'Planejado'
}

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  fixa: 'Fixa',
  variavel: 'Variável',
  recorrente: 'Recorrente',
  pontual: 'Pontual',
}
