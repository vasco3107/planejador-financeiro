import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { formatDecimal, maskBRLInput } from '@/domain/money'
import { cn } from '@/lib/cn'

const control =
  'w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink placeholder:text-ink-3 transition-colors ' +
  'hover:border-line-strong focus:border-brand focus:ring-3 focus:ring-[var(--ring)] focus:outline-none ' +
  'disabled:opacity-50 aria-[invalid=true]:border-despesa'

export function Field({
  label,
  error,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode
  error?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-despesa" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(control, 'h-11', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} rows={2} className={cn(control, 'resize-none py-2.5', className)} {...rest} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-11 appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" />
    </div>
  )
})

/** Campo de valor em reais: digitação estilo banco, valor sempre em centavos. */
export function MoneyInput({
  value,
  onChange,
  id,
  invalid,
  autoFocus,
  large,
}: {
  value: number
  onChange: (cents: number) => void
  id?: string
  invalid?: boolean
  autoFocus?: boolean
  large?: boolean
}) {
  const auto = useId()
  return (
    <div className="relative">
      <span
        className={cn(
          'pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-medium text-ink-3',
          large ? 'text-lg' : 'text-sm',
        )}
      >
        R$
      </span>
      <input
        id={id ?? auto}
        inputMode="numeric"
        autoComplete="off"
        data-autofocus={autoFocus || undefined}
        aria-invalid={invalid}
        placeholder="0,00"
        value={value ? formatDecimal(value) : ''}
        onChange={(e) => onChange(maskBRLInput(e.target.value).cents)}
        className={cn(control, 'num', large ? 'h-14 pl-12 text-2xl font-semibold' : 'h-11 pl-10')}
      />
    </div>
  )
}
