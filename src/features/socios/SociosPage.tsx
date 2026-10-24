import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Archive, ArchiveRestore, ArrowRightLeft, Check, ChevronRight, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { MonthlyBarChart } from '@/components/charts/SeriesCharts'
import { PeriodFilter } from '@/components/layout/PeriodFilter'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Dialog, confirmDialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Form'
import { Badge, EmptyState, PageHeader, Progress, Stat } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { useFinance, usePartners } from '@/data/hooks'
import { partnersRepo } from '@/data/repositories'
import { PALETTE } from '@/data/seed'
import { ME, computeTotals, destinedShare, groupByMonth, hasShare } from '@/domain/finance'
import { formatBRL, formatBps, formatPercent } from '@/domain/money'
import type { Partner } from '@/domain/types'
import { openTransactionForm } from '@/features/transactions/TransactionForm'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useColors } from '@/lib/colors'
import { cn } from '@/lib/cn'
import { usePeriod } from '@/store/ui'
import { chartMonths } from '../shared/months'

export default function SociosPage() {
  const { preset, range } = usePeriod()
  const f = useFinance(range, preset)
  const partners = usePartners()
  const c = useColors()
  const [editing, setEditing] = useState<Partner | 'new' | null>(null)

  const all = useMemo(() => partners ?? [], [partners])
  const active = all.filter((p) => !p.archived)
  const { totals, destination } = f
  const retiradoSocios = totals.retirado - (totals.retiradoPor[ME] ?? 0)

  // Uma linha por pessoa: você + cada sócio (ativos, ou arquivados que retiraram no período)
  const people = [
    { id: ME, name: 'Você', color: c.retirada, archived: false },
    ...all.filter((p) => !p.archived || (totals.retiradoPor[p.id] ?? 0) > 0),
  ].map((p) => {
    const alloc = destination.allocations.find((a) => a.role === 'retirada' && (a.partnerId ?? ME) === p.id)
    return {
      ...p,
      configured: hasShare(destination, p.id),
      bps: alloc?.bps ?? 0,
      share: destinedShare(destination, p.id),
      withdrawn: totals.retiradoPor[p.id] ?? 0,
    }
  })

  const months = useMemo(() => chartMonths(range, f.all), [range, f.all])
  const monthly = useMemo(() => {
    const g = groupByMonth(f.all.filter((t) => t.type === 'retirada'))
    return months.map((m) => {
      const byWho = computeTotals(g.get(m) ?? []).retiradoPor
      return { month: m, ...Object.fromEntries(people.map((p) => [p.id, byWho[p.id] ?? 0])) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.all, months, partners])

  const caixa = destination.allocations.filter((a) => a.role === 'caixa')
  const caixaCents = caixa.reduce((s, a) => s + a.cents, 0)
  const caixaBps = caixa.reduce((s, a) => s + a.bps, 0)

  const partnerWithdrawals = f.inPeriod.filter((t) => t.type === 'retirada' && t.partnerId)

  const withdraw = (partnerId?: string) =>
    openTransactionForm('retirada', { description: 'Retirada de lucro', partnerId: partnerId ?? active[0]?.id }, 'empresa')

  const remove = async (p: Partner) => {
    const count = await partnersRepo.withdrawals(p.id)
    if (count > 0) {
      const ok = await confirmDialog({
        title: `Arquivar ${p.name}?`,
        confirmLabel: 'Arquivar',
        message: `${p.name} tem ${count} retirada${count > 1 ? 's' : ''} registrada${count > 1 ? 's' : ''}. Para não perder o histórico, o sócio será arquivado em vez de excluído. As retiradas continuam contando no saldo da empresa.`,
      })
      if (!ok) return
      await partnersRepo.update(p.id, { archived: true })
      toast('Sócio arquivado')
      return
    }
    const ok = await confirmDialog({ title: `Excluir ${p.name}?`, danger: true, confirmLabel: 'Excluir', message: 'Nenhuma retirada registrada para este sócio.' })
    if (!ok) return
    await partnersRepo.remove(p.id)
    toast('Sócio excluído')
  }

  return (
    <div className="space-y-5 animate-fade-in lg:space-y-6">
      <PageHeader
        title="Sócios e divisão do lucro"
        subtitle="Quanto do lucro é de cada um e quanto cada um já retirou. Retiradas não são despesa: só saem do saldo da empresa. As suas vão para a sua carteira."
        actions={
          <>
            <Button variant="outline" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Novo sócio</Button>
            <Button icon={<ArrowRightLeft className="size-4" />} onClick={() => withdraw()} disabled={active.length === 0}>
              Retirada de sócio
            </Button>
          </>
        }
      />
      <PeriodFilter className="sm:items-start" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Lucro da empresa" value={formatBRL(totals.lucro)} color={c.lucro} sub="No período selecionado" />
        <Stat label="Retirado por todos" value={formatBRL(totals.retirado)} color={c.retirada} icon={<Users className="size-4" />} sub={totals.lucro > 0 ? `${formatPercent((totals.retirado / totals.lucro) * 100, 1)} do lucro` : undefined} />
        <Stat label="Retirado pelos sócios" value={formatBRL(retiradoSocios)} sub={`Você retirou ${formatBRL(totals.retiradoPor[ME] ?? 0)}`} />
        <Stat
          label="Disponível na empresa"
          value={<span className={totals.saldoDisponivel < 0 ? 'text-despesa' : undefined}>{formatBRL(totals.saldoDisponivel)}</span>}
          color={c.saldo}
          sub="Lucro do período que ainda não foi retirado"
        />
      </div>

      <Card>
        <CardHeader
          title="Divisão do lucro"
          subtitle="Parte de cada pessoa pela divisão × quanto já retirou no período"
          action={
            <Link to="/divisao" className="flex items-center gap-0.5 text-[13px] font-medium text-brand hover:underline">
              Ajustar % <ChevronRight className="size-3.5" />
            </Link>
          }
        />
        <CardBody>
          <ul className="divide-y divide-line">
            {people.map((p) => {
              const pct = p.share ? (p.withdrawn / p.share) * 100 : 0
              const rest = p.share - p.withdrawn
              return (
                <li key={p.id} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.name}
                      {p.configured && <Badge color={p.color}>{formatBps(p.bps)} do lucro</Badge>}
                      {p.archived && <Badge>Arquivado</Badge>}
                    </span>
                    <span className="text-sm text-ink-2 num">
                      <strong className="text-ink">{formatBRL(p.withdrawn)}</strong>
                      {p.configured && <> de {formatBRL(p.share)}</>}
                    </span>
                  </div>
                  {p.configured ? (
                    <>
                      <Progress className="mt-2" value={pct} color={p.color} height={6} />
                      <p className={cn('mt-1.5 text-xs', rest < 0 ? 'text-reserva' : 'text-ink-3')}>
                        {p.share === 0
                          ? 'Sem lucro a distribuir no período.'
                          : rest > 0
                            ? `Ainda pode retirar ${formatBRL(rest)}.`
                            : rest === 0
                              ? 'Retirou exatamente a parte dele(a).'
                              : `Retirou ${formatBRL(-rest)} a mais que a parte definida.`}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-ink-3">Sem % definida na divisão do lucro — mostrando só o que foi retirado.</p>
                  )}
                </li>
              )
            })}
          </ul>
          {caixa.length > 0 && (
            <p className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: c.saldo }} />
                Fica na empresa <Badge color={c.saldo}>{formatBps(caixaBps)} do lucro</Badge>
              </span>
              <strong className="text-ink num">{formatBRL(caixaCents)}</strong>
            </p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-3">
          <CardHeader title="Retiradas mês a mês" subtitle="Por pessoa" />
          <CardBody>
            <MonthlyBarChart data={monthly} height={280} series={people.map((p) => ({ key: p.id, name: p.name, color: p.color }))} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Cadastro de sócios" subtitle={`${active.length} ativo${active.length === 1 ? '' : 's'}`} />
          <CardBody>
            {all.length === 0 ? (
              <EmptyState
                className="py-6"
                icon={<Users className="size-5" />}
                title="Nenhum sócio cadastrado"
                text="Cadastre seu sócio para registrar as retiradas de lucro dele."
                action={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Cadastrar sócio</Button>}
              />
            ) : (
              <ul className="divide-y divide-line">
                {all.map((p) => (
                  <li key={p.id} className={cn('flex items-center gap-2 py-2.5', p.archived && 'opacity-60')}>
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                    {!p.archived && (
                      <Button size="sm" variant="secondary" onClick={() => withdraw(p.id)}>Retirada</Button>
                    )}
                    <Button size="icon-sm" variant="ghost" aria-label={`Editar ${p.name}`} onClick={() => setEditing(p)} icon={<Pencil className="size-3.5" />} />
                    {p.archived ? (
                      <Button size="icon-sm" variant="ghost" aria-label="Restaurar" onClick={() => partnersRepo.update(p.id, { archived: false })} icon={<ArchiveRestore className="size-3.5" />} />
                    ) : (
                      <Button size="icon-sm" variant="ghost" className="hover:text-despesa" aria-label={`Remover ${p.name}`} onClick={() => remove(p)} icon={<Trash2 className="size-3.5" />} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Retiradas dos sócios no período" subtitle={`${partnerWithdrawals.length} lançamentos`} />
        <CardBody>
          {partnerWithdrawals.length ? (
            <TransactionList items={partnerWithdrawals} />
          ) : (
            <EmptyState className="py-8" icon={<Archive className="size-5" />} title="Nenhuma retirada de sócio no período" />
          )}
        </CardBody>
      </Card>

      <PartnerForm value={editing} onClose={() => setEditing(null)} used={all.map((p) => p.color)} />
    </div>
  )
}

function PartnerForm({ value, onClose, used }: { value: Partner | 'new' | null; onClose: () => void; used: string[] }) {
  const editing = value && value !== 'new' ? value : null
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[1])
  const [lastKey, setLastKey] = useState<string | null>(null)
  const k = value ? (editing?.id ?? 'new') : null
  if (k !== lastKey) {
    setLastKey(k)
    setName(editing?.name ?? '')
    setColor(editing?.color ?? PALETTE.find((p) => !used.includes(p) && p !== '#db2777') ?? PALETTE[1])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (editing) await partnersRepo.update(editing.id, { name: name.trim(), color })
    else await partnersRepo.create(name, color)
    toast(editing ? 'Sócio atualizado' : 'Sócio cadastrado')
    onClose()
  }

  return (
    <Dialog
      open={value !== null}
      onClose={onClose}
      title={editing ? 'Editar sócio' : 'Novo sócio'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="partner-form" disabled={!name.trim()}>{editing ? 'Salvar' : 'Cadastrar'}</Button>
        </>
      }
    >
      <form id="partner-form" onSubmit={submit} className="grid gap-4">
        <Field label="Nome" htmlFor="pt-name">
          <Input id="pt-name" autoFocus maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do sócio" />
        </Field>
        <Field label="Cor nos gráficos">
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((p) => (
              <button key={p} type="button" aria-label={`Cor ${p}`} onClick={() => setColor(p)} className={cn('grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-surface', color === p && 'ring-2 ring-ink')} style={{ backgroundColor: p }}>
                {color === p && <Check className="size-3.5 text-white" />}
              </button>
            ))}
          </div>
        </Field>
      </form>
    </Dialog>
  )
}
