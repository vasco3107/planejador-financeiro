import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db } from './db'
import { exportBackup, isBackupFile, restoreBackup, type BackupFile } from './repositories'
import { WALLET_TABLE, supabase, syncEnabled } from './supabase'

/**
 * Sincronização simples: o navegador continua sendo a base (funciona offline) e
 * a nuvem guarda uma cópia completa. Quem gravou por último vence — o que é
 * adequado para uma pessoa usando computador e celular em momentos diferentes.
 */
export type SyncState = 'desligado' | 'deslogado' | 'sincronizando' | 'ok' | 'erro' | 'conflito'

interface SyncStatus {
  state: SyncState
  lastSync: number | null
  error: string | null
  email: string | null
  /** Quando os dois lados têm dados diferentes, o que cada um tem */
  conflito: { aquiLancamentos: number; nuvemLancamentos: number; nuvemEm: number } | null
}

type Listener = (s: SyncStatus) => void

let status: SyncStatus = { state: syncEnabled ? 'deslogado' : 'desligado', lastSync: null, error: null, email: null, conflito: null }
const listeners = new Set<Listener>()
const LAST_PULL_KEY = 'pf-last-pull'
const SAFETY_KEY = 'pf-copia-antes-da-nuvem'

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  for (const l of listeners) l(status)
}

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState(status)
  useEffect(() => {
    listeners.add(setS)
    setS(status)
    return () => void listeners.delete(setS)
  }, [])
  return s
}

const remoteStamp = () => Number(localStorage.getItem(LAST_PULL_KEY) ?? 0)
const setRemoteStamp = (v: number) => localStorage.setItem(LAST_PULL_KEY, String(v))

/** Momento da última alteração local, para saber se há algo novo a enviar. */
async function localStamp(): Promise<number> {
  const tables = [db.transactions, db.categories, db.distributions, db.projects, db.goals, db.partners, db.expected]
  let max = 0
  for (const t of tables) {
    const rows = (await t.toArray()) as { updatedAt?: number; createdAt?: number }[]
    for (const r of rows) max = Math.max(max, r.updatedAt ?? r.createdAt ?? 0)
  }
  return max
}

async function isLocalEmpty(): Promise<boolean> {
  return (await db.transactions.count()) === 0 && (await db.partners.count()) === 0
}

