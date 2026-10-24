import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { EditableAmount } from '@/components/ui/EditableAmount'
import { formatBRL } from '@/domain/money'
import { cn } from '@/lib/cn'

export interface QuickStat {
  key: string
  label: string
  amount: number
  color: string
  icon: ReactNode
  footer?: string
  negativeInRed?: boolean
  edit?: { onSave: (cents: number) => Promise<void> | void; disabled?: boolean; disabledHint?: string }
}

/**
 * Faixa compacta de números do painel. Cabem vários lado a lado sem cortar valor,
 * porque o rótulo fica pequeno e o valor ocupa a linha inteira da coluna.
 */
export function QuickStats({ items }: { items: QuickStat[] }) {
  return (
    <Card className="overflow-hidden">
      <ul className="grid grid-cols-2 divide-line sm:grid-cols-3 sm:divide-x lg:grid-cols-5">
        {items.map((s) => (
          <li key={s.key} className="min-w-0 border-b border-line px-4 py-3.5 last:border-b-0 sm:border-b-0 sm:px-5">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ backgroundColor: `${s.color}1a`, color: s.color }}>
                {s.icon}
              </span>
              <span className="truncate">{s.label}</span>
            </div>
            <div className={cn('text-[17px] font-semibold tracking-tight num sm:text-xl', s.negativeInRed && s.amount < 0 && 'text-despesa')}>
              {s.edit ? (
                <EditableAmount value={s.amount} onSave={s.edit.onSave} label={s.label} disabled={s.edit.disabled} disabledHint={s.edit.disabledHint} />
              ) : (
                <div className="mt-1 truncate">{formatBRL(s.amount)}</div>
              )}
            </div>
            {s.footer && <p className="mt-1 truncate text-[11px] text-ink-3" title={s.footer}>{s.footer}</p>}
          </li>
        ))}
      </ul>
    </Card>
  )
}
