import { useMemo } from 'react'
import { CalendarDays, Landmark, Percent, Plus } from 'lucide-react'
import { DonutChart } from '@/components/charts/DonutChart'
import { AreaSeriesChart } from '@/components/charts/SeriesCharts'
import { PeriodFilter } from '@/components/layout/PeriodFilter'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState, PageHeader, Stat } from '@/components/ui/misc'
import { usePersonalFinance } from '@/data/hooks'
import { shareOfIncome } from '@/domain/finance'
import { formatBRL, formatPercent } from '@/domain/money'
import { currentMonthKey, monthKey, todayISO } from '@/domain/period'
import { cumulativeSeries, personalMonthlySummaries } from '@/domain/reports'
import { openTransactionForm } from '@/features/transactions/TransactionForm'
import { TransactionList } from '@/features/transactions/TransactionList'
import { PALETTE } from '@/data/seed'
import { useColors } from '@/lib/colors'
import { usePeriod } from '@/store/ui'
import { chartMonths } from '../shared/months'

export default function InvestimentosPage() {
  const { preset, range } = usePeriod()
  const f = usePersonalFinance(range, preset)
  const c = useColors()

  const aportes = useMemo(() => f.all.filter((t) => t.type === 'investimento' && t.status === 'confirmado'), [f.all])
  const year = todayISO().slice(0, 4)
  const month = currentMonthKey()
  const total = aportes.reduce((s, t) => s + t.amountCents, 0)
  const noMes = aportes.filter((t) => monthKey(t.date) === month).reduce((s, t) => s + t.amountCents, 0)
  const noAno = aportes.filter((t) => t.date.startsWith(year)).reduce((s, t) => s + t.amountCents, 0)
  const shareEntradas = shareOfIncome(f.totals.investido, f.totals)

  const months = useMemo(() => chartMonths(range, f.all), [range, f.all])
  const evo = useMemo(() => {
    const s = personalMonthlySummaries(f.all, months)
    // Parte do acumulado anterior ao primeiro mês do gráfico
    const before = aportes.filter((t) => monthKey(t.date) < months[0]).reduce((acc, t) => acc + t.amountCents, 0)
    const cum = cumulativeSeries(s, (x) => x.investido, before)
    return s.map((x, i) => ({ month: x.month, acumulado: cum[i].cumulative, aporte: x.investido }))
  }, [f.all, months, aportes])

  const inPeriod = f.inPeriod.filter((t) => t.type === 'investimento')
  const bySource = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of inPeriod) if (t.status === 'confirmado') m.set(t.source || 'Não informado', (m.get(t.source || 'Não informado') ?? 0) + t.amountCents)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, cents], i) => ({ key: name, name, cents, color: PALETTE[i % PALETTE.length] }))
  }, [inPeriod])

  return (
    <div className="space-y-5 animate-fade-in lg:space-y-6">
      <PageHeader
        title="Investimentos"
        subtitle="Quanto você investiu com o seu dinheiro. Lance o valor exato de cada aporte."
        actions={<Button icon={<Plus className="size-4" />} onClick={() => openTransactionForm('investimento')}>Novo aporte</Button>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Total investido" value={formatBRL(total)} color={c.investimento} icon={<Landmark className="size-4" />} sub={`${aportes.length} aportes no total`} />
        <Stat label="Investido no mês" value={formatBRL(noMes)} color={c.investimento} icon={<CalendarDays className="size-4" />} sub="Mês atual" />
        <Stat label="Investido no ano" value={formatBRL(noAno)} color={c.investimento} icon={<CalendarDays className="size-4" />} sub={`Em ${year}`} />
        <Stat label="% do que você recebeu" value={formatPercent(shareEntradas, 1)} color={c.investimento} icon={<Percent className="size-4" />} sub="No período selecionado" />
      </div>

      <PeriodFilter className="sm:items-start" />

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-3">
          <CardHeader title="Evolução dos aportes" subtitle="Patrimônio aportado acumulado e aportes de cada mês" />
          <CardBody>
            <AreaSeriesChart
              data={evo}
              height={300}
              series={[
                { key: 'acumulado', name: 'Acumulado', color: c.investimento },
                { key: 'aporte', name: 'Aporte do mês', color: c.lucro },
              ]}
            />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Onde está investido" subtitle="Por instituição ou ativo, no período" />
          <CardBody>
            <DonutChart data={bySource} centerLabel="Aportado" height={190} legend="bottom" />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Aportes no período" subtitle={`${inPeriod.length} lançamentos`} />
        <CardBody>
          {inPeriod.length ? (
            <TransactionList items={inPeriod} />
          ) : (
            <EmptyState
              icon={<Landmark className="size-5" />}
              title="Nenhum aporte no período"
              text="Registre aportes para acompanhar quanto do lucro virou investimento."
              action={<Button variant="outline" icon={<Plus className="size-4" />} onClick={() => openTransactionForm('investimento')}>Registrar aporte</Button>}
            />
          )}
        </CardBody>
      </Card>
    </div>
  )
}
