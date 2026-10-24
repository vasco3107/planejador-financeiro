import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { AuthGate } from './features/auth/AuthGate'
import { applyTheme, useUI } from './store/ui'
import './index.css'

// Acompanha o tema do sistema quando o usuário escolheu "sistema"
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useUI.getState().theme === 'system') applyTheme('system')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <RouterProvider router={router} />
    </AuthGate>
  </StrictMode>,
)
