import { Projeto, LancamentoHoras, StatusProjeto } from '../types'

// Status que encerram um projeto — horas não são mais faturáveis
export const STATUS_ENCERRADO = new Set<StatusProjeto>(['Finalizado', 'Cancelado'])

/**
 * Um projeto é faturável (ainda a receber) se não está pago e não está encerrado.
 * Fonte única desta regra — usada pelo dashboard e pelos relatórios.
 */
export function projetoEhFaturavel(projeto: Projeto): boolean {
  return !projeto.pago && !STATUS_ENCERRADO.has(projeto.status)
}

/**
 * Um lançamento é faturável quando:
 * 1. o projeto não está encerrado (Finalizado/Cancelado)
 * 2. o projeto não está marcado como pago sem uma dataPagamento definida
 * 3. a data do lançamento é anterior à dataPagamento do projeto (quando existir)
 */
export function lancamentoEhFaturavel(
  lancamento: Pick<LancamentoHoras, 'data'>,
  projeto: Projeto
): boolean {
  if (STATUS_ENCERRADO.has(projeto.status)) return false
  if (projeto.pago && !projeto.dataPagamento) return false
  if (!projeto.dataPagamento) return true
  return lancamento.data < projeto.dataPagamento
}
