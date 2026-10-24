import { describe, expect, it } from 'vitest'
import { allocate, configForMonth, parsePercentToBps, validateDistribution } from './distribution'
import { ME, computeDestination, computePersonalTotals, computeTotals, destinedShare, moneyFlowSlices, pendingOf, profitBase, receiptState, receivedOf, shareOfIncome } from './finance'
import { generateInsights } from './insights'
import { formatBRL, maskBRLInput, parseBRL } from './money'
import { monthsBetween, parseDateBR, previousRange } from './period'
import { billed, distributeAdditional, distributeReceived } from './receipts'
import { monthlySummaries } from './reports'
import { PLATFORM_FEE_CATEGORY, isPersonal, type DistributionBucket, type DistributionConfig, type Transaction } from './types'

let seq = 0
const tx = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'amountCents'>): Transaction => ({
  id: String(++seq),
  date: '2026-09-10',
  description: 'x',
  status: 'confirmado',
  createdAt: 0,
  updatedAt: 0,
  ...p,
})

const bucket = (key: string, bps: number, role?: DistributionBucket['role']): DistributionBucket => ({
  key,
  name: key,
  color: '#000',
  bps,
  role,
})

const cfg = (effectiveFrom: string, buckets: DistributionBucket[], createdAt = 0): DistributionConfig => ({
  id: effectiveFrom + createdAt,
  scope: 'empresa',
  effectiveFrom,
  buckets,
  createdAt,
})

describe('money', () => {
  it('formata em reais', () => {
    expect(formatBRL(1000000).replace(/\s/g, ' ')).toBe('R$ 10.000,00')
    expect(formatBRL(-0).replace(/\s/g, ' ')).toBe('R$ 0,00')
  })
  it('interpreta o padrão brasileiro', () => {
    expect(parseBRL('1.234,56')).toBe(123456)
    expect(parseBRL('R$ 10.000')).toBe(1000000)
    expect(parseBRL('0,1')).toBe(10)
    expect(parseBRL('abc')).toBeNull()
    expect(parseBRL('')).toBeNull()
  })
  it('máscara de digitação', () => {
    expect(maskBRLInput('123456')).toEqual({ text: '1.234,56', cents: 123456 })
    expect(maskBRLInput('')).toEqual({ text: '', cents: 0 })
  })
})