/** Envia a cópia completa para a nuvem. */
export async function push(session: Session): Promise<void> {
  if (!supabase) return
  const data = await exportBackup()
  const { error } = await supabase
    .from(WALLET_TABLE)
    .upsert({ user_id: session.user.id, dados: data, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  setRemoteStamp(Date.now())
  setStatus({ state: 'ok', lastSync: Date.now(), error: null })
}

/** Traz a cópia da nuvem e substitui o que está no navegador. */
async function pull(session: Session): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase
    .from(WALLET_TABLE)
    .select('dados, updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.dados || !isBackupFile(data.dados as BackupFile)) return false
  // Rede de segurança: guarda o que havia aqui antes de substituir
  try {
    localStorage.setItem(SAFETY_KEY, JSON.stringify(await exportBackup()))
  } catch {
    /* armazenamento cheio: segue sem a cópia */
  }
  await restoreBackup(data.dados as BackupFile)
  setRemoteStamp(new Date(data.updated_at as string).getTime())
  setStatus({ state: 'ok', lastSync: Date.now(), error: null })
  return true
}

/**
 * Primeira decisão ao entrar: se a nuvem está vazia, sobe o que existe aqui;
 * se o navegador está vazio ou a nuvem é mais recente, baixa de lá.
 */
export async function syncOnLogin(session: Session): Promise<void> {
  if (!supabase) return
  setStatus({ state: 'sincronizando', email: session.user.email ?? null, error: null })
  try {
    const { data, error } = await supabase
      .from(WALLET_TABLE)
      .select('updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle()
    if (error) throw new Error(error.message)

    const remoteAt = data ? new Date(data.updated_at as string).getTime() : 0
    const vazioAqui = await isLocalEmpty()
    const primeiraVezNesteAparelho = remoteStamp() === 0

    if (!remoteAt) return void (await push(session))
    if (vazioAqui) return void (await pull(session))

    if (primeiraVezNesteAparelho) {
      // Os dois lados têm dados e este aparelho nunca sincronizou: quem decide é o usuário
      const nuvem = await contarNaNuvem(session)
      const aqui = await db.transactions.count()
      if (nuvem !== aqui) {
        pendente = session
        setStatus({ state: 'conflito', conflito: { aquiLancamentos: aqui, nuvemLancamentos: nuvem, nuvemEm: remoteAt } })
        return
      }
    }

    if ((await localStamp()) > remoteStamp()) await push(session)
    else await pull(session)
  } catch (e) {
    setStatus({ state: 'erro', error: e instanceof Error ? e.message : 'Falha ao sincronizar' })
  }
}

/** Quantos lançamentos existem na cópia da nuvem. */
async function contarNaNuvem(session: Session): Promise<number> {
  if (!supabase) return 0
  const { data } = await supabase.from(WALLET_TABLE).select('dados').eq('user_id', session.user.id).maybeSingle()
  const dados = data?.dados as BackupFile | undefined
  return dados?.data?.transactions?.length ?? 0
}

/** Sessão esperando a escolha do usuário no conflito. */
let pendente: Session | null = null

/** Mantém o que está neste aparelho e substitui a nuvem. */
export async function resolverComDaquiParaNuvem(): Promise<void> {
  if (!pendente) return
  const session = pendente
  pendente = null
  setStatus({ state: 'sincronizando', conflito: null })
  try {
    await push(session)
  } catch (e) {
    setStatus({ state: 'erro', error: e instanceof Error ? e.message : 'Falha ao enviar' })
  }
}

/** Traz o que está na nuvem e substitui este aparelho. */
export async function resolverComNuvemParaAqui(): Promise<void> {
  if (!pendente) return
  const session = pendente
  pendente = null
  setStatus({ state: 'sincronizando', conflito: null })
  try {
    await pull(session)
  } catch (e) {
    setStatus({ state: 'erro', error: e instanceof Error ? e.message : 'Falha ao baixar' })
  }
}

let timer: ReturnType<typeof setTimeout> | null = null

/** Agenda o envio depois de uma pausa, para não subir a cada tecla. */
export function schedulePush(session: Session, delay = 2500) {
  if (!supabase) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      setStatus({ state: 'sincronizando' })
      await push(session)
    } catch (e) {
      setStatus({ state: 'erro', error: e instanceof Error ? e.message : 'Falha ao enviar' })
    }
  }, delay)
}

/** Avisa quando o outro aparelho gravar algo. */
export function watchRemote(session: Session, onRemoteChange: () => void) {
  if (!supabase) return () => {}
  const client = supabase
  const channel = client
    .channel('carteira')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: WALLET_TABLE, filter: `user_id=eq.${session.user.id}` },
      (payload) => {
        const at = new Date((payload.new as { updated_at: string }).updated_at).getTime()
        // Ignora o eco do que este aparelho acabou de enviar
        if (at - remoteStamp() > 1500) onRemoteChange()
      },
    )
    .subscribe()
  return () => void client.removeChannel(channel)
}

export async function pullFromRemote(session: Session): Promise<void> {
  setStatus({ state: 'sincronizando' })
  try {
    await pull(session)
  } catch (e) {
    setStatus({ state: 'erro', error: e instanceof Error ? e.message : 'Falha ao baixar' })
  }
}

export function setLoggedOut() {
  pendente = null
  setStatus({ state: syncEnabled ? 'deslogado' : 'desligado', email: null, lastSync: null, error: null, conflito: null })
  localStorage.removeItem(LAST_PULL_KEY)
}
