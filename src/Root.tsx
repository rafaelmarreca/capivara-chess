import { StrictMode } from 'react'
import { HeroUIProvider } from '@heroui/react'
import App from './App.tsx'

/** Árvore raiz compartilhada entre o cliente (main.tsx) e o pré-render do build (prerender.tsx). */
export function Root() {
  return (
    <StrictMode>
      <HeroUIProvider>
        <div className="min-h-screen bg-background text-foreground">
          <App />
        </div>
      </HeroUIProvider>
    </StrictMode>
  )
}
