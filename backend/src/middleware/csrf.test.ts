import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { exigirCabecalhoCsrf } from './csrf'
import { opcoesCookieSessao } from './auth'

function executar(method: string, cabecalho?: string) {
  const req = { method, get: (nome: string) => (nome === 'X-Requested-With' ? cabecalho : undefined) } as unknown as Request
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
  const next = vi.fn()
  exigirCabecalhoCsrf(req, res, next)
  return { next, res }
}

describe('exigirCabecalhoCsrf', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('%s passa sem o cabeçalho', (method) => {
    expect(executar(method).next).toHaveBeenCalled()
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s sem o cabeçalho é recusado com 403', (method) => {
    const { next, res } = executar(method)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('POST com valor errado no cabeçalho é recusado', () => {
    expect(executar('POST', 'fetch').next).not.toHaveBeenCalled()
  })

  it('POST com X-Requested-With: XMLHttpRequest passa', () => {
    expect(executar('POST', 'XMLHttpRequest').next).toHaveBeenCalled()
  })
})

describe('opcoesCookieSessao', () => {
  it('padrão é SameSite=Lax, httpOnly, sem secure fora de produção', () => {
    expect(opcoesCookieSessao({})).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false })
  })

  it('produção continua Lax por padrão, com secure', () => {
    expect(opcoesCookieSessao({ NODE_ENV: 'production' })).toMatchObject({ sameSite: 'lax', secure: true })
  })

  it('COOKIE_SAME_SITE=none força secure (navegadores descartam none sem secure)', () => {
    expect(opcoesCookieSessao({ COOKIE_SAME_SITE: 'None' })).toMatchObject({ sameSite: 'none', secure: true })
  })
})
