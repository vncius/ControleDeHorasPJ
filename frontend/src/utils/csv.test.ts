import { describe, it, expect } from 'vitest'
import { campoTexto, campoNumero, montarCsv } from './csv'

describe('campoTexto', () => {
  it('coloca entre aspas e dobra aspas internas', () => {
    expect(campoTexto('Cliente "VIP"')).toBe('"Cliente ""VIP"""')
  })

  it('mantém ; e quebras de linha dentro do campo (não deslocam colunas)', () => {
    expect(campoTexto('Atlas; Logística\nfilial')).toBe('"Atlas; Logística\nfilial"')
  })

  it.each(['=HYPERLINK("http://x","clique")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1'])(
    'neutraliza início de fórmula: %j',
    (valor) => {
      expect(campoTexto(valor).startsWith(`"'`)).toBe(true)
    }
  )

  it('texto comum fica igual (só as aspas)', () => {
    expect(campoTexto('Reunião de kickoff')).toBe('"Reunião de kickoff"')
  })

  it('vazio, null e undefined viram campo vazio', () => {
    expect([campoTexto(''), campoTexto(null), campoTexto(undefined)]).toEqual(['""', '""', '""'])
  })
})

describe('campoNumero', () => {
  it('número negativo não é neutralizado (é gerado pelo app, não pelo usuário)', () => {
    expect(campoNumero('-1,50')).toBe('"-1,50"')
  })
})

describe('montarCsv', () => {
  it('BOM UTF-8, separador ; e CRLF entre linhas', () => {
    expect(montarCsv([['"a"', '"b"'], ['"1"', '"2"']])).toBe('﻿"a";"b"\r\n"1";"2"')
  })
})
