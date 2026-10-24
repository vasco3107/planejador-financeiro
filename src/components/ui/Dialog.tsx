import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const prevFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const p = panel.current
      const el =
        p?.querySelector<HTMLElement>('[data-autofocus]') ??
        p?.querySelector<HTMLElement>('input:not([type=hidden]):not([tabindex="-1"]), select, textarea') ??
        p?.querySelector<HTMLElement>('button:not([data-close])')
      el?.focus()
    }, 30)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col bg-surface shadow-pop',
          'rounded-t-3xl animate-sheet-in sm:rounded-2xl sm:animate-pop-in',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl',
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2 sm:px-6 sm:pt-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
          </div>
          <Button data-close variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar" icon={<X className="size-4" />} />
        </div>
        <div className="overflow-y-auto px-5 pt-2 pb-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ---------- Confirmação (promessa) ----------

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
}

interface ConfirmState {
  opts: ConfirmOptions | null
  resolve: ((v: boolean) => void) | null
}

const useConfirmStore = create<ConfirmState>(() => ({ opts: null, resolve: null }))

/** Abre um diálogo de confirmação e resolve com a escolha do usuário. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().resolve?.(false)
    useConfirmStore.setState({ opts, resolve })
  })
}

export function ConfirmHost() {
  const { opts, resolve } = useConfirmStore()
  const done = (v: boolean) => {
    resolve?.(v)
    useConfirmStore.setState({ opts: null, resolve: null })
  }
  return (
    <Dialog
      open={!!opts}
      onClose={() => done(false)}
      size="sm"
      title={
        <span className="flex items-center gap-2.5">
          {opts?.danger && (
            <span className="grid size-8 place-items-center rounded-full bg-despesa/12 text-despesa">
              <AlertTriangle className="size-4" />
            </span>
          )}
          {opts?.title}
        </span>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => done(false)}>
            Cancelar
          </Button>
          <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => done(true)}>
            {opts?.confirmLabel ?? 'Confirmar'}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-ink-2">{opts?.message}</div>
    </Dialog>
  )
}
