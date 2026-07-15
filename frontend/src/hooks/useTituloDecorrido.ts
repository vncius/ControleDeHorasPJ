import { useEffect } from 'react'
import { calcularDecorrido } from '../utils/tempo'
import { useAgoraTick } from './useAgoraTick'

const TITULO_BASE = document.title

/**
 * Enquanto houver um lançamento em aberto, mostra o tempo decorrido no
 * título da aba (ex.: "⏱ 01:23 · Horas PJ") — para perceber um ponto
 * esquecido ligado mesmo fora do app. Restaura o título base ao desmontar
 * ou quando não há lançamento em aberto.
 */
export function useTituloDecorrido(horaInicio: string | undefined, data: string | undefined): void {
  useAgoraTick(!!horaInicio)

  useEffect(() => {
    document.title = horaInicio ? `⏱ ${calcularDecorrido(horaInicio, data)} · ${TITULO_BASE}` : TITULO_BASE
  })

  useEffect(() => () => { document.title = TITULO_BASE }, [])
}
