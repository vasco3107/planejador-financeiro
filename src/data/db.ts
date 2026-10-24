import Dexie, { type EntityTable, type Transaction as DexieTx } from 'dexie'
import { CAIXA_BUCKET, COMPANY_DEFAULT_BUCKETS, DEFAULT_BUCKETS, TOTAL_BPS, normalizeBps } from '@/domain/distribution'
import { currentMonthKey } from '@/domain/period'
import type { Category, DistributionBucket, DistributionConfig, ExpectedReceipt, Goal, Partner, Project, Settings, Transaction } from '@/domain/types'
import { PLATFORM_FEE_CATEGORY } from '@/domain/types'
import { DEFAULT_CATEGORIES, PERSONAL_CATEGORIES, PERSONAL_EXPENSE_CATEGORIES } from './seed'

export class FinanceDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>
  categories!: EntityTable<Category, 'id'>
  distributions!: EntityTable<DistributionConfig, 'id'>
  projects!: EntityTable<Project, 'id'>
  goals!: EntityTable<Goal, 'id'>
  settings!: EntityTable<Settings, 'id'>
  partners!: EntityTable<Partner, 'id'>
  /** Controle à parte de valores que ainda não chegaram */
  expected!: EntityTable<ExpectedReceipt, 'id'>

  constructor() {
    super('planejador-financeiro')
    // Novas versões do schema devem ser adicionadas abaixo com .version(n+1)
    this.version(1).stores({
      transactions: 'id, type, date, categoryId, status, projectId, goalId, [type+date]',
      categories: 'id, kind, name',
      distributions: 'id, effectiveFrom, createdAt',
      projects: 'id, archived, createdAt',
      goals: 'id, archived, createdAt',
      settings: 'id',
    })
    // v2: carteira pessoal — adiciona as categorias de renda da pessoa física
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const table = tx.table<Category, string>('categories')
        for (const c of PERSONAL_CATEGORIES) if (!(await table.get(c.id))) await table.add(c)
      })
    // v3: sócios (retiradas de lucro para outras pessoas)
    this.version(3).stores({
      transactions: 'id, type, date, categoryId, status, projectId, goalId, partnerId, [type+date]',
      partners: 'id, archived, createdAt',
    })
    // v4: a distribuição se divide em duas regras independentes:
    //   empresa = divisão do lucro entre você, sócios e o que fica na empresa
    //   pessoal = destino das suas retiradas (investimentos, projetos, metas…)
    this.version(4)
      .stores({ distributions: 'id, scope, effectiveFrom, createdAt' })
      .upgrade(splitDistributionsByScope)
    // v5: gastos da pessoa física — adiciona as categorias de gasto
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        const table = tx.table<Category, string>('categories')
        for (const c of PERSONAL_EXPENSE_CATEGORIES) if (!(await table.get(c.id))) await table.add(c)
      })

    // v6: categoria de taxas de plataforma (abatem do que falta receber)
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        const table = tx.table<Category, string>('categories')
        const taxa = DEFAULT_CATEGORIES.find((c) => c.id === PLATFORM_FEE_CATEGORY)
        if (taxa && !(await table.get(taxa.id))) await table.add(taxa)
      })

    // v7: controle à parte dos valores que ainda não chegaram na conta
    this.version(7).stores({ expected: 'id, expectedDate, receivedDate, createdAt' })

    // v8: separação entre a conta do CPF e a do CNPJ
    this.version(8)
      .stores({ transactions: 'id, type, date, categoryId, status, projectId, goalId, partnerId, entity, [type+date]' })
      .upgrade(async (tx) => {
        // Tudo que já existia foi faturado no CPF
        await tx.table('transactions').toCollection().modify((t: Transaction) => {
          if (!t.entity) t.entity = 'cpf'
        })
      })

    this.on('populate', (tx) => {
      const now = Date.now()
      const from = currentMonthKey()
      tx.table('categories').bulkAdd([...DEFAULT_CATEGORIES, ...PERSONAL_CATEGORIES, ...PERSONAL_EXPENSE_CATEGORIES])
      tx.table('distributions').bulkAdd([
        { id: newId(), scope: 'empresa', effectiveFrom: from, buckets: COMPANY_DEFAULT_BUCKETS, createdAt: now },
        { id: newId(), scope: 'pessoal', effectiveFrom: from, buckets: DEFAULT_BUCKETS, createdAt: now },
      ] satisfies DistributionConfig[])
      tx.table('settings').add({ id: 'app', companyName: 'Minha empresa' } satisfies Settings)
    })
  }
}

async function splitDistributionsByScope(tx: DexieTx) {
  const table = tx.table<DistributionConfig, string>('distributions')
  const all = await table.toArray()
  await table.clear()
  await table.bulkAdd(splitLegacyConfigs(all))
}

/**
 * Converte regras antigas (uma só, misturando sócios e investimentos) em duas:
 * as partes de retirada viram a divisão do lucro da empresa (o resto "fica na empresa"),
 * e os demais destinos viram a sua distribuição pessoal, reescalada para 100%.
 * Regras que já têm escopo passam intactas. Garante ao menos uma regra de cada escopo.
 */
export function splitLegacyConfigs(configs: (Omit<DistributionConfig, 'scope'> & { scope?: DistributionConfig['scope'] })[]): DistributionConfig[] {
  const out: DistributionConfig[] = []
  for (const c of configs) {
    if (c.scope) {
      out.push(c as DistributionConfig)
      continue
    }
    const shares = c.buckets.filter((b) => b.role === 'retirada')
    const personal = c.buckets.filter((b) => b.role !== 'retirada' && (b.role as string) !== 'despesas')
    const sharesBps = shares.reduce((s, b) => s + b.bps, 0)
    if (shares.length) {
      const company: DistributionBucket[] = [...shares]
      if (sharesBps < TOTAL_BPS) company.push({ ...CAIXA_BUCKET, bps: TOTAL_BPS - sharesBps })
      out.push({ id: newId(), scope: 'empresa', effectiveFrom: c.effectiveFrom, buckets: company, createdAt: c.createdAt })
    }
    if (personal.some((b) => b.bps > 0)) {
      out.push({ id: newId(), scope: 'pessoal', effectiveFrom: c.effectiveFrom, buckets: normalizeBps(personal), createdAt: c.createdAt })
    }
  }
  const earliest = configs.map((c) => c.effectiveFrom).sort()[0] ?? currentMonthKey()
  const now = Date.now()
  if (!out.some((c) => c.scope === 'empresa')) {
    out.push({ id: newId(), scope: 'empresa', effectiveFrom: earliest, buckets: COMPANY_DEFAULT_BUCKETS, createdAt: now })
  }
  if (!out.some((c) => c.scope === 'pessoal')) {
    out.push({ id: newId(), scope: 'pessoal', effectiveFrom: earliest, buckets: DEFAULT_BUCKETS, createdAt: now })
  }
  return out
}

export const db = new FinanceDB()

export function newId(): string {
  return crypto.randomUUID()
}