describe('lucro', () => {
  it('receita 10.000 − despesa 3.000 = 7.000 (margem 70%)', () => {
    const t = computeTotals([tx({ type: 'receita', amountCents: 1000000 }), tx({ type: 'despesa', amountCents: 300000 })])
    expect(t.lucro).toBe(700000)
    expect(t.margem).toBe(70)
  })
  it('investimentos e reservas são da carteira, não da empresa', () => {
    const list = [
      tx({ type: 'receita', amountCents: 1000000 }),
      tx({ type: 'despesa', amountCents: 300000 }),
      tx({ type: 'retirada', amountCents: 400000 }),
      tx({ type: 'investimento', amountCents: 200000 }),
      tx({ type: 'reserva', amountCents: 100000 }),
      tx({ type: 'pessoal', amountCents: 50000 }),
    ]
    const t = computeTotals(list)
    expect(t.lucro).toBe(700000)
    expect(t.saldoDisponivel).toBe(300000)
    const p = computePersonalTotals(list)
    expect(p.retiradas).toBe(400000)
    expect(p.entradas).toBe(450000)
    expect(p.investido).toBe(200000)
    expect(p.reservado).toBe(100000)
    expect(p.livre).toBe(150000)
  })
  it('carteira: valores exatos lançados viram % do que você recebeu', () => {
    const list = [
      tx({ type: 'receita', amountCents: 9000000 }),
      tx({ type: 'retirada', amountCents: 800000 }),
      tx({ type: 'retirada', amountCents: 500000, partnerId: 's1' }),
      tx({ type: 'pessoal', amountCents: 200000 }),
      tx({ type: 'gasto', amountCents: 350000 }),
      tx({ type: 'investimento', amountCents: 400000 }),
      tx({ type: 'reserva', amountCents: 150000 }),
    ]
    const p = computePersonalTotals(list)
    expect(p.entradas).toBe(1000000)
    expect(p.livre).toBe(100000)
    expect([p.gasto, p.investido, p.reservado, p.livre].map((v) => shareOfIncome(v, p))).toEqual([35, 40, 15, 10])
    // gasto pessoal não mexe na empresa
    expect(computeTotals(list).lucro).toBe(9000000)
    expect(shareOfIncome(100, { entradas: 0 })).toBeNull()
  })
  it('retirada para PF reduz o saldo, não o lucro; renda pessoal é ignorada', () => {
    const t = computeTotals([
      tx({ type: 'receita', amountCents: 1000000 }),
      tx({ type: 'despesa', amountCents: 300000 }),
      tx({ type: 'retirada', amountCents: 200000 }),
      tx({ type: 'pessoal', amountCents: 500000 }),
    ])
    expect(t.receita).toBe(1000000)
    expect(t.lucro).toBe(700000)
    expect(t.retirado).toBe(200000)
    expect(t.saldoDisponivel).toBe(500000)
  })
  it('retiradas separadas por pessoa; sócio não entra na carteira pessoal', () => {
    const list = [
      tx({ type: 'receita', amountCents: 1000000 }),
      tx({ type: 'retirada', amountCents: 150000 }),
      tx({ type: 'retirada', amountCents: 250000, partnerId: 's1' }),
    ]
    const t = computeTotals(list)
    expect(t.retirado).toBe(400000)
    expect(t.retiradoPor[ME]).toBe(150000)
    expect(t.retiradoPor.s1).toBe(250000)
    expect(t.saldoDisponivel).toBe(600000)
    expect(list.filter(isPersonal).map((x) => x.amountCents)).toEqual([150000])
  })
  it('parte do lucro de cada pessoa pela regra', () => {
    const txs = [tx({ type: 'receita', amountCents: 1000000 })]
    const d = computeDestination(txs, [cfg('2026-01', [bucket('inv', 7000), { ...bucket('eu', 1500, 'retirada') }, { ...bucket('s', 1500, 'retirada'), partnerId: 's1' }])], profitBase)
    expect(destinedShare(d, ME)).toBe(150000)
    expect(destinedShare(d, 's1')).toBe(150000)
  })
  it('despesa pendente não entra no lucro; receita a receber entra', () => {
    const t = computeTotals([
      tx({ type: 'receita', amountCents: 1000000, status: 'pendente' }),
      tx({ type: 'despesa', amountCents: 50000, status: 'pendente' }),
    ])
    expect(t.receita).toBe(1000000)
    expect(t.receitaRecebida).toBe(0)
    expect(t.lucro).toBe(1000000)
    expect(t.despesaPendente).toBe(50000)
  })
  it('margem nula sem receita', () => {
    expect(computeTotals([tx({ type: 'despesa', amountCents: 100 })]).margem).toBeNull()
  })
})

describe('taxa de plataforma', () => {
  it('a taxa lançada como despesa abate do que falta receber', () => {
    const t = computeTotals([
      tx({ type: 'receita', amountCents: 119200, status: 'pendente' }),
      tx({ type: 'despesa', amountCents: 6200, categoryId: PLATFORM_FEE_CATEGORY }),
    ])
    expect(t.receita).toBe(119200)
    expect(t.taxaPlataforma).toBe(6200)
    expect(t.receitaRecebida).toBe(0)
    // faturamento resolvido = o que caiu na conta + a taxa retida
    expect(t.receitaLiquidada).toBe(6200)
    expect(t.receitaPendente).toBe(113000)
    expect(t.lucro).toBe(113000)
  })
  it('com o repasse lançado, não falta mais nada', () => {
    const t = computeTotals([
      tx({ type: 'receita', amountCents: 119200, status: 'pendente', payments: [{ id: 'p', date: '2026-09-22', amountCents: 113000 }] }),
      tx({ type: 'despesa', amountCents: 6200, categoryId: PLATFORM_FEE_CATEGORY }),
    ])
    expect(t.receitaPendente).toBe(0)
    expect(t.receitaLiquidada).toBe(119200)
  })
  it('despesa comum não abate do faturamento', () => {
    const t = computeTotals([
      tx({ type: 'receita', amountCents: 119200, status: 'pendente' }),
      tx({ type: 'despesa', amountCents: 6200, categoryId: 'desp-ia-apis' }),
    ])
    expect(t.taxaPlataforma).toBe(0)
    expect(t.receitaPendente).toBe(119200)
  })
})

