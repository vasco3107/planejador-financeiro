import { formatDecimal } from '@/domain/money'
import { formatDateBR } from '@/domain/period'
import type { Category, Transaction } from '@/domain/types'
import { TYPE_META } from '@/lib/colors'
import { pendingOf, receiptState, receivedOf } from '@/domain/finance'
import { EXPENSE_KIND_LABELS, RECEIPT_LABELS, statusLabel } from '@/lib/labels'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const escape = (v: string | number) => {
  const s = String(v ?? '')
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * CSV no padrão brasileiro: separador ";", vírgula decimal e BOM UTF-8,
 * para abrir corretamente no Excel em português.
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const body = [headers, ...rows].map((r) => r.map(escape).join(';')).join('\r\n')
  downloadBlob(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }), filename)
}

export const stamp = () => new Date().toISOString().slice(0, 10)

export function exportTransactionsCSV(
  txs: Transaction[],
  _categories: Category[],
  label: (t: Transaction) => { category: string },
) {
  downloadCSV(
    `movimentacoes-${stamp()}.csv`,
    ['Data', 'Tipo', 'Descrição', 'Categoria / destino', 'Origem / instituição', 'Tipo de despesa', 'Valor (R$)', 'Recebido (R$)', 'A receber (R$)', 'Status', 'Observação'],
    txs.map((t) => [
      formatDateBR(t.date),
      TYPE_META[t.type].label,
      t.description,
      label(t).category,
      t.type === 'receita' || t.type === 'investimento' ? (t.source ?? '') : '',
      t.expenseKind ? EXPENSE_KIND_LABELS[t.expenseKind] : '',
      (t.type === 'despesa' || t.type === 'gasto' ? '-' : '') + formatDecimal(t.amountCents),
      t.type === 'receita' ? formatDecimal(receivedOf(t)) : '',
      t.type === 'receita' ? formatDecimal(pendingOf(t)) : '',
      t.type === 'receita' ? RECEIPT_LABELS[receiptState(t)] : statusLabel(t.type, t.status),
      t.note ?? '',
    ]),
  )
}
