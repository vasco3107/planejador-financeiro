import { useState } from 'react'
import { Tags } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CategoryManager } from '@/features/categorias/CategoryManager'
import { KindPage } from '@/features/transactions/KindPage'

export default function ReceitasPage() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <KindPage
        kind="receita"
        extraActions={
          <Button variant="outline" icon={<Tags className="size-4" />} onClick={() => setOpen(true)}>
            Categorias
          </Button>
        }
      />
      <CategoryManager kind="receita" open={open} onClose={() => setOpen(false)} />
    </>
  )
}
