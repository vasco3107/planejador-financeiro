import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { formatDateBR, parseDateBR } from '@/domain/period'
import { cn } from '@/lib/cn'

/** Máscara dd/mm/aaaa enquanto digita. */
function mask(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/**
 * Campo de data sempre no padrão brasileiro (dd/mm/aaaa), independente do idioma do navegador.
 * O valor é ISO (yyyy-mm-dd); o ícone abre o calendário nativo.
 */
export function DateInput({
  value,
  onChange,
  id,
  invalid,
  className,
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (iso: string) => void
  id?: string
  invalid?: boolean
  className?: string
  'aria-label'?: string
}) {
  const [text, setText] = useState(value ? formatDateBR(value) : '')
  const picker = useRef<HTMLInputElement>(null)

  // Sincroniza quando o valor muda por fora (ex.: reset do formulário)
  useEffect(() => {
    const current = parseDateBR(text)
    if ((current ?? '') !== value) setText(value ? formatDateBR(value) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const bad = invalid || (text.length === 10 && !parseDateBR(text))

  return (
    <div className={cn('relative', className)}>
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        value={text}
        aria-invalid={bad}
        onChange={(e) => {
          const t = mask(e.target.value)
          setText(t)
          const iso = parseDateBR(t)
          onChange(iso ?? '')
        }}
        className={cn(
          'h-11 w-full rounded-xl border border-line bg-surface pr-10 pl-3.5 text-sm text-ink placeholder:text-ink-3 num transition-colors',
          'hover:border-line-strong focus:border-brand focus:ring-3 focus:ring-[var(--ring)] focus:outline-none aria-[invalid=true]:border-despesa',
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Abrir calendário"
        onClick={() => {
          const el = picker.current
          if (!el) return
          el.value = value
          try {
            el.showPicker()
          } catch {
            el.focus()
          }
        }}
        className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink"
      >
        <CalendarDays className="size-4" />
      </button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0"
        onChange={(e) => {
          if (!e.target.value) return
          setText(formatDateBR(e.target.value))
          onChange(e.target.value)
        }}
      />
    </div>
  )
}
