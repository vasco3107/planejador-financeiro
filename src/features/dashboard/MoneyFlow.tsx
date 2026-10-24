import { Link } from 'react-router'
import { AlertTriangle, ArrowRight, ChevronRight } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import type { Totals } from '@/domain/finance'
import { formatBRL, formatBps, formatPercent } from '@/domain/money'
import type { Bps, Cents } from '@/domain/types'
import { useColors } from '@/lib/colors'
import { cn } from '@/lib/cn'

export interface FlowPerson {
  id: string
  name: string
  color: string
  /** Quanto essa pessoa retirou de verdade */
  retirado: Cents
  /** Quanto a divisão sugere — só referência, não preenche nada */
  referencia: Cents | null
  bps: Bps | null
}

function Step({ label, value, sub, color, className }: { label: string; value: string; sub?: string; color: string; className?: string }) {
  return (
    <div className={cn('rounded-xl bg-surface-2 p-3.5 ring-1 ring-line ring-inset', className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </div>
      <div className="mt-1.5 text-lg font-semibold tracking-tight num">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  )
}

const Arrow = () => (
  <div className="flex items-center justify-center text-ink-3 max-md:rotate-90 max-md:py-0.5">
    <ArrowRight className="size-4" />
  </div>
)

/**
 * Faturamento → Despesas → Lucro → Retiradas.
 * Todos os valores vêm do que foi lançado; a divisão em % aparece só como referência.
 */
export function MoneyFlow({ totals, people }: { totals: Totals; people: FlowPerson[] }) {
  const c = useColors()
  const naoRetirado = Math.max(totals.saldoDisponivel, 0)
  const segments = [
    { key: 'despesas', name: 'Despesas', color: c.despesa, cents: totals.despesa },
    ...people.map((p) => ({ key: p.id, name: p.name, color: p.color, cents: p.retirado })),
    { key: 'guardado', name: 'Guardado na empresa', color: c.investimento, cents: totals.guardado },
    { key: 'nao-retirado', name: 'Livre', color: c.saldo, cents: naoRetirado },
  ]
  const segTotal = segments.reduce((s, x) => s + x.cents, 0)
  const noProfit = totals.lucro <= 0 && totals.receita + totals.despesa > 0

  return (
    <Card>
      <CardHeader
        title="Para onde foi o dinheiro"
        subtitle="Faturamento → Despesas → Lucro → Retiradas, tudo pelo que você lançou"
        action={
          <Link to="/socios" className="flex items-center gap-0.5 text-[13px] font-medium text-brand hover:underline">
            Sócios <ChevronRight className="size-3.5" />
          </Link>
        }
      />
      <CardBody className="space-y-5">
        <div>
          <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-surface-3">
            {segTotal > 0 &&
              segments
                .filter((s) => s.cents > 0)
                .map((s) => (
                  <div
                    key={s.key}
                    title={`${s.name}: ${formatBRL(s.cents)}`}
                    className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${(s.cents / segTotal) * 100}%`, backgroundColor: s.color }}
                  />
                ))}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
            {segments.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-xs text-ink-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
                <span className="text-ink-3 num">{segTotal ? formatPercent((s.cents / segTotal) * 100, 0) : '—'}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1.4fr] md:items-stretch">
          <Step label="Faturamento" value={formatBRL(totals.receita)} color={c.receita} sub={`${formatBRL(totals.receitaRecebida)} já na conta`} />
          <Arrow />
          <Step
            label="Despesas"
            value={`− ${formatBRL(totals.despesa)}`}
            color={c.despesa}
            sub={totals.receita ? `${formatPercent((totals.despesa / totals.receita) * 100, 0)} do faturamento` : 'Assinaturas, APIs e taxas'}
          />
          <Arrow />
          <Step
            label="Lucro líquido"
            value={formatBRL(totals.lucro)}
            color={c.lucro}
            sub={`Margem ${formatPercent(totals.margem, 1)}`}
            className={cn(totals.lucro < 0 && '[&>div:nth-child(2)]:text-despesa')}
          />
          <Arrow />
          {noProfit ? (
            <div className="flex items-center gap-3 rounded-xl bg-despesa/8 p-3.5 text-sm text-ink-2 ring-1 ring-despesa/20 ring-inset">
              <AlertTriangle className="size-4 shrink-0 text-despesa" />
              Sem lucro no período.
            </div>
          ) : (
            <div className="rounded-xl bg-surface-2 p-3.5 ring-1 ring-line ring-inset">
              <div className="text-xs font-medium text-ink-3">Destino do lucro</div>
              <ul className="mt-2 space-y-2.5">
                {people.map((p) => (
                  <li key={p.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-1.5 text-ink-2">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="font-semibold num">{formatBRL(p.retirado)}</span>
                    </div>
                    {p.referencia !== null && p.bps !== null && (
                      <p className="mt-0.5 text-[11px] text-ink-3 num">
                        referência: {formatBps(p.bps)} = {formatBRL(p.referencia)}
                      </p>
                    )}
                  </li>
                ))}
                {totals.guardado > 0 && (
                  <li className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: c.investimento }} />
                      Guardado na empresa
                    </span>
                    <span className="font-semibold num">{formatBRL(totals.guardado)}</span>
                  </li>
                )}
                <li className="flex items-baseline justify-between gap-2 border-t border-line pt-2 text-sm">
                  <span className="flex items-center gap-1.5 text-ink-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: c.saldo }} />
                    Livre
                  </span>
                  <span className={cn('font-semibold num', totals.saldoDisponivel < 0 && 'text-despesa')}>{formatBRL(totals.saldoDisponivel)}</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
