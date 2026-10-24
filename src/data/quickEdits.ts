/**
 * Edição direta dos totais do painel: o usuário digita o valor final e o app
 * ajusta os lançamentos por trás, sem inventar nada além do necessário.
 */
import { ME, receivedOf } from '@/domain/finance'
import type { Cents, Entity, Transaction } from '@/domain/types'
import { db, newId } from './db'

const TAXAS = 'Taxas das plataformas (Stripe e Kiwify)'

const sum = (txs: Transaction[]) => txs.reduce((s, t) => s + t.amountCents, 0)
const latest = (txs: Transaction[]) =>
  [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)[0]

/** Aplica a diferença no lançamento mais recente da lista; sem lista, cria um novo. */
async function applyDelta(txs: Transaction[], total: Cents, date: string, create: () => Transaction) {
  const delta = total - sum(txs)
  if (delta === 0) return
  const target = latest(txs)
  if (target && target.amountCents + delta > 0) {
    const amountCents = target.amountCents + delta
    // Um recebimento não pode passar do valor do lançamento
    const payments = target.payments?.length
      ? target.payments.slice().sort((a, b) => a.date.localeCompare(b.date))
      : undefined
    await db.transactions.update(target.id, { amountCents, payments, updatedAt: Date.now() })
    return
  }
  if (target) {
    // O ajuste zeraria (ou passaria) o lançamento: remove os antigos e cria um com o total
    await db.transactions.bulkDelete(txs.map((t) => t.id))
  }
  if (total > 0) await db.transactions.add({ ...create(), amountCents: total, date })
}

const base = (): Pick<Transaction, 'id' | 'status' | 'createdAt' | 'updatedAt'> => ({
  id: newId(),
  status: 'confirmado',
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

/** Faturamento do período, na conta aberta (CPF ou CNPJ). */
export async function setBillingTotal(receitas: Transaction[], total: Cents, date: string, entity: Entity) {
  await db.transaction('rw', db.transactions, async () => {
    await applyDelta(receitas, total, date, () => ({
      ...base(),
      type: 'receita',
      amountCents: total,
      date,
      entity,
      description: 'Faturamento',
      categoryId: 'rec-saas',
      status: 'pendente',
    }))
  })
}

/** Custos do período: a diferença entra na linha de taxas, preservando os comprovantes. */
export async function setCostsTotal(despesas: Transaction[], total: Cents, date: string, entity: Entity) {
  await db.transaction('rw', db.transactions, async () => {
    const taxas = despesas.filter((t) => t.description === TAXAS)
    const outros = despesas.filter((t) => t.description !== TAXAS)
    const alvo = total - sum(outros)
    if (alvo < 0) {
      // O total pedido é menor que os comprovantes: ajusta o lançamento mais recente
      await applyDelta(despesas, total, date, () => ({
        ...base(),
        type: 'despesa',
        amountCents: total,
        date,
        entity,
        description: TAXAS,
        categoryId: 'desp-operacionais',
      }))
      return
    }
    if (taxas.length) await db.transactions.bulkDelete(taxas.map((t) => t.id))
    if (alvo > 0) {
      await db.transactions.add({
        ...base(),
        type: 'despesa',
        amountCents: alvo,
        date,
        entity,
        description: TAXAS,
        categoryId: 'desp-operacionais',
        expenseKind: 'variavel',
        note: 'Diferença entre o faturamento bruto e o que as plataformas repassam',
      })
    }
  })
}

/** Total retirado por uma pessoa (ME = você, ou id do sócio) no período. */
export async function setWithdrawalTotal(retiradas: Transaction[], who: string, total: Cents, date: string, entity: Entity, name?: string) {
  const daPessoa = retiradas.filter((t) => (t.partnerId ?? ME) === who)
  await db.transaction('rw', db.transactions, async () => {
    await applyDelta(daPessoa, total, date, () => ({
      ...base(),
      type: 'retirada',
      amountCents: total,
      date,
      entity,
      description: name ? `Retirada de lucro — ${name}` : 'Retirada de lucro',
      partnerId: who === ME ? undefined : who,
    }))
  })
}

/** Total guardado no caixa da empresa no período. */
export async function setReserveTotal(caixas: Transaction[], total: Cents, date: string, entity: Entity) {
  await db.transaction('rw', db.transactions, async () => {
    await applyDelta(caixas, total, date, () => ({
      ...base(),
      type: 'caixa',
      amountCents: total,
      date,
      entity,
      description: 'Reserva de caixa',
    }))
  })
}

/**
 * Total de um tipo simples da carteira no período (gasto, investimento, reserva, ganho pessoal).
 * A diferença entra no lançamento mais recente; sem nenhum, cria um.
 */
export async function setSimpleTotal(
  txs: Transaction[],
  type: Transaction['type'],
  total: Cents,
  date: string,
  template: Partial<Transaction> = {},
) {
  const doTipo = txs.filter((t) => t.type === type)
  await db.transaction('rw', db.transactions, async () => {
    await applyDelta(doTipo, total, date, () => ({
      ...base(),
      type,
      amountCents: total,
      date,
      description: 'Lançamento',
      ...template,
    }) as Transaction)
  })
}

/** Quanto do faturamento já caiu na conta (distribui entre as receitas, das mais antigas para as mais novas). */
export async function setReceivedTotal(receitas: Transaction[], total: Cents, date: string) {
  const { paymentsRepo } = await import('./repositories')
  await paymentsRepo.setTotal(receitas, total, date)
}

/** Quanto já foi recebido, somando as receitas. */
export const receivedSum = (receitas: Transaction[]) => receitas.reduce((s, t) => s + receivedOf(t), 0)
