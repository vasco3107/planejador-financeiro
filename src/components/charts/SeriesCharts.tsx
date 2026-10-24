import { useId, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBRLCompact } from '@/domain/money'
import { monthLabel, monthShort } from '@/domain/period'
import { cn } from '@/lib/cn'
import { useChartTheme, useIsMobile } from './chartTheme'
import { TooltipBox, type RechartsTooltipProps } from './ChartTooltip'

export interface Series {
  key: string
  name: string
  color: string
}

type Row = { month: string } & Record<string, number | string>

/** Legenda clicável: liga/desliga séries sem repintar as demais. */
function Legend({ series, hidden, toggle }: { series: Series[]; hidden: Set<string>; toggle: (k: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {series.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => toggle(s.key)}
          aria-pressed={!hidden.has(s.key)}
          className={cn('flex items-center gap-2 text-xs font-medium transition-opacity', hidden.has(s.key) ? 'text-ink-3 opacity-50' : 'text-ink-2')}
        >
          <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
          {s.name}
        </button>
      ))}
    </div>
  )
}

function useHidden() {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const toggle = (k: string) =>
    setHidden((h) => {
      const n = new Set(h)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  return { hidden, toggle }
}

function tooltipFor(series: Series[], titleFormat: (v: string) => string = monthLabel) {
  return function Content({ active, payload, label }: RechartsTooltipProps) {
    if (!active || !payload?.length) return null
    const rows = series
      .map((s) => {
        const p = payload.find((x) => x.dataKey === s.key)
        return p ? { name: s.name, color: s.color, value: Number(p.value) } : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    return <TooltipBox title={titleFormat(String(label))} rows={rows} />
  }
}

export function MonthlyBarChart({
  data,
  series,
  height = 300,
  showLegend = true,
  xFormat = monthShort,
  titleFormat = monthLabel,
}: {
  data: Row[]
  series: Series[]
  height?: number
  showLegend?: boolean
  xFormat?: (v: string) => string
  titleFormat?: (v: string) => string
}) {
  const theme = useChartTheme()
  const mobile = useIsMobile()
  const { hidden, toggle } = useHidden()
  const visible = series.filter((s) => !hidden.has(s.key))
  const hasNegative = data.some((r) => visible.some((s) => Number(r[s.key]) < 0))

  return (
    <div>
      {showLegend && series.length > 1 && <Legend series={series} hidden={hidden} toggle={toggle} />}
      <div style={{ height: mobile ? Math.min(height, 240) : height }}>
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} barCategoryGap={mobile ? '18%' : '24%'} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="month" tickFormatter={xFormat} tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
            <YAxis tickFormatter={formatBRLCompact} tickLine={false} axisLine={false} width={mobile ? 58 : 76} tickCount={5} />
            {hasNegative && <ReferenceLine y={0} stroke={theme.axis} />}
            <Tooltip content={tooltipFor(visible, titleFormat)} cursor={{ fill: theme.cursor }} wrapperStyle={{ zIndex: 20 }} />
            {visible.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={500} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function AreaSeriesChart({
  data,
  series,
  height = 300,
  showLegend = true,
}: {
  data: Row[]
  series: Series[]
  height?: number
  showLegend?: boolean
}) {
  const theme = useChartTheme()
  const mobile = useIsMobile()
  const uid = useId().replace(/:/g, '')
  const { hidden, toggle } = useHidden()
  const visible = series.filter((s) => !hidden.has(s.key))
  const hasNegative = data.some((r) => visible.some((s) => Number(r[s.key]) < 0))

  return (
    <div>
      {showLegend && series.length > 1 && <Legend series={series} hidden={hidden} toggle={toggle} />}
      <div style={{ height: mobile ? Math.min(height, 240) : height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={visible.length > 1 ? 0.14 : 0.24} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis dataKey="month" tickFormatter={monthShort} tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
            <YAxis tickFormatter={formatBRLCompact} tickLine={false} axisLine={false} width={mobile ? 58 : 76} tickCount={5} />
            {hasNegative && <ReferenceLine y={0} stroke={theme.axis} strokeDasharray="3 3" />}
            <Tooltip content={tooltipFor(visible)} cursor={{ stroke: theme.axis, strokeDasharray: '3 3' }} wrapperStyle={{ zIndex: 20 }} />
            {visible.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#${uid}-${s.key})`}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: theme.surface }}
                animationDuration={600}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Lista de barras horizontais (HTML) para rankings de categoria. */
export function CategoryBars({
  items,
  formatValue,
  max = 8,
}: {
  items: { key: string; name: string; color: string; cents: number; share: number }[]
  formatValue: (c: number) => string
  max?: number
}) {
  const top = items.slice(0, max)
  const rest = items.slice(max)
  const rows = rest.length
    ? [...top, { key: '__rest', name: `Outras (${rest.length})`, color: '#94a3b8', cents: rest.reduce((s, i) => s + i.cents, 0), share: rest.reduce((s, i) => s + i.share, 0) }]
    : top
  const peak = Math.max(...rows.map((r) => r.share), 1)
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-ink-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
              <span className="truncate">{r.name}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2 num">
              <span className="font-semibold text-ink">{formatValue(r.cents)}</span>
              <span className="w-11 text-right text-xs text-ink-3">
                {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(r.share)}%
              </span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(r.share / peak) * 100}%`, backgroundColor: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
