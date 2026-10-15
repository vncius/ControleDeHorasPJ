import { describe, it, expect } from 'vitest'
import { calcularStatusPagamento, projetoTemSaldoAFaturar, marcarLancamentosFaturaveis } from './faturamento'
import type { Projeto, StatusProjeto } from '../types'

const projeto = (over: Partial<Projeto> = {}): Projeto => ({
  id: 'p1', tenantId: 't', clienteId: 'c1', nome: 'P', status: 'Em desenvolvimento',
  dataInicio: '2026-01-01', dataCriacao: '2026-01-01T00:00:00.000Z', ...over,
})

let seq = 0
const lanc = (data: string, horaInicio: string, totalDecimal?: number) => ({
  id: `l${++seq}`, data, horaInicio, ...(totalDecimal !== undefined && { horaFim: '23:59', totalDecimal }),
})

describe('calcularStatusPagamento', () => {
  it('sem pagamento = Não pago; cobre parte = Parcial; cobre tudo = Pago', () => {
    expect(calcularStatusPagamento(projeto(), 0, 10)).toBe('Não pago')
    expect(calcularStatusPagamento(projeto(), 4, 10)).toBe('Parcial')
    expect(calcularStatusPagamento(projeto(), 10, 10)).toBe('Pago')
    expect(calcularStatusPagamento(projeto(), 12, 10)).toBe('Pago')
  })

  it('consideradoPago vence a comparação (regularização)', () => {
    expect(calcularStatusPagamento(projeto({ consideradoPago: true }), 0, 10)).toBe('Pago')
  })

  it('pagamento que cobre exatamente a soma com ponto flutuante (0,1 + 0,2) é Pago', () => {
    expect(calcularStatusPagamento(projeto(), 0.3, 0.1 + 0.2)).toBe('Pago')
  })
})

describe('projetoTemSaldoAFaturar', () => {
  it.each<StatusProjeto>(['Finalizado', 'Cancelado'])('projeto %s não tem saldo, mesmo sem pagamento', (status) => {
    expect(projetoTemSaldoAFaturar(projeto({ status }), 0, 10)).toBe(false)
  })

  it('projeto novo sem lançamentos tem saldo (não é "pago em andamento")', () => {
    expect(projetoTemSaldoAFaturar(projeto(), 0, 0)).toBe(true)
  })

  it('projeto ativo totalmente coberto não tem saldo', () => {
    expect(projetoTemSaldoAFaturar(projeto(), 10, 10)).toBe(false)
  })
})

describe('marcarLancamentosFaturaveis (FIFO)', () => {
  it('pagamentos cobrem as horas mais antigas primeiro, independente da ordem recebida', () => {
    const novo = lanc('2026-03-10', '09:00', 2)
    const antigo = lanc('2026-03-01', '09:00', 3)
    const meio = lanc('2026-03-05', '09:00', 1)
    const r = marcarLancamentosFaturaveis([novo, antigo, meio], projeto(), 4)
    expect([r.get(antigo.id), r.get(meio.id), r.get(novo.id)]).toEqual([false, false, true])
  })

  it('no mesmo dia, ordena pela hora de início', () => {
    const tarde = lanc('2026-03-01', '14:00', 1)
    const manha = lanc('2026-03-01', '09:00', 1)
    const r = marcarLancamentosFaturaveis([tarde, manha], projeto(), 1)
    expect([r.get(manha.id), r.get(tarde.id)]).toEqual([false, true])
  })

  it('lançamento parcialmente coberto conta como faturável (o excedente ainda será cobrado)', () => {
    const a = lanc('2026-03-01', '09:00', 2)
    const b = lanc('2026-03-02', '09:00', 2)
    const r = marcarLancamentosFaturaveis([a, b], projeto(), 3)
    expect([r.get(a.id), r.get(b.id)]).toEqual([false, true])
  })

  it('soma com ponto flutuante não marca como faturável o que já foi pago (0,1 + 0,2 cobertos por 0,3)', () => {
    const a = lanc('2026-03-01', '09:00', 0.1)
    const b = lanc('2026-03-02', '09:00', 0.2)
    const r = marcarLancamentosFaturaveis([a, b], projeto(), 0.3)
    expect([r.get(a.id), r.get(b.id)]).toEqual([false, false])
  })

  it('projeto encerrado ou consideradoPago: nada é faturável', () => {
    const l = lanc('2026-03-01', '09:00', 2)
    expect(marcarLancamentosFaturaveis([l], projeto({ status: 'Finalizado' }), 0).get(l.id)).toBe(false)
    expect(marcarLancamentosFaturaveis([l], projeto({ consideradoPago: true }), 0).get(l.id)).toBe(false)
  })

  it('lançamento em andamento é faturável só se o projeto ainda tem saldo', () => {
    const fechado = lanc('2026-03-01', '09:00', 2)
    const aberto = lanc('2026-03-02', '09:00')
    expect(marcarLancamentosFaturaveis([fechado, aberto], projeto(), 0).get(aberto.id)).toBe(true)
    expect(marcarLancamentosFaturaveis([fechado, aberto], projeto(), 2).get(aberto.id)).toBe(false)
  })
})
