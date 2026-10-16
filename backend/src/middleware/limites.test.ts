import { describe, it, expect, vi, afterAll, beforeAll } from 'vitest'
import express from 'express'
import type { Request, Response } from 'express'
import type { AddressInfo } from 'node:net'
import { Server } from 'node:http'
import { criarLimitador } from './rateLimit'
import { parsersJson } from './corpo'
import { errorHandler } from './errorHandler'

// ----------------------------------------------------------------
// Rate limit (unitário, relógio controlado)
// ----------------------------------------------------------------
function executor(max: number, janelaMs: number) {
  let instante = 1_000_000
  const limitador = criarLimitador({ max, janelaMs, chave: (req) => (req as any).k, agora: () => instante })
  return {
    avancar: (ms: number) => { instante += ms },
    chamar(k: string | undefined) {
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() } as unknown as Response
      const next = vi.fn()
      limitador({ k } as unknown as Request, res, next)
      return { passou: next.mock.calls.length === 1, res }
    },
  }
}

describe('criarLimitador', () => {
  it('deixa passar até o máximo e recusa o seguinte com 429 e Retry-After', () => {
    const l = executor(3, 60_000)
    expect([1, 2, 3].map(() => l.chamar('ip1').passou)).toEqual([true, true, true])
    const quarta = l.chamar('ip1')
    expect(quarta.passou).toBe(false)
    expect(quarta.res.status).toHaveBeenCalledWith(429)
    expect(quarta.res.setHeader).toHaveBeenCalledWith('Retry-After', '60')
  })

  it('conta cada chave separadamente', () => {
    const l = executor(1, 60_000)
    expect(l.chamar('a').passou).toBe(true)
    expect(l.chamar('b').passou).toBe(true)
    expect(l.chamar('a').passou).toBe(false)
  })

  it('libera de novo quando a janela vence', () => {
    const l = executor(1, 60_000)
    l.chamar('a')
    expect(l.chamar('a').passou).toBe(false)
    l.avancar(60_000)
    expect(l.chamar('a').passou).toBe(true)
  })

  it('sem chave (ex.: sem sessão) não limita', () => {
    const l = executor(1, 60_000)
    expect([1, 2, 3].every(() => l.chamar(undefined).passou)).toBe(true)
  })
})

// ----------------------------------------------------------------
// Limite de corpo (HTTP real numa porta efêmera)
// ----------------------------------------------------------------
let servidor: Server
let base: string

beforeAll(async () => {
  const app = express()
  app.use(parsersJson())
  app.post('/{*caminho}', (req, res) => res.json({ bytes: JSON.stringify(req.body).length }))
  app.use(errorHandler)
  servidor = app.listen(0)
  await new Promise((r) => servidor.once('listening', r))
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
afterAll(() => new Promise((r) => servidor.close(r)))

const postar = (caminho: string, corpo: string) =>
  fetch(base + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo })
const texto = (kb: number) => JSON.stringify({ texto: 'x'.repeat(kb * 1024) })

describe('limites de corpo JSON', () => {
  it('rota comum aceita corpo pequeno', async () => {
    expect((await postar('/api/clientes', texto(10))).status).toBe(200)
  })

  it('rota comum recusa acima de 100 KB com 413 em JSON', async () => {
    const res = await postar('/api/clientes', texto(150))
    expect(res.status).toBe(413)
    expect(await res.json()).toHaveProperty('erro')
  })

  it.each(['importar-preview', 'importar-confirmar'])('importação (%s) aceita 1 MB', async (rota) => {
    expect((await postar(`/api/projetos/abc/lancamentos/${rota}`, texto(1024))).status).toBe(200)
  })

  it('importação recusa acima de 2 MB', async () => {
    expect((await postar('/api/projetos/abc/lancamentos/importar-preview', texto(2100))).status).toBe(413)
  })

  it('JSON malformado vira 400 em JSON', async () => {
    const res = await postar('/api/clientes', '{"nome": ')
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ erro: 'JSON inválido no corpo da requisição', codigo: 'corpo.jsonInvalido' })
  })
})
