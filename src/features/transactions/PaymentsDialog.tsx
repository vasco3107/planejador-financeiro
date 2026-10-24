import { useState } from 'react'
import { create } from 'zustand'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Dialog, confirmDialog } from '@/components/ui/Dialog'
import { Field, Input, MoneyInput } from '@/components/ui/Form'
import { Progress } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { useTransactions } from '@/data/hooks'
import { paymentsRepo } from '@/data/repositories'
import { pendingOf, receivedOf } from '@/domain/finance'
import { formatBRL, formatPercent } from '@/domain/money'
import { formatDateBR, todayISO } from '@/domain/period'
import { useColors } from '@/lib/colors'
import { outsidePeriod, revealDate } from '@/store/ui'

const useReceipts = create<{ txId: string | null }>(() => ({ txId: null }))

/** Abre a janela de recebimentos de uma receita. */
export const openReceipts = (txId: string) => useReceipts.setState({ txId })
const close = () => useReceipts.setState({ txId: null })

/**
 * Recebimentos de uma receita: quanto do valor total já caiu na conta.
 * Cada valor recebido entra com a sua data — dá para ir somando aos poucos.
 */
export function ReceiptsHost() {
  const { txId } = useReceipts()
  const txs = useTransactions()
  const c = useColors()
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')

  const tx = txs?.find((t) => t.id === txId)
  const received = tx ? receivedOf(tx) : 0
  const missing = tx ? pendingOf(tx) : 0
  const payments = tx?.payments ?? []

  const add = async () => {
    if (!tx || amount <= 0 || !date) return
    await paymentsRepo.add(tx.id, { date, amountCents: amount, note: note.trim() || undefined })
    const outside = outsidePeriod(date)
    if (outside) toast(`Recebimento de ${formatDateBR(date)} lançado, fora do período exibido (${outside}).`, 'info', { label: 'Mostrar', onClick: () => revealDate(date) })
    else toast('Recebimento registrado')
    setAmount(0)
    setNote('')
    setDate(todayISO())
  }

  const remove = async (id: string, value: number) => {
    if (!tx) return
    const ok = await confirmDialog({
      title: 'Excluir recebimento?',
      danger: true,
      confirmLabel: 'Excluir',
      message: `${formatBRL(value)} deixará de contar como recebido nesta receita.`,
    })
    if (!ok) return
    await paymentsRepo.remove(tx.id, id)
    toast('Recebimento excluído')
  }

  return (
    <Dialog
      open={!!tx}
      onClose={close}
      title="Recebimentos"
      description={tx ? `${tx.description} · valor total ${formatBRL(tx.amountCents)}` : undefined}
      footer={<Button variant="outline" onClick={close}>Fechar</Button>}
    >
      {tx && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-surface-2 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs text-ink-3">Já caiu na conta</p>
                <p className="text-2xl font-semibold num">{formatBRL(received)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-ink-3">{missing > 0 ? 'Falta receber' : 'Recebido por inteiro'}</p>
                <p className="text-lg font-semibold text-ink-2 num">{formatBRL(Math.max(missing, 0))}</p>
              </div>
            </div>
            <Progress className="mt-3" value={(received / tx.amountCents) * 100} color={c.receita} height={8} />
            <p className="mt-2 text-xs text-ink-3 num">{formatPercent((received / tx.amountCents) * 100, 1)} do valor total</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
            <Field label="Valor recebido">
              <MoneyInput value={amount} onChange={setAmount} autoFocus />
            </Field>
            <Field label="Data">
              <DateInput value={date} onChange={setDate} />
            </Field>
            <Button className="h-11" icon={<Plus className="size-4" />} onClick={add} disabled={amount <= 0 || !date}>
              Adicionar
            </Button>
            <Field label="Observação (opcional)" className="sm:col-span-3">
              <Input value={note} maxLength={80} placeholder="Ex.: líquido após taxa da plataforma" onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>

          {payments.length > 0 && (
            <ul className="divide-y divide-line border-t border-line pt-1">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-sm text-ink-2 num">{formatDateBR(p.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{p.note}</span>
                  <span className="font-semibold num">{formatBRL(p.amountCents)}</span>
                  <Button size="icon-sm" variant="ghost" className="hover:text-despesa" aria-label="Excluir recebimento" onClick={() => remove(p.id, p.amountCents)} icon={<Trash2 className="size-3.5" />} />
                </li>
              ))}
            </ul>
          )}
          {payments.length === 0 && (
            <p className="text-sm text-ink-3">
              Nenhum recebimento lançado ainda. Some aqui cada valor que cair na conta — o total da receita passa a contar só o que entrou.
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}
