import { describe, it, expect } from 'vitest'
import { periodoApuracao, somarHoras } from './tempo'

describe('periodoApuracao', () => {
  it('data no meio do período (27/08/2026) devolve 16/08 a 15/09', () => {
    expect(periodoApuracao('2026-08-27')).toEqual({ inicio: '2026-08-16', fim: '2026-09-15' })
  })

  it('dia 16 pertence ao período que começa nele', () => {
    expect(periodoApuracao('2026-08-16')).toEqual({ inicio: '2026-08-16', fim: '2026-09-15' })
  })

  it('dia 15 pertence ao período que termina nele (não ao seguinte)', () => {
    expect(periodoApuracao('2026-09-15')).toEqual({ inicio: '2026-08-16', fim: '2026-09-15' })
  })

  it('dia 1 do mês cai no período iniciado no mês anterior', () => {
    expect(periodoApuracao('2026-09-01')).toEqual({ inicio: '2026-08-16', fim: '2026-09-15' })
  })

  it('virada de ano: início de janeiro pertence ao período iniciado em dezembro', () => {
    expect(periodoApuracao('2026-01-05')).toEqual({ inicio: '2025-12-16', fim: '2026-01-15' })
  })

  it('virada de ano: dia 16 de dezembro inicia período que termina em janeiro do ano seguinte', () => {
    expect(periodoApuracao('2026-12-20')).toEqual({ inicio: '2026-12-16', fim: '2027-01-15' })
  })

  it('dia 16 de dezembro exatamente', () => {
    expect(periodoApuracao('2026-12-16')).toEqual({ inicio: '2026-12-16', fim: '2027-01-15' })
  })

  it('dia 15 de janeiro exatamente (fim do período que começou em dezembro anterior)', () => {
    expect(periodoApuracao('2026-01-15')).toEqual({ inicio: '2025-12-16', fim: '2026-01-15' })
  })
})

describe('somarHoras', () => {
  it('soma com 2 casas, sem erro de ponto flutuante', () => {
    expect(somarHoras([0.1, 0.2])).toBe(0.3)
    expect(somarHoras([1.25, undefined, 0.33, 0.67])).toBe(2.25)
  })
})
