import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatPercent } from '@/domain/money'
import { cn } from '@/lib/cn'

export function Badge({ color, children, className }: { color?: string; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', className)}
      style={color ? { backgroundColor: `${color}1f`, color } : undefined}
    >
      {children}
    </span>
  )
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} />
}

export function Progress({ value, color, className, height = 8 }: { value: number; color?: string; className?: string; height?: number }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('w-full overflow-hidden rounded-full bg-surface-3', className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${v}%`, backgroundColor: color ?? 'var(--brand)' }}
      />
    </div>
  )
}

/** Controle segmentado (abas compactas). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div role="tablist" className={cn('inline-flex rounded-xl bg-surface-3 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-lg font-medium whitespace-nowrap transition-all',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Indicador de variação. `inverse` = subir é ruim (ex. despesas).
 */
export function Delta({ value, inverse, label, className }: { value: number | null; inverse?: boolean; label?: string; className?: string }) {
  if (value === null || !Number.isFinite(value)) {
    return label ? <span className={cn('text-xs text-ink-3', className)}>sem base de comparação</span> : null
  }
  const flat = Math.abs(value) < 0.05
  const good = flat ? null : value > 0 !== !!inverse
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold num',
          good === null && 'bg-surface-3 text-ink-2',
          good === true && 'bg-receita/12 text-emerald-600 dark:text-emerald-400',
          good === false && 'bg-despesa/12 text-rose-600 dark:text-rose-400',
        )}
      >
        <Icon className="size-3.5" />
        {formatPercent(Math.abs(value), 1)}
      </span>
      {label && <span className="text-ink-3">{label}</span>}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  text?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</div>
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-3">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-3', className)} />
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Pequeno card de métrica usado nas páginas internas. */
export function Stat({
  label,
  value,
  sub,
  color,
  icon,
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  color?: string
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface p-3.5 shadow-card sm:p-5', className)}>
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
        {icon && (
          <span className="grid size-7 place-items-center rounded-lg" style={{ backgroundColor: `${color}1a`, color }}>
            {icon}
          </span>
        )}
        {label}
      </div>
      <div className="mt-3 truncate text-lg font-semibold tracking-tight num sm:text-2xl">{value}</div>
      {sub && <div className="mt-1.5 text-xs text-ink-3">{sub}</div>}
    </div>
  )
}
