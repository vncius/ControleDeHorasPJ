import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { FormatoData } from '../utils/formatoData'
import { formatarDataISO, formatarDataISOCurta } from '../utils/formatoData'

const CHAVE_STORAGE = 'horas-pj:formato-data'

function formatoInicial(): FormatoData {
  const salvo = localStorage.getItem(CHAVE_STORAGE)
  if (salvo === 'auto' || salvo === 'dd-mm-yyyy' || salvo === 'mm-dd-yyyy' || salvo === 'yyyy-mm-dd') return salvo
  return 'auto'
}

const PreferenciasContext = createContext<{
  formatoData: FormatoData
  definirFormatoData: (f: FormatoData) => void
} | null>(null)

export function PreferenciasProvider({ children }: { children: ReactNode }) {
  const [formatoData, setFormatoData] = useState<FormatoData>(formatoInicial)

  function definirFormatoData(f: FormatoData) {
    setFormatoData(f)
    localStorage.setItem(CHAVE_STORAGE, f)
  }

  return (
    <PreferenciasContext.Provider value={{ formatoData, definirFormatoData }}>
      {children}
    </PreferenciasContext.Provider>
  )
}

export function usePreferencias() {
  const ctx = useContext(PreferenciasContext)
  if (!ctx) throw new Error('usePreferencias deve ser usado dentro de PreferenciasProvider')
  return ctx
}

/** Formatador de data pronto para uso em JSX, já ligado à preferência + idioma atuais. */
export function useFormatarData() {
  const { formatoData } = usePreferencias()
  const { i18n } = useTranslation()
  return {
    formatarData: (iso?: string) => formatarDataISO(iso, formatoData, i18n.language),
    formatarDataCurta: (iso?: string) => formatarDataISOCurta(iso, formatoData, i18n.language),
  }
}
