import type { ReactNode } from 'react'
import { formatBRL } from '@/domain/money'

export interface TooltipRow {
  name: string
  color: string
  value: number
  extra?: ReactNode
}

/** Caixa de tooltip compartilhada por todos os gráficos. Texto em tinta, cor só no marcador. */
export function TooltipBox({ title, rows, footer }: { title?: ReactNode; rows: TooltipRow[]; footer?: ReactNode }) {
  return (
    <div className="min-w-44 rounded-xl border border-line bg-surface px-3.5 py-3 text-xs shadow-pop">
      {title && <div className="mb-2 font-semibold text-ink">{title}</div>}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-ink-2">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: r.color }} />
              {r.name}
            </span>
            <span className="font-semibold text-ink num">
              {formatBRL(r.value)}
              {r.extra}
            </span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-2 border-t border-line pt-2 text-ink-3">{footer}</div>}
    </div>
  )
}

/** Adaptador para o `content` do Tooltip do Recharts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RechartsTooltipProps = { active?: boolean; payload?: readonly any[]; label?: string | number }
