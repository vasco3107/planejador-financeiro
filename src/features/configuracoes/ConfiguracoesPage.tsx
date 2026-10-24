import { useEffect, useRef, useState } from 'react'
import { Building2, Database, Download, Monitor, Moon, Palette, Sparkles, Sun, Tags, Trash2, Upload } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { confirmDialog } from '@/components/ui/Dialog'
import { Field, Input } from '@/components/ui/Form'
import { PageHeader, Segmented } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { loadDemoData } from '@/data/demo'
import { useCategories, useSettings, useTransactions } from '@/data/hooks'
import { exportBackup, isBackupFile, resetAll, restoreBackup, settingsRepo } from '@/data/repositories'
import { CategoryManager } from '@/features/categorias/CategoryManager'
import { downloadBlob, stamp } from '@/lib/export/csv'
import { useUI, type Theme } from '@/store/ui'
import type { CategoryKind } from '@/domain/types'

export default function ConfiguracoesPage() {
  const settings = useSettings()
  const txs = useTransactions()
  const categories = useCategories()
  const theme = useUI((s) => s.theme)
  const setTheme = useUI((s) => s.setTheme)
  const [company, setCompany] = useState('')
  const [catKind, setCatKind] = useState<CategoryKind | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (settings) setCompany(settings.companyName)
  }, [settings])

  const saveCompany = async () => {
    const name = company.trim()
    if (!name || name === settings?.companyName) return
    await settingsRepo.update({ companyName: name })
    toast('Nome da empresa atualizado')
  }

  const backup = async () => {
    const data = await exportBackup()
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `backup-financeiro-${stamp()}.json`)
    toast('Backup baixado')
  }

  const restore = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!isBackupFile(parsed)) throw new Error('invalid')
      const ok = await confirmDialog({
        title: 'Restaurar backup?',
        danger: true,
        confirmLabel: 'Substituir dados',
        message: `O backup tem ${parsed.data.transactions.length} lançamentos (gerado em ${new Date(parsed.exportedAt).toLocaleString('pt-BR')}). Todos os dados atuais serão substituídos.`,
      })
      if (!ok) return
      await restoreBackup(parsed)
      toast('Backup restaurado')
    } catch {
      toast('Arquivo inválido — use um backup gerado por este app', 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const demo = async () => {
    const ok = await confirmDialog({
      title: 'Carregar dados de demonstração?',
      danger: (txs?.length ?? 0) > 0,
      confirmLabel: 'Carregar exemplo',
      message: 'Serão criados 12 meses de lançamentos, projetos e metas fictícios. Lançamentos, projetos, metas e regras de distribuição atuais serão substituídos. Categorias são mantidas.',
    })
    if (!ok) return
    await loadDemoData()
    toast('Dados de demonstração carregados')
  }

  const wipe = async () => {
    const ok = await confirmDialog({
      title: 'Apagar todos os dados?',
      danger: true,
      confirmLabel: 'Continuar',
      message: 'Lançamentos, categorias personalizadas, projetos, metas e regras serão apagados deste navegador. Recomendamos baixar um backup antes.',
    })
    if (!ok) return
    const sure = await confirmDialog({
      title: 'Tem certeza absoluta?',
      danger: true,
      confirmLabel: 'Apagar tudo definitivamente',
      message: 'Esta ação não pode ser desfeita.',
    })
    if (!sure) return
    await resetAll()
    window.location.assign('/')
  }

  const custom = (categories ?? []).filter((c) => !c.builtin).length

  return (
    <div className="space-y-5 animate-fade-in lg:space-y-6">
      <PageHeader title="Configurações" subtitle="Preferências, categorias e segurança dos seus dados." />

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Building2 className="size-4 text-ink-3" /> Empresa</span>} subtitle="Aparece no painel e nos relatórios em PDF." />
          <CardBody>
            <Field label="Nome da empresa" htmlFor="cfg-company">
              <div className="flex gap-2">
                <Input id="cfg-company" value={company} maxLength={60} onChange={(e) => setCompany(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveCompany()} />
                <Button onClick={saveCompany} disabled={!company.trim() || company.trim() === settings?.companyName} className="h-11">Salvar</Button>
              </div>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Palette className="size-4 text-ink-3" /> Aparência</span>} subtitle="Tema da interface." />
          <CardBody>
            <Segmented<Theme>
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: <span className="flex items-center gap-1.5"><Sun className="size-3.5" /> Claro</span> },
                { value: 'dark', label: <span className="flex items-center gap-1.5"><Moon className="size-3.5" /> Escuro</span> },
                { value: 'system', label: <span className="flex items-center gap-1.5"><Monitor className="size-3.5" /> Sistema</span> },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Tags className="size-4 text-ink-3" /> Categorias</span>} subtitle={`${categories?.length ?? 0} categorias · ${custom} personalizadas`} />
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCatKind('receita')}>Categorias de receita</Button>
            <Button variant="outline" onClick={() => setCatKind('despesa')}>Categorias de despesa</Button>
            <Button variant="outline" onClick={() => setCatKind('pessoal')}>Categorias de renda pessoal</Button>
            <Button variant="outline" onClick={() => setCatKind('gasto')}>Categorias de gasto pessoal</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Divisão do lucro"
            subtitle="Quanto do lucro da empresa é seu, de cada sócio e quanto fica no caixa"
          />
          <CardBody className="flex flex-col gap-2">
            <Link to="/divisao" className="text-sm font-medium text-brand hover:underline">Divisão do lucro da empresa →</Link>
            <Link to="/a-chegar" className="text-sm font-medium text-brand hover:underline">Valores a chegar (controle à parte) →</Link>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><Database className="size-4 text-ink-3" /> Seus dados</span>}
          subtitle="Tudo fica salvo apenas neste navegador. Limpar os dados do navegador apaga suas finanças — faça backups regulares."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button icon={<Download className="size-4" />} onClick={backup}>Baixar backup (.json)</Button>
            <Button variant="outline" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>Restaurar backup</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
            <Button variant="outline" icon={<Sparkles className="size-4" />} onClick={demo}>Carregar dados de exemplo</Button>
          </div>
          <p className="text-xs text-ink-3">{txs?.length ?? 0} lançamentos armazenados.</p>
          <div className="flex flex-col gap-3 rounded-2xl border border-despesa/30 bg-despesa/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Apagar todos os dados</p>
              <p className="text-xs text-ink-3">Remove tudo e volta ao estado inicial.</p>
            </div>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={wipe}>Apagar tudo</Button>
          </div>
        </CardBody>
      </Card>

      <CategoryManager kind={catKind ?? 'receita'} open={catKind !== null} onClose={() => setCatKind(null)} />
    </div>
  )
}
