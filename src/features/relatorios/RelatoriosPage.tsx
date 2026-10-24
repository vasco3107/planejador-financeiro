import { useMemo, useState } from 'react'
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react'
import { DonutChart } from '@/components/charts/DonutChart'
import { AreaSeriesChart, CategoryBars, MonthlyBarChart } from '@/components/charts/SeriesCharts'
import { PeriodFilter } from '@/components/layout/PeriodFilter'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Delta, EmptyState, PageHeader } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { useCategories, useFinance, useSettings } from '@/data/hooks'
import { ME } from '@/domain/finance'
import { formatBRL, formatDecimal, formatPercent } from '@/domain/money'
import { formatRangeBR, monthLabel, monthName, monthsBetween } from '@/domain/period'
import { cumulativeSeries, monthlySummaries, totalsByCategory, yearlySummaries, type MonthSummary } from '@/domain/reports'
import { downloadCSV, stamp } from '@/lib/export/csv'
import { exportPDF } from '@/lib/export/pdf'
import { bucketColor, useColors, SEMANTIC_LIGHT } from '@/lib/colors'
import { cn } from '@/lib/cn'
import { usePeriod } from '@/store/ui'
import { chartMonths } from '../shared/months'

type Tab = 'mensal' | 'anual' | 'receitas' | 'despesas' | 'lucro' | 'divisao'

const TABS: { value: Tab; label: string }[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
  { value: 'receitas', label: 'Receitas por categoria' },
  { value: 'despesas', label: 'Despesas por categoria' },
  { value: 'lucro', label: 'Evolução do lucro' },
  { value: 'divisao', label: 'Divisão do lucro' },
]

