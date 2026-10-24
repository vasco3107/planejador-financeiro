import { useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  Calendar,
  Car,
  Check,
  GraduationCap,
  Home,
  Laptop,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plane,
  Plus,
  Rocket,
  Shield,
  Target,
  Trash2,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { differenceInCalendarMonths, parseISO } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, confirmDialog } from '@/components/ui/Dialog'
import { DateInput } from '@/components/ui/DateInput'
import { Field, Input, MoneyInput, Textarea } from '@/components/ui/Form'
import { Badge, EmptyState, PageHeader, Progress, Segmented, Stat } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { useGoals, useProjects, useTransactions } from '@/data/hooks'
import { goalsRepo, projectsRepo } from '@/data/repositories'
import { PALETTE } from '@/data/seed'
import { computePersonalTotals } from '@/domain/finance'
import { formatBRL, formatPercent } from '@/domain/money'
import { formatDateBR, todayISO } from '@/domain/period'
import { isPersonal, type Goal, type Project, type Transaction } from '@/domain/types'
import { openTransactionForm } from '@/features/transactions/TransactionForm'
import { TransactionList } from '@/features/transactions/TransactionList'
import { useColors } from '@/lib/colors'
import { cn } from '@/lib/cn'

export const GOAL_ICONS: Record<string, LucideIcon> = {
  target: Target,
  laptop: Laptop,
  plane: Plane,
  shield: Shield,
  rocket: Rocket,
  briefcase: Briefcase,
  home: Home,
  car: Car,
  graduation: GraduationCap,
  trending: TrendingUp,
  piggy: PiggyBank,
}

type Mode = 'projeto' | 'meta'
type Item = (Project | Goal) & { color?: string; icon?: string; description?: string }

interface Props {
  mode: Mode
}

export function TargetsPage({ mode }: Props) {
  const isProj = mode === 'projeto'
  const projects = useProjects()
  const goals = useGoals()
  const txs = useTransactions()
  const c = useColors()
  const [filter, setFilter] = useState<'ativos' | 'arquivados'>('ativos')
  const [editing, setEditing] = useState<Item | 'new' | null>(null)
  const [detail, setDetail] = useState<Item | null>(null)

  const items: Item[] = (isProj ? projects : goals) ?? []
  const key = isProj ? 'projectId' : 'goalId'
  const reservas = useMemo(() => (txs ?? []).filter((t) => t.type === 'reserva' && t.status === 'confirmado'), [txs])
  const savedBy = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of reservas) {
      const id = t[key]
      if (id) m.set(id, (m.get(id) ?? 0) + t.amountCents)
    }
    return m
  }, [reservas, key])

  const visible = items.filter((i) => (filter === 'ativos' ? !i.archived : i.archived))
  const active = items.filter((i) => !i.archived)
  const totalTarget = active.reduce((s, i) => s + i.targetCents, 0)
  const totalSaved = active.reduce((s, i) => s + (savedBy.get(i.id) ?? 0), 0)

  // Dinheiro da sua carteira que ainda não foi gasto, investido nem guardado
  const livre = useMemo(() => computePersonalTotals((txs ?? []).filter(isPersonal)).livre, [txs])
  const accent = isProj ? c.reserva : c.lucro

  const remove = async (item: Item) => {
    const n = savedBy.get(item.id) ?? 0
    const ok = await confirmDialog({
      title: `Excluir ${isProj ? 'projeto' : 'meta'} "${item.name}"?`,
      danger: true,
      confirmLabel: 'Excluir',
      message: n
        ? `As reservas já feitas (${formatBRL(n)}) continuam no histórico, sem vínculo. Se quiser guardar o registro, prefira arquivar.`
        : 'Esta ação não pode ser desfeita.',
    })
    if (!ok) return
    await (isProj ? projectsRepo.remove(item.id) : goalsRepo.remove(item.id))
    toast(`${isProj ? 'Projeto' : 'Meta'} excluído`)
  }

  const toggleArchive = async (item: Item) => {
    await (isProj ? projectsRepo.update(item.id, { archived: !item.archived }) : goalsRepo.update(item.id, { archived: !item.archived }))
    toast(item.archived ? 'Restaurado' : 'Arquivado')
  }

  const reserve = (item: Item) =>
    openTransactionForm('reserva', {
      description: `Reserva: ${item.name}`,
      ...(isProj ? { projectId: item.id } : { goalId: item.id }),
    })

  return (
    <div className="space-y-5 animate-fade-in lg:space-y-6">
      <PageHeader
        title={isProj ? 'Projetos Futuros' : 'Metas Financeiras'}
        subtitle={isProj ? 'Separe parte do que você retira da empresa para cada projeto.' : 'Seus objetivos pessoais e quanto já foi reservado para cada um.'}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {isProj ? 'Novo projeto' : 'Nova meta'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label={isProj ? 'Projetos ativos' : 'Metas ativas'} value={active.length} color={accent} icon={isProj ? <Rocket className="size-4" /> : <Target className="size-4" />} />
        <Stat label="Valor necessário" value={formatBRL(totalTarget)} sub="Soma dos objetivos ativos" />
        <Stat label="Já reservado" value={formatBRL(totalSaved)} sub={totalTarget ? `${formatPercent((totalSaved / totalTarget) * 100, 1)} do total` : '—'} />
        <Stat
          label="Livre na sua carteira"
          value={formatBRL(livre)}
          color={c.reserva}
          icon={<PiggyBank className="size-4" />}
          sub="Ainda não gasto, investido nem guardado"
        />
      </div>

      <div className="flex items-center justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ativos', label: `Ativos (${active.length})` },
            { value: 'arquivados', label: `Arquivados (${items.length - active.length})` },
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={isProj ? <Rocket className="size-5" /> : <Target className="size-5" />}
            title={filter === 'ativos' ? (isProj ? 'Nenhum projeto ainda' : 'Nenhuma meta ainda') : 'Nada arquivado'}
            text={
              filter === 'ativos'
                ? isProj
                  ? 'Ex.: "Novo SaaS" com meta de R$ 20.000. Reserve parte das suas retiradas todo mês até chegar lá.'
                  : 'Ex.: "Comprar novo computador" com meta de R$ 8.000.'
                : undefined
            }
            action={filter === 'ativos' && <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>{isProj ? 'Criar projeto' : 'Criar meta'}</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <TargetCard
              key={item.id}
              item={item}
              mode={mode}
              saved={savedBy.get(item.id) ?? 0}
              reservas={reservas.filter((t) => t[key] === item.id)}
              onReserve={() => reserve(item)}
              onEdit={() => setEditing(item)}
              onArchive={() => toggleArchive(item)}
              onDelete={() => remove(item)}
              onOpen={() => setDetail(item)}
            />
          ))}
        </div>
      )}

      <TargetForm mode={mode} value={editing} onClose={() => setEditing(null)} />

      <Dialog open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ''} description="Reservas feitas para este objetivo" size="lg">
        {detail && (
          <TransactionList items={reservas.filter((t) => t[key] === detail.id).sort((a, b) => b.date.localeCompare(a.date))} />
        )}
        {detail && !reservas.some((t) => t[key] === detail.id) && <p className="py-6 text-center text-sm text-ink-3">Nenhuma reserva ainda.</p>}
      </Dialog>
    </div>
  )
}