describe('recebimento parcial da receita', () => {
  const parcial = tx({
    type: 'receita',
    amountCents: 1000000,
    status: 'pendente',
    payments: [
      { id: 'a', date: '2026-09-05', amountCents: 312450 },
      { id: 'b', date: '2026-09-18', amountCents: 187533 },
    ],
  })
  it('conta só o que já caiu na conta; o resto fica a receber', () => {
    expect(receivedOf(parcial)).toBe(499983)
    expect(pendingOf(parcial)).toBe(500017)
    expect(receiptState(parcial)).toBe('parcial')
    const t = computeTotals([parcial, tx({ type: 'despesa', amountCents: 100000 })])
    // O faturamento conta cheio; o recebido é acompanhado à parte
    expect(t.receita).toBe(1000000)
    expect(t.receitaRecebida).toBe(499983)
    expect(t.receitaPendente).toBe(500017)
    expect(t.lucro).toBe(900000)
  })
  it('sem recebimentos, vale o status', () => {
    expect(receivedOf(tx({ type: 'receita', amountCents: 5000 }))).toBe(5000)
    expect(receivedOf(tx({ type: 'receita', amountCents: 5000, status: 'pendente' }))).toBe(0)
    expect(receiptState(tx({ type: 'receita', amountCents: 5000 }))).toBe('recebido')
  })
})

describe('saldo do faturamento', () => {
  const receitas = [
    tx({ type: 'receita', amountCents: 300000, date: '2026-09-01', status: 'pendente' }),
    tx({ type: 'receita', amountCents: 200000, date: '2026-09-10', status: 'pendente' }),
    tx({ type: 'receita', amountCents: 100000, date: '2026-09-20', status: 'pendente' }),
  ]
  it('distribui o total informado das receitas mais antigas para as mais novas', () => {
    const d = distributeReceived(receitas, 412345)
    expect(receitas.map((t) => d.get(t.id))).toEqual([300000, 112345, 0])
    expect([...d.values()].reduce((s, v) => s + v, 0)).toBe(412345)
  })
  it('somar é acumulativo: usa só o saldo que falta em cada receita', () => {
    const jaRecebida = tx({ type: 'receita', amountCents: 300000, date: '2026-09-01', payments: [{ id: 'p', date: '2026-09-02', amountCents: 300000 }] })
    const lista = [jaRecebida, receitas[1], receitas[2]]
    const d = distributeAdditional(lista, 250000)
    expect(d.get(jaRecebida.id)).toBeUndefined()
    expect(d.get(receitas[1].id)).toBe(200000)
    expect(d.get(receitas[2].id)).toBe(50000)
  })
  it('não passa do faturamento lançado nem aceita negativo', () => {
    expect([...distributeReceived(receitas, 99999999).values()]).toEqual([300000, 200000, 100000])
    expect([...distributeReceived(receitas, -50).values()]).toEqual([0, 0, 0])
    expect(billed(receitas)).toBe(600000)
  })
})

