import { describe, it, expect, beforeEach, vi } from 'vitest'

// Repositórios em memória com a mesma semântica de posse por tenant do
// MongoRepository — os testes não tocam o banco.
vi.mock('../repositories', () => {
  function criarRepo() {
    let itens: any[] = []
    return {
      _reset: (novos: any[] = []) => { itens = novos.map((i) => ({ ...i })) },
      _todos: () => itens,
      findBy: async (pred: (i: any) => boolean) => itens.filter(pred),
      findOneBy: async (pred: (i: any) => boolean) => itens.find(pred),
      findAllByTenant: async (t: string) => itens.filter((i) => i.tenantId === t),
      findByIdAndTenant: async (id: string, t: string) => itens.find((i) => i.id === id && i.tenantId === t),
      existsForTenant: async (id: string, t: string) => itens.some((i) => i.id === id && i.tenantId === t),
      create: async (item: any) => { itens.push({ ...item }); return item },
      updateForTenant: async (id: string, t: string, partial: any) => {
        const item = itens.find((i) => i.id === id && i.tenantId === t)
        if (!item) return null
        Object.assign(item, partial)
        return { ...item }
      },
      deleteForTenant: async (id: string, t: string) => {
        const antes = itens.length
        itens = itens.filter((i) => !(i.id === id && i.tenantId === t))
        return itens.length < antes
      },
    }
  }
  return {
    clientesRepo: criarRepo(),
    projetosRepo: criarRepo(),
    escoposRepo: criarRepo(),
    lancamentosRepo: criarRepo(),
    preferenciasRepo: criarRepo(),
    pagamentosRepo: criarRepo(),
  }
})
vi.mock('../repositories/mongoClient', () => ({ withTransaction: async (fn: any) => fn(undefined) }))

import * as repos from '../repositories'
import { lancamentosService } from './lancamentosService'
import { projetosService } from './projetosService'

const r = repos as any
const A = 'a@exemplo.dev'
const B = 'b@exemplo.dev'

beforeEach(() => {
  r.projetosRepo._reset([
    { id: 'pA1', tenantId: A, nome: 'Projeto A1', status: 'Em desenvolvimento' },
    { id: 'pA2', tenantId: A, nome: 'Projeto A2', status: 'Em desenvolvimento' },
    { id: 'pB1', tenantId: B, nome: 'Projeto B1', status: 'Em desenvolvimento' },
  ])
  r.escoposRepo._reset([
    { id: 'eA1', tenantId: A, projetoId: 'pA1', status: 'Aprovada' },
    { id: 'eA2', tenantId: A, projetoId: 'pA2', status: 'Aprovada' },
    { id: 'eB1', tenantId: B, projetoId: 'pB1', status: 'Aprovada' },
  ])
  r.lancamentosRepo._reset([
    { id: 'lAberto', tenantId: A, projetoId: 'pA1', data: '2026-01-05', horaInicio: '09:00', descricao: 'x', tipo: 'Automatico' },
    { id: 'lFechado', tenantId: A, projetoId: 'pA1', data: '2026-01-05', horaInicio: '08:00', horaFim: '08:30', descricao: 'x', tipo: 'Manual' },
  ])
  r.preferenciasRepo._reset()
  r.pagamentosRepo._reset()
  r.clientesRepo._reset()
})

const novoLancamento = (escopoId?: string) => ({
  projetoId: 'pA1', data: '2026-01-05', horaInicio: '10:00', horaFim: '11:00', descricao: 'Trabalho', escopoId,
})

describe('lançamento só aceita escopo do mesmo tenant e do mesmo projeto', () => {
  it('criar: aceita escopo do próprio projeto', async () => {
    const criado = await lancamentosService.criar(A, novoLancamento('eA1'))
    expect(criado.escopoId).toBe('eA1')
  })

  it('criar: recusa escopo de outro tenant', async () => {
    await expect(lancamentosService.criar(A, novoLancamento('eB1'))).rejects.toMatchObject({
      status: 400,
      codigo: 'lancamento.escopoInvalido',
    })
  })

  it('criar: recusa escopo de outro projeto do mesmo tenant', async () => {
    await expect(lancamentosService.criar(A, novoLancamento('eA2'))).rejects.toThrow('Escopo não encontrado')
  })

  it('criar: sem escopo continua válido (escopo principal)', async () => {
    const criado = await lancamentosService.criar(A, novoLancamento())
    expect(criado.escopoId).toBeUndefined()
  })

  it('atualizar: recusa escopo de outro tenant e não altera o lançamento', async () => {
    await expect(lancamentosService.atualizar(A, 'lFechado', { escopoId: 'eB1' })).rejects.toThrow('Escopo não encontrado')
    expect(r.lancamentosRepo._todos().find((l: any) => l.id === 'lFechado').escopoId).toBeUndefined()
  })

  it('atualizar: null limpa o escopo', async () => {
    await lancamentosService.atualizar(A, 'lFechado', { escopoId: 'eA1' })
    const limpo = await lancamentosService.atualizar(A, 'lFechado', { escopoId: null })
    expect(limpo.escopoId).toBeUndefined()
  })

  it('finalizar: recusa escopo de outro projeto', async () => {
    await expect(lancamentosService.finalizarTrabalho(A, 'lAberto', { horaFim: '10:00', escopoId: 'eA2' })).rejects.toThrow(
      'Escopo não encontrado'
    )
  })

  it('finalizar: aceita escopo do próprio projeto', async () => {
    const finalizado = await lancamentosService.finalizarTrabalho(A, 'lAberto', { horaFim: '10:00', escopoId: 'eA1' })
    expect(finalizado.escopoId).toBe('eA1')
  })
})

describe('exclusão de projeto em cascata', () => {
  it('remove escopos, lançamentos, pagamentos e preferências do projeto — e só deles', async () => {
    r.pagamentosRepo._reset([{ id: 'pg1', tenantId: A, projetoId: 'pA1', horasCobertas: 1 }])
    r.preferenciasRepo._reset([
      { id: 'pref1', tenantId: A, projetoId: 'pA1', ultimaDescricaoLancamento: 'x' },
      { id: 'pref2', tenantId: A, projetoId: 'pA2', ultimaDescricaoLancamento: 'y' },
      { id: 'pref3', tenantId: B, projetoId: 'pA1', ultimaDescricaoLancamento: 'z' },
    ])

    await projetosService.excluir(A, 'pA1')

    expect(r.projetosRepo._todos().map((p: any) => p.id)).toEqual(['pA2', 'pB1'])
    expect(r.escoposRepo._todos().map((e: any) => e.id)).toEqual(['eA2', 'eB1'])
    expect(r.lancamentosRepo._todos()).toHaveLength(0)
    expect(r.pagamentosRepo._todos()).toHaveLength(0)
    expect(r.preferenciasRepo._todos().map((p: any) => p.id)).toEqual(['pref2', 'pref3'])
  })
})