function TargetCard({
  item,
  mode,
  saved,
  reservas,
  onReserve,
  onEdit,
  onArchive,
  onDelete,
  onOpen,
}: {
  item: Item
  mode: Mode
  saved: number
  reservas: Transaction[]
  onReserve: () => void
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
  onOpen: () => void
}) {
  const c = useColors()
  const [menu, setMenu] = useState(false)
  const color = mode === 'projeto' ? (item as Project).color : c.lucro
  const Icon = mode === 'meta' ? (GOAL_ICONS[(item as Goal).icon] ?? Target) : Rocket
  const pct = item.targetCents ? (saved / item.targetCents) * 100 : 0
  const done = pct >= 100
  const remaining = Math.max(item.targetCents - saved, 0)

  // Ritmo: média mensal das reservas e previsão de conclusão
  let forecast: string | null = null
  if (!done && reservas.length > 0) {
    const first = reservas.reduce((m, t) => (t.date < m ? t.date : m), reservas[0].date)
    const months = Math.max(differenceInCalendarMonths(parseISO(todayISO()), parseISO(first)) + 1, 1)
    const perMonth = saved / months
    if (perMonth > 0) {
      const n = Math.ceil(remaining / perMonth)
      forecast = `No ritmo atual (${formatBRL(Math.round(perMonth))}/mês), faltam ~${n} ${n === 1 ? 'mês' : 'meses'}`
    }
  }
  let perMonthNeeded: string | null = null
  if (!done && item.deadline) {
    const m = differenceInCalendarMonths(parseISO(item.deadline), parseISO(todayISO()))
    perMonthNeeded = m > 0 ? `Para o prazo: ${formatBRL(Math.ceil(remaining / m))}/mês` : 'Prazo vencido'
  }

  return (
    <Card className={cn('flex flex-col', item.archived && 'opacity-70')}>
      <div className="flex items-start gap-3 p-5 pb-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon className="size-5" />
        </span>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate font-semibold">{item.name}</p>
          <p className="truncate text-xs text-ink-3">
            {item.description || (item.deadline ? `Prazo: ${formatDateBR(item.deadline)}` : `${reservas.length} reserva${reservas.length === 1 ? '' : 's'}`)}
          </p>
        </button>
        <div className="relative">
          <Button size="icon-sm" variant="ghost" aria-label="Opções" onClick={() => setMenu((m) => !m)} icon={<MoreHorizontal className="size-4" />} />
          {menu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
              <div className="absolute top-full right-0 z-30 mt-1 w-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop animate-pop-in">
                {[
                  { label: 'Editar', icon: Pencil, fn: onEdit },
                  { label: item.archived ? 'Restaurar' : 'Arquivar', icon: item.archived ? ArchiveRestore : Archive, fn: onArchive },
                  { label: 'Excluir', icon: Trash2, fn: onDelete, danger: true },
                ].map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => {
                      setMenu(false)
                      a.fn()
                    }}
                    className={cn('flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2', a.danger && 'text-despesa')}
                  >
                    <a.icon className="size-3.5" /> {a.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 px-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl font-semibold tracking-tight num">{formatBRL(saved)}</span>
          <span className="text-sm text-ink-3 num">de {formatBRL(item.targetCents)}</span>
        </div>
        <Progress className="mt-2.5" value={pct} color={done ? c.receita : color} height={10} />
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={cn('font-semibold num', done ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-2')}>
            {formatPercent(pct, 2)}
          </span>
          {done ? (
            <Badge color={c.receita}><Check className="size-3" /> Concluído</Badge>
          ) : (
            <span className="text-ink-3 num">Faltam {formatBRL(remaining)}</span>
          )}
        </div>
        {(forecast || perMonthNeeded) && (
          <div className="mt-3 space-y-1 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-3">
            {perMonthNeeded && <p className="flex items-center gap-1.5"><Calendar className="size-3" /> {perMonthNeeded}</p>}
            {forecast && <p className="flex items-center gap-1.5"><TrendingUp className="size-3" /> {forecast}</p>}
          </div>
        )}
      </div>

      <div className="p-5 pt-4">
        <Button variant="secondary" className="w-full" icon={<PiggyBank className="size-4" />} onClick={onReserve} disabled={item.archived}>
          Reservar valor
        </Button>
      </div>
    </Card>
  )
}

function TargetForm({ mode, value, onClose }: { mode: Mode; value: Item | 'new' | null; onClose: () => void }) {
  const isProj = mode === 'projeto'
  const open = value !== null
  const editing = value !== 'new' && value !== null ? value : null
  const [name, setName] = useState('')
  const [target, setTarget] = useState(0)
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [icon, setIcon] = useState('target')
  const [error, setError] = useState<string | null>(null)
  const [lastKey, setLastKey] = useState<string | null>(null)

  // Reinicia o formulário quando abre para outro item
  const k = open ? (editing?.id ?? 'new') : null
  if (k !== lastKey) {
    setLastKey(k)
    setName(editing?.name ?? '')
    setTarget(editing?.targetCents ?? 0)
    setDeadline(editing?.deadline ?? '')
    setDescription(editing?.description ?? '')
    setColor((editing as Project | null)?.color ?? PALETTE[name.length % PALETTE.length])
    setIcon((editing as Goal | null)?.icon ?? 'target')
    setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Dê um nome.')
    if (target <= 0) return setError('Informe o valor da meta.')
    const base = { name: name.trim(), targetCents: target, deadline: deadline || undefined }
    if (isProj) {
      const data = { ...base, color, description: description.trim() || undefined }
      if (editing) await projectsRepo.update(editing.id, data)
      else await projectsRepo.create(data)
    } else {
      const data = { ...base, icon }
      if (editing) await goalsRepo.update(editing.id, data)
      else await goalsRepo.create(data)
    }
    toast(editing ? 'Alterações salvas' : isProj ? 'Projeto criado' : 'Meta criada')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar ${isProj ? 'projeto' : 'meta'}` : isProj ? 'Novo projeto' : 'Nova meta'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="target-form">{editing ? 'Salvar' : 'Criar'}</Button>
        </>
      }
    >
      <form id="target-form" onSubmit={submit} className="grid gap-4" noValidate>
        <Field label={isProj ? 'Nome do projeto' : 'Objetivo'} htmlFor="tg-name">
          <Input id="tg-name" autoFocus maxLength={60} placeholder={isProj ? 'Ex.: Novo SaaS' : 'Ex.: Comprar novo computador'} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor da meta">
            <MoneyInput value={target} onChange={setTarget} />
          </Field>
          <Field label="Prazo (opcional)" htmlFor="tg-deadline">
            <DateInput id="tg-deadline" value={deadline} onChange={setDeadline} />
          </Field>
        </div>
        {isProj ? (
          <>
            <Field label="Descrição (opcional)" htmlFor="tg-desc">
              <Textarea id="tg-desc" maxLength={140} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Cor">
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((p) => (
                  <button key={p} type="button" aria-label={`Cor ${p}`} onClick={() => setColor(p)} className={cn('grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-surface', color === p && 'ring-2 ring-ink')} style={{ backgroundColor: p }}>
                    {color === p && <Check className="size-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </Field>
          </>
        ) : (
          <Field label="Ícone">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(GOAL_ICONS).map(([k, I]) => (
                <button
                  key={k}
                  type="button"
                  aria-label={k}
                  onClick={() => setIcon(k)}
                  className={cn('grid size-10 place-items-center rounded-xl border transition-colors', icon === k ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-2 hover:bg-surface-2')}
                >
                  <I className="size-4.5" />
                </button>
              ))}
            </div>
          </Field>
        )}
        {error && <p className="text-sm font-medium text-despesa">{error}</p>}
      </form>
    </Dialog>
  )
}
