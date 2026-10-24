import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useLiveQuery } from 'dexie-react-hooks'
import { LogIn, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { toast } from '@/components/ui/Toast'
import { db } from '@/data/db'
import { authErrorMessage, supabase, syncEnabled } from '@/data/supabase'
import {
  resolverComDaquiParaNuvem,
  resolverComNuvemParaAqui,
  schedulePush,
  setLoggedOut,
  syncOnLogin,
  useSyncStatus,
  watchRemote,
  pullFromRemote,
} from '@/data/sync'
import { Dialog } from '@/components/ui/Dialog'
import { formatDateBR } from '@/domain/period'
import { Logo } from '@/components/layout/Logo'

/** Sessão aberta, para quem precisar saber quem está logado. */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(syncEnabled)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, loading }
}

/** Mantém nuvem e navegador no mesmo ponto enquanto a sessão estiver aberta. */
function useSync(session: Session | null) {
  // Qualquer alteração no banco local dispara o envio
  const marca = useLiveQuery(async () => {
    const tabelas = [db.transactions, db.categories, db.distributions, db.projects, db.goals, db.partners, db.expected]
    const contagens = await Promise.all(tabelas.map((t) => t.count()))
    const ultimo = await db.transactions.orderBy('id').last()
    return `${contagens.join('-')}:${ultimo?.updatedAt ?? 0}`
  })

  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    if (!session) {
      setPronto(false)
      return
    }
    let vivo = true
    syncOnLogin(session).then(() => vivo && setPronto(true))
    const parar = watchRemote(session, () => void pullFromRemote(session))
    return () => {
      vivo = false
      parar()
    }
  }, [session])

  useEffect(() => {
    // Só envia depois da primeira sincronização, senão sobe dado desatualizado
    if (session && pronto && marca !== undefined) schedulePush(session)
  }, [session, pronto, marca])
}

/**
 * Pede login antes de abrir o app. Sem credenciais do Supabase configuradas,
 * o app abre direto e funciona só neste navegador.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  useSync(session)

  if (!syncEnabled) return <>{children}</>
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <Loader2 className="size-6 animate-spin text-ink-3" />
      </div>
    )
  }
  if (!session) return <LoginScreen />
  return (
    <>
      {children}
      <ConflitoDialog />
    </>
  )
}

/**
 * Os dois lados têm dados diferentes e este aparelho nunca sincronizou:
 * o usuário escolhe qual versão fica, em vez de o app adivinhar.
 */
function ConflitoDialog() {
  const { state, conflito } = useSyncStatus()
  const [ocupado, setOcupado] = useState(false)
  if (state !== 'conflito' || !conflito) return null

  const escolher = async (fn: () => Promise<void>) => {
    setOcupado(true)
    try {
      await fn()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Dialog
      open
      onClose={() => {}}
      title="Qual versão você quer manter?"
      description="Este aparelho e a nuvem têm dados diferentes. A versão escolhida substitui a outra."
      footer={
        <>
          <Button variant="outline" disabled={ocupado} onClick={() => escolher(resolverComNuvemParaAqui)}>
            Usar a da nuvem
          </Button>
          <Button disabled={ocupado} onClick={() => escolher(resolverComDaquiParaNuvem)}>
            Usar a deste aparelho
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-brand/40 bg-brand-soft/40 p-4">
          <p className="text-xs font-medium text-ink-3">Neste aparelho</p>
          <p className="mt-1 text-2xl font-semibold num">{conflito.aquiLancamentos}</p>
          <p className="text-xs text-ink-3">lançamentos</p>
        </div>
        <div className="rounded-xl border border-line p-4">
          <p className="text-xs font-medium text-ink-3">Na nuvem</p>
          <p className="mt-1 text-2xl font-semibold num">{conflito.nuvemLancamentos}</p>
          <p className="text-xs text-ink-3">salvos em {formatDateBR(new Date(conflito.nuvemEm).toISOString().slice(0, 10))}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Antes de substituir o que está aqui, o app guarda uma cópia de segurança neste navegador.
      </p>
    </Dialog>
  )
}

function LoginScreen() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setCarregando(true)
    setErro(null)
    try {
      const { error, data } =
        modo === 'entrar'
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
          : await supabase.auth.signUp({ email: email.trim(), password: senha })
      if (error) {
        setErro(authErrorMessage(error.message))
        return
      }
      if (modo === 'criar' && !data.session) {
        toast('Conta criada. Confirme o e-mail para entrar.', 'info')
        setModo('entrar')
      }
    } catch (err) {
      setErro(authErrorMessage(err instanceof Error ? err.message : 'Falha ao entrar'))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h1 className="text-lg font-semibold tracking-tight">{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</h1>
          <p className="mt-1 text-sm text-ink-3">
            {modo === 'entrar'
              ? 'Seus lançamentos ficam iguais no computador e no celular.'
              : 'Use o mesmo e-mail e senha nos dois aparelhos.'}
          </p>

          <form onSubmit={enviar} className="mt-5 grid gap-4" noValidate>
            <Field label="E-mail" htmlFor="auth-email">
              <Input id="auth-email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Senha" htmlFor="auth-senha" hint={modo === 'criar' ? 'Mínimo de 6 caracteres' : undefined}>
              <Input
                id="auth-senha"
                type="password"
                autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Field>
            {erro && <p className="text-sm font-medium text-despesa">{erro}</p>}
            <Button
              type="submit"
              size="lg"
              disabled={carregando || !email.trim() || senha.length < 6}
              icon={carregando ? <Loader2 className="size-4 animate-spin" /> : modo === 'entrar' ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
            >
              {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setModo(modo === 'entrar' ? 'criar' : 'entrar')
              setErro(null)
            }}
            className="mt-4 w-full text-center text-[13px] font-medium text-brand hover:underline"
          >
            {modo === 'entrar' ? 'Ainda não tenho conta' : 'Já tenho conta'}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-ink-3">Os dados ficam na sua conta e só você enxerga.</p>
      </div>
    </div>
  )
}

export async function sair() {
  if (!supabase) return
  await supabase.auth.signOut()
  setLoggedOut()
}
