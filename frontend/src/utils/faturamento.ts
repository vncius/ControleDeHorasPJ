import type { Projeto, StatusPagamentoProjeto } from '../types'

/**
 * Mirror de backend/src/utils/faturamento.ts::calcularStatusPagamento (sem
 * runtime compartilhado entre front e back, mesmo padrão de utils/tempo.ts).
 * Fonte única da regra continua sendo o backend — esta cópia serve só para
 * telas que agregam horas/pagamentos localmente (Projetos, Dashboard) em
 * vez de ler o resumo já computado (ResumoProjeto.statusPagamento).
 */
export function calcularStatusPagamento(
  projeto: Pick<Projeto, 'consideradoPago'>,
  totalHorasCobertas: number,
  totalTrabalhado: number
): StatusPagamentoProjeto {
  if (projeto.consideradoPago) return 'Pago'
  if (totalHorasCobertas <= 0) return 'Não pago'
  if (totalHorasCobertas >= totalTrabalhado) return 'Pago'
  return 'Parcial'
}
