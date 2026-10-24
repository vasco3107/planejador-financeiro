import { useMemo, useState } from 'react'
import { Check, Lock, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, confirmDialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Form'
import { toast } from '@/components/ui/Toast'
import { useCategories, useTransactions } from '@/data/hooks'
import { categoriesRepo } from '@/data/repositories'
import { FALLBACK_CATEGORY, PALETTE } from '@/data/seed'
import type { Category, CategoryKind } from '@/domain/types'
import { cn } from '@/lib/cn'

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Cor ${c}`}
          onClick={() => onChange(c)}
          className={cn('grid size-6 place-items-center rounded-full ring-offset-2 ring-offset-surface transition', value === c && 'ring-2 ring-ink')}
          style={{ backgroundColor: c }}
        >
          {value === c && <Check className="size-3.5 text-white" />}
        </button>
      ))}
    </div>
  )
}

export function CategoryManager({ kind, open, onClose }: { kind: CategoryKind; open: boolean; onClose: () => void }) {
  const categories = useCategories()
  const txs = useTransactions()
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null)

  const list = useMemo(
    () => (categories ?? []).filter((c) => c.kind === kind).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [categories, kind],
  )
  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of txs ?? []) if (t.categoryId) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1)
    return m
  }, [txs])

  const exists = (n: string, exceptId?: string) =>
    list.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === n.trim().toLowerCase())

  const add = async () => {
    const n = name.trim()
    if (!n) return
    if (exists(n)) return toast('Já existe uma categoria com esse nome', 'error')
    await categoriesRepo.create(kind, n, color)
    setName('')
    setColor(PALETTE[(PALETTE.indexOf(color) + 1) % PALETTE.length])
    toast('Categoria criada')
  }

  const save = async () => {
    if (!editing) return
    const n = editing.name.trim()
    if (!n) return
    if (exists(n, editing.id)) return toast('Já existe uma categoria com esse nome', 'error')
    await categoriesRepo.update(editing.id, { name: n, color: editing.color })
    setEditing(null)
    toast('Categoria atualizada')
  }

  const remove = async (c: Category) => {
    const count = usage.get(c.id) ?? 0
    const ok = await confirmDialog({
      title: `Excluir "${c.name}"?`,
      danger: true,
      confirmLabel: 'Excluir categoria',
      message: count
        ? `${count} lançamento${count > 1 ? 's' : ''} usa${count > 1 ? 'm' : ''} esta categoria e ${count > 1 ? 'serão movidos' : 'será movido'} para "Outros". Nenhum valor será perdido.`
        : 'Nenhum lançamento usa esta categoria.',
    })
    if (!ok) return
    await categoriesRepo.remove(c.id)
    toast('Categoria excluída')
  }

  return (
    <Dialog open={open} onClose={onClose} title={{ receita: 'Categorias de receita', despesa: 'Categorias de despesa', pessoal: 'Categorias de renda pessoal', gasto: 'Categorias de gasto pessoal' }[kind]} description="Crie, renomeie ou exclua categorias." size="md">
      <div className="rounded-2xl border border-line bg-surface-2 p-3.5">
        <div className="flex gap-2">
          <Input
            placeholder="Nova categoria"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void add())}
          />
          <Button onClick={add} disabled={!name.trim()} icon={<Plus className="size-4" />} className="h-11">
            Criar
          </Button>
        </div>
        <div className="mt-3">
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>

      <ul className="mt-4 divide-y divide-line">
        {list.map((c) => {
          const locked = c.id === FALLBACK_CATEGORY[kind]
          const isEditing = editing?.id === c.id
          return (
            <li key={c.id} className="py-2.5">
              {isEditing ? (
                <div className="space-y-2.5">
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={editing.name}
                      maxLength={40}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void save())}
                    />
                    <Button size="icon" onClick={save} aria-label="Salvar" icon={<Check className="size-4" />} />
                    <Button size="icon" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancelar" icon={<X className="size-4" />} />
                  </div>
                  <ColorPicker value={editing.color} onChange={(col) => setEditing({ ...editing, color: col })} />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  <span className="text-xs text-ink-3 num">{usage.get(c.id) ?? 0} lanç.</span>
                  {locked ? (
                    <span className="grid size-8 place-items-center text-ink-3" title="Categoria padrão">
                      <Lock className="size-3.5" />
                    </span>
                  ) : (
                    <>
                      <Button size="icon-sm" variant="ghost" aria-label={`Editar ${c.name}`} onClick={() => setEditing({ id: c.id, name: c.name, color: c.color })} icon={<Pencil className="size-3.5" />} />
                      <Button size="icon-sm" variant="ghost" className="hover:text-despesa" aria-label={`Excluir ${c.name}`} onClick={() => remove(c)} icon={<Trash2 className="size-3.5" />} />
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}
