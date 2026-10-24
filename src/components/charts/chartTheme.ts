import { useSyncExternalStore } from 'react'
import { useIsDark } from '@/lib/colors'

export function useChartTheme() {
  const dark = useIsDark()
  return {
    grid: dark ? '#1a2333' : '#e8edf2',
    axis: dark ? '#6b778a' : '#8a94a6',
    cursor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
    surface: dark ? '#0e1420' : '#ffffff',
  }
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => matchMedia(query).matches,
    () => false,
  )
}

export const useIsMobile = () => useMediaQuery('(max-width: 639px)')
