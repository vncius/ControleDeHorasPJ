// ============================================================
// Utilitários de tempo
// ============================================================

/**
 * Converte "HH:MM" para minutos totais
 */
export function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/**
 * Converte minutos totais para "HH:MM"
 */
export function minutosParaHHMM(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Converte minutos para decimal (ex: 90 → 1.5)
 */
export function minutosParaDecimal(minutos: number): number {
  return Math.round((minutos / 60) * 100) / 100
}

/**
 * Calcula diferença em minutos entre duas horas "HH:MM"
 * Retorna null se horaFim < horaInicio
 */
export function calcularDiferenca(
  horaInicio: string,
  horaFim: string
): { minutos: number; hhMM: string; decimal: number } | null {
  const inicio = horaParaMinutos(horaInicio)
  const fim = horaParaMinutos(horaFim)
  if (fim < inicio) return null
  const minutos = fim - inicio
  return {
    minutos,
    hhMM: minutosParaHHMM(minutos),
    decimal: minutosParaDecimal(minutos),
  }
}

/**
 * Data/hora atual no formato ISO 8601
 */
export function agora(): string {
  return new Date().toISOString()
}

/**
 * Data hoje no formato YYYY-MM-DD
 */
export function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Hora atual no formato HH:MM
 */
export function horaAtual(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Verifica se uma string está no formato YYYY-MM-DD
 */
export function isDataValida(data: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(data)
}

/**
 * Verifica se uma string está no formato HH:MM
 */
export function isHoraValida(hora: string): boolean {
  return /^\d{2}:\d{2}$/.test(hora)
}

/**
 * Soma de horas em decimal de uma lista de lançamentos finalizados
 */
export function somarHoras(decimais: (number | undefined)[]): number {
  return decimais.reduce<number>((acc, v) => acc + (v ?? 0), 0)
}

/**
 * Determina se um lançamento é faturável considerando a data de pagamento do projeto.
 *
 * Regra:
 * - Sem dataPagamento → sempre faturável
 * - Com dataPagamento → faturável apenas se lancamento.data < dataPagamento
 *   (lançamentos do dia do pagamento em diante já não são faturáveis)
 */
export function lancamentoEhFaturavel(
  lancamentoData: string,
  dataPagamento?: string
): boolean {
  if (!dataPagamento) return true
  return lancamentoData < dataPagamento
}
