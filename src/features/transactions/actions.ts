import { createElement } from 'react'
import { confirmDialog } from '@/components/ui/Dialog'
import { toast } from '@/components/ui/Toast'
import { transactionsRepo } from '@/data/repositories'
import { formatBRL } from '@/domain/money'
import { formatDateBR } from '@/domain/period'
import type { Transaction } from '@/domain/types'
import { TYPE_META } from '@/lib/colors'

export async function deleteTransaction(tx: Transaction): Promise<boolean> {
  const ok = await confirmDialog({
    title: 'Excluir lançamento?',
    danger: true,
    confirmLabel: 'Excluir',
    message: createElement(
      'span',
      null,
      `${TYPE_META[tx.type].label} "${tx.description}" de ${formatBRL(tx.amountCents)} em ${formatDateBR(tx.date)}. `,
      'Os totais e gráficos serão recalculados. Esta ação não pode ser desfeita.',
    ),
  })
  if (!ok) return false
  await transactionsRepo.remove(tx.id)
  toast('Lançamento excluído')
  return true
}

export async function deleteTransactions(ids: string[]): Promise<boolean> {
  const ok = await confirmDialog({
    title: `Excluir ${ids.length} lançamentos?`,
    danger: true,
    confirmLabel: 'Excluir todos',
    message: 'Os lançamentos selecionados serão removidos permanentemente.',
  })
  if (!ok) return false
  await transactionsRepo.removeMany(ids)
  toast(`${ids.length} lançamentos excluídos`)
  return true
}
