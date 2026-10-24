import { useState } from 'react'
import { Link } from 'react-router'
import { Check, Info, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { DateInput } from '@/components/ui/DateInput'
import { Field, MoneyInput } from '@/components/ui/Form'
import { Progress } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { paymentsRepo } from '@/data/repositories'
import { receivedOf } from '@/domain/finance'
import { formatBRL, formatPercent } from '@/domain/money'
import { formatRangeBR, todayISO } from '@/domain/period'
import { billed } from '@/domain/receipts'
import type { DateRange, Transaction } from '@/domain/types'
import { useColors } from '@/lib/colors'
import { cn } from '@/lib/cn'

/**
 * Saldo do faturamento do período.
 * Você informa quanto caiu na conta; as taxas vêm das despesas lançadas na
 * categoria "Taxas de plataforma" e já abatem do que falta receber.
 */
export function BillingCard({ receitas, taxas, range }: { receitas: Transaction[]; taxas: number; range: DateRange }) {
  const c = useColors()
  const lancado = billed(receitas)
  const naConta = receitas.reduce((s, t) => s + receivedOf(t), 0)
  const liquidado = Math.min(naConta + taxas, lancado)
  const falta = lancado - liquidado
  const pct = lancado > 0 ? (liquidado / lancado) * 100 : 0

  const [mode, setMode] = useState<'somar' | 'corrigir'>('somar')
  const [value, setValue] = useState(0)
  const [date, setDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const add = Math.min(value, Math.max(lancado - naConta, 0))
  const fix = Math.min(value, lancado)
  const canSave = mode === 'somar' ? add > 0 && !!date : fix !== naConta

  const save = async () => {
    setSaving(true)
    try {
      if (mode === 'somar') {
        await paymentsRepo.addToTotal(receitas, add, date, 'Caiu na conta')
        toast(`+ ${formatBRL(add)} na conta · total ${formatBRL(naConta + add)}`)
      } else {
        await paymentsRepo.setTotal(receitas, fix, date)
        toast(`Total na conta corrigido para ${formatBRL(fix)}`)
      }
      setValue(0)
      setMode('somar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Saldo do faturamento"
        subtitle={`Quanto do faturamento já foi resolvido · ${formatRangeBR(range)}`}
        action={
          <div className="flex items-center gap-3">
          <Link to="/a-chegar" className="text-[13px] font-medium text-ink-3 hover:text-brand hover:underline">
            A chegar
          </Link>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'somar' ? 'corrigir' : 'somar')
              setValue(mode === 'somar' ? naConta : 0)
            }}
            className="text-[13px] font-medium text-brand hover:underline"
          >
            {mode === 'somar' ? 'Corrigir total' : 'Voltar a somar'}
          </button>
          </div>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-ink-3">Faturamento lançado</p>
            <p className="mt-1 text-xl font-semibold tracking-tight num sm:text-2xl">{formatBRL(lancado)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">Caiu na conta</p>
            <p className="mt-1 text-xl font-semibold tracking-tight num sm:text-2xl" style={{ color: c.receita }}>{formatBRL(naConta)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">Taxas retidas</p>
            <p className="mt-1 text-xl font-semibold tracking-tight num sm:text-2xl">{formatBRL(taxas)}</p>
            <p className="text-xs text-ink-3">Categoria "Taxas de plataforma"</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">Falta receber</p>
            <p className={cn('mt-1 text-xl font-semibold tracking-tight num sm:text-2xl', falta === 0 && 'text-ink-3')}>{formatBRL(Math.max(falta, 0))}</p>
          </div>
        </div>

        <div>
          <Progress value={pct} color={c.receita} height={10} />
          <p className="mt-2 text-xs font-medium text-ink-3 num">{formatPercent(pct, 1)} do faturamento já resolvido (conta + taxas)</p>
        </div>

        <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
          <Field
            label={mode === 'somar' ? 'Caiu na conta agora' : 'Total que já caiu na conta (corrigir)'}
            hint={
              mode === 'somar'
                ? add > 0
                  ? `Novo total na conta: ${formatBRL(naConta + add)}`
                  : 'Soma ao que já tinha caído'
                : 'Substitui o total já recebido do período'
            }
          >
            <MoneyInput value={value} onChange={setValue} large />
          </Field>
          <Field label="Data">
            <DateInput value={date} onChange={setDate} />
          </Field>
          <Button
            className="mb-0.5"
            size="lg"
            icon={mode === 'somar' ? <Plus className="size-4" /> : <Check className="size-4" />}
            onClick={save}
            disabled={!canSave || saving || receitas.length === 0}
          >
            {mode === 'somar' ? 'Somar' : 'Corrigir'}
          </Button>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-ink-3">
          <Info className="mt-px size-3.5 shrink-0" />
          As taxas que você lança como despesa na categoria "Taxas de plataforma" já abatem daqui — por isso o "falta receber" fecha em zero quando tudo for repassado.
        </p>
      </CardBody>
    </Card>
  )
}
