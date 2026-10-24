import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { create } from 'zustand'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { DateInput } from '@/components/ui/DateInput'
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Form'
import { Segmented } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { useCategories, useGoals, usePartners, useProjects, useTransactions } from '@/data/hooks'
import { computeTotals, pendingOf, receivedOf } from '@/domain/finance'
import { formatBRL } from '@/domain/money'
import { COMPANY_TYPES, PLATFORM_FEE_CATEGORY } from '@/domain/types'
import { transactionsRepo, type TransactionInput } from '@/data/repositories'
import { formatDateBR, todayISO } from '@/domain/period'
import { outsidePeriod, revealDate, useUI } from '@/store/ui'
import type { Transaction, TransactionType } from '@/domain/types'
import { TYPE_META } from '@/lib/colors'
import { EXPENSE_KIND_LABELS, statusLabel } from '@/lib/labels'
import { openReceipts } from './PaymentsDialog'

// ---------- Estado global do formulário (abre de qualquer tela) ----------

interface FormState {
  open: boolean
  type: TransactionType
  editing: Transaction | null
  preset: Partial<TransactionInput> | null
  /** Quais tipos o seletor mostra: os da empresa ou os da sua carteira */
  scope: 'empresa' | 'pessoal'
}

const useTxForm = create<FormState>(() => ({ open: false, type: 'receita', editing: null, preset: null, scope: 'empresa' }))

export function openTransactionForm(type: TransactionType, preset?: Partial<TransactionInput>, scope?: FormState['scope']) {
  const defaultScope = type === 'receita' || type === 'despesa' || type === 'caixa' || (type === 'retirada' && preset?.partnerId) ? 'empresa' : 'pessoal'
  useTxForm.setState({ open: true, type, editing: null, preset: preset ?? null, scope: scope ?? defaultScope })
}
export function editTransaction(tx: Transaction) {
  useTxForm.setState({ open: true, type: tx.type, editing: tx, preset: null })
}
const closeForm = () => useTxForm.setState({ open: false })

// ---------- Validação ----------

const schema = z
  .object({
    type: z.enum(['receita', 'despesa', 'investimento', 'reserva', 'retirada', 'pessoal', 'gasto', 'caixa']),
    amountCents: z.number().int().positive('Informe um valor maior que zero.'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.'),
    description: z.string().trim().min(1, 'Descreva o lançamento.').max(120, 'Máximo de 120 caracteres.'),
    categoryId: z.string().optional(),
    source: z.string().trim().max(80).optional(),
    expenseKind: z.enum(['fixa', 'variavel', 'recorrente', 'pontual']).optional(),
    status: z.enum(['confirmado', 'pendente']),
    target: z.string().optional(),
    partnerId: z.string().optional(),
    entity: z.enum(['cpf', 'cnpj']).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.type === 'receita' || v.type === 'despesa' || v.type === 'pessoal' || v.type === 'gasto') && !v.categoryId) {
      ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Escolha uma categoria.' })
    }
  })

type FormValues = z.infer<typeof schema>

/** Empresa: só o básico — o que entra, o que sai e o lucro que é retirado */
const COMPANY_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'receita', label: 'Receita' },
  { value: 'despesa', label: 'Despesa' },
  { value: 'retirada', label: 'Retirada' },
  { value: 'caixa', label: 'Guardar' },
]
/** Sua carteira: o que você recebe e para onde destina */
const PERSONAL_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'retirada', label: 'Retirada' },
  { value: 'pessoal', label: 'Ganho' },
  { value: 'gasto', label: 'Gasto' },
  { value: 'investimento', label: 'Investi' },
  { value: 'reserva', label: 'Guardei' },
]