export default function RelatoriosPage() {
  const { preset, range } = usePeriod()
  const f = useFinance(range, preset)
  const categories = useCategories()
  const settings = useSettings()
  const c = useColors()
  const [tab, setTab] = useState<Tab>('mensal')
  const [busy, setBusy] = useState(false)

  const months = useMemo(() => {
    if (range.start.startsWith('1900')) return chartMonths(range, f.all)
    return monthsBetween(range.start, range.end)
  }, [range, f.all])
  const summaries = useMemo(() => monthlySummaries(f.all, f.configs, months), [f.all, f.configs, months])
  const years = useMemo(() => yearlySummaries(f.inPeriod), [f.inPeriod])
  const recCats = useMemo(() => totalsByCategory(f.inPeriod, categories ?? [], 'receita'), [f.inPeriod, categories])
  const despCats = useMemo(() => totalsByCategory(f.inPeriod, categories ?? [], 'despesa'), [f.inPeriod, categories])
  const company = settings?.companyName ?? 'Minha empresa'
  const t = f.totals

  const monthRows = (s: MonthSummary) => [
    monthLabel(s.month),
    formatDecimal(s.receita),
    formatDecimal(s.despesa),
    formatDecimal(s.lucro),
    s.margem === null ? '' : formatDecimal(Math.round(s.margem * 100)),
    formatDecimal(s.retiradoPor[ME] ?? 0),
    formatDecimal(s.retirado - (s.retiradoPor[ME] ?? 0)),
    formatDecimal(s.saldoDisponivel),
    s.receitaGrowth === null ? '' : formatDecimal(Math.round(s.receitaGrowth * 100)),
    s.lucroGrowth === null ? '' : formatDecimal(Math.round(s.lucroGrowth * 100)),
  ]

  const exportCSV = () => {
    const rows: (string | number)[][] = []
    switch (tab) {
      case 'receitas':
      case 'despesas':
        return downloadCSV(`${tab}-por-categoria-${stamp()}.csv`, ['Categoria', 'Valor (R$)', 'Participação (%)', 'Lançamentos'],
          (tab === 'receitas' ? recCats : despCats).map((x) => [x.name, formatDecimal(x.cents), formatDecimal(Math.round(x.share * 100)), x.count]))
      case 'anual':
        return downloadCSV(`relatorio-anual-${stamp()}.csv`, ['Ano', 'Receita (R$)', 'Despesas (R$)', 'Lucro (R$)', 'Margem (%)', 'Retiradas (R$)', 'Ficou na empresa (R$)'],
          years.map((y) => [y.year, formatDecimal(y.receita), formatDecimal(y.despesa), formatDecimal(y.lucro), y.margem === null ? '' : formatDecimal(Math.round(y.margem * 100)), formatDecimal(y.retirado), formatDecimal(y.saldoDisponivel)]))
      case 'divisao': {
        const keys = uniqueBuckets(summaries)
        for (const s of summaries) rows.push([monthLabel(s.month), formatDecimal(s.lucro), ...keys.map((k) => formatDecimal(s.allocations.find((a) => a.key === k.key)?.cents ?? 0))])
        return downloadCSV(`divisao-do-lucro-${stamp()}.csv`, ['Mês', 'Lucro (R$)', ...keys.map((k) => `${k.name} (R$)`)], rows)
      }
      default:
        return downloadCSV(`relatorio-mensal-${stamp()}.csv`,
          ['Mês', 'Receita (R$)', 'Despesas (R$)', 'Lucro (R$)', 'Margem (%)', 'Você retirou (R$)', 'Sócios retiraram (R$)', 'Ficou na empresa (R$)', 'Cresc. receita (%)', 'Cresc. lucro (%)'],
          summaries.map(monthRows))
    }
  }

  const doPDF = async () => {
    setBusy(true)
    try {
      const keys = uniqueBuckets(summaries)
      await exportPDF({
        title: 'Relatório financeiro',
        subtitle: formatRangeBR(range),
        company,
        filename: `relatorio-financeiro-${stamp()}.pdf`,
        summary: [
          { label: 'Receita', cents: t.receita, color: SEMANTIC_LIGHT.receita },
          { label: 'Despesas', cents: t.despesa, color: SEMANTIC_LIGHT.despesa },
          { label: 'Lucro líquido', cents: t.lucro, color: SEMANTIC_LIGHT.lucro },
          { label: 'Margem', text: formatPercent(t.margem, 1), color: SEMANTIC_LIGHT.saldo },
          { label: 'Você retirou', cents: t.retiradoPor[ME] ?? 0, color: SEMANTIC_LIGHT.retirada },
          { label: 'Sócios retiraram', cents: t.retirado - (t.retiradoPor[ME] ?? 0) },
          { label: 'Ficou na empresa', cents: t.saldoDisponivel },
          { label: 'Lançamentos', text: String(f.inPeriod.length) },
        ],
        sections: [
          {
            title: 'Resumo mensal',
            head: ['Mês', 'Receita', 'Despesas', 'Lucro', 'Margem', 'Retiradas', 'Ficou na empresa', 'Cresc. lucro'],
            numeric: [1, 2, 3, 4, 5, 6, 7],
            body: summaries.map((s) => [monthLabel(s.month), formatBRL(s.receita), formatBRL(s.despesa), formatBRL(s.lucro), formatPercent(s.margem, 1), formatBRL(s.retirado), formatBRL(s.saldoDisponivel), formatPercent(s.lucroGrowth, 1)]),
            foot: ['Total', formatBRL(t.receita), formatBRL(t.despesa), formatBRL(t.lucro), formatPercent(t.margem, 1), formatBRL(t.retirado), formatBRL(t.saldoDisponivel), ''],
          },
          {
            title: 'Divisão do lucro',
            head: ['Mês', 'Lucro', ...keys.map((k) => k.name)],
            numeric: keys.map((_, i) => i + 2).concat(1),
            body: summaries.map((s) => [monthLabel(s.month), formatBRL(Math.max(s.lucro, 0)), ...keys.map((k) => formatBRL(s.allocations.find((a) => a.key === k.key)?.cents ?? 0))]),
            foot: ['Total', formatBRL(f.destination.baseCents), ...keys.map((k) => formatBRL(f.destination.allocations.find((a) => a.key === k.key)?.cents ?? 0))],
          },
          {
            title: 'Receitas por categoria',
            head: ['Categoria', 'Lançamentos', 'Valor', 'Participação'],
            numeric: [1, 2, 3],
            body: recCats.map((x) => [x.name, x.count, formatBRL(x.cents), formatPercent(x.share, 1)]),
          },
          {
            title: 'Despesas por categoria',
            head: ['Categoria', 'Lançamentos', 'Valor', 'Participação'],
            numeric: [1, 2, 3],
            body: despCats.map((x) => [x.name, x.count, formatBRL(x.cents), formatPercent(x.share, 1)]),
          },
          ...(years.length > 1
            ? [{
                title: 'Resumo anual',
                head: ['Ano', 'Receita', 'Despesas', 'Lucro', 'Margem', 'Retiradas', 'Ficou na empresa'],
                numeric: [1, 2, 3, 4, 5, 6],
                body: years.map((y) => [y.year, formatBRL(y.receita), formatBRL(y.despesa), formatBRL(y.lucro), formatPercent(y.margem, 1), formatBRL(y.retirado), formatBRL(y.saldoDisponivel)]),
              }]
            : []),
        ],
      })
      toast('PDF gerado')
    } catch (e) {
      console.error(e)
      toast('Não foi possível gerar o PDF', 'error')
    } finally {
      setBusy(false)
    }
  }

  const lucroEvo = useMemo(() => {
    const cum = cumulativeSeries(summaries, (s) => s.lucro)
    return summaries.map((s, i) => ({ month: s.month, lucro: s.lucro, acumulado: cum[i].cumulative }))
  }, [summaries])
  const bucketKeys = uniqueBuckets(summaries)
  const distData = summaries.map((s) => ({
    month: s.month,
    ...Object.fromEntries(bucketKeys.map((k) => [k.key, s.allocations.find((a) => a.key === k.key)?.cents ?? 0])),
  }))

  const empty = f.inPeriod.length === 0

  return (
    <div className="space-y-5 animate-fade-in lg:space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="Análises do período selecionado, prontas para exportar."
        actions={
          <>
            <Button variant="outline" icon={<FileSpreadsheet className="size-4" />} onClick={exportCSV} disabled={empty}>CSV</Button>
            <Button icon={<FileDown className="size-4" />} onClick={doPDF} disabled={empty || busy}>{busy ? 'Gerando…' : 'PDF'}</Button>
          </>
        }
      />
      <PeriodFilter className="sm:items-start" />

      <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <div role="tablist" className="inline-flex gap-1 rounded-xl bg-surface-3 p-1">
          {TABS.map((x) => (
            <button
              key={x.value}
              role="tab"
              type="button"
              aria-selected={tab === x.value}
              onClick={() => setTab(x.value)}
              className={cn('rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all', tab === x.value ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2')}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      {empty ? (
        <Card>
          <EmptyState icon={<FileText className="size-5" />} title="Sem dados no período" text="Escolha outro período ou registre lançamentos para gerar relatórios." />
        </Card>
      ) : (
        <>
          {tab === 'mensal' && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...summaries].reverse().filter((s) => s.count > 0).map((s) => (
                <Card key={s.month}>
                  <CardHeader
                    title={monthName(s.month) + ' ' + s.month.slice(0, 4)}
                    subtitle={`${s.count} lançamentos`}
                    action={<Delta value={s.lucroGrowth} label="lucro" />}
                  />
                  <CardBody>
                    <dl className="space-y-2 text-sm">
                      {[
                        ['Receita', s.receita, c.receita],
                        ['Despesas', s.despesa, c.despesa],
                        ['Lucro', s.lucro, c.lucro],
                        ['Você retirou', s.retiradoPor[ME] ?? 0, c.retirada],
                        ['Sócios retiraram', s.retirado - (s.retiradoPor[ME] ?? 0), c.lucro],
                        ['Ficou na empresa', s.saldoDisponivel, c.saldo],
                      ].map(([label, v, color]) => (
                        <div key={label as string} className="flex items-center justify-between">
                          <dt className="flex items-center gap-2 text-ink-2"><span className="size-2 rounded-full" style={{ backgroundColor: color as string }} />{label}</dt>
                          <dd className={cn('font-semibold num', label === 'Lucro' && (v as number) < 0 && 'text-despesa')}>{formatBRL(v as number)}</dd>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t border-line pt-2">
                        <dt className="text-ink-2">Margem de lucro</dt>
                        <dd className="font-semibold num">{formatPercent(s.margem, 1)}</dd>
                      </div>
                      <div className="flex items-center justify-between">
                        <dt className="text-ink-2">Receita vs mês anterior</dt>
                        <dd><Delta value={s.receitaGrowth} /></dd>
                      </div>
                    </dl>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          {tab === 'anual' && (
            <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
              <Card className="lg:col-span-3">
                <CardHeader title="Comparativo anual" />
                <CardBody>
                  <MonthlyBarChart
                    xFormat={(v) => v}
                    titleFormat={(v) => `Ano ${v}`}
                    data={years.map((y) => ({ month: y.year, receita: y.receita, despesa: y.despesa, lucro: y.lucro, retirado: y.retirado }))}
                    series={[
                      { key: 'receita', name: 'Receitas', color: c.receita },
                      { key: 'despesa', name: 'Despesas', color: c.despesa },
                      { key: 'lucro', name: 'Lucro', color: c.lucro },
                      { key: 'retirado', name: 'Retiradas', color: c.retirada },
                    ]}
                  />
                </CardBody>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader title="Por ano" />
                <CardBody className="space-y-4">
                  {years.map((y) => (
                    <div key={y.year} className="rounded-xl border border-line p-4">
                      <div className="mb-2 flex items-baseline justify-between">
                        <span className="text-lg font-semibold">{y.year}</span>
                        <span className="text-xs text-ink-3">{y.months} {y.months === 1 ? 'mês' : 'meses'} com lançamentos</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        <span className="text-ink-3">Receita</span><span className="text-right font-medium num">{formatBRL(y.receita)}</span>
                        <span className="text-ink-3">Despesas</span><span className="text-right font-medium num">{formatBRL(y.despesa)}</span>
                        <span className="text-ink-3">Lucro</span><span className="text-right font-semibold num">{formatBRL(y.lucro)}</span>
                        <span className="text-ink-3">Margem</span><span className="text-right font-medium num">{formatPercent(y.margem, 1)}</span>
                        <span className="text-ink-3">Retiradas</span><span className="text-right font-medium num">{formatBRL(y.retirado)}</span>
                        <span className="text-ink-3">Ficou na empresa</span><span className="text-right font-medium num">{formatBRL(y.saldoDisponivel)}</span>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          )}

          {(tab === 'receitas' || tab === 'despesas') && (
            <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
              <Card className="lg:col-span-2">
                <CardHeader title={tab === 'receitas' ? 'Receitas por categoria' : 'Despesas por categoria'} subtitle={formatRangeBR(range)} />
                <CardBody>
                  <DonutChart
                    data={(tab === 'receitas' ? recCats : despCats).map((x) => ({ key: x.categoryId, name: x.name, color: x.color, cents: x.cents }))}
                    centerLabel={tab === 'receitas' ? 'Receita' : 'Despesas'}
                    height={220}
                    legend="none"
                  />
                </CardBody>
              </Card>
              <Card className="lg:col-span-3">
                <CardHeader title="Ranking" subtitle="Participação de cada categoria no total" />
                <CardBody>
                  <CategoryBars items={(tab === 'receitas' ? recCats : despCats).map((x) => ({ ...x, key: x.categoryId }))} formatValue={formatBRL} max={12} />
                </CardBody>
              </Card>
            </div>
          )}

          {tab === 'lucro' && (
            <Card>
              <CardHeader title="Evolução do lucro" subtitle="Lucro de cada mês e acumulado no período" />
              <CardBody>
                <AreaSeriesChart data={lucroEvo} height={340} series={[{ key: 'acumulado', name: 'Acumulado', color: c.saldo }, { key: 'lucro', name: 'Lucro do mês', color: c.lucro }]} />
                <MonthTable summaries={summaries} />
              </CardBody>
            </Card>
          )}

          {tab === 'divisao' && (
            <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
              <Card className="lg:col-span-2">
                <CardHeader title="Divisão no período" subtitle={`Lucro dividido: ${formatBRL(f.destination.baseCents)}`} />
                <CardBody>
                  <DonutChart data={f.destination.allocations.map((a) => ({ key: a.key, name: a.name, color: bucketColor(a, c), cents: a.cents }))} centerLabel="Lucro" height={210} legend="bottom" />
                </CardBody>
              </Card>
              <Card className="lg:col-span-3">
                <CardHeader title="Divisão por mês" subtitle="Calculada com a divisão vigente em cada mês" />
                <CardBody>
                  <MonthlyBarChart data={distData} series={bucketKeys.map((k) => ({ key: k.key, name: k.name, color: bucketColor(k, c) }))} />
                </CardBody>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function uniqueBuckets(summaries: MonthSummary[]) {
  const map = new Map<string, MonthSummary['allocations'][number]>()
  for (const s of summaries) for (const a of s.allocations) if (!map.has(a.key)) map.set(a.key, a)
  return [...map.values()]
}

function MonthTable({ summaries }: { summaries: MonthSummary[] }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3 uppercase">
            <th className="py-2 font-semibold">Mês</th>
            <th className="py-2 text-right font-semibold">Receita</th>
            <th className="py-2 text-right font-semibold">Lucro</th>
            <th className="py-2 text-right font-semibold">Margem</th>
            <th className="py-2 text-right font-semibold">Variação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {summaries.map((s) => (
            <tr key={s.month}>
              <td className="py-2.5">{monthLabel(s.month)}</td>
              <td className="py-2.5 text-right num">{formatBRL(s.receita)}</td>
              <td className={cn('py-2.5 text-right font-medium num', s.lucro < 0 && 'text-despesa')}>{formatBRL(s.lucro)}</td>
              <td className="py-2.5 text-right num">{formatPercent(s.margem, 1)}</td>
              <td className="py-2.5 text-right">
                {s.lucroDelta === null ? <span className="text-ink-3">—</span> : (
                  <span className={cn('num', s.lucroDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-despesa')}>
                    {s.lucroDelta >= 0 ? '+' : '−'}{formatBRL(Math.abs(s.lucroDelta))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
