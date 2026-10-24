import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Credenciais do projeto. A chave é publicável de propósito: quem protege os
 * dados é a regra de acesso (RLS) do banco, que só deixa cada usuário ver a
 * própria linha. Por isso ela pode ficar no repositório.
 */
const URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://usrhgkqvbcjnraymoylw.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_U28wyIMJTwhkyOUHGA9RDw_gu0Z0fLA'

/** Sem credenciais, o app roda só no navegador, como antes. */
export const supabase: SupabaseClient | null =
  URL && KEY ? createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null

export const syncEnabled = supabase !== null

/** Tabela com um registro por usuário, guardando a cópia completa dos dados. */
export const WALLET_TABLE = 'carteiras'

/** Traduz os erros do Supabase para algo que faça sentido em português. */
export function authErrorMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Confirme o e-mail antes de entrar (veja sua caixa de entrada).'
  if (m.includes('user already registered')) return 'Esse e-mail já tem conta. Use "Entrar".'
  if (m.includes('password should be at least')) return 'A senha precisa de pelo menos 6 caracteres.'
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'E-mail inválido.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere um pouco e tente de novo.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor.'
  return message
}