function toValues(type: TransactionType, tx: Transaction | null, preset: Partial<TransactionInput> | null): FormValues {
  const src = tx ?? preset ?? {}
  return {
    type,
    amountCents: src.amountCents ?? 0,
    date: src.date ?? todayISO(),
    description: src.description ?? '',
    categoryId: src.categoryId ?? '',
    source: src.source ?? '',
    expenseKind: src.expenseKind ?? (type === 'despesa' ? 'variavel' : undefined),
    // Receita nasce como "a receber": o que entrou é lançado nos recebimentos
    status: src.status ?? (type === 'receita' ? 'pendente' : 'confirmado'),
    target: src.projectId ? `p:${src.projectId}` : src.goalId ? `g:${src.goalId}` : '',
    partnerId: src.partnerId ?? '',
    entity: src.entity ?? useUI.getState().entity,
    note: src.note ?? '',
  }
}

export function TransactionFormHost() {
  const { open, type, editing, preset, scope } = useTxForm()
  const partners = usePartners()
  const categories = useCategories()
  const projects = useProjects()
  const goals = useGoals()
  const allTxs = useTransactions()
  const isPersonalForm = scope === 'pessoal'

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toValues(type, editing, preset) })

  useEffect(() => {
    if (open) reset(toValues(type, editing, preset))
  }, [open, type, editing, preset, reset])

  const currentType = watch('type')
  const cats = useMemo(
    () => (categories ?? []).filter((c) => c.kind === currentType).sort((a, b) => Number(a.name === 'Outros') - Number(b.name === 'Outros') || a.name.localeCompare(b.name)),
    [categories, currentType],
  )

  const onSubmit = async (v: FormValues) => {
    const isCat = v.type === 'receita' || v.type === 'despesa' || v.type === 'pessoal' || v.type === 'gasto'
    const data: TransactionInput = {
      type: v.type,
      amountCents: v.amountCents,
      date: v.date,
      description: v.description.trim(),
      categoryId: isCat ? v.categoryId : undefined,
      source: v.type === 'receita' || v.type === 'investimento' || v.type === 'pessoal' ? v.source?.trim() || undefined : undefined,
      expenseKind: v.type === 'despesa' ? v.expenseKind : undefined,
      status: v.status,
      projectId: v.type === 'reserva' && v.target?.startsWith('p:') ? v.target.slice(2) : undefined,
      goalId: v.type === 'reserva' && v.target?.startsWith('g:') ? v.target.slice(2) : undefined,
      // Lançamentos da empresa ficam na conta aberta (CPF ou CNPJ)
      entity: COMPANY_TYPES.includes(v.type) ? (v.entity ?? 'cpf') : undefined,
      // Na carteira a retirada é sempre sua
      partnerId: v.type === 'retirada' && !isPersonalForm && v.partnerId ? v.partnerId : undefined,
      note: v.note?.trim() || undefined,
    }
    if (editing) await transactionsRepo.update(editing.id, data)
    else await transactionsRepo.create(data)
    const done = editing ? 'Lançamento atualizado' : v.type === 'retirada' ? 'Retirada registrada' : 'Lançamento registrado'
    // Avisa quando a data cai fora do período exibido — senão o lançamento parece não ter entrado
    const outside = outsidePeriod(data.date)
    if (outside) toast(`${done} em ${formatDateBR(data.date)}, fora do período exibido (${outside}).`, 'info', { label: 'Mostrar', onClick: () => revealDate(data.date) })
    else toast(done)
    closeForm()
  }

  const hasReceipts = !!editing?.payments?.length
  const meta = TYPE_META[currentType]
  // Saldo que a empresa ainda tem para retirar (todo o período, excluindo esta retirada se estiver em edição)
  const companySaldo = computeTotals((allTxs ?? []).filter((t) => COMPANY_TYPES.includes(t.type) && t.id !== editing?.id)).saldoDisponivel
  const activeProjects = (projects ?? []).filter((p) => !p.archived || p.id === editing?.projectId)
  const activeGoals = (goals ?? []).filter((g) => !g.archived || g.id === editing?.goalId)

  return (
    <Dialog
      open={open}
      onClose={closeForm}
      title={editing ? 'Editar lançamento' : meta.newTitle}
      description={
        currentType === 'investimento'
          ? 'Quanto do seu dinheiro você aplicou. Fica só na sua carteira.'
          : currentType === 'reserva'
            ? 'Dinheiro que você guardou. Pode ir para um projeto ou meta, ou ficar só guardado.'
            : currentType === 'gasto'
              ? 'O que você gastou como pessoa física. Não afeta a empresa.'
            : currentType === 'caixa'
              ? 'Lucro guardado no caixa da empresa: sai do lucro livre e não vai para você nem para os sócios.'
            : currentType === 'retirada'
              ? (isPersonalForm ? 'Lucro que você tirou da empresa. Entra na sua carteira.' : 'Lucro que sai da empresa para você ou para um sócio. Não é despesa: o lucro não muda, só o saldo na empresa.')
              : currentType === 'pessoal'
                ? 'Renda da pessoa física que não vem da empresa. Não aparece nos números da empresa.'
                : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={closeForm}>
            Cancelar
          </Button>
          <Button type="submit" form="tx-form" disabled={isSubmitting}>
            {editing ? 'Salvar alterações' : 'Adicionar'}
          </Button>
        </>
      }
    >
      <form id="tx-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {!editing && (
          <Segmented
            className="w-full [&>button]:flex-1"
            value={currentType}
            onChange={(t) => {
              setValue('type', t)
              setValue('categoryId', '')
              setValue('expenseKind', t === 'despesa' ? 'variavel' : undefined)
            }}
            options={isPersonalForm ? PERSONAL_OPTIONS : COMPANY_OPTIONS}
            size="sm"
          />
        )}

        <Field label="Valor" error={errors.amountCents?.message}>
          <Controller
            control={control}
            name="amountCents"
            render={({ field }) => <MoneyInput large autoFocus value={field.value} onChange={field.onChange} invalid={!!errors.amountCents} />}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data" htmlFor="tx-date" error={errors.date?.message}>
            <Controller control={control} name="date" render={({ field }) => <DateInput id="tx-date" value={field.value} onChange={field.onChange} invalid={!!errors.date} />} />
          </Field>
          <Field
            label="Status"
            htmlFor="tx-status"
            hint={hasReceipts ? 'Definido pelos recebimentos lançados.' : undefined}
          >
            <Select id="tx-status" disabled={hasReceipts} {...register('status')}>
              <option value="confirmado">{statusLabel(currentType, 'confirmado')}</option>
              <option value="pendente">{statusLabel(currentType, 'pendente')}</option>
            </Select>
          </Field>
        </div>

        <Field label="Descrição" htmlFor="tx-desc" error={errors.description?.message}>
          <Input
            id="tx-desc"
            placeholder={
              currentType === 'receita' ? 'Ex.: Assinaturas de setembro' :
              currentType === 'despesa' ? 'Ex.: Plano de API da OpenAI' :
              currentType === 'investimento' ? 'Ex.: Aporte Tesouro Selic' :
              currentType === 'retirada' ? 'Ex.: Distribuição de lucros de setembro' :
              currentType === 'pessoal' ? 'Ex.: Projeto freelance' :
              currentType === 'gasto' ? 'Ex.: Mercado do mês' :
              currentType === 'caixa' ? 'Ex.: Reserva de caixa' : 'Ex.: Poupança de setembro'
            }
            {...register('description')}
            aria-invalid={!!errors.description}
          />
        </Field>

        {(currentType === 'receita' || currentType === 'despesa') && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Categoria"
              htmlFor="tx-cat"
              error={errors.categoryId?.message}
              hint={watch('categoryId') === PLATFORM_FEE_CATEGORY ? 'Taxa retida antes do repasse: abate do que falta receber.' : undefined}
            >
              <Select id="tx-cat" {...register('categoryId')} aria-invalid={!!errors.categoryId}>
                <option value="">Selecione…</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            {currentType === 'receita' ? (
              <Field label="Origem da receita" htmlFor="tx-src">
                <Input id="tx-src" placeholder="Cliente, produto, plataforma…" {...register('source')} />
              </Field>
            ) : (
              <Field label="Tipo de despesa" htmlFor="tx-kind">
                <Select id="tx-kind" {...register('expenseKind')}>
                  {Object.entries(EXPENSE_KIND_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        {currentType === 'gasto' && (
          <Field label="Categoria" htmlFor="tx-cat" error={errors.categoryId?.message}>
            <Select id="tx-cat" {...register('categoryId')} aria-invalid={!!errors.categoryId}>
              <option value="">Selecione…</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        )}

        {currentType === 'pessoal' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria" htmlFor="tx-cat" error={errors.categoryId?.message}>
              <Select id="tx-cat" {...register('categoryId')} aria-invalid={!!errors.categoryId}>
                <option value="">Selecione…</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Fonte pagadora" htmlFor="tx-src">
              <Input id="tx-src" placeholder="Empresa, cliente, banco…" {...register('source')} />
            </Field>
          </div>
        )}

        {!isPersonalForm && (
          <Field label="Conta" htmlFor="tx-entity" hint="Em qual conta esse lançamento corre">
            <Select id="tx-entity" {...register('entity')}>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
            </Select>
          </Field>
        )}

        {currentType === 'retirada' && !isPersonalForm && (
          <Field label="Para quem" htmlFor="tx-partner" hint={watch('partnerId') ? 'Retirada do sócio: sai do saldo da empresa e não entra na sua carteira.' : 'Retirada sua: entra na sua carteira pessoal.'}>
            <Select id="tx-partner" {...register('partnerId')}>
              <option value="">Você</option>
              {(partners ?? []).filter((p) => !p.archived || p.id === editing?.partnerId).map((p) => (
                <option key={p.id} value={p.id}>{p.name} (sócio)</option>
              ))}
            </Select>
          </Field>
        )}

        {currentType === 'retirada' && (
          <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs text-ink-2">
            Saldo disponível da empresa para retirar: <strong className={companySaldo < 0 ? 'text-despesa num' : 'text-ink num'}>{formatBRL(companySaldo)}</strong>
            {watch('amountCents') > companySaldo && companySaldo >= 0 && (
              <span className="mt-1 block text-reserva">Este valor é maior que o saldo disponível — o saldo da empresa ficará negativo.</span>
            )}
          </p>
        )}

        {currentType === 'investimento' && (
          <Field label="Onde foi investido" htmlFor="tx-inst">
            <Input id="tx-inst" placeholder="Corretora, banco, ativo…" {...register('source')} />
          </Field>
        )}

        {currentType === 'reserva' && (
          <Field
            label="Para quê (opcional)"
            htmlFor="tx-target"
            error={errors.target?.message}
          >
            <Select id="tx-target" {...register('target')} aria-invalid={!!errors.target}>
              <option value="">Só guardar (sem projeto ou meta)</option>
              {activeProjects.length > 0 && (
                <optgroup label="Projetos futuros">
                  {activeProjects.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}
                </optgroup>
              )}
              {activeGoals.length > 0 && (
                <optgroup label="Metas">
                  {activeGoals.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}
                </optgroup>
              )}
            </Select>
          </Field>
        )}

        {currentType === 'receita' && (
          <div className="rounded-xl bg-surface-2 px-3.5 py-3 text-xs text-ink-2">
            {editing ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Recebido: <strong className="text-ink num">{formatBRL(receivedOf(editing))}</strong> de {formatBRL(editing.amountCents)}
                  {pendingOf(editing) > 0 && <> · faltam <strong className="text-ink num">{formatBRL(pendingOf(editing))}</strong></>}
                </span>
                <button
                  type="button"
                  className="font-medium text-brand hover:underline"
                  onClick={() => {
                    closeForm()
                    openReceipts(editing.id)
                  }}
                >
                  Registrar recebimento
                </button>
              </div>
            ) : (
              'Recebeu em partes ou com taxa? Salve pelo valor total e depois registre cada valor que cair na conta.'
            )}
          </div>
        )}

        <Field label="Observação (opcional)" htmlFor="tx-note">
          <Textarea id="tx-note" {...register('note')} />
        </Field>
      </form>
    </Dialog>
  )
}
