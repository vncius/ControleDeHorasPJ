import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import 'dotenv/config'
import { conectarMongo, getDb, resolverNomeBanco } from '../repositories/mongoClient'
import { auditoriaService, COLECAO_AUDITORIA } from './auditoriaService'

// Integração (opt-in: `npm run test:integracao`), no banco de TESTE.
const habilitado = process.env.TESTES_INTEGRACAO === '1' && !!process.env.MONGODB_URI
const A = 'auditoria-teste-a'
const B = 'auditoria-teste-b'
const contexto = { ip: '127.0.0.1', userAgent: 'teste', detalhes: { metodo: 'DELETE', caminho: '/api/clientes/x' } }

describe.skipIf(!habilitado)('auditoriaService (integração)', () => {
  beforeAll(async () => {
    expect(resolverNomeBanco()).not.toBe(process.env.MONGODB_DB_NAME ?? 'horas-pj')
    await conectarMongo()
    await getDb().collection(COLECAO_AUDITORIA).deleteMany({ tenantId: { $in: [A, B] } })
  }, 30_000)

  afterAll(async () => {
    await getDb().collection(COLECAO_AUDITORIA).deleteMany({ tenantId: { $in: [A, B] } })
  })

  it('grava em segundo plano e lista só os eventos do próprio tenant, mais recentes primeiro', async () => {
    auditoriaService.registrar({ tenantId: A, usuarioId: A, acao: 'login', ...contexto })
    await new Promise((r) => setTimeout(r, 50))
    auditoriaService.registrar({ tenantId: A, usuarioId: A, acao: 'exclusao', ...contexto })
    auditoriaService.registrar({ tenantId: B, usuarioId: B, acao: 'login', ...contexto })

    // fire-and-forget: espera a gravação chegar ao banco
    for (let i = 0; i < 50 && (await getDb().collection(COLECAO_AUDITORIA).countDocuments({ tenantId: { $in: [A, B] } })) < 3; i++) {
      await new Promise((r) => setTimeout(r, 100))
    }

    const eventos = await auditoriaService.listar(A)
    expect(eventos.map((e) => e.acao)).toEqual(['exclusao', 'login'])
    expect(eventos[0]).not.toHaveProperty('tenantId')
    expect(eventos[0]).toMatchObject({ ip: '127.0.0.1', detalhes: { caminho: '/api/clientes/x' } })
  })
})
