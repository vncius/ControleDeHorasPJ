import { useTranslation } from 'react-i18next'

// ============================================================
// Números e moeda no formato do idioma da interface (separador decimal,
// agrupamento de milhar). A moeda é sempre BRL — o valor é em reais —, só a
// apresentação muda: "R$ 1.234,50" (pt), "R$1,234.50" (en), "1234,50 R$" (es).
// ============================================================

export function formatarDecimal(valor: number, casas: number, idioma: string): string {
  return new Intl.NumberFormat(idioma, { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(valor)
}

export function formatarMoeda(valor: number, idioma: string): string {
  // narrowSymbol: sem ele, idiomas sem símbolo próprio para o real (es)
  // mostrariam o código "BRL" em vez de "R$"
  return new Intl.NumberFormat(idioma, { style: 'currency', currency: 'BRL', currencyDisplay: 'narrowSymbol' }).format(valor)
}

export function useFormatarNumero() {
  const { i18n } = useTranslation()
  return {
    idioma: i18n.language,
    formatarDecimal: (valor: number, casas = 2) => formatarDecimal(valor, casas, i18n.language),
    formatarMoeda: (valor: number) => formatarMoeda(valor, i18n.language),
  }
}
