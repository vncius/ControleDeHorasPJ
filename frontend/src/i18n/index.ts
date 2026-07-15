import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import pt from './pt'
import es from './es'
import en from './en'

export const IDIOMAS = ['pt', 'es', 'en'] as const
export type Idioma = (typeof IDIOMAS)[number]

const CHAVE_STORAGE = 'horas-pj:idioma'

function idiomaInicial(): Idioma {
  const salvo = localStorage.getItem(CHAVE_STORAGE)
  if (salvo && (IDIOMAS as readonly string[]).includes(salvo)) return salvo as Idioma
  const nav = navigator.language.slice(0, 2)
  if ((IDIOMAS as readonly string[]).includes(nav)) return nav as Idioma
  return 'pt'
}

export function definirIdioma(idioma: Idioma): void {
  localStorage.setItem(CHAVE_STORAGE, idioma)
  i18n.changeLanguage(idioma)
}

i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    es: { translation: es },
    en: { translation: en },
  },
  lng: idiomaInicial(),
  fallbackLng: 'pt',
  interpolation: { escapeValue: false },
})

export default i18n
