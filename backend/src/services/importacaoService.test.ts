import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../repositories', () => {
  const lancamentos: any[] = []
  return {
    lancamentosRepo: { create: async (l: any) => { lancamentos.push(l); return l }, _todos: () => lancamentos, _reset: () => { lancamentos.length = 0 } },
    projetosRepo: { existsForTenant: async (id: string, t: string) => id === 'p1' && t === 'a@exemplo.dev' },
  }
})

import * as repos from '../repositories'
import { parsearLinhas, importacaoService } from './importacaoService'

const linha = (...colunas: string[]) => colunas.join('\t')

describe('parsearLinhas', () => {
  it('linha completa e consistente é válida, com totais calculados', () => {
    const [l] = parsearLinhas(linha('seg, 05/out', 'Reunião', '09:00', '10:30', '01:30', '1,50'), 2026)
    expect(l).toMatchObject({
      status: 'valida', data: '2026-10-05', descricao: 'Reunião',
      horaInicio: '09:00', horaFim: '10:30', totalHHMMCalculado: '01:30', totalDecimalCalculado: 1.5,
    })
  })

  it('ignora linhas em branco e numera as demais', () => {
    const r = parsearLinhas(['', linha('seg, 05/out', 'A', '09:00', '10:00', '01:00'), '   ', linha('ter, 06/out', 'B', '09:00', '10:00', '01:00')].join('\n'), 2026)
    expect(r.map((l) => l.indice)).toEqual([1, 2])
  })

  it('descrição vazia é erro (D8) — não é importada', () => {
    const [l] = parsearLinhas(linha('seg, 05/out', '', '09:00', '10:00', '01:00', '1,00'), 2026)
    expect(l.status).toBe('erro')
    expect(l.mensagem).toMatch(/Descrição vazia/)
  })

  it('total divergente além da tolerância é aviso (importável)', () => {
    const [l] = parsearLinhas(linha('seg, 05/out', 'X', '14:00', '17:15', '03:00', '3,00'), 2026)
    expect(l.status).toBe('aviso')
  })

  it('divergência dentro da tolerância de 0,02 continua válida', () => {
    const [l] = parsearLinhas(linha('seg, 05/out', 'X', '09:00', '09:20', '00:20', '0,34'), 2026)
    expect(l.status).toBe('valida')
  })

  it('virada de meia-noite é aviso, com total calculado correto', () => {
    const [l] = parsearLinhas(linha('seg, 05/out', 'Deploy', '23:00', '00:30', '01:30', '1,50'), 2026)
    expect(l).toMatchObject({ status: 'aviso', totalHHMMCalculado: '01:30' })
  })

  it.each([
    ['colunas insuficientes', linha('seg, 05/out', 'X', '09:00', '10:00')],
    ['data inválida', linha('05/10', 'X', '09:00', '10:00', '01:00')],
    ['mês desconhecido', linha('seg, 05/xyz', 'X', '09:00', '10:00', '01:00')],
    ['hora início inválida', linha('seg, 05/out', 'X', '9h', '10:00', '01:00')],
    ['hora fim inválida', linha('seg, 05/out', 'X', '09:00', '', '01:00')],
  ])('%s é erro', (_nome, texto) => {
    expect(parsearLinhas(texto, 2026)[0].status).toBe('erro')
  })
})

describe('importacaoService.confirmar', () => {
  const r = repos as any
  beforeEach(() => r.lancamentosRepo._reset())

  const valida = { indice: 1, textoOriginal: 't', data: '2026-10-05', descricao: 'Reunião', horaInicio: '09:00', horaFim: '10:30', status: 'valida' as const }

  it('grava válidas e avisos com totais recalculados no servidor', async () => {
    const criados = await importacaoService.confirmar('a@exemplo.dev', 'p1', [
      { ...valida, totalDecimalCalculado: 99 }, // valor do cliente é ignorado
      { ...valida, indice: 2, status: 'aviso' },
    ])
    expect(criados).toHaveLength(2)
    expect(criados[0]).toMatchObject({ totalHHMM: '01:30', totalDecimal: 1.5, tipo: 'Importado', tenantId: 'a@exemplo.dev' })
  })

  it('descarta linha com erro e linha sem descrição, mesmo com status adulterado para válida', async () => {
    const criados = await importacaoService.confirmar('a@exemplo.dev', 'p1', [
      valida,
      { ...valida, indice: 2, status: 'erro' },
      { ...valida, indice: 3, descricao: '   ' },
      { ...valida, indice: 4, descricao: undefined },
    ])
    expect(criados.map((l) => l.descricao)).toEqual(['Reunião'])
  })

  it('projeto de outro tenant é recusado com 404', async () => {
    await expect(importacaoService.confirmar('b@exemplo.dev', 'p1', [valida])).rejects.toMatchObject({
      status: 404,
      codigo: 'projeto.naoEncontrado',
    })
  })
})
