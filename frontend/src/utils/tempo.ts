export function horaAtual(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * Formata um Date como YYYY-MM-DD no fuso LOCAL. Nunca usar
 * toISOString().slice(0,10): devolve a data UTC e, após as 21h no
 * Brasil, cai no dia seguinte.
 */
export function dataLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function hojeLocal(): string {
  return dataLocalISO(new Date())
}

function decorridoMs(horaInicio: string, data?: string): number {
  const [h, m] = horaInicio.split(':').map(Number)
  // ancorado na data de início quando conhecida — um ponto iniciado ontem
  // à noite (virada de meia-noite) continua contando corretamente
  const inicio = data ? new Date(data + 'T00:00:00') : new Date()
  inicio.setHours(h, m, 0, 0)
  return Math.max(0, Date.now() - inicio.getTime())
}

export function calcularDecorrido(horaInicio: string, data?: string): string {
  const totalMin = Math.floor(decorridoMs(horaInicio, data) / 60000)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Decorrido em horas decimais (ex.: 1h30 → 1.5) — usado para somar ao vivo aos totais. */
export function calcularDecorridoDecimal(horaInicio: string, data?: string): number {
  return decorridoMs(horaInicio, data) / 3600000
}
