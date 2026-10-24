import { useMemo, useState } from 'react'
import { differenceInCalendarDays } from 'date-fns'
import { Check, Clock, Info, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { DateInput } from '@/components/ui/DateInput'
import { confirmDialog } from '@/components/ui/Dialog'
import { Field, Input, MoneyInput } from '@/components/ui/Form'
import { Badge, EmptyState, PageHeader, Segmented, Stat } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { useExpected } from '@/data/hooks'
import { expectedRepo } from '@/data/repositories'
import { formatBRL } from '@/domain/money'
import { formatDateBR, todayISO } from '@/domain/period'
import { parseISO } from 'date-fns'
import type { ExpectedReceipt } from '@/domain/types'
import { useColors } from '@/lib/colors'
import { cn } from '@/lib/cn'

const atrasoEmDias = (r: ExpectedReceipt) => differenceInCalendarDays(parseISO(todayISO()), parseISO(r.expectedDate))

/**
 * Controle à parte dos valores que deveriam ter chegado e ainda não caíram.
 * Nada aqui entra em faturamento, recebido, despesas ou lucro.
 */
export default function AChegarPage() {
  const itens = useExpected()
  const c = useColors()
  const [filtro, setFiltro] = useState<'abertos' | 'recebidos'>('abertos')
  const [valor, setValor] = useState(0)
  const [data, setData] = useState(todayISO())
  const [descricao, setDescricao] = useState('')
  const [origem, setOrigem] = useState('Stripe')

  const lista = useMemo(() => itens ?? [], [itens])
  const abertos = lista.filter((r) => !r.receivedDate)
  const recebidos = lista.filter((r) => r.receivedDate)
  const total = abertos.reduce((s, r) => s + r.amountCents, 0)
  const atrasados = abertos.filter((r) => atrasoEmDias(r) > 0)
  const visiveis = (filtro === 'abertos' ? abertos : recebidos).slice().sort((a, b) => b.expectedDate.localeCompare(a.expectedDate))

  const adicionar = async () => {
    if (valor <= 0 || !data) return
    await expectedRepo.create({
      amountCents: valor,
      expectedDate: data,
      description: descricao.trim() || 'Valor a chegar',
      source: origem.trim() || undefined,
    })
    setValor(0)
    setDescricao('')
    toast('Valor anotado')
  }

  const baixar = async (r: ExpectedReceipt) => {
    await expectedRepo.markReceived(r.id, todayISO())
    toast(`${formatBRL(r.amountCents)} marcado como recebido`)
  }

  const excluir = async (r: ExpectedReceipt) => {
    const ok = await confirmDialog({
      title: 'Excluir este valor?',
      danger: true,
      confirmLabel: 'Excluir',
      message: `${formatBRL(r.amountCents)} previsto para ${formatDateBR(r.expectedDate)} sai deste controle.`,
    })
    if (!ok) return
    await expectedRepo.remove(r.id)
    toast('Removido')
  }

  return (
    <div className="space-y-5 animate-fade-in lg:space-y-6">
      <PageHeader
        title="A chegar"
        subtitle="Valores que já foram dados como pagos mas ainda não caíram na conta. Controle à parte."
      />

      <p className="flex items-start gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-2">
        <Info className="mt-px size-4 shrink-0 text-ink-3" />
        Esta página não mexe em nada: faturamento, recebido, despesas, lucro e retiradas continuam exatamente como estão. É só uma lista de cobrança sua.
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Em aberto" value={formatBRL(total)} color={c.reserva} icon={<Clock className="size-4" />} sub={`${abertos.length} ${abertos.length === 1 ? 'valor' : 'valores'}`} />
        <Stat label="Atrasados" value={atrasados.length} color={c.despesa} sub={atrasados.length ? `${formatBRL(atrasados.reduce((s, r) => s + r.amountCents, 0))} passou da data` : 'Nenhum'} />
        <Stat label="Já recebidos" value={formatBRL(recebidos.reduce((s, r) => s + r.amountCents, 0))} color={c.receita} sub={`${recebidos.length} com baixa`} />
        <Stat label="Próximo previsto" value={abertos.length ? formatDateBR(abertos.map((r) => r.expectedDate).sort()[0]) : '—'} sub="Data mais próxima" />
      </div>

      <Card>
        <CardHeader title="Anotar valor" subtitle="Quanto era para ter chegado e em que dia" />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem_1fr_9rem_auto] sm:items-end">
            <Field label="Valor">
              <MoneyInput value={valor} onChange={setValor} large />
            </Field>
            <Field label="Data prevista">
              <DateInput value={data} onChange={setData} />
            </Field>
            <Field label="Descrição">
              <Input value={descricao} maxLength={60} placeholder="Ex.: pagamento do cliente X" onChange={(e) => setDescricao(e.target.value)} />
            </Field>
            <Field label="Origem">
              <Input value={origem} maxLength={20} onChange={(e) => setOrigem(e.target.value)} />
            </Field>
            <Button className="mb-0.5" size="lg" icon={<Plus className="size-4" />} onClick={adicionar} disabled={valor <= 0 || !data}>
              Anotar
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={filtro === 'abertos' ? 'Esperando cair' : 'Com baixa'}
          subtitle={`${visiveis.length} ${visiveis.length === 1 ? 'item' : 'itens'}`}
          action={
            <Segmented
              size="sm"
              value={filtro}
              onChange={setFiltro}
              options={[
                { value: 'abertos', label: `Em aberto (${abertos.length})` },
                { value: 'recebidos', label: `Recebidos (${recebidos.length})` },
              ]}
            />
          }
        />
        <CardBody>
          {visiveis.length === 0 ? (
            <EmptyState
              icon={<Clock className="size-5" />}
              title={filtro === 'abertos' ? 'Nada esperando' : 'Nenhuma baixa ainda'}
              text={filtro === 'abertos' ? 'Anote acima os valores que a plataforma deu como pagos e ainda não caíram.' : undefined}
            />
          ) : (
            <ul className="divide-y divide-line">
              {visiveis.map((r) => {
                const dias = atrasoEmDias(r)
                const atrasado = !r.receivedDate && dias > 0
                return (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.description}</p>
                      <p className="truncate text-xs text-ink-3">
                        previsto {formatDateBR(r.expectedDate)}
                        {r.source && ` · ${r.source}`}
                        {r.receivedDate && ` · recebido em ${formatDateBR(r.receivedDate)}`}
                      </p>
                    </div>
                    {atrasado && <Badge color={c.despesa}>{dias} {dias === 1 ? 'dia' : 'dias'} de atraso</Badge>}
                    <span className={cn('font-semibold whitespace-nowrap num', r.receivedDate && 'text-ink-3 line-through')}>{formatBRL(r.amountCents)}</span>
                    {r.receivedDate ? (
                      <Button size="icon-sm" variant="ghost" aria-label="Reabrir" title="Reabrir" onClick={() => expectedRepo.reopen(r.id)} icon={<RotateCcw className="size-3.5" />} />
                    ) : (
                      <Button size="sm" variant="secondary" icon={<Check className="size-3.5" />} onClick={() => baixar(r)}>
                        Caiu
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" className="hover:text-despesa" aria-label="Excluir" onClick={() => excluir(r)} icon={<Trash2 className="size-3.5" />} />
                  </li>
                )
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
