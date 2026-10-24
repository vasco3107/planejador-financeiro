import { useMemo } from 'react'
import { AlertTriangle, Info, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/misc'
import { useCategories } from '@/data/hooks'
import { generateInsights, type InsightTone } from '@/domain/insights'
import { monthLabel } from '@/domain/period'
import type { Transaction } from '@/domain/types'
import { cn } from '@/lib/cn'

const TONE: Record<InsightTone, { icon: typeof Info; cls: string }> = {
  positive: { icon: TrendingUp, cls: 'bg-receita/12 text-receita' },
  negative: { icon: TrendingDown, cls: 'bg-despesa/12 text-despesa' },
  warning: { icon: AlertTriangle, cls: 'bg-reserva/15 text-reserva' },
  neutral: { icon: Info, cls: 'bg-lucro/12 text-lucro' },
}

export function InsightsCard({ transactions, month, limit = 5 }: { transactions: Transaction[]; month: string; limit?: number }) {
  const categories = useCategories()
  const insights = useMemo(
    () =>
      generateInsights({
        transactions,
        categories: categories ?? [],
        referenceMonth: month,
      }).slice(0, limit),
    [transactions, categories, month, limit],
  )

  return (
    <Card className="h-full">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" /> Insights
          </span>
        }
        subtitle={`Baseados nos seus lançamentos · ${monthLabel(month)}`}
      />
      <CardBody>
        {insights.length === 0 ? (
          <EmptyState
            className="py-6"
            icon={<Sparkles className="size-5" />}
            title="Ainda sem insights"
            text="Registre receitas e despesas de pelo menos dois meses para ver comparações automáticas."
          />
        ) : (
          <ul className="space-y-2.5">
            {insights.map((i) => {
              const t = TONE[i.tone]
              return (
                <li key={i.id} className="flex gap-3 rounded-xl p-2.5 transition-colors hover:bg-surface-2">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', t.cls)}>
                    <t.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">{i.title}</p>
                    <p className="text-[13px] leading-snug text-ink-2">{i.text}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