describe('distribuição', () => {
  it('exemplo completo: lucro 7.000 com 40/60 → 2.800 / 4.200', () => {
    const txs = [tx({ type: 'receita', amountCents: 1000000 }), tx({ type: 'despesa', amountCents: 300000 })]
    const d = computeDestination(txs, [cfg('2026-01', [bucket('inv', 4000, 'investimentos'), bucket('proj', 6000, 'projetos')])], profitBase)
    expect(d.allocations.map((a) => a.cents)).toEqual([280000, 420000])
    const slices = moneyFlowSlices(computeTotals(txs), d, '#f00')
    expect(slices.reduce((s, x) => s + x.cents, 0)).toBe(1000000)
  })
  it('base receita: 10.000 com 15/40/45 → 1.500 / 4.000 / 4.500', () => {
    const a = allocate(1000000, [bucket('d', 1500), bucket('i', 4000), bucket('p', 4500)])
    expect(a.map((x) => x.cents)).toEqual([150000, 400000, 450000])
  })
  it('soma exata centavo a centavo', () => {
    const a = allocate(100, [bucket('a', 3333), bucket('b', 3333), bucket('c', 3334)])
    expect(a.reduce((s, x) => s + x.cents, 0)).toBe(100)
    const b = allocate(700001, [bucket('a', 4000), bucket('b', 6000)])
    expect(b.reduce((s, x) => s + x.cents, 0)).toBe(700001)
  })
  it('prejuízo não gera destinação', () => {
    const txs = [tx({ type: 'receita', amountCents: 100 }), tx({ type: 'despesa', amountCents: 500 })]
    const d = computeDestination(txs, [cfg('2026-01', [bucket('a', 10000)])], profitBase)
    expect(d.allocations[0].cents).toBe(0)
    expect(d.monthsWithLoss).toEqual(['2026-09'])
  })
  it('valida 100%', () => {
    const v = validateDistribution([bucket('a', 5000), bucket('b', 4500)])
    expect(v.valid).toBe(false)
    expect(v.message).toBe('Suas categorias somam 95%. Defina mais 5% para completar a distribuição.')
    expect(validateDistribution([bucket('a', 6000), bucket('b', 4500)]).valid).toBe(false)
    expect(validateDistribution([bucket('a', 6000), bucket('b', 4000)]).valid).toBe(true)
  })
  it('usa a versão vigente no mês', () => {
    const configs = [cfg('2026-01', [bucket('a', 10000)], 1), cfg('2026-06', [bucket('b', 10000)], 2)]
    expect(configForMonth(configs, '2026-03')?.effectiveFrom).toBe('2026-01')
    expect(configForMonth(configs, '2026-09')?.effectiveFrom).toBe('2026-06')
    expect(configForMonth(configs, '2025-01')?.effectiveFrom).toBe('2026-01')
  })
  it('converte percentuais', () => {
    expect(parsePercentToBps('12,5')).toBe(1250)
    expect(parsePercentToBps('101')).toBeNull()
  })
})

describe('período e relatórios', () => {
  it('meses entre datas', () => {
    expect(monthsBetween('2025-11-15', '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
  it('período anterior', () => {
    expect(previousRange('mes', { start: '2026-03-01', end: '2026-03-31' })).toEqual({ start: '2026-02-01', end: '2026-02-28' })
  })
  it('data brasileira', () => {
    expect(parseDateBR('21/09/2026')).toBe('2026-09-21')
    expect(parseDateBR('31/02/2026')).toBeNull()
  })
  it('crescimento mês a mês', () => {
    const s = monthlySummaries(
      [
        tx({ type: 'receita', amountCents: 1000, date: '2026-08-01' }),
        tx({ type: 'receita', amountCents: 1500, date: '2026-09-01' }),
      ],
      [],
    )
    expect(s.map((m) => m.receitaGrowth)).toEqual([null, 50])
  })
  it('insights usam só dados do usuário', () => {
    const list = generateInsights({
      transactions: [
        tx({ type: 'receita', amountCents: 1000000, date: '2026-08-05' }),
        tx({ type: 'despesa', amountCents: 100000, date: '2026-08-05' }),
        tx({ type: 'receita', amountCents: 1000000, date: '2026-09-05' }),
        tx({ type: 'despesa', amountCents: 118000, date: '2026-09-05' }),
      ],
      categories: [],
      projects: [],
      goals: [],
      referenceMonth: '2026-09',
    })
    expect(list.find((i) => i.id === 'despesa-growth')?.text).toBe('Suas despesas aumentaram 18% em relação ao mês anterior.')
    expect(generateInsights({ transactions: [], categories: [], projects: [], goals: [], referenceMonth: '2026-09' })).toEqual([])
  })
})
