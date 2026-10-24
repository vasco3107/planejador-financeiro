import {
  FileBarChart2,
  History,
  LayoutDashboard,
  Landmark,
  Rocket,
  Settings,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Aparece na barra inferior do celular */
  mobile?: boolean
  /** Inicia um grupo com título no menu lateral */
  group?: string
  /** Rótulo curto para a barra inferior do celular */
  short?: string
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, mobile: true, group: 'Empresa' },
  { to: '/receitas', label: 'Receitas', icon: TrendingUp, mobile: true },
  { to: '/despesas', label: 'Despesas', icon: TrendingDown },
  { to: '/socios', label: 'Sócios e divisão', icon: Users },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart2 },
  { to: '/pessoal', label: 'Visão geral', short: 'Carteira', icon: Wallet, mobile: true, group: 'Minha carteira' },
  { to: '/investimentos', label: 'Investimentos', icon: Landmark },
  { to: '/projetos', label: 'Projetos', icon: Rocket },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, group: 'Sistema' },
]
