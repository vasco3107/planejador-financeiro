import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightLeft, ChevronRight, HandCoins, Landmark, PiggyBank, ShoppingBag, Tags, Wallet } from 'lucide-react'
import { DonutChart } from '@/components/charts/DonutChart'
import { CategoryBars, MonthlyBarChart } from '@/components/charts/SeriesCharts'
import { PeriodFilter } from '@/components/layout/PeriodFilter'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Delta, EmptyState, PageHeader, Progress, Segmented } from '@/components/ui/misc'
import { useCategories, useFinance, usePersonalFinance } from '@/data/hooks'
import { ME, destinedShare, growth, hasShare, shareOfIncome } from '@/domain/finance'
import { formatBRL, formatPercent } from '@/domain/money'
import { PREVIOUS_LABELS, monthLabel } from '@/domain/period'
import { personalMonthlySummaries, totalsByCategory } from '@/domain/reports'
import type { CategoryKind, TransactionType } from '@/domain/types'
import { CategoryManager } from '@/features/categorias/CategoryManager'
import { EditableAmount } from '@/components/ui/EditableAmount'
import { setSimpleTotal, setWithdrawalTotal } from '@/data/quickEdits'
import { todayISO } from '@/domain/period'
import { openTransactionForm } from '@/features/transactions/TransactionForm'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useColors } from '@/lib/colors'
import { cn } from '@/lib/cn'
import { usePeriod, useUI } from '@/store/ui'
import { chartMonths } from '../shared/months'

type Filter = 'todos' | 'entradas' | 'gasto' | 'investimento' | 'reserva'

export const newWithdrawal = () => openTransactionForm('retirada', { description: 'Retirada de lucro' }, 'pessoal')

/** Card de um destino do dinheiro: valor exato lançado + % calculada sobre o que você recebeu. */
function UseCard({ label, cents, pct, color, icon, onAdd, addLabel, onSave }: {
  label: string
  cents: number
  pct: number | null
  color: string
  icon: ReactNode
  onAdd?: () => void
  addLabel?: string
  onSave?: (cents: number) => Promise<void> | void
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-3.5 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
          <span className="grid size-7 place-items-center rounded-lg" style={{ backgroundColor: `${color}1a`, color }}>{icon}</span>
          {label}
        </span>
        <span className="text-sm font-semibold num" style={{ color }}>{formatPercent(pct, 1)}</span>
      </div>
      <div className={cn('mt-2 text-lg font-semibold tracking-tight num sm:text-2xl', cents < 0 && 'text-despesa')}>
        {onSave ? <EditableAmount value={cents} onSave={onSave} label={label} /> : <div className="mt-1 truncate">{formatBRL(cents)}</div>}
      </div>
      <Progress className="mt-2.5" value={pct ?? 0} color={color} height={5} />
      {onAdd && (
        <button type="button" onClick={onAdd} className="mt-3 self-start text-xs font-medium text-brand hover:underline">
          + {addLabel}
        </button>
      )}
    </div>
  )
}

