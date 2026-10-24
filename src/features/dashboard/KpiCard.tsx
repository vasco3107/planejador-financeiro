import type { ReactNode } from 'react'
import { Delta } from '@/components/ui/misc'
import { EditableAmount } from '@/components/ui/EditableAmount'
import { cn } from '@/lib/cn'

export function KpiCard({
  label,
  value,
  icon,
  color,
  delta,
  deltaLabel,
  inverse,
  footer,
  emphasis,
  edit,
  className,
}: {
  label: string
  value: ReactNode
  icon: ReactNode
  color: string
  delta?: number | null
  deltaLabel?: string
  inverse?: boolean
  footer?: ReactNode
  emphasis?: boolean
  /** Deixa o valor editável no próprio card */
  edit?: { onSave: (cents: number) => Promise<void> | void; amount: number; disabled?: boolean; disabledHint?: string }
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line bg-surface p-3.5 shadow-card sm:p-5',
        emphasis && 'ring-1 ring-inset',
        className,
      )}
      style={emphasis ? ({ '--tw-ring-color': `${color}40` } as React.CSSProperties) : undefined}
    >
      {emphasis && (
        <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-[0.10] blur-2xl" style={{ backgroundColor: color }} />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-2 sm:text-[13px]">{label}</span>
        <span className="grid size-8 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${color}1a`, color }}>
          {icon}
        </span>
      </div>
      <div className={cn('mt-2 font-semibold tracking-tight num', emphasis ? 'text-lg sm:text-2xl xl:text-[28px]' : 'text-lg sm:text-2xl')}>
        {edit ? (
          <EditableAmount value={edit.amount} onSave={edit.onSave} label={label} disabled={edit.disabled} disabledHint={edit.disabledHint} />
        ) : (
          <div className="mt-1 truncate">{value}</div>
        )}
      </div>
      <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
        {delta !== undefined && deltaLabel !== undefined && <Delta value={delta} inverse={inverse} label={deltaLabel} />}
        {footer && <span className="text-xs text-ink-3">{footer}</span>}
      </div>
    </div>
  )
}
