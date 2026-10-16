import { describe, it, expect, beforeEach, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import type { Request, Response } from 'express'

// usuários em memória — o middleware e o service só usam estes métodos
vi.mock('../repositories', () => {
  const usuarios = new Map<string, any>()
  return {
    usuariosRepo: {
      _reset: () => usuarios.clear(),
      _todos: () => [...usuarios.values()],
      findById: async (id: string) => usuarios.get(id),
      buscarPorGoogleSub: async (sub: string) => [...usuarios.values()].find((u) => u.googleSub === sub),
      buscarPorEmail: async (email: string) => [...usuarios.values()].find((u) => u.email === email),
      create: async (u: any) => { usuarios.set(u.id, { ...u }); return u },
      update: async (id: string, p: any) => { const u = usuarios.get(id); Object.assign(u, p); return { ...u } },
      incrementarVersaoSessao: async (id: string) => { usuarios.get(id).versaoSessao++ },
    },
  }
})

// segredo fictício gerado em tempo de execução (um literal parecido com chave dispara o Gitleaks)
process.env.JWT_SECRET = 'teste-'.repeat(8)

import * as repos from '../repositories'
import { assinarSessao, verificarSessao, requireAuth, NOME_COOKIE_SESSAO, DURACAO_SESSAO_MS } from './auth'
import { usuariosService } from '../services/usuariosService'

const r = (repos as any).usuariosRepo

async function autenticar(token?: string) {
  const req = { cookies: token ? { [NOME_COOKIE_SESSAO]: token } : {} } as unknown as Request
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
  const next = vi.fn()
  await requireAuth(req, res, next)
  return { req, res, next }
}

beforeEach(() => r._reset())

describe('token de sessão', () => {
  it('carrega uid e versão, e vale 24h', () => {
    const token = assinarSessao({ uid: 'u1', v: 3 })
    expect(verificarSessao(token)).toEqual({ uid: 'u1', v: 3 })
    const { exp, iat } = jwt.decode(token) as { exp: number; iat: number }
    expect((exp - iat) * 1000).toBe(DURACAO_SESSAO_MS)
  })

  it('recusa o formato antigo ({ email }) e token assinado com outro segredo', () => {
    expect(verificarSessao(jwt.sign({ email: 'a@exemplo.dev' }, process.env.JWT_SECRET!))).toBeNull()
    expect(verificarSessao(jwt.sign({ uid: 'u1', v: 0 }, 'outro-segredo'))).toBeNull()
  })
})

describe('requireAuth', () => {
  it('sessão válida preenche req.usuario com o tenantId do usuário (nunca o e-mail)', async () => {
    const u = await usuariosService.entrarComGoogle({ sub: 'g-1', email: 'a@exemplo.dev', nome: 'Ana' })
    const { req, next } = await autenticar(assinarSessao({ uid: u.id, v: u.versaoSessao }))
    expect(next).toHaveBeenCalledWith()
    expect(req.usuario).toEqual({ id: u.id, tenantId: u.tenantId, email: 'a@exemplo.dev', nome: 'Ana' })
    expect(req.usuario!.tenantId).not.toContain('@')
  })

  it('sem cookie ou com usuário inexistente responde 401', async () => {
    expect((await autenticar()).res.status).toHaveBeenCalledWith(401)
    expect((await autenticar(assinarSessao({ uid: 'nao-existe', v: 0 }))).res.status).toHaveBeenCalledWith(401)
  })

  it('"sair de todos" invalida na hora as sessões emitidas antes', async () => {
    const u = await usuariosService.entrarComGoogle({ sub: 'g-1', email: 'a@exemplo.dev' })
    const antigo = assinarSessao({ uid: u.id, v: u.versaoSessao })
    expect((await autenticar(antigo)).next).toHaveBeenCalled() // aquece o cache

    await usuariosService.sairDeTodos(u.id)

    const { res, next } = await autenticar(antigo)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    // um login novo recebe a versão nova e volta a funcionar
    const novo = await usuariosService.entrarComGoogle({ sub: 'g-1', email: 'a@exemplo.dev' })
    expect((await autenticar(assinarSessao({ uid: novo.id, v: novo.versaoSessao }))).next).toHaveBeenCalled()
  })
})

describe('authController', () => {
  it('/auth/me devolve o e-mail e o nome do usuário (não o tenantId)', async () => {
    const { authController } = await import('../controllers')
    const u = await usuariosService.entrarComGoogle({ sub: 'g-me', email: 'me@exemplo.dev', nome: 'Me' })
    const { req } = await autenticar(assinarSessao({ uid: u.id, v: u.versaoSessao }))
    const res = { json: vi.fn() } as unknown as Response
    authController.me(req, res)
    expect(res.json).toHaveBeenCalledWith({ email: 'me@exemplo.dev', nome: 'Me' })
  })
})

describe('usuariosService.entrarComGoogle', () => {
  it('conta nova: tenantId = id (UUID), com o sub do Google', async () => {
    const u = await usuariosService.entrarComGoogle({ sub: 'g-novo', email: 'novo@exemplo.dev' })
    expect(u.tenantId).toBe(u.id)
    expect(u.tenantId).toMatch(/^[0-9a-f-]{36}$/)
    expect(u).toMatchObject({ googleSub: 'g-novo', versaoSessao: 0 })
  })

  it('usuário migrado (sem sub) é vinculado pelo e-mail no primeiro login', async () => {
    await r.create({ id: 'migrado', tenantId: 'migrado', email: 'antigo@exemplo.dev', versaoSessao: 0 })
    const u = await usuariosService.entrarComGoogle({ sub: 'g-2', email: 'antigo@exemplo.dev' })
    expect(u).toMatchObject({ id: 'migrado', tenantId: 'migrado', googleSub: 'g-2' })
    expect(r._todos()).toHaveLength(1)
  })

  it('identifica pelo sub mesmo que o e-mail no Google tenha mudado', async () => {
    const original = await usuariosService.entrarComGoogle({ sub: 'g-3', email: 'velho@exemplo.dev' })
    const depois = await usuariosService.entrarComGoogle({ sub: 'g-3', email: 'novo@exemplo.dev' })
    expect(depois.tenantId).toBe(original.tenantId)
    expect(depois.email).toBe('novo@exemplo.dev')
    expect(r._todos()).toHaveLength(1)
  })
})
