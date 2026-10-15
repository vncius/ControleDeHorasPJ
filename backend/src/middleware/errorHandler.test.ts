import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { errorHandler, rotaNaoEncontrada } from './errorHandler'
import { conflito, invalido, naoEncontrado } from '../errors/AppError'

let servidor: Server
let base: string

beforeAll(async () => {
  const app = express()
  app.get('/invalido', () => { throw invalido('projeto.nomeObrigatorio', 'Nome do projeto é obrigatório') })
  app.get('/nao-encontrado', () => { throw naoEncontrado('projeto.naoEncontrado', 'Projeto não encontrado') })
  app.get('/conflito', () => { throw conflito('cliente.possuiProjetos', 'possui 2 projeto(s)', { count: 2 }) })
  app.get('/inesperado', () => { throw new Error('E11000 duplicate key dup key: { tenantId: "alguem@exemplo.dev" }') })
  app.use('/api', rotaNaoEncontrada)
  app.use(errorHandler)
  servidor = app.listen(0)
  await new Promise((r) => servidor.once('listening', r))
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
afterAll(() => new Promise((r) => servidor.close(r)))

const obter = async (caminho: string) => {
  const res = await fetch(base + caminho)
  return { status: res.status, corpo: await res.json() }
}

describe('errorHandler', () => {
  it('AppError 400 devolve mensagem e código', async () => {
    expect(await obter('/invalido')).toEqual({
      status: 400,
      corpo: { erro: 'Nome do projeto é obrigatório', codigo: 'projeto.nomeObrigatorio' },
    })
  })

  it('AppError 404', async () => {
    expect((await obter('/nao-encontrado')).status).toBe(404)
  })

  it('AppError 409 inclui params para interpolação da tradução', async () => {
    const { status, corpo } = await obter('/conflito')
    expect(status).toBe(409)
    expect(corpo).toMatchObject({ codigo: 'cliente.possuiProjetos', params: { count: 2 } })
  })

  it('erro inesperado vira 500 genérico sem vazar a mensagem — nem para o cliente, nem para o log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { status, corpo } = await obter('/inesperado')
    expect(status).toBe(500)
    expect(corpo).toEqual({ erro: 'Erro interno. Tente novamente.', codigo: 'interno' })
    expect(JSON.stringify(log.mock.calls)).not.toContain('alguem@exemplo.dev')
    log.mockRestore()
  })

  it('rota /api inexistente responde 404 em JSON', async () => {
    expect(await obter('/api/nao-existe')).toEqual({
      status: 404,
      corpo: { erro: 'Rota não encontrada', codigo: 'rota.naoEncontrada' },
    })
  })
})
