import type { Category } from '@/domain/types'

const cat = (id: string, kind: Category['kind'], name: string, color: string): Category => ({
  id,
  kind,
  name,
  color,
  builtin: true,
})

export const DEFAULT_CATEGORIES: Category[] = [
  cat('rec-saas', 'receita', 'SaaS', '#0d9488'),
  cat('rec-ecommerce', 'receita', 'E-commerce', '#0284c7'),
  cat('rec-servicos', 'receita', 'Serviços', '#16a34a'),
  cat('rec-freelance', 'receita', 'Freelance', '#65a30d'),
  cat('rec-salario', 'receita', 'Salário', '#4f46e5'),
  cat('rec-investimentos', 'receita', 'Investimentos', '#7c3aed'),
  cat('rec-outros', 'receita', 'Outros', '#64748b'),

  cat('desp-ia-assinaturas', 'despesa', 'Assinaturas de IA', '#db2777'),
  cat('desp-ia-apis', 'despesa', 'APIs de IA', '#c026d3'),
  cat('desp-hospedagem', 'despesa', 'Hospedagem', '#2563eb'),
  cat('desp-dominios', 'despesa', 'Domínios', '#0891b2'),
  cat('desp-softwares', 'despesa', 'Softwares', '#7c3aed'),
  cat('desp-marketing', 'despesa', 'Marketing', '#ea580c'),
  cat('desp-funcionarios', 'despesa', 'Funcionários', '#ca8a04'),
  cat('desp-impostos', 'despesa', 'Impostos', '#dc2626'),
  cat('desp-equipamentos', 'despesa', 'Equipamentos', '#475569'),
  cat('desp-operacionais', 'despesa', 'Operacionais', '#0f766e'),
  cat('desp-taxas', 'despesa', 'Taxas de plataforma', '#0891b2'),
  cat('desp-outros', 'despesa', 'Outros', '#64748b'),
]

export { PLATFORM_FEE_CATEGORY } from '@/domain/types'

/** Categorias de renda da pessoa física (fora da empresa). */
export const PERSONAL_CATEGORIES: Category[] = [
  cat('pf-salario', 'pessoal', 'Salário', '#4f46e5'),
  cat('pf-freelance', 'pessoal', 'Freelance', '#65a30d'),
  cat('pf-rendimentos', 'pessoal', 'Rendimentos', '#7c3aed'),
  cat('pf-alugueis', 'pessoal', 'Aluguéis', '#ca8a04'),
  cat('pf-vendas', 'pessoal', 'Vendas', '#0284c7'),
  cat('pf-outros', 'pessoal', 'Outros', '#64748b'),
]

/** Categorias de gasto da pessoa física. */
export const PERSONAL_EXPENSE_CATEGORIES: Category[] = [
  cat('pg-moradia', 'gasto', 'Moradia', '#4f46e5'),
  cat('pg-alimentacao', 'gasto', 'Alimentação', '#ea580c'),
  cat('pg-transporte', 'gasto', 'Transporte', '#0284c7'),
  cat('pg-saude', 'gasto', 'Saúde', '#dc2626'),
  cat('pg-educacao', 'gasto', 'Educação', '#7c3aed'),
  cat('pg-lazer', 'gasto', 'Lazer', '#db2777'),
  cat('pg-assinaturas', 'gasto', 'Assinaturas', '#0891b2'),
  cat('pg-compras', 'gasto', 'Compras', '#ca8a04'),
  cat('pg-outros', 'gasto', 'Outros', '#64748b'),
]

export const FALLBACK_CATEGORY: Record<Category['kind'], string> = {
  receita: 'rec-outros',
  despesa: 'desp-outros',
  pessoal: 'pf-outros',
  gasto: 'pg-outros',
}

/** Paleta para novas categorias, projetos e destinos. */
export const PALETTE = [
  '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04',
  '#16a34a', '#0891b2', '#dc2626', '#4f46e5', '#65a30d', '#475569',
]
