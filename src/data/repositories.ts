/**
 * Camada de acesso a dados. A UI só conversa com estas funções (via hooks),
 * então trocar IndexedDB por uma API remota no futuro exige mudar apenas este arquivo.
 */
import type {
  Category,
  Cents,
  CategoryKind,
  DistributionBucket,
  DistributionConfig,
  DistributionScope,
  ExpectedReceipt,
  Goal,
  Partner,
  Payment,
  Project,
  Settings,
  Transaction,
} from '@/domain/types'
import { distributeAdditional, distributeReceived } from '@/domain/receipts'
import { db, newId, splitLegacyConfigs } from './db'
import { FALLBACK_CATEGORY } from './seed'

export type TransactionInput = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>

export const transactionsRepo = {
  list: () => db.transactions.orderBy('date').reverse().toArray(),
  get: (id: string) => db.transactions.get(id),
  async create(input: TransactionInput): Promise<string> {
    const now = Date.now()
    const id = newId()
    await db.transactions.add({ ...input, id, createdAt: now, updatedAt: now })
    return id
  },
  async update(id: string, patch: Partial<TransactionInput>): Promise<void> {
    await db.transactions.update(id, { ...patch, updatedAt: Date.now() })
  },
  remove: (id: string) => db.transactions.delete(id),
  removeMany: (ids: string[]) => db.transactions.bulkDelete(ids),
}

