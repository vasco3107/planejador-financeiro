import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/cn'

type ToastKind = 'success' | 'error' | 'info'
interface ToastAction {
  label: string
  onClick: () => void
}
interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  action?: ToastAction
}

const useToasts = create<{ items: ToastItem[] }>(() => ({ items: [] }))
let seq = 0

const dismiss = (id: number) => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) }))

/** Mostra um aviso rápido. Com ação, fica mais tempo na tela. */
export function toast(message: string, kind: ToastKind = 'success', action?: ToastAction) {
  const id = ++seq
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, kind, message, action }] }))
  setTimeout(() => dismiss(id), action ? 7000 : 3200)
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }
const COLORS = { success: 'text-receita', error: 'text-despesa', info: 'text-lucro' }

export function ToastHost() {
  const items = useToasts((s) => s.items)
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {items.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium shadow-pop animate-pop-in"
          >
            <Icon className={cn('size-4.5 shrink-0', COLORS[t.kind])} />
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  dismiss(t.id)
                }}
                className="ml-1 shrink-0 rounded-lg px-2 py-1 text-[13px] font-semibold text-brand hover:bg-brand-soft"
              >
                {t.action.label}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
