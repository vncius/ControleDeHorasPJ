import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import {
  criarProjetoSchema,
  atualizarProjetoSchema,
  criarEscopoSchema,
  criarPagamentoSchema,
  criarLancamentoSchema,
  atualizarLancamentoSchema,
  finalizarLancamentoSchema,
  previewImportacaoSchema,
  confirmarImportacaoSchema,
  MAX_LINHAS_IMPORTACAO,
} from '.'
import { validarCorpo, bloquearChavesProibidas } from '../middleware/validacao'
import { errorHandler } from '../middleware/errorHandler'

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success

describe('schemas — o que o frontend envia hoje passa', () => {
  it('projeto (criar e atualizar com horasContratadas: null = horas abertas)', () => {
    const base = { clienteId: 'c1', nome: 'Portal', status: 'Em desenvolvimento', dataInicio: '2026-07-01', consideradoPago: false }
    expect(ok(criarProjetoSchema, { ...base, horasContratadas: 160, valorHora: 120 })).toBe(true)
    expect(ok(criarProjetoSchema, base)).toBe(true)
    expect(ok(atualizarProjetoSchema, { ...base, horasContratadas: null })).toBe(true)
  })

  it('escopo com horasAdicionais null (horas livres)', () => {
    expect(ok(criarEscopoSchema, { titulo: 'Levantamento', horasAdicionais: null, status: 'Aprovada' })).toBe(true)
  })

  it('lançamento: criar, atualizar com escopoId null e finalizar', () => {
    expect(ok(criarLancamentoSchema, { projetoId: 'p1', data: '2026-10-15', horaInicio: '09:00', horaFim: '10:30', descricao: 'x', tipo: 'Manual' })).toBe(true)
    expect(ok(atualizarLancamentoSchema, { escopoId: null, horaFim: '11:00' })).toBe(true)
    expect(ok(finalizarLancamentoSchema, { horaFim: '18:00', descricao: 'x', escopoId: null })).toBe(true)
  })

  it('importação: ano chega como número ou texto numérico', () => {
    expect(previewImportacaoSchema.parse({ texto: 'linha', ano: '2026' }).ano).toBe(2026)
  })
})

describe('schemas — o que deve ser recusado', () => {
  it('campos que nunca vêm do cliente (tenantId, geradoPorRegularizacao)', () => {
    expect(ok(criarProjetoSchema, { clienteId: 'c1', nome: 'P', dataInicio: '2026-07-01', tenantId: 'outro@x.dev' })).toBe(false)
    const pagamento = { horasCobertas: 10, dataPagamento: '2026-10-01', periodoApuracaoInicio: '2026-08-16', periodoApuracaoFim: '2026-09-15' }
    expect(ok(criarPagamentoSchema, pagamento)).toBe(true)
    expect(ok(criarPagamentoSchema, { ...pagamento, geradoPorRegularizacao: true })).toBe(false)
  })

  it('status de escopo fora do enum (é o que decide o que soma ao limite)', () => {
    expect(ok(criarEscopoSchema, { titulo: 'X', status: 'Aprovadíssima' })).toBe(false)
  })

  it('datas e horas fora do formato', () => {
    expect(ok(criarLancamentoSchema, { projetoId: 'p1', data: '15/10/2026', horaInicio: '09:00', descricao: 'x' })).toBe(false)
    expect(ok(criarLancamentoSchema, { projetoId: 'p1', data: '2026-10-15', horaInicio: '25:00', descricao: 'x' })).toBe(false)
  })

  it('descrição só com espaços no lançamento manual', () => {
    expect(ok(criarLancamentoSchema, { projetoId: 'p1', data: '2026-10-15', horaInicio: '09:00', descricao: '   ' })).toBe(false)
  })

  it('número como texto e horas negativas', () => {
    expect(ok(criarProjetoSchema, { clienteId: 'c1', nome: 'P', dataInicio: '2026-07-01', horasContratadas: '160' })).toBe(false)
    expect(ok(criarEscopoSchema, { titulo: 'X', horasAdicionais: -2 })).toBe(false)
  })

  it('importação: linha com hora adulterada e excesso de linhas', () => {
    const linha = { indice: 0, textoOriginal: 't', data: '2026-10-05', horaInicio: '09:00', horaFim: '10:00', status: 'valida' }
    expect(ok(confirmarImportacaoSchema, { linhas: [linha] })).toBe(true)
    expect(ok(confirmarImportacaoSchema, { linhas: [{ ...linha, horaFim: '99:99' }] })).toBe(false)
    expect(ok(confirmarImportacaoSchema, { linhas: Array(MAX_LINHAS_IMPORTACAO + 1).fill(linha) })).toBe(false)
  })
})

// ----------------------------------------------------------------
// Middlewares de validação (HTTP real numa porta efêmera)
// ----------------------------------------------------------------
let servidor: Server
let base: string

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use(bloquearChavesProibidas)
  app.post('/escopos', validarCorpo(criarEscopoSchema), (req, res) => res.json(req.body))
  app.use(errorHandler)
  servidor = app.listen(0)
  await new Promise((r) => servidor.once('listening', r))
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
afterAll(() => new Promise((r) => servidor.close(r)))

const postar = async (corpo: string) => {
  const res = await fetch(`${base}/escopos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo })
  return { status: res.status, corpo: await res.json() }
}

describe('validarCorpo e bloquearChavesProibidas', () => {
  it('corpo válido passa com trim aplicado', async () => {
    expect(await postar(JSON.stringify({ titulo: '  Integração  ' }))).toEqual({ status: 200, corpo: { titulo: 'Integração' } })
  })

  it('campo inválido responde 400 com o caminho do campo', async () => {
    expect(await postar(JSON.stringify({ titulo: 'X', status: 'Talvez' }))).toEqual({
      status: 400,
      corpo: { erro: 'Campo inválido: status', codigo: 'validacao.campoInvalido', params: { campo: 'status' } },
    })
  })

  it('campo desconhecido responde 400', async () => {
    const { status, corpo } = await postar(JSON.stringify({ titulo: 'X', tenantId: 'outro@x.dev' }))
    expect(status).toBe(400)
    expect(corpo).toMatchObject({ codigo: 'validacao.campoDesconhecido', params: { campo: 'tenantId' } })
  })

  it.each([
    ['operador Mongo', '{"titulo":"X","filtro":{"$ne":null}}', '$ne'],
    ['__proto__', '{"titulo":"X","__proto__":{"admin":true}}', '__proto__'],
  ])('%s em qualquer nível é recusado antes do schema', async (_nome, corpo, chave) => {
    const r = await postar(corpo)
    expect(r.status).toBe(400)
    expect(r.corpo).toMatchObject({ codigo: 'validacao.chaveProibida', params: { campo: chave } })
  })
})
