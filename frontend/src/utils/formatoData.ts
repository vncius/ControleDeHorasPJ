export type FormatoData = 'auto' | 'dd-mm-yyyy' | 'mm-dd-yyyy' | 'yyyy-mm-dd'

/**
 * Formata uma data YYYY-MM-DD respeitando a preferência do usuário.
 * "auto" segue o idioma da interface (via Intl); os demais formatos são
 * fixos, independentes do idioma.
 */
export function formatarDataISO(iso: string | undefined, formato: FormatoData, idioma: string): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  switch (formato) {
    case 'dd-mm-yyyy': return `${dia}/${mes}/${ano}`
    case 'mm-dd-yyyy': return `${mes}/${dia}/${ano}`
    case 'yyyy-mm-dd': return iso
    default:
      return new Date(iso + 'T00:00:00').toLocaleDateString(idioma, { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
}

/** Variante curta (ano com 2 dígitos) — usada em colunas de tabela apertadas. */
export function formatarDataISOCurta(iso: string | undefined, formato: FormatoData, idioma: string): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.split('-')
  const anoCurto = ano.slice(-2)
  switch (formato) {
    case 'dd-mm-yyyy': return `${dia}/${mes}/${anoCurto}`
    case 'mm-dd-yyyy': return `${mes}/${dia}/${anoCurto}`
    case 'yyyy-mm-dd': return iso
    default:
      return new Date(iso + 'T00:00:00').toLocaleDateString(idioma, { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
}
