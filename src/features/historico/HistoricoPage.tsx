import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, History, Plus, Search, Trash2, X } from 'lucide-react'
import { PeriodFilter } from '@/components/layout/PeriodFilter'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Form'
import { Badge, EmptyState, PageHeader } from '@/components/ui/misc'
import { useCategories, useFinance } from '@/data/hooks'
import { receiptState } from '@/domain/finance'
import { formatBRL } from '@/domain/money'
import { formatDateBR } from '@/domain/period'
import { COMPANY_TYPES, type Transaction, type TransactionStatus, type TransactionType } from '@/domain/types'
import { deleteTransactions } from '@/features/transactions/actions'
import { openTransactionForm, editTransaction } from '@/features/transactions/TransactionForm'
import { AmountText, RowMenu, TYPE_ICON, useTxLabels } from '@/features/transactions/TransactionList'
import { exportTransactionsCSV } from '@/lib/export/csv'
import { TYPE_META, typeColor, useColors } from '@/lib/colors'
import { cn } from '@/lib/cn'
import { RECEIPT_LABELS, statusLabel } from '@/lib/labels'
import { usePeriod } from '@/store/ui'

type SortKey = 'date' | 'type' | 'description' | 'category' | 'amount' | 'status'
const PAGE = 50

function Th({ k, sort, onSort, children, className }: { k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; children: React.ReactNode; className?: string }) {
  return (
    <th className={cn('px-3 py-3 text-left text-xs font-semibold tracking-wide text-ink-3 uppercase', className)} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(k)} className={cn('inline-flex items-center gap-1 hover:text-ink', className?.includes('text-right') && 'flex-row-reverse')}>
        {children}
        {sort.key === k ? (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  )
}

export default function HistoricoPage() {
  const { preset, range } = usePeriod()
  const f = useFinance(range, preset)
  const categories = useCategories()
  const c = useColors()
  const label = useTxLabels()
  const [q, setQ] = useState('')
  const [type, setType] = useState<TransactionType | ''>('')
  const [cat, setCat] = useState('')
  const [status, setStatus] = useState<TransactionStatus | ''>('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: -1 })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(PAGE)

  const tColor = (t: TransactionType) => typeColor(t, c)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = f.inPeriod
      .filter((t) => !type || t.type === type)
      .filter((t) => !cat || t.categoryId === cat)
      .filter((t) => !status || t.status === status)
      .map((t) => ({ t, category: label(t).category }))
      .filter(({ t, category }) =>
        !needle ||
        `${t.description} ${category} ${t.source ?? ''} ${t.note ?? ''} ${formatBRL(t.amountCents)}`.toLowerCase().includes(needle),
      )
    const get = (r: { t: Transaction; category: string }): string | number => {
      switch (sort.key) {
        case 'date': return r.t.date + r.t.createdAt
        case 'type': return r.t.type
        case 'description': return r.t.description.toLowerCase()
        case 'category': return r.category.toLowerCase()
        case 'amount': return r.t.amountCents
        case 'status': return r.t.status
      }
    }
    return list.sort((a, b) => {
      const x = get(a)
      const y = get(b)
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
    })
  }, [f.inPeriod, q, type, cat, status, sort, label])

  const shown = rows.slice(0, limit)
  const sum = (tp: TransactionType) => rows.filter((r) => r.t.type === tp && r.t.status === 'confirmado').reduce((s, r) => s + r.t.amountCents, 0)
  const hasFilters = q || type || cat || status
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'date' || key === 'amount' ? -1 : 1 }))
  const allSelected = shown.length > 0 && shown.every((r) => selected.has(r.t.id))

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Histórico financeiro"
        subtitle="Movimentações da empresa: receitas, despesas e retiradas de lucro. Aportes e reservas ficam na sua carteira."
        actions={
          <>
            <Button variant="outline" icon={<Download className="size-4" />} disabled={!rows.length} onClick={() => exportTransactionsCSV(rows.map((r) => r.t), categories ?? [], label)}>
              CSV
            </Button>
            <Button icon={<Plus className="size-4" />} onClick={() => openTransactionForm('receita')}>Novo lançamento</Button>
          </>
        }
      />
      <PeriodFilter className="sm:items-start" />

      <Card>
        <div className="grid gap-2 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(3,11rem)_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
            <Input className="pl-10" placeholder="Pesquisar descrição, categoria, valor…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} />
          </div>
          <Select aria-label="Tipo" value={type} onChange={(e) => { setType(e.target.value as TransactionType | ''); setCat('') }}>
            <option value="">Todos os tipos</option>
            {COMPANY_TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].plural}</option>)}
          </Select>
          <Select aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas as categorias</option>
            {(categories ?? [])
              .filter((x) => x.kind !== 'pessoal' && (!type || x.kind === type))
              .map((x) => <option key={x.id} value={x.id}>{x.name}{!type ? ` (${x.kind})` : ''}</option>)}
          </Select>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as TransactionStatus | '')}>
            <option value="">Todos os status</option>
            <option value="confirmado">Confirmado</option>
            <option value="pendente">Pendente</option>
          </Select>
          {hasFilters && (
            <Button variant="ghost" icon={<X className="size-4" />} className="h-11" onClick={() => { setQ(''); setType(''); setCat(''); setStatus('') }}>
              Limpar
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-4 py-3 text-xs text-ink-3">
          <span><strong className="text-ink num">{rows.length}</strong> movimentações</span>
          <span>Receitas <strong className="text-ink num">{formatBRL(sum('receita'))}</strong></span>
          <span>Despesas <strong className="text-ink num">{formatBRL(sum('despesa'))}</strong></span>
          <span>Retiradas <strong className="text-ink num">{formatBRL(sum('retirada'))}</strong></span>
          {selected.size > 0 && (
            <span className="ml-auto flex items-center gap-2">
              {selected.size} selecionado{selected.size > 1 ? 's' : ''}
              <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={async () => { if (await deleteTransactions([...selected])) setSelected(new Set()) }}>
                Excluir
              </Button>
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<History className="size-5" />}
            title={hasFilters ? 'Nada encontrado com esses filtros' : 'Nenhuma movimentação no período'}
            text={hasFilters ? 'Tente outros termos ou limpe os filtros.' : 'Mude o período ou registre um lançamento.'}
          />
        ) : (
          <>
            {/* Desktop: tabela */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-surface-2/60">
                  <tr>
                    <th className="w-10 pl-4">
                      <input
                        type="checkbox"
                        aria-label="Selecionar todos"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(shown.map((r) => r.t.id)))}
                        className="size-4 accent-[var(--brand)]"
                      />
                    </th>
                    <Th sort={sort} onSort={toggleSort} k="date">Data</Th>
                    <Th sort={sort} onSort={toggleSort} k="type">Tipo</Th>
                    <Th sort={sort} onSort={toggleSort} k="description">Descrição</Th>
                    <Th sort={sort} onSort={toggleSort} k="category">Categoria</Th>
                    <Th sort={sort} onSort={toggleSort} k="amount" className="text-right">Valor</Th>
                    <Th sort={sort} onSort={toggleSort} k="status">Status</Th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map(({ t, category }) => {
                    const Icon = TYPE_ICON[t.type]
                    const catColor = t.categoryId ? categories?.find((x) => x.id === t.categoryId)?.color : undefined
                    return (
                      <tr key={t.id} className={cn('group transition-colors hover:bg-surface-2', selected.has(t.id) && 'bg-brand-soft/60')}>
                        <td className="pl-4">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${t.description}`}
                            checked={selected.has(t.id)}
                            onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n })}
                            className="size-4 accent-[var(--brand)]"
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-ink-2 num">{formatDateBR(t.date)}</td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: tColor(t.type) }}>
                            <Icon className="size-3.5" />
                            <span className="text-ink-2">{TYPE_META[t.type].label}</span>
                          </span>
                        </td>
                        <td className="max-w-[18rem] px-3 py-3">
                          <button type="button" onClick={() => editTransaction(t)} className="block max-w-full truncate text-left font-medium hover:text-brand">
                            {t.description}
                          </button>
                          {t.note && <p className="truncate text-xs text-ink-3">{t.note}</p>}
                        </td>
                        <td className="max-w-[14rem] px-3 py-3">
                          <span className="flex items-center gap-2 text-ink-2">
                            {catColor && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: catColor }} />}
                            <span className="truncate">{category}</span>
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right"><AmountText tx={t} /></td>
                        <td className="px-3 py-3">
                          <Badge color={t.status === 'confirmado' ? c.saldo : c.reserva}>
                            {t.type === 'receita' ? RECEIPT_LABELS[receiptState(t)] : statusLabel(t.type, t.status)}
                          </Badge>
                        </td>
                        <td className="pr-3"><RowMenu tx={t} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: cards */}
            <ul className="divide-y divide-line md:hidden">
              {shown.map(({ t, category }) => {
                const Icon = TYPE_ICON[t.type]
                return (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${tColor(t.type)}1a`, color: tColor(t.type) }}>
                      <Icon className="size-4" />
                    </span>
                    <button type="button" onClick={() => editTransaction(t)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-medium">{t.description}</p>
                      <p className="truncate text-xs text-ink-3">{formatDateBR(t.date)} · {category}</p>
                      {t.status === 'pendente' && <p className="text-xs font-medium text-reserva">{statusLabel(t.type, t.status)}</p>}
                    </button>
                    <AmountText tx={t} className="text-sm" />
                    <RowMenu tx={t} />
                  </li>
                )
              })}
            </ul>

            {rows.length > limit && (
              <div className="border-t border-line p-4 text-center">
                <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                  Mostrar mais ({rows.length - limit} restantes)
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
