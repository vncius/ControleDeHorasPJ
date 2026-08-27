import { Projeto, StatusProjeto, StatusPagamentoProjeto } from '../types'

// Status que encerram um projeto — horas não são mais faturáveis
export const STATUS_ENCERRADO = new Set<StatusProjeto>(['Finalizado', 'Cancelado'])

/**
 * Status de pagamento do projeto a partir da soma de Pagamento.horasCobertas
 * comparada ao total de horas já trabalhadas (lançadas). Fonte única desta
 * regra — usada pelo resumo de projeto, dashboard e relatórios.
 */
export function calcularStatusPagamento(
  totalHorasCobertas: number,
  totalTrabalhado: number
): StatusPagamentoProjeto {
  if (totalHorasCobertas <= 0) return 'Não pago'
  if (totalHorasCobertas >= totalTrabalhado) return 'Pago'
  return 'Parcial'
}

/**
 * Um projeto ainda tem saldo a faturar se não está encerrado e as horas
 * cobertas por pagamentos não alcançam o total já trabalhado.
 */
export function projetoTemSaldoAFaturar(
  projeto: Projeto,
  totalHorasCobertas: number,
  totalTrabalhado: number
): boolean {
  if (STATUS_ENCERRADO.has(projeto.status)) return false
  return totalHorasCobertas < totalTrabalhado
}

/**
 * Marca cada lançamento finalizado do projeto como faturável ou não, em
 * ordem FIFO: as horas mais antigas são as primeiras cobertas pelos
 * pagamentos (não há vínculo entre um pagamento específico e um lançamento
 * específico — só o total de horas cobertas importa). Um lançamento em
 * andamento (sem horaFim) não entra na soma cumulativa; seu resultado
 * reflete apenas se o projeto já tem saldo a faturar considerando o que
 * foi finalizado até aqui.
 */
export function marcarLancamentosFaturaveis<
  T extends { id: string; data: string; horaInicio: string; horaFim?: string; totalDecimal?: number }
>(lancamentos: T[], projeto: Projeto, totalHorasCobertas: number): Map<string, boolean> {
  const resultado = new Map<string, boolean>()

  if (STATUS_ENCERRADO.has(projeto.status)) {
    lancamentos.forEach((l) => resultado.set(l.id, false))
    return resultado
  }

  const finalizados = lancamentos.filter((l) => l.horaFim !== undefined && l.totalDecimal !== undefined)
  const emAberto = lancamentos.filter((l) => l.horaFim === undefined)

  const ordenados = [...finalizados].sort(
    (a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio)
  )

  let acumulado = 0
  for (const l of ordenados) {
    acumulado += l.totalDecimal ?? 0
    resultado.set(l.id, acumulado > totalHorasCobertas)
  }

  const saldoRestante = projetoTemSaldoAFaturar(projeto, totalHorasCobertas, acumulado)
  emAberto.forEach((l) => resultado.set(l.id, saldoRestante))

  return resultado
}
