import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

vi.mock('../services/auditoriaService', () => ({ auditoriaService: { registrar: vi.fn(), listar: vi.fn() } }))
vi.mock('../services/authService', () => ({ authService: { loginComGoogle: vi.fn() } }))
vi.mock('../services/usuariosService', () => ({
  usuariosService: { entrarComGoogle: vi.fn(), sairDeTodos: vi.fn() },
}))

process.env.JWT_SECRET = 'teste-'.repeat(8)

import { auditoriaService } from '../services/auditoriaService'
import { authService } from '../services/authService'
import { usuariosService } from '../services/usuariosService'
import { auditar, auditarExclusoes, auditarRegularizacao } from './auditoria'
import { authController } from '../controllers'
import { naoAutorizado } from '../errors/AppError'
import { errorHandler } from './errorHandler'

const registrar = vi.mocked(auditoriaService.registrar)
let servidor: Server
let base: string

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  // simula o requireAuth
  app.use((req, _res, next) => {
    req.usuario = { id: 'u1', tenantId: 't1', email: 'a@exemplo.dev' }
    next()
  })
  app.use(auditarExclusoes)
  app.delete('/api/clientes/:id', (req, res) => {
    if (req.params.id === 'inexistente') return void res.status(404).json({})
    res.json({ ok: true })
  })
  app.post('/api/importar', auditar('importacao'), (_req, res) => res.status(201).json([]))
  app.put('/api/projetos/:id', auditarRegularizacao, (_req, res) => res.json({}))
  app.post('/api/auth/google', authController.loginGoogle)
  app.use(errorHandler)
  servidor = app.listen(0)
  await new Promise((r) => servidor.once('listening', r))
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
afterAll(() => new Promise((r) => servidor.close(r)))
beforeEach(() => registrar.mockClear())

const chamar = (metodo: string, caminho: string, corpo?: unknown) =>
  fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'teste' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  })
// 'finish' dispara depois de a resposta sair: espera o próximo tick
const aposResposta = () => new Promise((r) => setTimeout(r, 20))

describe('auditoria', () => {
  it('exclusão bem-sucedida grava quem, de onde e a rota (sem query string)', async () => {
    await chamar('DELETE', '/api/clientes/c1?motivo=x')
    await aposResposta()
    expect(registrar).toHaveBeenCalledTimes(1)
    expect(registrar.mock.calls[0][0]).toMatchObject({
      tenantId: 't1', usuarioId: 'u1', acao: 'exclusao', userAgent: 'teste',
      detalhes: { metodo: 'DELETE', caminho: '/api/clientes/c1' },
    })
  })

  it('exclusão que falhou (404) não grava nada', async () => {
    await chamar('DELETE', '/api/clientes/inexistente')
    await aposResposta()
    expect(registrar).not.toHaveBeenCalled()
  })

  it('importação grava a ação e nunca o corpo da requisição', async () => {
    await chamar('POST', '/api/importar', { linhas: [{ descricao: 'dado do cliente' }] })
    await aposResposta()
    expect(registrar.mock.calls[0][0].acao).toBe('importacao')
    expect(JSON.stringify(registrar.mock.calls[0][0])).not.toContain('dado do cliente')
  })

  it('regularização grava o novo valor de consideradoPago; edição comum de projeto não grava', async () => {
    await chamar('PUT', '/api/projetos/p1', { nome: 'Novo nome' })
    await chamar('PUT', '/api/projetos/p1', { consideradoPago: true })
    await aposResposta()
    expect(registrar).toHaveBeenCalledTimes(1)
    expect(registrar.mock.calls[0][0]).toMatchObject({ acao: 'regularizacao', detalhes: { consideradoPago: true } })
  })

  it('login com sucesso grava "login" com o tenant; token recusado grava "login_falhou" sem identidade', async () => {
    vi.mocked(authService.loginComGoogle).mockResolvedValueOnce({ sub: 'g', email: 'a@exemplo.dev' })
    vi.mocked(usuariosService.entrarComGoogle).mockResolvedValueOnce({
      id: 'u1', tenantId: 't1', email: 'a@exemplo.dev', versaoSessao: 0, dataCriacao: '',
    })
    expect((await chamar('POST', '/api/auth/google', { credential: 'ok' })).status).toBe(200)

    vi.mocked(authService.loginComGoogle).mockRejectedValueOnce(naoAutorizado('auth.tokenInvalido', 'Token do Google inválido'))
    expect((await chamar('POST', '/api/auth/google', { credential: 'ruim' })).status).toBe(401)

    expect(registrar.mock.calls.map((c) => [c[0].acao, c[0].tenantId])).toEqual([
      ['login', 't1'],
      ['login_falhou', null],
    ])
    expect(JSON.stringify(registrar.mock.calls)).not.toContain('a@exemplo.dev')
  })
})
