import { lazy } from 'react'
import { Navigate, createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { NotFound } from './NotFound'

const page = (load: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(load)
  return <C />
}

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: page(() => import('@/features/dashboard/DashboardPage')) },
      { path: 'receitas', element: page(() => import('@/features/receitas/ReceitasPage')) },
      { path: 'despesas', element: page(() => import('@/features/despesas/DespesasPage')) },
      { path: 'investimentos', element: page(() => import('@/features/investimentos/InvestimentosPage')) },
      { path: 'projetos', element: page(() => import('@/features/projetos/ProjetosPage')) },
      { path: 'metas', element: page(() => import('@/features/metas/MetasPage')) },
      { path: 'historico', element: page(() => import('@/features/historico/HistoricoPage')) },
      { path: 'pessoal', element: page(() => import('@/features/pessoal/PessoalPage')) },
      // Antigo endereço da regra de % da carteira
      { path: 'distribuicao', element: <Navigate to="/pessoal" replace /> },
      { path: 'a-chegar', element: page(() => import('@/features/aChegar/AChegarPage')) },
      { path: 'divisao', element: page(() => import('@/features/distribuicao/DivisaoLucroPage')) },
      { path: 'socios', element: page(() => import('@/features/socios/SociosPage')) },
      { path: 'relatorios', element: page(() => import('@/features/relatorios/RelatoriosPage')) },
      { path: 'configuracoes', element: page(() => import('@/features/configuracoes/ConfiguracoesPage')) },
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: import.meta.env.BASE_URL })
