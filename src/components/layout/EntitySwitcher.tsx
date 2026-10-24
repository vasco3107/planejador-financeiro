import { Building2, UserRound } from 'lucide-react'
import { ENTITY_LABELS, type Entity } from '@/domain/types'
import { cn } from '@/lib/cn'
import { useUI } from '@/store/ui'

const ICONS: Record<Entity, typeof UserRound> = { cpf: UserRound, cnpj: Building2 }

/**
 * Troca a conta aberta: CPF ou CNPJ.
 * Só muda os números da empresa — a sua carteira pessoal junta as duas.
 */
export function EntitySwitcher({ compact }: { compact?: boolean }) {
  const entity = useUI((s) => s.entity)
  const setEntity = useUI((s) => s.setEntity)

  return (
    <div role="tablist" aria-label="Conta" className={cn('flex rounded-xl bg-surface-3 p-1', compact ? 'gap-0.5' : 'gap-1')}>
      {(Object.keys(ENTITY_LABELS) as Entity[]).map((e) => {
        const Icon = ICONS[e]
        const active = entity === e
        return (
          <button
            key={e}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setEntity(e)}
            title={e === 'cpf' ? 'Faturamento no CPF' : 'Faturamento no CNPJ'}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-all',
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            <Icon className="size-3.5" />
            {!compact && ENTITY_LABELS[e]}
          </button>
        )
      })}
    </div>
  )
}
