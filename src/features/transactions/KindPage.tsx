import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDownLeft, ArrowUpRight, Plus, Search } from 'lucide-react'
import { DonutChart } from '@/components/charts/DonutChart'
import { MonthlyBarChart } from '@/components/charts/SeriesCharts'
import { PeriodFilter } from '@/components/layout/PeriodFilter'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Form'
import { Delta, EmptyState, PageHeader, Stat } from '@/components/ui/misc'
import { useCategories, useFinance } from '@/data/hooks'
import { computeTotals, filterByRange, groupByMonth } from '@/domain/finance'
import { formatBRL } from '@/domain/money'
import { PREVIOUS_LABELS, previousRange } from '@/domain/period'
import { totalsByCategory } from '@/domain/reports'
import type { CategoryKind } from '@/domain/types'
import { useColors } from '@/lib/colors'
import { usePeriod } from '@/store/ui'
import { chartMonths } from '../shared/months'
import { BillingCard } from './BillingCard'
import { openTransactionForm } from './TransactionForm'
import { TransactionList } from './TransactionList'

/** Página base de Receitas e Despesas (mesma estrutura, dados do tipo). */
export function KindPage({ kind, extraActions }: { kind: CategoryKind; extraActions?: ReactNode }) {
  const { preset, range } = usePeriod()
  const f = useFinance(range, preset)
  const categories = useCategories()
  const c = useColors()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('')
  const isReceita = kind === 'receita'
  const color = isReceita ? c.receita : c.despesa

  const list = useMemo(() => f.inPeriod.filter((t) => t.type === kind), [f.inPeriod, kind])
  const total = isReceita ? f.totals.receita : f.totals.despesa
  const pending = isReceita ? f.totals.receitaPendente : f.totals.despesaPendente
  const prev = previousRange(preset, range)
  const prevTotal = prev ? computeTotals(filterByRange(f.all, prev))[isReceita ? 'receita' : 'despesa'] : null
  const growth = prevTotal ? ((total - prevTotal) / prevTotal) * 100 : null

  const byCat = useMemo(() => totalsByCategory(list, categories ?? [], kind), [list, categories, kind])
  const months = useMemo(() => chartMonths(range, f.all), [range, f.all])
  const monthly = useMemo(() => {
    const g = groupByMonth(f.all.filter((t) => t.type === kind))
    return months.map((m) => ({
      month: m,
      valor: (g.get(m) ?? []).reduce((s, t) => s + (isReceita ? t.amountCents : t.status === 'confirmado' ? t.amountCents : 0), 0),
    }))
  }, [f.all, months, kind, isReceita])

  const filtered = list.filter(
    (t) =>
      (!cat || t.categoryId === cat) &&
      (!q || `${t.description} ${t.source ?? ''} ${t.note ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  )
  // Tudo que foi lançado no período (recebido + a receber)
  const lancado = list.reduce((s, t) => s + t.amountCents, 0)
  // Maior lançamento do período (recebido ou não)
  const biggest = list.reduce<(typeof list)[number] | null>((m, t) => (!m || t.amountCents > m.amountCents ? t : m), null)
  const Icon = isReceita ? ArrowDownLeft : ArrowUpRight

  return (
    <div className="space-y-5 animate-fade-in lg:space-y-6">
      <PageHeader
        title={isReceita ? 'Receitas' : 'Despesas'}
        subtitle={isReceita ? 'Lance o faturamento e vá registrando o que cair na conta' : 'Custos operacionais — investimentos e reservas ficam de fora'}
        actions={
          <>
            {extraActions}
            <Button icon={<Plus className="size-4" />} onClick={() => openTransactionForm(kind)}>
              {isReceita ? 'Nova receita' : 'Nova despesa'}
            </Button>
          </>
        }
      />
      <PeriodFilter className="sm:items-start" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat
          label={isReceita ? 'Faturamento no período' : 'Despesas no período'}
          value={formatBRL(total)}
          color={color}
          icon={<Icon className="size-4" />}
          sub={<Delta value={growth} inverse={!isReceita} label={PREVIOUS_LABELS[preset] || undefined} />}
        />
        <Stat
          label={isReceita ? 'Já caiu na conta' : 'Ainda a pagar'}
          value={formatBRL(isReceita ? f.totals.receitaRecebida : pending)}
          color={isReceita ? c.receita : c.reserva}
          sub={isReceita ? `${formatBRL(pending)} ainda a receber · ${formatBRL(f.totals.taxaPlataforma)} de taxas` : 'Despesas pendentes'}
        />
        <Stat label="Lançamentos" value={list.length} sub={`Ticket médio ${formatBRL(list.length ? Math.round(lancado / list.length) : 0)}`} />
        <Stat
          label={isReceita ? 'Maior receita' : 'Maior despesa'}
          value={biggest ? formatBRL(biggest.amountCents) : '—'}
          sub={<span className="block truncate">{biggest?.description ?? 'Sem lançamentos'}</span>}
        />
      </div>

      {isReceita && <BillingCard receitas={list} taxas={f.totals.taxaPlataforma} range={range} />}

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Por categoria" subtitle="Participação no período" />
          <CardBody>
            <DonutChart
              data={byCat.map((b) => ({ key: b.categoryId, name: b.name, color: b.color, cents: b.cents }))}
              centerLabel={isReceita ? 'Receita' : 'Despesas'}
              height={200}
              legend="bottom"
            />
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Mês a mês" subtitle={isReceita ? 'Faturamento por mês' : 'Despesa paga por mês'} />
          <CardBody>
            <MonthlyBarChart data={monthly} height={300} series={[{ key: 'valor', name: isReceita ? 'Receitas' : 'Despesas', color }]} showLegend={false} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Lançamentos" subtitle={`${filtered.length} no período`} />
        <CardBody>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
              <Input className="pl-10" placeholder="Buscar por descrição ou origem…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select
              aria-label="Filtrar por categoria"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink sm:w-56"
            >
              <option value="">Todas as categorias</option>
              {(categories ?? []).filter((x) => x.kind === kind).map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </div>
          {filtered.length ? (
            <TransactionList items={filtered} />
          ) : (
            <EmptyState
              icon={<Icon className="size-5" />}
              title={list.length ? 'Nada encontrado' : `Nenhuma ${isReceita ? 'receita' : 'despesa'} no período`}
              text={list.length ? 'Ajuste a busca ou o filtro de categoria.' : 'Registre um lançamento ou mude o período.'}
              action={!list.length && (
                <Button variant="outline" icon={<Plus className="size-4" />} onClick={() => openTransactionForm(kind)}>
                  Adicionar
                </Button>
              )}
            />
          )}
        </CardBody>
      </Card>
    </div>
  )
}
