import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatBRL, formatPercent } from '@/domain/money'
import { cn } from '@/lib/cn'
import { useChartTheme } from './chartTheme'
import { TooltipBox, type RechartsTooltipProps } from './ChartTooltip'

export interface DonutSlice {
  key: string
  name: string
  color: string
  cents: number
}

/**
 * Rosca com total no centro e legenda com valor e percentual.
 * Tooltip: nome, porcentagem e valor.
 */
export function DonutChart({
  data,
  centerLabel = 'Total',
  height = 240,
  legend = 'side',
}: {
  data: DonutSlice[]
  centerLabel?: string
  height?: number
  legend?: 'side' | 'bottom' | 'none'
}) {
  const theme = useChartTheme()
  const [active, setActive] = useState<string | null>(null)
  const visible = data.filter((d) => d.cents > 0)
  const total = visible.reduce((s, d) => s + d.cents, 0)
  const activeSlice = visible.find((d) => d.key === active)

  const content = ({ active: a, payload }: RechartsTooltipProps) => {
    if (!a || !payload?.length) return null
    const d = payload[0].payload as DonutSlice
    return (
      <TooltipBox
        rows={[{ name: d.name, color: d.color, value: d.cents }]}
        footer={`${formatPercent((d.cents / total) * 100, 1)} do total`}
      />
    )
  }

  return (
    <div className={cn('flex gap-6', legend === 'side' ? 'flex-col items-center sm:flex-row' : 'flex-col')}>
      <div className="relative w-full shrink-0" style={{ height, maxWidth: legend === 'side' ? height : undefined }}>
        {total > 0 ? (
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={visible}
                dataKey="cents"
                nameKey="name"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={visible.length > 1 ? 1.5 : 0}
                cornerRadius={4}
                stroke={theme.surface}
                strokeWidth={2}
                isAnimationActive
                animationDuration={500}
                onMouseEnter={(_, i) => setActive(visible[i]?.key ?? null)}
                onMouseLeave={() => setActive(null)}
              >
                {visible.map((d) => (
                  <Cell key={d.key} fill={d.color} opacity={active && active !== d.key ? 0.35 : 1} />
                ))}
              </Pie>
              <Tooltip content={content} wrapperStyle={{ zIndex: 20 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center">
            <div className="grid aspect-square h-full max-h-full place-items-center rounded-full border-[14px] border-surface-3" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[11px] font-medium tracking-wide text-ink-3 uppercase">
              {activeSlice ? activeSlice.name : centerLabel}
            </div>
            <div className="mt-0.5 text-lg font-semibold tracking-tight num">
              {formatBRL(activeSlice ? activeSlice.cents : total)}
            </div>
            {activeSlice && (
              <div className="text-xs font-medium text-ink-2 num">{formatPercent((activeSlice.cents / total) * 100, 1)}</div>
            )}
          </div>
        </div>
      </div>
      {legend !== 'none' && (
        <ul className="w-full min-w-0 flex-1 space-y-1">
          {data.map((d) => (
            <li
              key={d.key}
              onMouseEnter={() => setActive(d.key)}
              onMouseLeave={() => setActive(null)}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors',
                active === d.key && 'bg-surface-3',
              )}
            >
              <span className="flex min-w-0 items-center gap-2.5 text-ink-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="flex shrink-0 items-baseline gap-2 num">
                <span className="font-semibold text-ink">{formatBRL(d.cents)}</span>
                <span className="w-12 text-right text-xs text-ink-3">
                  {total ? formatPercent((d.cents / total) * 100, 1) : '—'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
