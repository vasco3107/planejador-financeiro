import { computeTotals, groupByMonth, growth } from './finance'
import { formatBRL, formatPercent } from './money'
import { monthName, previousMonthKey } from './period'
import { totalsByCategory } from './reports'
import type { Category, Goal, Project, Transaction } from './types'

export type InsightTone = 'positive' | 'negative' | 'neutral' | 'warning'

export interface Insight {
  id: string
  tone: InsightTone
  title: string
  text: string
  /** Quanto maior, mais relevante */
  weight: number
}

const pct = (v: number) => formatPercent(Math.abs(v), 0)

/**
 * Gera insights a partir exclusivamente dos lançamentos do usuário.
 * Compara o mês de referência com o anterior. Só fala quando há dados suficientes.
 */
export function generateInsights(input: {
  transactions: Transaction[]
  categories: Category[]
  /** Opcional: projetos e metas da sua carteira, para avisar quando estiverem perto de concluir */
  projects?: Project[]
  goals?: Goal[]
  referenceMonth: string
}): Insight[] {
  const { transactions, categories, projects = [], goals = [], referenceMonth } = input
  const out: Insight[] = []
  const byMonth = groupByMonth(transactions)
  const curList = byMonth.get(referenceMonth) ?? []
  const prevKey = previousMonthKey(referenceMonth)
  const prevList = byMonth.get(prevKey) ?? []
  const cur = computeTotals(curList)
  const prev = computeTotals(prevList)
  const hasPrev = prevList.length > 0
  const curName = monthName(referenceMonth).toLowerCase()

  // Despesas vs mês anterior
  const dg = growth(cur.despesa, prev.despesa)
  if (hasPrev && dg !== null && Math.abs(dg) >= 5) {
    out.push({
      id: 'despesa-growth',
      tone: dg > 0 ? 'warning' : 'positive',
      title: dg > 0 ? 'Despesas em alta' : 'Despesas em queda',
      text: `Suas despesas ${dg > 0 ? 'aumentaram' : 'diminuíram'} ${pct(dg)} em relação ao mês anterior.`,
      weight: 60 + Math.min(Math.abs(dg), 40),
    })
  }

  // Lucro vs mês anterior (em R$)
  if (hasPrev && cur.receita + cur.despesa > 0) {
    const delta = cur.lucro - prev.lucro
    if (delta !== 0) {
      out.push({
        id: 'lucro-delta',
        tone: delta > 0 ? 'positive' : 'negative',
        title: delta > 0 ? 'Lucro crescendo' : 'Lucro recuou',
        text: `Seu lucro ${delta > 0 ? 'aumentou' : 'caiu'} ${formatBRL(Math.abs(delta))} em relação ao mês passado.`,
        weight: 80,
      })
    }
  }

  // Receita vs mês anterior
  const rg = growth(cur.receita, prev.receita)
  if (hasPrev && rg !== null && Math.abs(rg) >= 5) {
    out.push({
      id: 'receita-growth',
      tone: rg > 0 ? 'positive' : 'negative',
      title: rg > 0 ? 'Receita em alta' : 'Receita em queda',
      text: `Sua receita ${rg > 0 ? 'cresceu' : 'caiu'} ${pct(rg)} em ${curName} comparado ao mês anterior.`,
      weight: 55 + Math.min(Math.abs(rg), 40),
    })
  }

  // Quanto do lucro saiu em retiradas
  if (cur.lucro > 0 && cur.retirado > 0) {
    const share = (cur.retirado / cur.lucro) * 100
    out.push({
      id: 'retirada-share',
      tone: share > 100 ? 'warning' : 'neutral',
      title: share > 100 ? 'Retiradas acima do lucro' : 'Retiradas do mês',
      text: `As retiradas somaram ${formatPercent(share, 0)} do lucro de ${curName}.`,
      weight: share > 100 ? 75 : 50,
    })
  }

  // Maior categoria de despesa
  const cats = totalsByCategory(curList, categories, 'despesa')
  if (cats.length > 0 && cur.despesa > 0) {
    const top = cats[0]
    out.push({
      id: 'top-category',
      tone: top.share >= 40 ? 'warning' : 'neutral',
      title: 'Maior centro de custo',
      text: `${top.name} representa ${formatPercent(top.share, 0)} das suas despesas em ${curName}.`,
      weight: 45 + (top.share >= 40 ? 20 : 0),
    })
    // Categorias ligadas a IA/software
    const tech = cats.filter((c) => /ia|software|api|assinatura|hospedagem/i.test(c.name) && c !== top)
    const techTotal = tech.reduce((s, c) => s + c.share, 0)
    if (tech.length > 0 && techTotal >= 5) {
      out.push({
        id: 'tech-share',
        tone: 'neutral',
        title: 'Custo de tecnologia',
        text: `${tech.map((c) => c.name).join(', ')} somam ${formatPercent(techTotal, 0)} das suas despesas.`,
        weight: 35,
      })
    }
  }

  // Margem
  if (cur.receita > 0 && cur.margem !== null) {
    if (cur.lucro < 0) {
      out.push({
        id: 'prejuizo',
        tone: 'negative',
        title: 'Mês no vermelho',
        text: `As despesas superaram a receita em ${formatBRL(-cur.lucro)} em ${curName}. Não há lucro a distribuir.`,
        weight: 100,
      })
    } else {
      const allMonths = [...byMonth.entries()].filter(([k]) => k < referenceMonth)
      const margins = allMonths.map(([, l]) => computeTotals(l).margem).filter((m): m is number => m !== null)
      if (margins.length >= 2) {
        const avg = margins.reduce((s, m) => s + m, 0) / margins.length
        const diff = cur.margem - avg
        if (Math.abs(diff) >= 5) {
          out.push({
            id: 'margem-media',
            tone: diff > 0 ? 'positive' : 'warning',
            title: diff > 0 ? 'Margem acima da média' : 'Margem abaixo da média',
            text: `Sua margem de ${formatPercent(cur.margem, 1)} está ${formatPercent(Math.abs(diff), 1).replace('%', '')} p.p. ${diff > 0 ? 'acima' : 'abaixo'} da sua média histórica.`,
            weight: 58,
          })
        }
      }
    }
  }

  // Contas pendentes
  if (cur.despesaPendente > 0) {
    out.push({
      id: 'pendentes',
      tone: 'warning',
      title: 'Contas a pagar',
      text: `Há ${formatBRL(cur.despesaPendente)} em despesas pendentes neste mês.`,
      weight: 52,
    })
  }
  if (cur.receitaPendente > 0) {
    out.push({
      id: 'a-receber',
      tone: 'neutral',
      title: 'Valores a receber',
      text: `Há ${formatBRL(cur.receitaPendente)} em receitas pendentes neste mês.`,
      weight: 40,
    })
  }

  // Projetos/metas próximos de concluir
  const reservedBy = (key: 'projectId' | 'goalId', id: string) =>
    transactions
      .filter((t) => t.type === 'reserva' && t.status === 'confirmado' && t[key] === id)
      .reduce((s, t) => s + t.amountCents, 0)
  const targets = [
    ...projects.filter((p) => !p.archived).map((p) => ({ kind: 'projeto', name: p.name, target: p.targetCents, saved: reservedBy('projectId', p.id) })),
    ...goals.filter((g) => !g.archived).map((g) => ({ kind: 'meta', name: g.name, target: g.targetCents, saved: reservedBy('goalId', g.id) })),
  ]
  for (const t of targets) {
    if (t.target <= 0) continue
    const p = (t.saved / t.target) * 100
    if (p >= 100) {
      out.push({ id: `done-${t.name}`, tone: 'positive', title: 'Objetivo alcançado', text: `A ${t.kind} "${t.name}" atingiu 100% do valor planejado.`, weight: 70 })
    } else if (p >= 75) {
      out.push({ id: `near-${t.name}`, tone: 'positive', title: 'Quase lá', text: `A ${t.kind} "${t.name}" está em ${formatPercent(p, 0)}. Faltam ${formatBRL(t.target - t.saved)}.`, weight: 48 })
    }
  }

  return out.sort((a, b) => b.weight - a.weight)
}
