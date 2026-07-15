import { useEffect, useState } from 'react'

/**
 * Força um re-render a cada `intervaloMs` enquanto `ativo` for true.
 * Usado para exibir tempo decorrido em tempo real sem ir ao backend —
 * os componentes recalculam o decorrido a partir de horaInicio/data a
 * cada tick, usando o relógio do próprio cliente.
 */
export function useAgoraTick(ativo: boolean, intervaloMs = 1000): void {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!ativo) return
    const id = setInterval(() => setTick(n => n + 1), intervaloMs)
    return () => clearInterval(id)
  }, [ativo, intervaloMs])
}
