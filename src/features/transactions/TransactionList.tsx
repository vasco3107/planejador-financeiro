import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, HandCoins, Landmark, MoreHorizontal, PiggyBank, Pencil, ShoppingBag, Trash2, Vault, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCategoryMap, useGoals, usePartners, useProjects } from '@/data/hooks'
import { formatBRL } from '@/domain/money'
import { formatDateBR } from '@/domain/period'
import type { Transaction, TransactionType } from '@/domain/types'
import { typeColor, useColors } from '@/lib/colors'
import { cn } from '@/lib/cn'
import { statusLabel } from '@/lib/labels'
import { pendingOf, receiptState, receivedOf } from '@/domain/finance'
import { RECEIPT_LABELS } from '@/lib/labels'
import { openReceipts } from './PaymentsDialog'
import { deleteTransaction } from './actions'
import { editTransaction } from './TransactionForm'

export const TYPE_ICON: Record<TransactionType, typeof Landmark> = {
  receita: ArrowDownLeft,
  despesa: ArrowUpRight,
  investimento: Landmark,
  reserva: PiggyBank,
  retirada: ArrowRightLeft,
  pessoal: HandCoins,
  gasto: ShoppingBag,
  caixa: Vault,
}

export function useTxLabels() {
  const cats = useCategoryMap()
  const projects = useProjects()
  const goals = useGoals()
  const partners = usePartners()
  return (t: Transaction): { category: string; color?: string } => {
    if (t.type === 'reserva') {
      const p = projects?.find((x) => x.id === t.projectId)
      const g = goals?.find((x) => x.id === t.goalId)
      return { category: p ? `Projeto · ${p.name}` : g ? `Meta · ${g.name}` : 'Guardado' }
    }
    if (t.type === 'investimento') return { category: t.source || 'Investimento' }
    if (t.type === 'caixa') return { category: 'Reserva da empresa' }
    if (t.type === 'retirada') {
      const p = t.partnerId ? partners?.find((x) => x.id === t.partnerId) : undefined
      return { category: t.partnerId ? `Retirada · ${p?.name ?? 'Sócio'}` : 'Retirada · Você', color: p?.color }
    }
    const c = t.categoryId ? cats.get(t.categoryId) : undefined
    return { category: c?.name ?? 'Sem categoria', color: c?.color }
  }
}

export function AmountText({ tx, className }: { tx: Transaction; className?: string }) {
  const sign = tx.type === 'receita' || tx.type === 'pessoal' ? '+' : tx.type === 'despesa' || tx.type === 'gasto' ? '−' : ''
  return (
    <span
      className={cn(
        'font-semibold whitespace-nowrap num',
        (tx.type === 'receita' || tx.type === 'pessoal') && 'text-emerald-600 dark:text-emerald-400',
        tx.status === 'pendente' && 'opacity-60',
        className,
      )}
    >
      {sign} {formatBRL(tx.amountCents)}
    </span>
  )
}

export function RowMenu({ tx }: { tx: Transaction }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Ações"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop animate-pop-in">
          {tx.type === 'receita' && (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2"
              onClick={() => {
                setOpen(false)
                openReceipts(tx.id)
              }}
            >
              <Wallet className="size-3.5" /> Recebimentos
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2"
            onClick={() => {
              setOpen(false)
              editTransaction(tx)
            }}
          >
            <Pencil className="size-3.5" /> Editar
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-despesa hover:bg-surface-2"
            onClick={() => {
              setOpen(false)
              void deleteTransaction(tx)
            }}
          >
            <Trash2 className="size-3.5" /> Excluir
          </button>
        </div>
      )}
    </div>
  )
}

/** Lista compacta de lançamentos (cards), usada em dashboard e páginas por tipo. */
export function TransactionList({ items, showMenu = true }: { items: Transaction[]; showMenu?: boolean }) {
  const colors = useColors()
  const label = useTxLabels()
  return (
    <ul className="divide-y divide-line">
      {items.map((t) => {
        const Icon = TYPE_ICON[t.type]
        const l = label(t)
        return (
          <li key={t.id} className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl"
              style={{ backgroundColor: `${typeColor(t.type, colors)}1a`, color: typeColor(t.type, colors) }}
            >
              <Icon className="size-4" />
            </span>
            <button type="button" onClick={() => editTransaction(t)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-ink">{t.description}</p>
              <p className="truncate text-xs text-ink-3">
                {formatDateBR(t.date)} · {l.category}
                {t.type === 'receita' && receiptState(t) !== 'recebido' ? (
                  <span className="text-reserva">
                    {' · '}
                    {receiptState(t) === 'parcial'
                      ? `${formatBRL(receivedOf(t))} recebidos · faltam ${formatBRL(pendingOf(t))}`
                      : RECEIPT_LABELS.aguardando}
                  </span>
                ) : (
                  t.status === 'pendente' && t.type !== 'receita' && <span className="text-reserva"> · {statusLabel(t.type, t.status)}</span>
                )}
              </p>
            </button>
            <AmountText tx={t} className="text-sm" />
            {showMenu && <RowMenu tx={t} />}
          </li>
        )
      })}
    </ul>
  )
}
