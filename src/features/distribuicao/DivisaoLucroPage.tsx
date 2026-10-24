import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { addMonths, subMonths } from 'date-fns'
import { AlertCircle, Building2, CheckCircle2, ChevronLeft, History, RotateCcw, Save, Trash2, UserRound, Users, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { confirmDialog } from '@/components/ui/Dialog'
import { Field, Input, MoneyInput, Select } from '@/components/ui/Form'
import { Badge, PageHeader, Skeleton } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { useDistributions, usePartners, useTransactions } from '@/data/hooks'
import { distributionsRepo } from '@/data/repositories'
import {
  CAIXA_BUCKET,
  TOTAL_BPS,
  allocate,
  bpsToInput,
  configForMonth,
  parsePercentToBps,
  validateDistribution,
} from '@/domain/distribution'
import { groupByMonth, profitBase } from '@/domain/finance'
import { formatBRL, formatBps } from '@/domain/money'
import { currentMonthKey, monthLabel, monthsBetween, toISO } from '@/domain/period'
import type { DistributionBucket } from '@/domain/types'
import { bucketColor, useColors } from '@/lib/colors'
import { cn } from '@/lib/cn'

interface DraftBucket extends DistributionBucket {
  input: string
}

const toDraft = (b: DistributionBucket[]): DraftBucket[] => b.map((x) => ({ ...x, input: bpsToInput(x.bps) }))

const t = {
  title: 'Divisão do lucro',
  subtitle: 'Quanto do lucro da empresa é seu, de cada sócio e quanto fica no caixa. A soma precisa ser exatamente 100%.',
  rule: 'Percentuais aplicados ao lucro de cada mês',
  base: 'Lucro',
  empty: 'Sem lucro registrado neste mês ainda.',
  simLabel: 'Lucro do mês',
}

/** Editor da divisão do lucro da empresa entre você, sócios e o caixa (versionada por mês). */
export default function DivisaoLucroPage() {
  const scope = 'empresa'
  const configs = useDistributions(scope)
  const txs = useTransactions()
  const partners = usePartners()
  const c = useColors()

  const current = useMemo(() => (configs ? configForMonth(configs, currentMonthKey()) : null), [configs])
  const [draft, setDraft] = useState<DraftBucket[] | null>(null)
  const [from, setFrom] = useState(currentMonthKey())
  const [simBase, setSimBase] = useState(1000000)

  useEffect(() => {
    if (current && draft === null) setDraft(toDraft(current.buckets))
  }, [current, draft])

  if (!configs || !draft) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const buckets: DistributionBucket[] = draft.map(({ input: _i, ...b }) => b)
  const validation = validateDistribution(buckets)
  const dirty = JSON.stringify(buckets) !== JSON.stringify(current?.buckets ?? [])

  const update = (i: number, patch: Partial<DraftBucket>) => setDraft((d) => d!.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const setPercent = (i: number, text: string) => {
    const bps = parsePercentToBps(text)
    update(i, { input: text, ...(bps !== null ? { bps } : {}) })
  }
  const push = (b: DistributionBucket) => setDraft([...draft, { ...b, input: bpsToInput(b.bps) }])

  const completeWith = (i: number) => {
    const bps = Math.max(0, draft[i].bps + validation.diffBps)
    update(i, { bps, input: bpsToInput(bps) })
  }

  const save = async () => {
    if (!validation.valid) return
    await distributionsRepo.save(scope, from, buckets.map((b) => ({ ...b, name: b.name.trim() })))
    toast(`Divisão salva a partir de ${monthLabel(from).toLowerCase()}`)
    setDraft(null)
  }

  const monthTxs = groupByMonth(txs ?? []).get(currentMonthKey()) ?? []
  const monthBase = profitBase(monthTxs)
  const monthAlloc = validation.valid ? allocate(Math.max(monthBase, 0), buckets) : []
  const simAlloc = validation.valid ? allocate(Math.max(simBase, 0), buckets) : []

  const now = new Date()
  const monthOptions = [
    ...new Set([...monthsBetween(toISO(subMonths(now, 24)), toISO(addMonths(now, 12))), ...configs.map((x) => x.effectiveFrom)]),
  ]
    .sort()
    .reverse()

  // Pessoas/destinos que ainda podem ser adicionados à divisão da empresa
  const missingMe = !draft.some((b) => b.role === 'retirada' && !b.partnerId)
  const missingCaixa = !draft.some((b) => b.role === 'caixa')
  const missingPartners = (partners ?? []).filter((p) => !p.archived && !draft.some((b) => b.partnerId === p.id))

  const badgeFor = (b: DistributionBucket) =>
    b.role === 'retirada' ? (b.partnerId ? 'Sócio' : 'Vai para sua carteira')
      : b.role === 'caixa' ? 'Capital da empresa'
      : null

  return (
    <div className="space-y-5 animate-fade-in lg:space-y-6">
      <Link to="/socios" className="inline-flex items-center gap-1 text-sm font-medium text-ink-3 hover:text-ink">
        <ChevronLeft className="size-4" /> Sócios
      </Link>
      <PageHeader title={t.title} subtitle={t.subtitle} />

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Regra"
            subtitle={t.rule}
            action={
              dirty && (
                <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setDraft(null)}>
                  Desfazer
                </Button>
              )
            }
          />
          <CardBody className="space-y-5">
            <div>
              <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-surface-3">
                {buckets
                  .filter((b) => b.bps > 0)
                  .map((b) => (
                    <div
                      key={b.key}
                      className="h-full transition-[width] duration-300 first:rounded-l-full last:rounded-r-full"
                      style={{ width: `${Math.min(b.bps, TOTAL_BPS) / (Math.max(validation.totalBps, TOTAL_BPS) / 100)}%`, backgroundColor: bucketColor(b, c) }}
                    />
                  ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-ink-3">0%</span>
                <span className={cn('font-semibold num', validation.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-despesa')}>
                  Total: {formatBps(validation.totalBps)}
                </span>
                <span className="text-ink-3">100%</span>
              </div>
            </div>

            <ul className="space-y-3">
              {draft.map((b, i) => {
                const color = bucketColor(b, c)
                // Nomes de pessoas vêm do cadastro; "Fica na empresa" é fixo
                const locked = b.role === 'retirada' || b.role === 'caixa'
                const badge = badgeFor(b)
                return (
                  <li key={b.key} className="rounded-2xl border border-line p-3 sm:p-3.5">
                    <div className="flex items-center gap-1.5 sm:gap-2.5">
                      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <Input
                        aria-label="Nome do destino"
                        readOnly={locked}
                        className={cn('h-10 border-transparent bg-transparent px-1.5 font-medium', !locked && 'hover:border-line')}
                        placeholder="Nome do destino (ex.: Reserva de emergência)"
                        value={b.name}
                        maxLength={40}
                        onChange={(e) => update(i, { name: e.target.value })}
                      />
                      <div className="relative w-[4.75rem] shrink-0 sm:w-24">
                        <Input
                          aria-label={`Percentual de ${b.name || 'destino'}`}
                          inputMode="decimal"
                          className="h-10 pr-7 text-right font-semibold num"
                          value={b.input}
                          aria-invalid={parsePercentToBps(b.input) === null}
                          onChange={(e) => setPercent(i, e.target.value)}
                          onBlur={() => update(i, { input: bpsToInput(b.bps) })}
                        />
                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-ink-3">%</span>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Remover ${b.name}`}
                        disabled={draft.length <= 1}
                        onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                        icon={<Trash2 className="size-3.5" />}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 sm:pl-5">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={0.5}
                        value={b.bps / 100}
                        aria-label={`Ajustar ${b.name}`}
                        onChange={(e) => setPercent(i, e.target.value.replace('.', ','))}
                        className="h-1.5 min-w-32 flex-1 cursor-pointer"
                        style={{ accentColor: color }}
                      />
                      {badge && <Badge color={color}>{badge}</Badge>}
                      {!validation.valid && validation.diffBps !== 0 && b.bps + validation.diffBps >= 0 && (
                        <button type="button" onClick={() => completeWith(i)} className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                          <Wand2 className="size-3" /> {validation.diffBps > 0 ? 'Completar' : 'Ajustar'}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="flex flex-wrap gap-2">
              {missingMe && (
                <Button variant="outline" icon={<UserRound className="size-4" />} onClick={() => push({ key: 'minha-parte', name: 'Você', color: c.retirada, bps: 0, role: 'retirada' })}>
                  Sua parte
                </Button>
              )}
              {missingPartners.map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  icon={<Users className="size-4" />}
                  onClick={() => push({ key: `socio-${p.id}`, name: p.name, color: p.color, bps: 0, role: 'retirada', partnerId: p.id })}
                >
                  Parte de {p.name}
                </Button>
              ))}
              {missingCaixa && (
                <Button variant="outline" icon={<Building2 className="size-4" />} onClick={() => push(CAIXA_BUCKET)}>
                  Fica na empresa
                </Button>
              )}
              {(partners ?? []).length === 0 && (
                <Link to="/socios" className="self-center text-xs font-medium text-brand hover:underline">
                  Cadastre um sócio para incluir a parte dele
                </Link>
              )}
            </div>

            <div role="status" className={cn('flex items-start gap-3 rounded-2xl p-4 text-sm', validation.valid ? 'bg-receita/10' : 'bg-despesa/10')}>
              {validation.valid ? (
                <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-receita" />
              ) : (
                <AlertCircle className="mt-0.5 size-4.5 shrink-0 text-despesa" />
              )}
              <div>
                <p className="font-medium">{validation.valid ? 'Distribuição completa: 100%.' : validation.message}</p>
                {!validation.valid && <p className="mt-0.5 text-ink-3">Só é possível salvar quando a soma for exatamente 100%.</p>}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-end sm:justify-between">
              <Field label="Válida a partir de" htmlFor="dist-from" hint="Meses anteriores mantêm a regra da época." className="sm:w-56">
                <Select id="dist-from" value={from} onChange={(e) => setFrom(e.target.value)}>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </Select>
              </Field>
              <Button size="lg" icon={<Save className="size-4" />} disabled={!validation.valid || (!dirty && configs.some((x) => x.effectiveFrom === from))} onClick={save}>
                Salvar
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-5 lg:col-span-2 lg:space-y-6">
          <Card>
            <CardHeader title="Simulador" subtitle="Veja o cálculo antes de salvar" />
            <CardBody className="space-y-4">
              <Field label={t.simLabel}>
                <MoneyInput value={simBase} onChange={setSimBase} />
              </Field>
              <div className="space-y-2 rounded-2xl bg-surface-2 p-4 text-sm">
                {validation.valid ? (
                  simAlloc.map((a) => (
                    <Row key={a.key} label={`${a.name || 'Sem nome'} · ${formatBps(a.bps)}`} value={formatBRL(a.cents)} color={bucketColor(a, c)} />
                  ))
                ) : (
                  <p className="text-xs text-despesa">Complete 100% para simular.</p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`Este mês · ${monthLabel(currentMonthKey())}`} subtitle={`${t.base} até agora: ${formatBRL(monthBase)}`} />
            <CardBody>
              {monthBase <= 0 ? (
                <p className="text-sm text-ink-3">{t.empty}</p>
              ) : validation.valid ? (
                <div className="space-y-2 text-sm">
                  {monthAlloc.map((a) => (
                    <Row key={a.key} label={a.name || 'Sem nome'} value={formatBRL(a.cents)} color={bucketColor(a, c)} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-despesa">Complete 100% para ver a prévia.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><History className="size-4 text-ink-3" /> Histórico de regras</span>}
          subtitle="Cada mês usa a regra vigente naquele mês. Mudar os percentuais não reescreve o passado."
        />
        <CardBody>
          <ul className="divide-y divide-line">
            {[...configs].reverse().map((cfg) => (
              <li key={cfg.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Desde {monthLabel(cfg.effectiveFrom).toLowerCase()}</span>
                  {cfg.id === current?.id && <Badge color={c.saldo}>Vigente</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {cfg.buckets.map((b) => (
                    <Badge key={b.key} color={bucketColor(b, c)}>{b.name} {formatBps(b.bps)}</Badge>
                  ))}
                  {configs.length > 1 && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Excluir versão"
                      onClick={async () => {
                        const ok = await confirmDialog({
                          title: 'Excluir esta versão?',
                          danger: true,
                          confirmLabel: 'Excluir',
                          message: 'Os meses cobertos por ela passarão a usar a regra anterior (ou a primeira regra existente).',
                        })
                        if (ok) {
                          await distributionsRepo.remove(cfg.id)
                          setDraft(null)
                          toast('Versão excluída')
                        }
                      }}
                      icon={<Trash2 className="size-3.5" />}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-ink-2">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-medium text-ink num">{value}</span>
    </div>
  )
}
