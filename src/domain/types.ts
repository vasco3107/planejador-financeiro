/** Valores monetários sempre em centavos (inteiro). Percentuais em pontos-base (10000 = 100%). */
export type Cents = number
export type Bps = number

/**
 * Empresa: receita, despesa, retirada (lucro que sai para você ou para um sócio) e caixa
 *   (lucro guardado na empresa: sai do lucro livre, mas não vai para ninguém).
 * Sua carteira: o que entra — suas retiradas (retirada sem partnerId) e outras rendas (pessoal) —
 *   e o que você fez com o dinheiro: gasto, investimento (aporte) e reserva (guardado, com ou sem projeto/meta).
 */
export type TransactionType = 'receita' | 'despesa' | 'investimento' | 'reserva' | 'retirada' | 'pessoal' | 'gasto' | 'caixa'

/** Tipos que pertencem à contabilidade da empresa */
export const COMPANY_TYPES: TransactionType[] = ['receita', 'despesa', 'retirada', 'caixa']
/** Conta em que o dinheiro da empresa corre: pessoa física (CPF) ou empresa (CNPJ). */
export type Entity = 'cpf' | 'cnpj'

export const ENTITY_LABELS: Record<Entity, string> = { cpf: 'CPF', cnpj: 'CNPJ' }

export type TransactionStatus = 'confirmado' | 'pendente'
export type ExpenseKind = 'fixa' | 'variavel' | 'recorrente' | 'pontual'
/** pessoal = rendas da pessoa física; gasto = gastos da pessoa física */
/** Categoria cujas despesas são taxas retidas pela plataforma antes do repasse. */
export const PLATFORM_FEE_CATEGORY = 'desp-taxas'

export type CategoryKind = 'receita' | 'despesa' | 'pessoal' | 'gasto'

/** Valor que caiu na conta referente a um lançamento (recebimento parcial). */
export interface Payment {
  id: string
  /** ISO yyyy-mm-dd */
  date: string
  /** Valor bruto liquidado: o que caiu na conta + a taxa retida */
  amountCents: Cents
  /** Taxa retida pela plataforma dentro deste valor (Stripe, Kiwify…) */
  feeCents?: Cents
  note?: string
}

export interface Transaction {
  id: string
  type: TransactionType
  amountCents: Cents
  /** ISO yyyy-mm-dd */
  date: string
  description: string
  categoryId?: string
  /** Origem da receita (cliente, produto, plataforma…) */
  source?: string
  expenseKind?: ExpenseKind
  status: TransactionStatus
  projectId?: string
  goalId?: string
  /** Em lançamentos da empresa: se corre no CPF ou no CNPJ. Vazio = CPF (lançamentos antigos) */
  entity?: Entity
  /** Só em retiradas: sócio que recebeu. Vazio = você */
  partnerId?: string
  /**
   * Recebimentos parciais (só em receitas): o quanto já caiu na conta, parcela a parcela.
   * Sem a lista, vale o status: confirmado = recebido por inteiro, pendente = nada recebido.
   */
  payments?: Payment[]
  note?: string
  createdAt: number
  updatedAt: number
}

/** Lançamento da sua carteira: suas retiradas, outras rendas, gastos, aportes e reservas. */
export const isPersonal = (t: Pick<Transaction, 'type' | 'partnerId'>) =>
  t.type === 'pessoal' || t.type === 'gasto' || t.type === 'investimento' || t.type === 'reserva' || (t.type === 'retirada' && !t.partnerId)

/**
 * Controle à parte: valores que deveriam ter chegado (Stripe marcou como pago,
 * Pix combinado…) e ainda não caíram. NÃO entra em nenhum cálculo do app.
 */
export interface ExpectedReceipt {
  id: string
  amountCents: Cents
  /** Data em que o dinheiro era esperado (ISO yyyy-mm-dd) */
  expectedDate: string
  description: string
  source?: string
  /** Quando recebido, a data da baixa */
  receivedDate?: string
  note?: string
  createdAt: number
}

export interface Partner {
  id: string
  name: string
  color: string
  archived: boolean
  createdAt: number
}

export interface Category {
  id: string
  kind: CategoryKind
  name: string
  color: string
  builtin: boolean
}

export interface DistributionBucket {
  key: string
  name: string
  color: string
  bps: Bps
  /**
   * Papel especial.
   * Carteira: 'investimentos' e 'projetos' (projetos e metas).
   * Empresa (divisão do lucro): 'retirada' (parte de uma pessoa) e 'caixa' (fica na empresa).
   */
  role?: 'investimentos' | 'projetos' | 'retirada' | 'caixa'
  /** Com role 'retirada': sócio dono desta parte. Vazio = sua parte */
  partnerId?: string
}

/** 'empresa' = divisão do lucro entre sócios; 'pessoal' = destino das suas retiradas */
export type DistributionScope = 'empresa' | 'pessoal'

export interface DistributionConfig {
  id: string
  scope: DistributionScope
  /** Mês a partir do qual vale, formato yyyy-mm */
  effectiveFrom: string
  buckets: DistributionBucket[]
  createdAt: number
}

export interface Project {
  id: string
  name: string
  description?: string
  targetCents: Cents
  color: string
  deadline?: string
  archived: boolean
  createdAt: number
}

export interface Goal {
  id: string
  name: string
  targetCents: Cents
  icon: string
  deadline?: string
  archived: boolean
  createdAt: number
}

export interface Settings {
  id: 'app'
  companyName: string
}

export interface DateRange {
  /** ISO yyyy-mm-dd, inclusivo */
  start: string
  end: string
}
