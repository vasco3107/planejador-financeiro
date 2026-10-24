import { allocate, configForMonth, type Allocation } from './distribution'
import { ratioPercent } from './money'
import { inRange, monthKey } from './period'
import { PLATFORM_FEE_CATEGORY, type Cents, type DateRange, type DistributionBucket, type DistributionConfig, type Transaction } from './types'

/**
 * Quanto de um lançamento já entrou de fato.
 * Com recebimentos parciais, soma as parcelas (limitado ao valor do lançamento);
 * sem eles, vale o status: confirmado = tudo, pendente = nada.
 */
export function receivedOf(t: Pick<Transaction, 'amountCents' | 'status' | 'payments'>): Cents {
  if (t.payments?.length) return Math.min(t.payments.reduce((s, p) => s + p.amountCents, 0), t.amountCents)
  return t.status === 'confirmado' ? t.amountCents : 0
}

/** Taxas retidas pelas plataformas dentro do que já foi liquidado. */
export const feesOf = (t: Pick<Transaction, 'payments'>) => (t.payments ?? []).reduce((s, p) => s + (p.feeCents ?? 0), 0)

/** O que de fato caiu na conta: bruto liquidado menos as taxas retidas. */
export const netReceivedOf = (t: Pick<Transaction, 'amountCents' | 'status' | 'payments'>) => receivedOf(t) - feesOf(t)

/** Quanto ainda falta cair na conta. */
export const pendingOf = (t: Pick<Transaction, 'amountCents' | 'status' | 'payments'>) => t.amountCents - receivedOf(t)

export type ReceiptState = 'recebido' | 'parcial' | 'aguardando'

export function receiptState(t: Pick<Transaction, 'amountCents' | 'status' | 'payments'>): ReceiptState {
  const got = receivedOf(t)
  if (got >= t.amountCents) return 'recebido'
  return got > 0 ? 'parcial' : 'aguardando'
}

/** Chave de 'você' nas retiradas e nas partes do lucro */
export const ME = '__eu'

// ---------------------------------------------------------------------------
// Empresa
// ---------------------------------------------------------------------------

export interface Totals {
  /** Faturamento lançado no período (recebido ou não) */
  receita: Cents
  /** Quanto do faturamento já caiu na conta */
  receitaRecebida: Cents
  /** Taxas retidas pelas plataformas (despesas na categoria "Taxas de plataforma") */
  taxaPlataforma: Cents
  /** Faturamento já resolvido: o que caiu na conta + as taxas retidas */
  receitaLiquidada: Cents
  despesa: Cents
  /** Lucro = faturamento − despesas, recebido ou não. Retiradas NÃO entram aqui. */
  lucro: Cents
  /** % — null quando não houve receita */
  margem: number | null
  /** Lucro que saiu para você e para os sócios (não é despesa) */
  retirado: Cents
  /** Retiradas por pessoa: id do sócio, ou ME para você */
  retiradoPor: Record<string, Cents>
  /** Lucro guardado na empresa (não foi para ninguém) */
  guardado: Cents
  /** Faturamento que ainda não caiu na conta nem virou taxa */
  receitaPendente: Cents
  despesaPendente: Cents
  /** Lucro livre: lucro − retiradas − o que foi guardado na empresa */
  saldoDisponivel: Cents
  count: number
}

/** Totais da empresa. Só considera receita, despesa e retirada; pendentes ficam separados. */
export function computeTotals(txs: Transaction[]): Totals {
  let receita = 0
  let receitaRecebida = 0
  let taxaPlataforma = 0
  let despesa = 0
  let retirado = 0
  let guardado = 0
  const retiradoPor: Record<string, Cents> = {}
  let despesaPendente = 0
  let count = 0
  for (const t of txs) {
    const pending = t.status === 'pendente'
    switch (t.type) {
      case 'receita': {
        count++
        // O faturamento conta cheio; o recebido é acompanhado à parte
        receita += t.amountCents
        receitaRecebida += receivedOf(t)
        break
      }
      case 'despesa':
        count++
        if (pending) despesaPendente += t.amountCents
        else {
          despesa += t.amountCents
          // A taxa foi descontada antes do repasse: ela resolve parte do faturamento
          if (t.categoryId === PLATFORM_FEE_CATEGORY) taxaPlataforma += t.amountCents
        }
        break
      case 'caixa':
        count++
        if (!pending) guardado += t.amountCents
        break
      case 'retirada':
        count++
        if (!pending) {
          retirado += t.amountCents
          const who = t.partnerId ?? ME
          retiradoPor[who] = (retiradoPor[who] ?? 0) + t.amountCents
        }
        break
      // investimento, reserva e pessoal pertencem à sua carteira, não à empresa
    }
  }
  const lucro = receita - despesa
  const receitaLiquidada = Math.min(receitaRecebida + taxaPlataforma, receita)
  return {
    receita,
    receitaRecebida,
    taxaPlataforma,
    receitaLiquidada,
    despesa,
    lucro,
    margem: ratioPercent(lucro, receita),
    retirado,
    retiradoPor,
    guardado,
    receitaPendente: Math.max(receita - receitaLiquidada, 0),
    despesaPendente,
    saldoDisponivel: lucro - retirado - guardado,
    count,
  }
}

// ---------------------------------------------------------------------------
// Sua carteira
// ---------------------------------------------------------------------------

