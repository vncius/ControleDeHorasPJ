export function horaAtual(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function calcularDecorrido(horaInicio: string): string {
  const [h, m] = horaInicio.split(':').map(Number)
  const inicio = new Date()
  inicio.setHours(h, m, 0, 0)
  const diff = Math.max(0, Date.now() - inicio.getTime())
  const totalMin = Math.floor(diff / 60000)
  const hh = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
