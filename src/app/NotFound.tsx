import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/misc'

export function NotFound() {
  return (
    <EmptyState
      icon={<Compass className="size-5" />}
      title="Página não encontrada"
      text="O endereço acessado não existe."
      action={<Link to="/" className="text-sm font-medium text-brand hover:underline">Voltar ao dashboard</Link>}
    />
  )
}
