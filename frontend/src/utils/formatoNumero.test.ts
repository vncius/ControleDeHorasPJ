import { describe, it, expect } from 'vitest'
import { formatarDecimal, formatarMoeda } from './formatoNumero'

// Intl separa número e símbolo com espaço "não quebrável" (U+00A0/U+202F);
// normaliza para comparar só o conteúdo.
const semEspacoEspecial = (s: string) => s.replace(/[  ]/g, ' ')

describe('formatarDecimal', () => {
  it('usa o separador decimal e de milhar do idioma', () => {
    expect(formatarDecimal(1234.5, 2, 'pt')).toBe('1.234,50')
    expect(formatarDecimal(1234.5, 2, 'en')).toBe('1,234.50')
  })

  it('respeita o número de casas', () => {
    expect(formatarDecimal(2.25, 1, 'pt')).toBe('2,3')
    expect(formatarDecimal(0, 2, 'en')).toBe('0.00')
  })
})

describe('formatarMoeda', () => {
  it('é sempre BRL, só a apresentação muda com o idioma', () => {
    expect(semEspacoEspecial(formatarMoeda(1234.5, 'pt'))).toBe('R$ 1.234,50')
    expect(semEspacoEspecial(formatarMoeda(1234.5, 'en'))).toBe('R$1,234.50')
    expect(semEspacoEspecial(formatarMoeda(1234.5, 'es'))).toContain('R$')
  })
})
