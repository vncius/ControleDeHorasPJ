import { describe, it, expect } from 'vitest'
import { validarAmbiente } from './ambiente'

const SEGREDO_FORTE = 'x'.repeat(48)
const CLIENT_ID = '123-abc.apps.googleusercontent.com'

describe('validarAmbiente', () => {
  it('aceita configuração completa em produção', () => {
    expect(() =>
      validarAmbiente({ NODE_ENV: 'production', JWT_SECRET: SEGREDO_FORTE, GOOGLE_CLIENT_ID: CLIENT_ID })
    ).not.toThrow()
  })

  it('exige JWT_SECRET e GOOGLE_CLIENT_ID em qualquer ambiente, listando os dois', () => {
    expect(() => validarAmbiente({})).toThrow(/JWT_SECRET não definido[\s\S]*GOOGLE_CLIENT_ID não definido/)
  })

  it('trata valor só com espaços como ausente', () => {
    expect(() => validarAmbiente({ JWT_SECRET: '   ', GOOGLE_CLIENT_ID: CLIENT_ID })).toThrow('JWT_SECRET não definido')
  })

  it('em desenvolvimento aceita segredo curto', () => {
    expect(() => validarAmbiente({ JWT_SECRET: 'curto', GOOGLE_CLIENT_ID: CLIENT_ID })).not.toThrow()
  })

  it('em produção recusa segredo com menos de 32 bytes', () => {
    expect(() =>
      validarAmbiente({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(31), GOOGLE_CLIENT_ID: CLIENT_ID })
    ).toThrow('ao menos 32 bytes')
  })

  it('em produção recusa os valores de exemplo do .env.example', () => {
    expect(() =>
      validarAmbiente({
        NODE_ENV: 'production',
        JWT_SECRET: 'replace-with-a-long-random-secret',
        GOOGLE_CLIENT_ID: 'your-google-oauth-client-id.apps.googleusercontent.com',
      })
    ).toThrow(/JWT_SECRET está com o valor de exemplo[\s\S]*GOOGLE_CLIENT_ID está com o valor de exemplo/)
  })
})

describe('validarAmbiente — COOKIE_SAME_SITE', () => {
  const base = { JWT_SECRET: SEGREDO_FORTE, GOOGLE_CLIENT_ID: CLIENT_ID }

  it('aceita ausente e os valores válidos, sem diferenciar maiúsculas', () => {
    for (const COOKIE_SAME_SITE of [undefined, 'lax', 'Strict', 'none']) {
      expect(() => validarAmbiente({ ...base, COOKIE_SAME_SITE })).not.toThrow()
    }
  })

  it('recusa valor desconhecido', () => {
    expect(() => validarAmbiente({ ...base, COOKIE_SAME_SITE: 'relaxado' })).toThrow('COOKIE_SAME_SITE inválido')
  })
})