export interface PersonalTotals {
  /** Suas retiradas de lucro da empresa */
  retiradas: Cents
  /** Outras rendas da pessoa física */
  outrosGanhos: Cents
  entradas: Cents
  aReceber: Cents
  gasto: Cents
  investido: Cents
  /** Guardado (reservas, com ou sem projeto/meta) */
  reservado: Cents
  /** Entradas que você ainda não gastou, investiu nem guardou */
  livre: Cents
}

/** Participação de um valor nas suas entradas, em % (null sem entradas). */
export const shareOfIncome = (cents: Cents, t: Pick<PersonalTotals, 'entradas'>) =>
  t.entradas > 0 ? (cents / t.entradas) * 100 : null

export function computePersonalTotals(txs: Transaction[]): PersonalTotals {
  let retiradas = 0
  let outrosGanhos = 0
  let aReceber = 0
  let gasto = 0
  let investido = 0
  let reservado = 0
  for (const t of txs) {
    const ok = t.status === 'confirmado'
    if (t.type === 'retirada' && !t.partnerId) {
      if (ok) retiradas += t.amountCents
      else aReceber += t.amountCents
    } else if (t.type === 'pessoal') {
      if (ok) outrosGanhos += t.amountCents
      else aReceber += t.amountCents
    } else if (t.type === 'gasto' && ok) gasto += t.amountCents
    else if (t.type === 'investimento' && ok) investido += t.amountCents
    else if (t.type === 'reserva' && ok) reservado += t.amountCents
  }
  const entradas = retiradas + outrosGanhos
  return { retiradas, outrosGanhos, entradas, aReceber, gasto, investido, reservado, livre: entradas - gasto - investido - reservado }
}

// ---------------------------------------------------------------------------
// Divisão do lucro da empresa (você, sócios, fica na empresa)
// ---------------------------------------------------------------------------

export const filterByRange = (txs: Transaction[], r: DateRange) => txs.filter((t) => inRange(t.date, r))

export function groupByMonth(txs: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>()
  for (const t of txs) {
    const k = monthKey(t.date)
    const list = map.get(k)
    if (list) list.push(t)
    else map.set(k, [t])
  }
  return map
}

export interface Destination {
  /** Soma do lucro dividido no período */
  baseCents: Cents
  allocations: Allocation[]
  /** Meses do período em que a base foi negativa (prejuízo — nada a dividir) */
  monthsWithLoss: string[]
}

/** Base da divisão do lucro da empresa: lucro do mês. */
export const profitBase = (list: Transaction[]) => computeTotals(list).lucro

/**
 * Para cada mês, aplica a regra vigente naquele mês sobre a base do mês.
 * Meses com base ≤ 0 não destinam nada.
 */
export function computeDestination(
  txs: Transaction[],
  configs: DistributionConfig[],
  base: (monthTxs: Transaction[]) => Cents,
): Destination {
  const byKey = new Map<string, Allocation>()
  const order: string[] = []
  const monthsWithLoss: string[] = []
  let baseCents = 0

  const months = [...groupByMonth(txs).entries()].sort(([a], [b]) => a.localeCompare(b))
  for (const [month, list] of months) {
    const config = configForMonth(configs, month)
    if (!config) continue
    const monthBase = base(list)
    if (monthBase < 0) monthsWithLoss.push(month)
    if (monthBase <= 0) continue
    baseCents += monthBase
    for (const a of allocate(monthBase, config.buckets)) {
      const prev = byKey.get(a.key)
      if (prev) prev.cents += a.cents
      else {
        byKey.set(a.key, { ...a })
        order.push(a.key)
      }
    }
  }

  // Garante que os destinos da regra atual apareçam mesmo zerados
  const latest = configForMonth(configs, '9999-12')
  for (const b of latest?.buckets ?? []) {
    if (!byKey.has(b.key)) {
      byKey.set(b.key, { ...b, cents: 0 })
      order.push(b.key)
    }
  }
  return { baseCents, allocations: order.map((k) => byKey.get(k)!), monthsWithLoss }
}

export const destinedFor = (d: Destination, role: DistributionBucket['role']) =>
  d.allocations.filter((a) => a.role === role).reduce((s, a) => s + a.cents, 0)

/** Quem é o dono de uma parte do lucro (destino de retirada) */
export const shareOwner = (b: Pick<DistributionBucket, 'partnerId'>) => b.partnerId ?? ME

/** Parte do lucro destinada a uma pessoa (você = ME, ou id do sócio) */
export const destinedShare = (d: Destination, who: string) =>
  d.allocations.filter((a) => a.role === 'retirada' && shareOwner(a) === who).reduce((s, a) => s + a.cents, 0)

export const hasShare = (d: Destination, who: string) =>
  d.allocations.some((a) => a.role === 'retirada' && shareOwner(a) === who)

export interface MoneySlice {
  key: string
  name: string
  color: string
  cents: Cents
}

/** Para onde foi cada real da receita da empresa: despesas + divisão do lucro. */
export function moneyFlowSlices(totals: Totals, destination: Destination, despesaColor: string): MoneySlice[] {
  return [
    { key: 'despesas', name: 'Despesas', color: despesaColor, cents: totals.despesa },
    ...destination.allocations.map((a) => ({ key: a.key, name: a.name, color: a.color, cents: a.cents })),
  ]
}

/** Variação percentual entre dois valores; null quando a base é zero. */
export function growth(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
