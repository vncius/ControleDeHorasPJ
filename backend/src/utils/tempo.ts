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
 * Calcula diferença em minutos entre duas horas "HH:MM".
 * horaFim menor que horaInicio é interpretada como virada de meia-noite
 * (ex.: 23:00 → 00:30 = 1h30); o lançamento pertence ao dia em que começou.
 */
export function calcularDiferenca(
  horaInicio: string,
  horaFim: string
): { minutos: number; hhMM: string; decimal: number } {
  const inicio = horaParaMinutos(horaInicio)
  const fim = horaParaMinutos(horaFim)
  const minutos = fim >= inicio ? fim - inicio : 24 * 60 - inicio + fim
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
 * Formata um Date como YYYY-MM-DD no fuso LOCAL. Nunca usar
 * toISOString().slice(0,10) para isso: devolve a data UTC e, após as
 * 21h no Brasil, cai no dia seguinte.
 */
export function dataLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Data hoje no formato YYYY-MM-DD (fuso local, consistente com horaAtual)
 */
export function hoje(): string {
  return dataLocalISO(new Date())
}

/**
 * Hora atual no formato HH:MM
 */
export function horaAtual(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Constrói o instante (Date) de uma data "YYYY-MM-DD" + hora "HH:MM", no
 * fuso local do processo.
 */
export function instanteDe(data: string, hora: string): Date {
  const [h, m] = hora.split(':').map(Number)
  const instante = new Date(data + 'T00:00:00')
  instante.setHours(h, m, 0, 0)
  return instante
}

/**
 * true se data+hora cai no futuro em relação a agora. Usado para barrar
 * início de lançamento em andamento no futuro (ex.: hora corrigida para
 * antes da meia-noite sem também voltar a data um dia).
 */
export function isInstanteFuturo(data: string, hora: string): boolean {
  return instanteDe(data, hora).getTime() > Date.now()
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
  // arredonda o total para 2 casas: cada parcela já tem 2 casas, e a soma em
  // ponto flutuante acumularia erro (0,1 + 0,2 = 0,30000000000000004)
  const total = decimais.reduce<number>((acc, v) => acc + (v ?? 0), 0)
  return Math.round(total * 100) / 100
}

// Regra de faturabilidade movida para utils/faturamento.ts (fonte única,
// considera status do projeto + soma de pagamentos vs. horas trabalhadas).

/**
 * Período de apuração fixo: do dia 16 de um mês ao dia 15 do mês seguinte.
 * Dado uma data qualquer, devolve o {inicio, fim} do período que a contém.
 * dia 16 pertence ao período que começa nele; dia 15 pertence ao período
 * que termina nele (não ao que começa no dia 16 seguinte).
 */
export function periodoApuracao(data: string): { inicio: string; fim: string } {
  const [ano, mes, dia] = data.split('-').map(Number)
  if (dia >= 16) {
    return {
      inicio: `${ano}-${String(mes).padStart(2, '0')}-16`,
      fim: dataLocalISO(new Date(ano, mes, 15)),
    }
  }
  return {
    inicio: dataLocalISO(new Date(ano, mes - 2, 16)),
    fim: `${ano}-${String(mes).padStart(2, '0')}-15`,
  }
}
