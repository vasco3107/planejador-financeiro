import { endOfMonth, format, subMonths } from 'date-fns'
import { CAIXA_BUCKET } from '@/domain/distribution'
import type { Goal, Partner, Project, Transaction } from '@/domain/types'
import { db, newId } from './db'

/** Gerador pseudoaleatório determinístico, para a demonstração ser sempre igual. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

/**
 * Popula 12 meses de dados fictícios de uma empresa digital e da carteira do sócio
 * (substitui lançamentos, sócios, projetos, metas e regras existentes).
 */
export async function loadDemoData(): Promise<void> {
  const rand = rng(42)
  const now = new Date()
  const txs: Transaction[] = []
  const ts = Date.now()
  const add = (t: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: Transaction['status'] }) =>
    txs.push({ status: 'confirmado', ...t, id: newId(), createdAt: ts, updatedAt: ts })
  const vary = (base: number, pct: number) => Math.round(base * (1 + (rand() * 2 - 1) * pct))

  const projects: Project[] = [
    { id: newId(), name: 'Novo SaaS', description: 'Plataforma de automação para agências', targetCents: 2000000, color: '#0d9488', archived: false, createdAt: ts },
    { id: newId(), name: 'Curso online', description: 'Gravação e lançamento', targetCents: 1200000, color: '#2563eb', archived: false, createdAt: ts + 1 },
    { id: newId(), name: 'App mobile', targetCents: 3500000, color: '#db2777', archived: false, createdAt: ts + 2 },
  ]
  const goals: Goal[] = [
    { id: newId(), name: 'Comprar novo computador', targetCents: 800000, icon: 'laptop', archived: false, createdAt: ts },
    { id: newId(), name: 'Reserva de emergência', targetCents: 3000000, icon: 'shield', archived: false, createdAt: ts + 1 },
    { id: newId(), name: 'Viagem de equipe', targetCents: 1500000, icon: 'plane', archived: false, createdAt: ts + 2 },
  ]

  const partners: Partner[] = [{ id: newId(), name: 'Sócio (exemplo)', color: '#2563eb', archived: false, createdAt: ts }]

  for (let i = 11; i >= 0; i--) {
    const month = subMonths(now, i)
    const ym = format(month, 'yyyy-MM')
    const last = i === 0 ? now.getDate() : endOfMonth(month).getDate()
    const day = (d: number) => `${ym}-${String(Math.min(d, last)).padStart(2, '0')}`
    const g = 1 + (11 - i) * 0.07 // crescimento mensal

    add({ type: 'receita', amountCents: vary(620000 * g, 0.06), date: day(5), description: 'Assinaturas mensais', categoryId: 'rec-saas', source: 'Stripe' })
    add({ type: 'receita', amountCents: vary(180000 * g, 0.25), date: day(12), description: 'Vendas da loja', categoryId: 'rec-ecommerce', source: 'Loja virtual' })
    if (rand() > 0.3) add({ type: 'receita', amountCents: vary(350000, 0.4), date: day(18), description: 'Projeto de consultoria', categoryId: 'rec-servicos', source: 'Cliente B2B' })
    if (rand() > 0.6) add({ type: 'receita', amountCents: vary(120000, 0.3), date: day(24), description: 'Landing page freelance', categoryId: 'rec-freelance', source: 'Indicação' })

    add({ type: 'despesa', amountCents: 55000, date: day(2), description: 'Claude Max + ChatGPT', categoryId: 'desp-ia-assinaturas', expenseKind: 'recorrente' })
    add({ type: 'despesa', amountCents: vary(90000 * g, 0.3), date: day(3), description: 'Consumo de APIs de IA', categoryId: 'desp-ia-apis', expenseKind: 'variavel' })
    add({ type: 'despesa', amountCents: vary(38000, 0.1), date: day(4), description: 'Servidores e banco de dados', categoryId: 'desp-hospedagem', expenseKind: 'recorrente' })
    add({ type: 'despesa', amountCents: 24000, date: day(6), description: 'Figma, Notion e GitHub', categoryId: 'desp-softwares', expenseKind: 'recorrente' })
    add({ type: 'despesa', amountCents: vary(120000, 0.35), date: day(10), description: 'Anúncios', categoryId: 'desp-marketing', expenseKind: 'variavel' })
    add({ type: 'despesa', amountCents: 250000, date: day(5), description: 'Desenvolvedor PJ', categoryId: 'desp-funcionarios', expenseKind: 'fixa' })
    add({ type: 'despesa', amountCents: vary(70000 * g, 0.05), date: day(20), description: 'DAS Simples Nacional', categoryId: 'desp-impostos', expenseKind: 'fixa' })
    add({ type: 'despesa', amountCents: 15000, date: day(8), description: 'Contabilidade', categoryId: 'desp-operacionais', expenseKind: 'fixa' })
    if (i % 12 === 3) add({ type: 'despesa', amountCents: 18000, date: day(15), description: 'Renovação de domínios', categoryId: 'desp-dominios', expenseKind: 'pontual' })
    if (i === 7) add({ type: 'despesa', amountCents: 450000, date: day(14), description: 'Monitor e periféricos', categoryId: 'desp-equipamentos', expenseKind: 'pontual' })

    if (i > 0) {
      add({ type: 'investimento', amountCents: vary(60000 * g, 0.15), date: day(25), description: 'Aporte Tesouro Selic', source: 'Tesouro Direto' })
      add({ type: 'investimento', amountCents: vary(20000, 0.2), date: day(26), description: 'Aporte CDB liquidez diária', source: 'Banco' })
      add({ type: 'reserva', amountCents: vary(40000 * g, 0.2), date: day(27), description: `Reserva: ${projects[i % 3].name}`, projectId: projects[i % 3].id })
      add({ type: 'reserva', amountCents: vary(20000 * g, 0.2), date: day(28), description: `Reserva: ${goals[i % 3].name}`, goalId: goals[i % 3].id })
      // Carteira pessoal: retirada mensal do lucro e rendas por fora
      add({ type: 'retirada', amountCents: vary(200000 * g, 0.1), date: day(24), description: 'Retirada de lucro' })
      add({ type: 'retirada', amountCents: vary(200000 * g, 0.1), date: day(24), description: 'Retirada de lucro', partnerId: partners[0].id })
      if (rand() > 0.5) add({ type: 'pessoal', amountCents: vary(90000, 0.4), date: day(16), description: 'Projeto freelance', categoryId: 'pf-freelance', source: 'Cliente PF' })
      add({ type: 'pessoal', amountCents: vary(12000, 0.2), date: day(1), description: 'Rendimento da poupança', categoryId: 'pf-rendimentos', source: 'Banco' })
      // Gastos pessoais e dinheiro guardado sem projeto
      add({ type: 'gasto', amountCents: 50000, date: day(26), description: 'Aluguel', categoryId: 'pg-moradia' })
      add({ type: 'gasto', amountCents: vary(35000, 0.2), date: day(27), description: 'Mercado', categoryId: 'pg-alimentacao' })
      add({ type: 'gasto', amountCents: vary(15000, 0.5), date: day(28), description: 'Restaurantes e lazer', categoryId: 'pg-lazer' })
      add({ type: 'gasto', amountCents: 6000, date: day(26), description: 'Streaming e academia', categoryId: 'pg-assinaturas' })
      if (i % 2 === 0) add({ type: 'reserva', amountCents: vary(20000, 0.3), date: day(29), description: 'Poupança' })
    } else {
      add({ type: 'despesa', amountCents: 32000, date: day(28), description: 'Ferramenta de e-mail marketing', categoryId: 'desp-softwares', expenseKind: 'recorrente', status: 'pendente' })
    }
  }

  await db.transaction('rw', [db.transactions, db.projects, db.goals, db.distributions, db.partners], async () => {
    await db.partners.clear()
    await db.partners.bulkAdd(partners)
    await db.transactions.clear()
    await db.projects.clear()
    await db.goals.clear()
    await db.distributions.clear()
    await db.transactions.bulkAdd(txs)
    await db.projects.bulkAdd(projects)
    await db.goals.bulkAdd(goals)
    const from = format(subMonths(now, 11), 'yyyy-MM')
    await db.distributions.bulkAdd([
      {
        // Empresa: 40% para você, 40% para o sócio, 20% fica no caixa
        id: newId(),
        scope: 'empresa',
        effectiveFrom: from,
        buckets: [
          { key: 'minha-parte', name: 'Você', color: '#db2777', bps: 4000, role: 'retirada' },
          { key: `socio-${partners[0].id}`, name: partners[0].name, color: partners[0].color, bps: 4000, role: 'retirada', partnerId: partners[0].id },
          { ...CAIXA_BUCKET, bps: 2000 },
        ],
        createdAt: ts,
      },
    ])
  })
}
