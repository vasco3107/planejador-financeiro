import { Check, Cloud, CloudOff, Loader2, LogOut, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { confirmDialog } from '@/components/ui/Dialog'
import { useSyncStatus } from '@/data/sync'
import { cn } from '@/lib/cn'
import { sair } from './AuthGate'

const MINUTO = 60_000

function quando(ts: number | null): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < MINUTO) return 'agora'
  if (diff < 60 * MINUTO) return `há ${Math.floor(diff / MINUTO)} min`
  return `há ${Math.floor(diff / (60 * MINUTO))} h`
}

/** Mostra o estado da sincronização e permite sair da conta. */
export function SyncBadge({ compact }: { compact?: boolean }) {
  const { state, lastSync, error, email } = useSyncStatus()
  if (state === 'desligado') return null

  const Icon = state === 'sincronizando' ? Loader2 : state === 'erro' ? CloudOff : state === 'ok' ? Check : Cloud
  const texto =
    state === 'sincronizando' ? 'Sincronizando…' : state === 'erro' ? 'Falhou' : state === 'ok' ? `Salvo ${quando(lastSync)}` : 'Conectando'

  const desconectar = async () => {
    const ok = await confirmDialog({
      title: 'Sair da conta?',
      confirmLabel: 'Sair',
      message: 'Os dados continuam na nuvem. Neste aparelho eles seguem salvos até você entrar com outra conta.',
    })
    if (ok) await sair()
  }

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        title={error ?? `${email ?? ''} · ${texto}`}
        onClick={desconectar}
        aria-label="Conta e sincronização"
        icon={<Icon className={cn('size-4', state === 'sincronizando' && 'animate-spin', state === 'erro' && 'text-despesa')} />}
      />
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-ink-3">
      <Icon className={cn('size-3.5 shrink-0', state === 'sincronizando' && 'animate-spin', state === 'erro' && 'text-despesa')} />
      <span className="min-w-0 flex-1 truncate" title={error ?? email ?? undefined}>
        {error ? error : email}
      </span>
      <span className="shrink-0">{texto}</span>
      <button type="button" onClick={desconectar} title="Sair da conta" className="shrink-0 rounded p-1 hover:bg-surface-3 hover:text-ink">
        <LogOut className="size-3.5" />
      </button>
    </div>
  )
}

export { RefreshCw }
