import { useEffect, useRef, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DateInput } from '@/components/ui/DateInput'
import { Field } from '@/components/ui/Form'
import { PERIOD_LABELS, formatRangeBR, type PeriodPreset } from '@/domain/period'
import { cn } from '@/lib/cn'
import { usePeriod, useUI } from '@/store/ui'

const PRESETS: PeriodPreset[] = ['hoje', 'semana', 'mes', 'ano', 'tudo']

export function PeriodFilter({ className }: { className?: string }) {
  const { preset, range } = usePeriod()
  const setPreset = useUI((s) => s.setPreset)
  const setCustom = useUI((s) => s.setCustom)
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(range.start)
  const [end, setEnd] = useState(range.end)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const invalid = !start || !end || start > end

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5 sm:items-end', className)}>
      <div ref={box} className="relative flex max-w-full min-w-0">
        <div role="tablist" aria-label="Período" className="flex min-w-0 gap-1 overflow-x-auto rounded-xl bg-surface-3 p-1 scrollbar-none">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={preset === p}
              onClick={() => setPreset(p)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all',
                preset === p ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2',
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={preset === 'custom'}
            aria-expanded={open}
            onClick={() => {
              setStart(range.start.startsWith('1900') ? '' : range.start)
              setEnd(range.end.startsWith('2999') ? '' : range.end)
              setOpen((o) => !o)
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-all',
              preset === 'custom' ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            <CalendarRange className="size-3.5" />
            Personalizado
          </button>
        </div>
        {open && (
          <div className="absolute top-full right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-4 shadow-pop animate-pop-in">
            <div className="grid grid-cols-2 gap-3">
              <Field label="De" htmlFor="pf-start">
                <DateInput id="pf-start" value={start} onChange={setStart} />
              </Field>
              <Field label="Até" htmlFor="pf-end">
                <DateInput id="pf-end" value={end} onChange={setEnd} />
              </Field>
            </div>
            {start && end && start > end && <p className="mt-2 text-xs text-despesa">A data inicial deve ser anterior à final.</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                size="sm"
                disabled={invalid}
                onClick={() => {
                  setCustom({ start, end })
                  setOpen(false)
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </div>
      <span className="px-1 text-xs text-ink-3 num">{formatRangeBR(range)}</span>
    </div>
  )
}
