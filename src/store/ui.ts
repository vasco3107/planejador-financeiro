import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { currentMonthKey, formatRangeBR, inRange, monthKey, monthRange, rangeForPreset, type PeriodPreset } from '@/domain/period'
import type { DateRange } from '@/domain/types'

import type { Entity } from '@/domain/types'

export type Theme = 'light' | 'dark' | 'system'

interface UIState {
  /** Conta aberta: CPF ou CNPJ */
  entity: Entity
  preset: PeriodPreset
  custom: DateRange | undefined
  theme: Theme
  sidebarCollapsed: boolean
  setEntity: (e: Entity) => void
  setPreset: (p: PeriodPreset) => void
  setCustom: (r: DateRange) => void
  setTheme: (t: Theme) => void
  toggleSidebar: () => void
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      entity: 'cpf',
      preset: 'mes',
      custom: undefined,
      theme: 'system',
      sidebarCollapsed: false,
      setEntity: (entity) => set({ entity }),
      setPreset: (preset) => set({ preset }),
      setCustom: (custom) => set({ custom, preset: 'custom' }),
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'pf-ui',
      version: 1,
      // O período personalizado não é lembrado entre sessões: um intervalo antigo
      // escondia lançamentos novos. Ao abrir o app, volta para "Este mês".
      partialize: (s) => ({ entity: s.entity, preset: s.preset === 'custom' ? 'mes' : s.preset, theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
      migrate: (persisted) => {
        const s = (persisted ?? {}) as { entity?: Entity; preset?: PeriodPreset; theme?: Theme; sidebarCollapsed?: boolean }
        return {
          entity: s.entity ?? 'cpf',
          preset: !s.preset || s.preset === 'custom' ? 'mes' : s.preset,
          theme: s.theme ?? 'system',
          sidebarCollapsed: s.sidebarCollapsed ?? false,
        }
      },
    },
  ),
)

/** Intervalo de datas do filtro atual (recalculado a cada render para "hoje" nunca ficar velho). */
export function usePeriod() {
  const preset = useUI((s) => s.preset)
  const custom = useUI((s) => s.custom)
  const range = rangeForPreset(preset, custom)
  // Estabiliza a referência para os useMemo que dependem do intervalo
  return { preset, range: stableRange(range) }
}

let lastRange: DateRange = { start: '', end: '' }
function stableRange(r: DateRange): DateRange {
  if (r.start !== lastRange.start || r.end !== lastRange.end) lastRange = r
  return lastRange
}

/** Intervalo do filtro atual, fora de React. */
export function currentRange() {
  const { preset, custom } = useUI.getState()
  return rangeForPreset(preset, custom)
}

/** Se a data estiver fora do período exibido, devolve o texto do período atual; senão, null. */
export function outsidePeriod(iso: string): string | null {
  const r = currentRange()
  return inRange(iso, r) ? null : formatRangeBR(r)
}

/** Ajusta o filtro para mostrar a data: "Este mês" se for do mês atual, senão o mês da data. */
export function revealDate(iso: string) {
  const key = monthKey(iso)
  if (key === currentMonthKey()) useUI.getState().setPreset('mes')
  else useUI.getState().setCustom(monthRange(key))
}

export function applyTheme(theme: Theme) {
  try {
    localStorage.setItem('pf-theme', theme)
  } catch {
    /* armazenamento indisponível */
  }
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}
