import { Fragment, Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Plus, Sun, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmHost } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/misc'
import { ToastHost } from '@/components/ui/Toast'
import { ReceiptsHost } from '@/features/transactions/PaymentsDialog'
import { TransactionFormHost, openTransactionForm } from '@/features/transactions/TransactionForm'
import { cn } from '@/lib/cn'
import { useUI } from '@/store/ui'
import { EntitySwitcher } from './EntitySwitcher'
import { SyncBadge } from '@/features/auth/SyncBadge'
import { Logo } from './Logo'
import { NAV, type NavItem } from './nav'

/** Menu agrupado (Empresa, Minha carteira, Sistema) para a folha "Mais" do celular */
const NAV_GROUPS = NAV.reduce<{ title: string; items: NavItem[] }[]>((acc, item) => {
  if (item.group || acc.length === 0) acc.push({ title: item.group ?? '', items: [] })
  acc[acc.length - 1].items.push(item)
  return acc
}, [])

function ThemeToggle({ className }: { className?: string }) {
  const theme = useUI((s) => s.theme)
  const setTheme = useUI((s) => s.setTheme)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}
      title={theme === 'system' ? 'Tema do sistema' : undefined}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      icon={isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    />
  )
}

const PERSONAL_PATHS = ['/pessoal', '/investimentos', '/projetos', '/metas']

/** O botão + abre o lançamento do contexto: carteira ou empresa */
function newEntry(pathname: string) {
  if (PERSONAL_PATHS.some((p) => pathname.startsWith(p))) openTransactionForm('retirada', { description: 'Retirada de lucro' }, 'pessoal')
  else openTransactionForm('receita')
}

function Sidebar() {
  const location = useLocation()
  const collapsed = useUI((s) => s.sidebarCollapsed)
  const toggle = useUI((s) => s.toggleSidebar)
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[76px]' : 'w-64',
      )}
    >
      <div className={cn('flex h-16 items-center', collapsed ? 'justify-center' : 'justify-between px-5')}>
        <Logo compact={collapsed} />
      </div>
      {!collapsed && (
        <div className="px-3 pb-1">
          <EntitySwitcher />
        </div>
      )}
      {collapsed && (
        <div className="px-2 pb-1">
          <EntitySwitcher compact />
        </div>
      )}
      <div className={cn('px-3 pt-2 pb-3', collapsed && 'px-3.5')}>
        <Button
          className="w-full"
          size={collapsed ? 'icon' : 'md'}
          icon={<Plus className="size-4" />}
          onClick={() => newEntry(location.pathname)}
          aria-label="Novo lançamento"
        >
          {!collapsed && 'Novo lançamento'}
        </Button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 scrollbar-none" aria-label="Principal">
        {NAV.map(({ to, label, icon: Icon, group }) => (
          <Fragment key={to}>
          {group && (collapsed ? <div className="mx-3 my-2 border-t border-line" /> : <div className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{group}</div>)}
          <NavLink
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'group flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                isActive ? 'bg-brand-soft text-brand' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
              )
            }
          >
            <Icon className="size-[18px] shrink-0" />
            {!collapsed && label}
          </NavLink>
          </Fragment>
        ))}
      </nav>
      {!collapsed && <SyncBadge />}
      <div className={cn('flex items-center border-t border-line p-3', collapsed ? 'flex-col gap-1' : 'justify-between')}>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          icon={collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        />
      </div>
    </aside>
  )
}

function MobileNav() {
  const [more, setMore] = useState(false)
  const location = useLocation()
  useEffect(() => {
    setMore(false)
  }, [location.pathname])
  const main = NAV.filter((n) => n.mobile)
  const rest = NAV.filter((n) => !n.mobile)
  const restActive = rest.some((n) => location.pathname.startsWith(n.to))

  const item = (active: boolean) =>
    cn('flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-brand' : 'text-ink-3')

  return (
    <>
      <nav
        aria-label="Navegação"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-md items-stretch">
          {main.slice(0, 2).map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => item(isActive)}>
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => newEntry(location.pathname)}
              aria-label="Novo lançamento"
              className="grid size-12 -translate-y-3 place-items-center rounded-2xl bg-brand text-white shadow-pop ring-4 ring-bg active:scale-95 dark:text-[#04201d]"
            >
              <Plus className="size-6" />
            </button>
          </div>
          {main.slice(2).map(({ to, label, short, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => item(isActive)}>
              <Icon className="size-5" />
              {short ?? label}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMore(true)} className={item(restActive)}>
            <Menu className="size-5" />
            Mais
          </button>
        </div>
      </nav>

      {more && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/45 animate-fade-in" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-pop animate-sheet-in">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="font-semibold">Menu</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setMore(false)} aria-label="Fechar" icon={<X className="size-4" />} />
            </div>
            {NAV_GROUPS.map((g) => (
            <div key={g.title} className="mb-3 last:mb-0">
            <div className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{g.title}</div>
            <div className="grid grid-cols-3 gap-2">
              {g.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center text-xs font-medium',
                      isActive ? 'border-brand/30 bg-brand-soft text-brand' : 'border-line text-ink-2',
                    )
                  }
                >
                  <Icon className="size-5" />
                  {label}
                </NavLink>
              ))}
            </div>
            </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-80" />
    </div>
  )
}

export function AppLayout() {
  const collapsed = useUI((s) => s.sidebarCollapsed)
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-surface/90 px-4 backdrop-blur-lg lg:hidden">
        <Logo compact />
        <div className="flex items-center gap-2">
          <EntitySwitcher />
          <SyncBadge compact />
          <ThemeToggle />
        </div>
      </header>
      <main className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[76px]' : 'lg:pl-64')}>
        <div className="mx-auto w-full max-w-[1400px] px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <MobileNav />
      <TransactionFormHost />
      <ReceiptsHost />
      <ConfirmHost />
      <ToastHost />
    </div>
  )
}
