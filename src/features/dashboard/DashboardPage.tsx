import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  ArrowRightLeft,
  Users,
  Vault,
  Percent,
  Plus,
  Sparkles,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { DonutChart } from '@/components/charts/DonutChart'
import { AreaSeriesChart, MonthlyBarChart } from '@/components/charts/SeriesCharts'
import { PeriodFilter } from '@/components/layout/PeriodFilter'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState, Segmented, Skeleton } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { usePartners, useFinance, useSettings } from '@/data/hooks'
import { setBillingTotal, setCostsTotal, setReceivedTotal, setReserveTotal, setWithdrawalTotal } from '@/data/quickEdits'
import { loadDemoData } from '@/data/demo'
import { ME, destinedShare, hasShare } from '@/domain/finance'
import { ENTITY_LABELS } from '@/domain/types'
import { formatBRL, formatPercent } from '@/domain/money'
import { PREVIOUS_LABELS, todayISO } from '@/domain/period'
import { cumulativeSeries, monthlySummaries } from '@/domain/reports'
import { openTransactionForm } from '@/features/transactions/TransactionForm'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useColors } from '@/lib/colors'
import { usePeriod } from '@/store/ui'
import { chartMonths, referenceMonth } from '../shared/months'
import { InsightsCard } from './InsightsCard'
import { KpiCard } from './KpiCard'
import { MoneyFlow, type FlowPerson } from './MoneyFlow'
import { QuickStats } from './QuickStats'