/** Recebimentos parciais de uma receita: o que já caiu na conta. */
export const paymentsRepo = {
  /**
   * Soma um valor recém-recebido ao saldo do faturamento, sem apagar os recebimentos anteriores.
   * O valor entra nas receitas que ainda têm saldo, das mais antigas para as mais novas.
   */
  async addToTotal(receitas: Transaction[], deltaCents: Cents, date: string, note?: string): Promise<void> {
    const perTx = distributeAdditional(receitas, deltaCents)
    await db.transaction('rw', db.transactions, async () => {
      for (const [id, value] of perTx) {
        const tx = await db.transactions.get(id)
        if (!tx || value <= 0) continue
        const payments = [...(tx.payments ?? []), { id: newId(), date, amountCents: value, note }].sort((a, b) => a.date.localeCompare(b.date))
        await db.transactions.update(id, { payments, status: syncStatus(tx.amountCents, payments), updatedAt: Date.now() })
      }
    })
  },
  /**
   * Corrige o total já recebido de um conjunto de receitas (substitui os recebimentos).
   * O valor é distribuído das receitas mais antigas para as mais novas.
   */
  async setTotal(receitas: Transaction[], totalCents: Cents, date: string): Promise<void> {
    const perTx = distributeReceived(receitas, totalCents)
    await db.transaction('rw', db.transactions, async () => {
      for (const t of receitas) {
        const value = perTx.get(t.id) ?? 0
        const payments: Payment[] | undefined =
          value > 0 ? [{ id: newId(), date, amountCents: value, note: 'Recebido (total informado no faturamento)' }] : undefined
        await db.transactions.update(t.id, {
          payments,
          status: value >= t.amountCents ? 'confirmado' : 'pendente',
          updatedAt: Date.now(),
        })
      }
    })
  },
  /** Registra um valor recebido e acerta o status (a receber → recebido quando completa). */
  async add(txId: string, payment: { date: string; amountCents: Cents; note?: string }): Promise<void> {
    await db.transaction('rw', db.transactions, async () => {
      const tx = await db.transactions.get(txId)
      if (!tx) return
      const payments = [...(tx.payments ?? []), { ...payment, id: newId() }].sort((a, b) => a.date.localeCompare(b.date))
      await db.transactions.update(txId, { payments, status: syncStatus(tx.amountCents, payments), updatedAt: Date.now() })
    })
  },
  /**
   * Registra um repasse da plataforma: o valor que caiu na conta mais a taxa retida.
   * O bruto (líquido + taxa) conta como faturamento recebido e a taxa vira despesa.
   */
  async registerPayout(
    receitas: Transaction[],
    netCents: Cents,
    feeCents: Cents,
    date: string,
    platform = 'plataforma',
  ): Promise<void> {
    const gross = netCents + feeCents
    const perTx = distributeAdditional(receitas, gross)
    await db.transaction('rw', db.transactions, async () => {
      let restanteTaxa = feeCents
      const entries = [...perTx.entries()]
      for (const [id, value] of entries) {
        const tx = await db.transactions.get(id)
        if (!tx || value <= 0) continue
        // A taxa é repartida junto com o bruto, proporcionalmente
        const isLast = entries[entries.length - 1][0] === id
        const fee = isLast ? restanteTaxa : Math.round((feeCents * value) / gross)
        restanteTaxa -= fee
        const payments = [...(tx.payments ?? []), { id: newId(), date, amountCents: value, feeCents: fee, note: `Repasse ${platform}` }]
          .sort((a, b) => a.date.localeCompare(b.date))
        await db.transactions.update(id, { payments, status: syncStatus(tx.amountCents, payments), updatedAt: Date.now() })
      }
      if (feeCents > 0) {
        await db.transactions.add({
          id: newId(),
          type: 'despesa',
          amountCents: feeCents,
          date,
          description: `Taxa ${platform}`,
          categoryId: 'desp-operacionais',
          expenseKind: 'variavel',
          status: 'confirmado',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      }
    })
  },
  async remove(txId: string, paymentId: string): Promise<void> {
    await db.transaction('rw', db.transactions, async () => {
      const tx = await db.transactions.get(txId)
      if (!tx?.payments) return
      const payments = tx.payments.filter((p) => p.id !== paymentId)
      await db.transactions.update(txId, {
        payments: payments.length ? payments : undefined,
        status: payments.length ? syncStatus(tx.amountCents, payments) : tx.status,
        updatedAt: Date.now(),
      })
    })
  },
}

const syncStatus = (amountCents: Cents, payments: Payment[]): Transaction['status'] =>
  payments.reduce((s, p) => s + p.amountCents, 0) >= amountCents ? 'confirmado' : 'pendente'

export const categoriesRepo = {
  list: () => db.categories.toArray(),
  async create(kind: CategoryKind, name: string, color: string): Promise<string> {
    const id = newId()
    await db.categories.add({ id, kind, name: name.trim(), color, builtin: false })
    return id
  },
  update: (id: string, patch: Partial<Pick<Category, 'name' | 'color'>>) => db.categories.update(id, patch),
  usage: (id: string) => db.transactions.where('categoryId').equals(id).count(),
  /** Exclui e move os lançamentos para outra categoria (padrão: "Outros"). */
  async remove(id: string, moveTo?: string): Promise<void> {
    await db.transaction('rw', db.categories, db.transactions, async () => {
      const cat = await db.categories.get(id)
      if (!cat) return
      const target = moveTo ?? FALLBACK_CATEGORY[cat.kind]
      await db.transactions.where('categoryId').equals(id).modify({ categoryId: target, updatedAt: Date.now() })
      await db.categories.delete(id)
    })
  },
}

export const distributionsRepo = {
  list: (scope: DistributionScope) => db.distributions.where('scope').equals(scope).sortBy('effectiveFrom'),
  /** Salva a regra a partir de um mês. Se já existir versão para o mesmo mês (e escopo), ela é substituída. */
  async save(scope: DistributionScope, effectiveFrom: string, buckets: DistributionBucket[]): Promise<void> {
    await db.transaction('rw', db.distributions, async () => {
      const same = await db.distributions.where('scope').equals(scope).filter((d) => d.effectiveFrom === effectiveFrom).toArray()
      await db.distributions.bulkDelete(same.map((d) => d.id))
      await db.distributions.add({ id: newId(), scope, effectiveFrom, buckets, createdAt: Date.now() })
    })
  },
  async remove(id: string): Promise<void> {
    const cfg = await db.distributions.get(id)
    if (!cfg) return
    if ((await db.distributions.where('scope').equals(cfg.scope).count()) <= 1) throw new Error('É preciso manter ao menos uma regra.')
    await db.distributions.delete(id)
  },
}

function targetsRepo<T extends Project | Goal>(table: typeof db.projects | typeof db.goals, key: 'projectId' | 'goalId') {
  const t = table as unknown as import('dexie').Table<T, string>
  return {
    list: () => t.orderBy('createdAt').toArray(),
    async create(input: Omit<T, 'id' | 'createdAt' | 'archived'>): Promise<string> {
      const id = newId()
      await t.add({ ...input, id, archived: false, createdAt: Date.now() } as T)
      return id
    },
    update: (id: string, patch: Partial<T>) => t.update(id, patch as never),
    /** Exclui; as reservas continuam no histórico, sem vínculo. */
    async remove(id: string): Promise<void> {
      await db.transaction('rw', t, db.transactions, async () => {
        await db.transactions.where(key).equals(id).modify((tx) => {
          delete tx[key]
          tx.updatedAt = Date.now()
        })
        await t.delete(id)
      })
    },
  }
}

export const projectsRepo = targetsRepo<Project>(db.projects, 'projectId')
export const goalsRepo = targetsRepo<Goal>(db.goals, 'goalId')

export const partnersRepo = {
  list: () => db.partners.orderBy('createdAt').toArray(),
  async create(name: string, color: string): Promise<string> {
    const id = newId()
    await db.partners.add({ id, name: name.trim(), color, archived: false, createdAt: Date.now() })
    return id
  },
  /** Renomear também atualiza o nome da parte do sócio na divisão do lucro. */
  async update(id: string, patch: Partial<Pick<Partner, 'name' | 'color' | 'archived'>>): Promise<void> {
    await db.transaction('rw', db.partners, db.distributions, async () => {
      await db.partners.update(id, patch)
      if (patch.name) {
        await db.distributions.toCollection().modify((d) => {
          for (const b of d.buckets) if (b.partnerId === id) b.name = patch.name!
        })
      }
    })
  },
  withdrawals: (id: string) => db.transactions.where('partnerId').equals(id).count(),
  /** Só exclui sócios sem retiradas — com histórico, o caminho é arquivar. */
  async remove(id: string): Promise<void> {
    if ((await partnersRepo.withdrawals(id)) > 0) throw new Error('Sócio com retiradas registradas: arquive em vez de excluir.')
    await db.partners.delete(id)
  },
}

/** Valores que deveriam ter chegado e ainda não caíram. Controle isolado: não entra em nenhum cálculo. */
export const expectedRepo = {
  list: () => db.expected.orderBy('expectedDate').toArray(),
  async create(input: Omit<ExpectedReceipt, 'id' | 'createdAt'>): Promise<string> {
    const id = newId()
    await db.expected.add({ ...input, id, createdAt: Date.now() })
    return id
  },
  update: (id: string, patch: Partial<Omit<ExpectedReceipt, 'id' | 'createdAt'>>) => db.expected.update(id, patch),
  /** Dá baixa: marca a data em que o dinheiro caiu. */
  markReceived: (id: string, receivedDate: string) => db.expected.update(id, { receivedDate }),
  reopen: (id: string) => db.expected.update(id, { receivedDate: undefined }),
  remove: (id: string) => db.expected.delete(id),
}

export const settingsRepo = {
  get: async (): Promise<Settings> =>
    (await db.settings.get('app')) ?? { id: 'app', companyName: 'Minha empresa' },
  update: async (patch: Partial<Omit<Settings, 'id'>>) => {
    const cur = await settingsRepo.get()
    await db.settings.put({ ...cur, ...patch })
  },
}

// ---------- Backup ----------

export interface BackupFile {
  app: 'planejador-financeiro'
  version: 1
  exportedAt: string
  data: {
    transactions: Transaction[]
    categories: Category[]
    distributions: DistributionConfig[]
    projects: Project[]
    goals: Goal[]
    settings: Settings[]
    partners?: Partner[]
    expected?: ExpectedReceipt[]
  }
}

export async function exportBackup(): Promise<BackupFile> {
  return {
    app: 'planejador-financeiro',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      transactions: await db.transactions.toArray(),
      categories: await db.categories.toArray(),
      distributions: await db.distributions.toArray(),
      projects: await db.projects.toArray(),
      goals: await db.goals.toArray(),
      settings: await db.settings.toArray(),
      partners: await db.partners.toArray(),
      expected: await db.expected.toArray(),
    },
  }
}

export function isBackupFile(v: unknown): v is BackupFile {
  const b = v as BackupFile
  return (
    !!b && b.app === 'planejador-financeiro' && b.version === 1 && !!b.data &&
    Array.isArray(b.data.transactions) && Array.isArray(b.data.categories) &&
    Array.isArray(b.data.distributions) && b.data.distributions.length > 0 &&
    b.data.transactions.every((t) => typeof t.id === 'string' && Number.isInteger(t.amountCents) && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
  )
}

const ALL_TABLES = () => [db.transactions, db.categories, db.distributions, db.projects, db.goals, db.settings, db.partners, db.expected]

/** Substitui todos os dados pelos do backup (operação atômica). */
export async function restoreBackup(file: BackupFile): Promise<void> {
  await db.transaction('rw', ALL_TABLES(), async () => {
    await Promise.all(ALL_TABLES().map((t) => t.clear()))
    await db.transactions.bulkAdd(file.data.transactions)
    await db.categories.bulkAdd(file.data.categories)
    // Backups antigos têm uma regra só: separa em empresa × pessoal
    await db.distributions.bulkAdd(splitLegacyConfigs(file.data.distributions))
    await db.projects.bulkAdd(file.data.projects ?? [])
    await db.goals.bulkAdd(file.data.goals ?? [])
    await db.settings.bulkAdd(file.data.settings ?? [])
    await db.partners.bulkAdd(file.data.partners ?? [])
    await db.expected.bulkAdd(file.data.expected ?? [])
  })
}

/** Apaga tudo e recria o estado inicial. */
export async function resetAll(): Promise<void> {
  await db.delete()
  await db.open()
}
