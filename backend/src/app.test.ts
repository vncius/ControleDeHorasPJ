import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { criarApp } from './app'
import { linhaDeLog } from './middleware/logRequisicoes'

// Testes HTTP do app montado (sem MongoDB): só caminhos que respondem antes
// de chegar a um service — saúde, cabeçalhos, CORS, CSRF, sessão e corpo.
const ORIGEM = 'http://localhost:5173'
let servidor: Server
let base: string

beforeAll(async () => {
  servidor = criarApp({ NODE_ENV: 'test', CORS_ORIGIN: ORIGEM }).listen(0)
  await new Promise((r) => servidor.once('listening', r))
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`
})
afterAll(() => new Promise((r) => servidor.close(r)))

const XHR = { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' }

describe('app HTTP', () => {
  it('GET /health responde 200 com cabeçalhos do helmet e sem X-Powered-By', async () => {
    const res = await fetch(`${base}/health`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('x-powered-by')).toBeNull()
  })

  it('rota protegida sem sessão responde 401', async () => {
    expect((await fetch(`${base}/api/clientes`)).status).toBe(401)
  })

  it('POST sem o cabeçalho de CSRF responde 403, mesmo em rota pública', async () => {
    const res = await fetch(`${base}/api/auth/logout`, { method: 'POST' })
    expect(res.status).toBe(403)
  })

  it('logout com o cabeçalho limpa o cookie com SameSite=Lax e HttpOnly', async () => {
    const res = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: XHR })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/sessao=;/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('CORS libera só a origem configurada', async () => {
    const permitida = await fetch(`${base}/health`, { headers: { Origin: ORIGEM } })
    expect(permitida.headers.get('access-control-allow-origin')).toBe(ORIGEM)
    const outra = await fetch(`${base}/health`, { headers: { Origin: 'https://site-malicioso.example' } })
    expect(outra.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('corpo acima do limite responde 413 em JSON antes de chegar à rota', async () => {
    const res = await fetch(`${base}/api/clientes`, {
      method: 'POST',
      headers: XHR,
      body: JSON.stringify({ nome: 'x'.repeat(150 * 1024) }),
    })
    expect(res.status).toBe(413)
    expect(await res.json()).toHaveProperty('erro')
  })
})

describe('linhaDeLog', () => {
  it('registra método, caminho sem query string, status e duração', () => {
    expect(linhaDeLog('GET', '/api/projetos?clienteId=abc&email=x@y.com', 200, 12)).toBe('[http] GET /api/projetos 200 12ms')
  })
})