export default function DashboardPage() {
  const { preset, range } = usePeriod()
  const f = useFinance(range, preset)
  const settings = useSettings()
  const partners = usePartners()
  const c = useColors()
  const [barMonths, setBarMonths] = useState<'6' | '12'>('6')
  const [evoMode, setEvoMode] = useState<'acumulado' | 'mensal'>('acumulado')

  const months = useMemo(() => chartMonths(range, f.all), [range, f.all])
  const summaries = useMemo(() => monthlySummaries(f.all, f.configs, months), [f.all, f.configs, months])

  const { totals, prevTotals, destination } = f
  const dLabel = PREVIOUS_LABELS[preset]
  const g = (cur: number, prev: number | undefined) =>
    prevTotals && prev !== undefined && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null


  const barData = summaries.slice(barMonths === '6' && months.length > 6 ? -6 : 0).map((s) => ({
    month: s.month,
    receita: s.receita,
    despesa: s.despesa,
    lucro: s.lucro,
    retirada: s.retirado,
  }))

  const evoData = useMemo(() => {
    const lucro = cumulativeSeries(summaries, (s) => s.lucro)
    const ret = cumulativeSeries(summaries, (s) => s.retirado)
    const caixa = cumulativeSeries(summaries, (s) => s.saldoDisponivel)
    return summaries.map((s, i) =>
      evoMode === 'acumulado'
        ? { month: s.month, lucro: lucro[i].cumulative, retirado: ret[i].cumulative, caixa: caixa[i].cumulative }
        : { month: s.month, lucro: s.lucro, retirado: s.retirado, caixa: s.saldoDisponivel },
    )
  }, [summaries, evoMode])


  const recent = f.inPeriod.slice(0, 6)
  const receitas = f.inPeriod.filter((t) => t.type === 'receita')
  const despesas = f.inPeriod.filter((t) => t.type === 'despesa')
  const retiradas = f.inPeriod.filter((t) => t.type === 'retirada')
  const caixas = f.inPeriod.filter((t) => t.type === 'caixa')
  const impostos = f.inPeriod.filter((t) => t.type === 'despesa' && t.categoryId === 'desp-impostos' && t.status === 'confirmado').reduce((s, t) => s + t.amountCents, 0)
  const socios = (partners ?? []).filter((p) => !p.archived)
  const hoje = todayISO()
  const meuRetirado = totals.retiradoPor[ME] ?? 0
  const sociosRetirado = totals.retirado - meuRetirado
  const minhaParte = destinedShare(destination, ME)

  // Pessoas do fluxo: valor real retirado + a referência da divisão (que não preenche nada)
  const pessoas: FlowPerson[] = [
    {
      id: ME,
      name: 'Você',
      color: c.retirada,
      retirado: meuRetirado,
      referencia: hasShare(destination, ME) ? minhaParte : null,
      bps: destination.allocations.find((a) => a.role === 'retirada' && !a.partnerId)?.bps ?? null,
    },
    ...socios.map((p) => {
      const alloc = destination.allocations.find((a) => a.partnerId === p.id)
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        retirado: totals.retiradoPor[p.id] ?? 0,
        referencia: alloc ? alloc.cents : null,
        bps: alloc ? alloc.bps : null,
      }
    }),
  ]

  const slices = [
    { key: 'despesas', name: 'Despesas', color: c.despesa, cents: totals.despesa },
    ...pessoas.map((p) => ({ key: p.id, name: p.name, color: p.color, cents: p.retirado })),
    { key: 'nao-retirado', name: 'Não retirado', color: c.saldo, cents: Math.max(totals.saldoDisponivel, 0) },
  ]

  const isEmpty = !f.loading && f.all.length === 0

  if (f.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in lg:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-3">
            {settings?.companyName ?? 'Minha empresa'}
            <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">{ENTITY_LABELS[f.entity]}</span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Visão geral</h1>
        </div>
        <PeriodFilter />
      </div>

      {isEmpty && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Sparkles className="size-5" />
              </span>
              <div>
                <p className="font-semibold">Comece registrando sua primeira receita</p>
                <p className="mt-0.5 text-sm text-ink-3">
                  O lucro, a distribuição e os gráficos são calculados automaticamente. Quer ver antes como fica? Carregue dados de exemplo.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  await loadDemoData()
                  toast('Dados de demonstração carregados')
                }}
              >
                Ver exemplo
              </Button>
              <Button icon={<Plus className="size-4" />} onClick={() => openTransactionForm('receita')}>
                Nova receita
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          label="Faturamento"
          value={formatBRL(totals.receita)}
          icon={<ArrowDownLeft className="size-4" />}
          color={c.receita}
          delta={g(totals.receita, prevTotals?.receita)}
          deltaLabel={dLabel}
          edit={{ amount: totals.receita, onSave: (v) => setBillingTotal(receitas, v, hoje, f.entity) }}
          footer={totals.receitaPendente > 0 ? `${formatBRL(totals.receitaPendente)} ainda a receber` : 'Tudo resolvido'}
        />
        <KpiCard
          label="Despesas totais"
          value={formatBRL(totals.despesa)}
          icon={<ArrowUpRight className="size-4" />}
          color={c.despesa}
          inverse
          delta={g(totals.despesa, prevTotals?.despesa)}
          deltaLabel={dLabel}
          edit={{ amount: totals.despesa, onSave: (v) => setCostsTotal(despesas, v, hoje, f.entity) }}
          footer={impostos > 0 ? `Inclui ${formatBRL(impostos)} de impostos` : 'Assinaturas, APIs e taxas'}
        />
        <KpiCard
          label="Lucro líquido"
          value={<span className={totals.lucro < 0 ? 'text-despesa' : undefined}>{formatBRL(totals.lucro)}</span>}
          icon={<Wallet className="size-4" />}
          color={c.lucro}
          emphasis
          delta={g(totals.lucro, prevTotals?.lucro)}
          deltaLabel={dLabel}
        />
        <KpiCard
          label="Margem de lucro"
          value={formatPercent(totals.margem, 1)}
          icon={<Percent className="size-4" />}
          color={c.saldo}
          footer={
            prevTotals?.margem != null && totals.margem != null
              ? `${totals.margem - prevTotals.margem >= 0 ? '+' : '−'}${formatPercent(Math.abs(totals.margem - prevTotals.margem), 1).replace('%', '')} p.p. ${dLabel}`
              : 'Lucro ÷ receita'
          }
        />
      </div>
      <QuickStats
        items={[
          {
            key: 'conta',
            label: 'Caiu na conta',
            amount: totals.receitaRecebida,
            color: c.receita,
            icon: <Wallet className="size-3.5" />,
            footer: totals.taxaPlataforma > 0 ? `+ ${formatBRL(totals.taxaPlataforma)} em taxas` : 'Faturamento repassado',
            edit: { onSave: (v: number) => setReceivedTotal(receitas, v, hoje) },
          },
          {
            key: 'voce',
            label: 'Você retirou',
            amount: meuRetirado,
            color: c.retirada,
            icon: <ArrowRightLeft className="size-3.5" />,
            footer: minhaParte > 0 ? `Referência: ${formatBRL(minhaParte)}` : 'Vai para a sua carteira',
            edit: { onSave: (v: number) => setWithdrawalTotal(retiradas, ME, v, hoje, f.entity) },
          },
          {
            key: 'socios',
            label: socios.length === 1 ? socios[0].name : 'Sócios',
            amount: sociosRetirado,
            color: c.lucro,
            icon: <Users className="size-3.5" />,
            footer: 'Retiradas dos sócios',
            edit: {
              disabled: socios.length !== 1,
              disabledHint: socios.length === 0 ? 'Cadastre um sócio em Sócios e divisão' : 'Mais de um sócio: edite na página Sócios',
              onSave: (v: number) => setWithdrawalTotal(retiradas, socios[0].id, v, hoje, f.entity, socios[0].name),
            },
          },
          {
            key: 'guardado',
            label: 'Guardado',
            amount: totals.guardado,
            color: c.investimento,
            icon: <Vault className="size-3.5" />,
            footer: 'Fica na empresa, não é de ninguém',
            edit: { onSave: (v: number) => setReserveTotal(caixas, v, hoje, f.entity) },
          },
          {
            key: 'livre',
            label: 'Lucro livre',
            amount: totals.saldoDisponivel,
            color: c.saldo,
            icon: <WalletCards className="size-3.5" />,
            footer: 'Depois de retiradas e reservas',
            negativeInRed: true,
          },
        ]}
      />

      <MoneyFlow totals={totals} people={pessoas} />

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Para onde foi a receita" subtitle="Despesas e divisão do lucro no período" />
          <CardBody>
            <DonutChart data={slices} centerLabel="Receita" height={210} legend="bottom" />
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader
            title="Comparativo mensal"
            subtitle="Receitas, despesas, lucro e retiradas"
            action={
              months.length > 6 ? (
                <Segmented size="sm" value={barMonths} onChange={setBarMonths} options={[{ value: '6', label: '6 meses' }, { value: '12', label: 'Todos' }]} />
              ) : undefined
            }
          />
          <CardBody>
            <MonthlyBarChart
              data={barData}
              height={318}
              series={[
                { key: 'receita', name: 'Receitas', color: c.receita },
                { key: 'despesa', name: 'Despesas', color: c.despesa },
                { key: 'lucro', name: 'Lucro', color: c.lucro },
                { key: 'retirada', name: 'Retiradas', color: c.retirada },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Evolução financeira"
            subtitle={evoMode === 'acumulado' ? 'Lucro, retiradas e o que ficou na empresa, acumulados' : 'Valores de cada mês'}
            action={
              <Segmented size="sm" value={evoMode} onChange={setEvoMode} options={[{ value: 'acumulado', label: 'Acumulado' }, { value: 'mensal', label: 'Mensal' }]} />
            }
          />
          <CardBody>
            <AreaSeriesChart
              data={evoData}
              height={300}
              series={[
                { key: 'lucro', name: 'Lucro', color: c.lucro },
                { key: 'retirado', name: 'Retirado', color: c.retirada },
                { key: 'caixa', name: 'Ficou na empresa', color: c.saldo },
              ]}
            />
          </CardBody>
        </Card>
        <div className="lg:col-span-2">
          <InsightsCard transactions={f.all} month={referenceMonth(range)} />
        </div>
      </div>

      <Card>
        <CardHeader
          title="Últimas movimentações"
          subtitle="No período selecionado"
          action={
            <Link to="/historico" className="flex items-center gap-0.5 text-[13px] font-medium text-brand hover:underline">
              Ver histórico <ChevronRight className="size-3.5" />
            </Link>
          }
        />
        <CardBody>
          {recent.length ? (
            <TransactionList items={recent} />
          ) : (
            <EmptyState className="py-8" icon={<Wallet className="size-5" />} title="Nenhuma movimentação no período" text="Mude o filtro de período ou registre um lançamento." />
          )}
        </CardBody>
      </Card>
    </div>
  )
}
