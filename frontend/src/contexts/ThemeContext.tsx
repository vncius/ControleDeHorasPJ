import { createContext, useContext, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Tema = 'dark' | 'light'
const CHAVE_STORAGE = 'horas-pj:tema'

function temaInicial(): Tema {
  const salvo = localStorage.getItem(CHAVE_STORAGE)
  if (salvo === 'dark' || salvo === 'light') return salvo
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

const ThemeContext = createContext<{ tema: Tema; alternar: () => void } | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
    localStorage.setItem(CHAVE_STORAGE, tema)
  }, [tema])

  function alternar() {
    setTema(t => (t === 'dark' ? 'light' : 'dark'))
  }

  return <ThemeContext.Provider value={{ tema, alternar }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return ctx
}