export default function PessoalPage() {
  const { preset, range } = usePeriod()
  const f = usePersonalFinance(range, preset)
  const company = useFinance(range, preset)
  const categories = useCategories()
  const c = useColors()
  const [filter, setFilter] = useState<Filter>('todos')
  const [catsKind, setCatsKind] = useState<CategoryKind | null>(null)

  const { totals, prevTotals } = f
  const hoje = todayISO()
  const entity = useUI((s) => s.entity)
  const pct = (cents: number) => shareOfIncome(cents, totals)
  const hasMyShare = hasShare(company.destination, ME)
  const myShare = destinedShare(company.destination, ME)

  const months = useMemo(() => chartMonths(range, f.all), [range, f.all])
  const summaries = useMemo(() => personalMonthlySummaries(f.all, months), [f.all, months])
  const monthly = summaries.map((s) => ({ month: s.month, entradas: s.entradas, gasto: s.gasto, investido: s.investido, reservado: s.reservado }))

  const byExpenseCat = useMemo(() => totalsByCategory(f.inPeriod, categories ?? [], 'gasto'), [f.inPeriod, categories])

  const uses = [
    { key: 'gasto', name: 'Gastei', color: c.despesa, cents: totals.gasto },
    { key: 'inv', name: 'Investi', color: c.investimento, cents: totals.investido },
    { key: 'res', name: 'Guardei', color: c.reserva, cents: totals.reservado },
    { key: 'livre', name: 'Livre', color: c.pessoal, cents: Math.max(totals.livre, 0) },
  ]

  const list = f.inPeriod.filter((t) =>
    filter === 'todos' ? true : filter === 'entradas' ? t.type === 'retirada' || t.type === 'pessoal' : t.type === (filter as TransactionType),
  )

  return (
    <div className="space-y-5 animate-fade-in lg:space-y-6">
      <PageHeader
        title="Minha carteira"
        subtitle="Lance o valor exato do que recebeu, gastou, investiu e guardou. Junta o que você tira do CPF e do CNPJ."
        actions={
          <>
            <Button variant="outline" icon={<Tags className="size-4" />} onClick={() => setCatsKind('gasto')}>Categorias</Button>
            <Button variant="outline" icon={<HandCoins className="size-4" />} onClick={() => openTransactionForm('pessoal')}>Outro ganho</Button>
            <Button icon={<ArrowRightLeft className="size-4" />} onClick={newWithdrawal}>Registrar retirada</Button>
          </>
        }
      />
      <PeriodFilter className="sm:items-start" />

      {/* O que entrou */}
      <Card>
        <CardBody className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-end sm:justify-between sm:pt-5">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
              <Wallet className="size-4 text-pessoal" /> Recebi no período
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight num">{formatBRL(totals.entradas)}</p>
            <div className="mt-1.5">
              <Delta value={prevTotals ? growth(totals.entradas, prevTotals.entradas) : null} label={PREVIOUS_LABELS[preset] || undefined} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:text-right">
            <dt className="text-ink-3">Retiradas da empresa</dt>
            <dd className="font-semibold num sm:text-right">
              <EditableAmount value={totals.retiradas} label="Retiradas da empresa" onSave={(v) => setWithdrawalTotal(f.inPeriod, ME, v, hoje, entity)} />
            </dd>
            <dt className="text-ink-3">Outros ganhos</dt>
            <dd className="font-semibold num sm:text-right">
              <EditableAmount value={totals.outrosGanhos} label="Outros ganhos" onSave={(v) => setSimpleTotal(f.inPeriod, 'pessoal', v, hoje, { description: 'Outros ganhos', categoryId: 'pf-outros' })} />
            </dd>
            {totals.aReceber > 0 && (
              <>
                <dt className="text-ink-3">A receber</dt>
                <dd className="font-semibold text-ink-2 num">{formatBRL(totals.aReceber)}</dd>
              </>
            )}
          </dl>
        </CardBody>
      </Card>

      {/* O que você fez com o dinheiro: valores lançados → % calculada */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <UseCard label="Gastei" cents={totals.gasto} pct={pct(totals.gasto)} color={c.despesa} icon={<ShoppingBag className="size-4" />} onAdd={() => openTransactionForm('gasto')} addLabel="Lançar gasto" onSave={(v) => setSimpleTotal(f.inPeriod, 'gasto', v, hoje, { description: 'Gastos', categoryId: 'pg-outros' })} />
        <UseCard label="Investi" cents={totals.investido} pct={pct(totals.investido)} color={c.investimento} icon={<Landmark className="size-4" />} onAdd={() => openTransactionForm('investimento')} addLabel="Lançar investimento" onSave={(v) => setSimpleTotal(f.inPeriod, 'investimento', v, hoje, { description: 'Investimentos' })} />
        <UseCard label="Guardei" cents={totals.reservado} pct={pct(totals.reservado)} color={c.reserva} icon={<PiggyBank className="size-4" />} onAdd={() => openTransactionForm('reserva')} addLabel="Lançar valor guardado" onSave={(v) => setSimpleTotal(f.inPeriod, 'reserva', v, hoje, { description: 'Guardado' })} />
        <UseCard label="Livre" cents={totals.livre} pct={pct(totals.livre)} color={c.pessoal} icon={<Wallet className="size-4" />} />
      </div>
      {totals.entradas === 0 && totals.gasto + totals.investido + totals.reservado > 0 && (
        <p className="-mt-2 text-xs text-ink-3">Sem entradas no período — as porcentagens aparecem quando houver retiradas ou ganhos lançados.</p>
      )}

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Para onde foi o seu dinheiro" subtitle="% sobre o que você recebeu no período" />
          <CardBody>
            <DonutChart data={uses} centerLabel="Recebido" height={200} legend="bottom" />
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Mês a mês" subtitle="Quanto entrou e quanto você gastou, investiu e guardou" />
          <CardBody>
            <MonthlyBarChart
              data={monthly}
              height={290}
              series={[
                { key: 'entradas', name: 'Recebi', color: c.pessoal },
                { key: 'gasto', name: 'Gastei', color: c.despesa },
                { key: 'investido', name: 'Investi', color: c.investimento },
                { key: 'reservado', name: 'Guardei', color: c.reserva },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      {/* Porcentagens por mês */}
      <Card>
        <CardHeader title="Porcentagens por mês" subtitle="Cada valor dividido pelo que você recebeu no mês" />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3 uppercase">
                  <th className="py-2 font-semibold">Mês</th>
                  <th className="py-2 text-right font-semibold">Recebi</th>
                  <th className="py-2 text-right font-semibold">Gastei</th>
                  <th className="py-2 text-right font-semibold">Investi</th>
                  <th className="py-2 text-right font-semibold">Guardei</th>
                  <th className="py-2 text-right font-semibold">Livre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...summaries].reverse().filter((s) => s.entradas + s.gasto + s.investido + s.reservado > 0).map((s) => {
                  const p = (v: number) => shareOfIncome(v, s)
                  const cell = (v: number) => (
                    <td className="py-2.5 text-right num">
                      <span className="font-medium text-ink">{formatPercent(p(v), 1)}</span>
                      <span className="block text-xs text-ink-3">{formatBRL(v)}</span>
                    </td>
                  )
                  return (
                    <tr key={s.month}>
                      <td className="py-2.5">{monthLabel(s.month)}</td>
                      <td className="py-2.5 text-right font-semibold num">{formatBRL(s.entradas)}</td>
                      {cell(s.gasto)}
                      {cell(s.investido)}
                      {cell(s.reservado)}
                      {cell(s.livre)}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Gastos por categoria"
            subtitle={totals.gasto > 0 ? `${formatBRL(totals.gasto)} no período` : undefined}
            action={<Button variant="ghost" size="sm" onClick={() => setCatsKind('gasto')}>Categorias</Button>}
          />
          <CardBody>
            {byExpenseCat.length ? (
              <CategoryBars items={byExpenseCat.map((x) => ({ ...x, key: x.categoryId }))} formatValue={formatBRL} max={8} />
            ) : (
              <EmptyState className="py-6" icon={<ShoppingBag className="size-5" />} title="Nenhum gasto no período" action={<Button variant="outline" onClick={() => openTransactionForm('gasto')}>Lançar gasto</Button>} />
            )}
          </CardBody>
        </Card>

        {hasMyShare ? (
          <Card className="lg:col-span-3">
            <CardHeader
              title="Sua parte do lucro da empresa"
              subtitle="Pela divisão do lucro × quanto você já retirou no período"
              action={
                <Link to="/socios" className="flex items-center gap-0.5 text-[13px] font-medium text-brand hover:underline">
                  Divisão <ChevronRight className="size-3.5" />
                </Link>
              }
            />
            <CardBody>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-3">Já retirado</p>
                  <p className="text-2xl font-semibold num">{formatBRL(totals.retiradas)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ink-3">Sua parte</p>
                  <p className="text-lg font-semibold text-ink-2 num">{formatBRL(myShare)}</p>
                </div>
              </div>
              <Progress className="mt-3" value={myShare ? (totals.retiradas / myShare) * 100 : 0} color={c.retirada} height={10} />
              <p className="mt-2 text-xs text-ink-3">
                {myShare === 0
                  ? 'A empresa não teve lucro a dividir no período.'
                  : totals.retiradas >= myShare
                    ? `Você já retirou toda a sua parte${totals.retiradas > myShare ? ` e mais ${formatBRL(totals.retiradas - myShare)}` : ''}.`
                    : `Ainda pode retirar ${formatBRL(myShare - totals.retiradas)}.`}
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="lg:col-span-3" />
        )}
      </div>

      <Card>
        <CardHeader
          title="Lançamentos"
          subtitle={`${list.length} no período`}
        />
        <CardBody>
          <div className="-mx-1 mb-4 overflow-x-auto px-1 scrollbar-none">
            <Segmented
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'entradas', label: 'Entradas' },
                { value: 'gasto', label: 'Gastos' },
                { value: 'investimento', label: 'Investi' },
                { value: 'reserva', label: 'Guardei' },
              ]}
            />
          </div>
          {list.length ? (
            <TransactionList items={list} />
          ) : (
            <EmptyState icon={<Wallet className="size-5" />} title="Nada por aqui no período" />
          )}
        </CardBody>
      </Card>

      <CategoryManager kind={catsKind ?? 'gasto'} open={catsKind !== null} onClose={() => setCatsKind(null)} />
    </div>
  )
}
