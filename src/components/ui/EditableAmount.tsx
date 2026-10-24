import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { formatBRL, formatDecimal, maskBRLInput } from '@/domain/money'
import { cn } from '@/lib/cn'

/**
 * Valor que pode ser editado no próprio card: clica no lápis, digita e salva.
 * Enter salva, Esc cancela.
 */
export function EditableAmount({
  value,
  onSave,
  className,
  label,
  disabled,
  disabledHint,
}: {
  value: number
  onSave: (cents: number) => Promise<void> | void
  className?: string
  label: string
  disabled?: boolean
  disabledHint?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(value)
      setTimeout(() => input.current?.select(), 20)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const save = async () => {
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-ink-3">R$</span>
          <input
            ref={input}
            aria-label={`Novo valor de ${label}`}
            inputMode="numeric"
            value={draft ? formatDecimal(draft) : ''}
            onChange={(e) => setDraft(maskBRLInput(e.target.value).cents)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="h-10 w-full rounded-xl border border-brand bg-surface pr-2 pl-9 text-lg font-semibold text-ink num focus:ring-3 focus:ring-[var(--ring)] focus:outline-none"
          />
        </div>
        <button type="button" aria-label="Salvar" disabled={saving} onClick={save} className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-white dark:text-[#04201d]">
          <Check className="size-4" />
        </button>
        <button type="button" aria-label="Cancelar" onClick={() => setEditing(false)} className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-3">
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      title={disabled ? disabledHint : `Editar ${label}`}
      onClick={() => setEditing(true)}
      className={cn('group mt-1 flex w-full min-w-0 items-center gap-1.5 text-left', disabled && 'cursor-default', className)}
    >
      <span className="min-w-0 truncate">{formatBRL(value)}</span>
      {!disabled && <Pencil className="size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />}
    </button>
  )
}
