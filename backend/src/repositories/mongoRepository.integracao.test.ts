import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import 'dotenv/config'
import { conectarMongo, getDb, resolverNomeBanco } from './mongoClient'
import { MongoRepository } from './mongoRepository'

// ============================================================
// Integração com MongoDB de verdade: isolamento por tenant nos métodos
// *ByTenant / *ForTenant (a única barreira entre os dados de usuários).
//
// Opt-in (precisa de rede e de MONGODB_URI): `npm run test:integracao`.
// Roda no banco de TESTE — com NODE_ENV=test, resolverNomeBanco() usa
// MONGODB_DB_NAME_TEST e recusa coincidir com o de produção. Usa uma coleção
// própria, removida ao final.
// ============================================================

const habilitado = process.env.TESTES_INTEGRACAO === '1' && !!process.env.MONGODB_URI
const COLECAO = 'teste_isolamento_tenant'

interface Item {
  id: string
  tenantId: string
  nome: string
  opcional?: string
}

describe.skipIf(!habilitado)('MongoRepository — isolamento por tenant (integração)', () => {
  const repo = new MongoRepository<Item>(COLECAO)
  const A = 'a@exemplo.dev'
  const B = 'b@exemplo.dev'

  beforeAll(async () => {
    expect(resolverNomeBanco()).not.toBe(process.env.MONGODB_DB_NAME ?? 'horas-pj')
    await conectarMongo()
    await getDb().collection(COLECAO).deleteMany({})
    await repo.create({ id: 'a1', tenantId: A, nome: 'do A', opcional: 'x' })
    await repo.create({ id: 'a2', tenantId: A, nome: 'outro do A' })
    await repo.create({ id: 'b1', tenantId: B, nome: 'do B' })
  }, 30_000)

  afterAll(async () => {
    await getDb().collection(COLECAO).drop().catch(() => {})
  })

  it('findAllByTenant devolve só os do tenant', async () => {
    expect((await repo.findAllByTenant(A)).map((i) => i.id).sort()).toEqual(['a1', 'a2'])
    expect((await repo.findAllByTenant(B)).map((i) => i.id)).toEqual(['b1'])
  })

  it('findByIdAndTenant / existsForTenant não enxergam item de outro tenant', async () => {
    expect(await repo.findByIdAndTenant('b1', A)).toBeUndefined()
    expect(await repo.existsForTenant('b1', A)).toBe(false)
    expect((await repo.findByIdAndTenant('b1', B))?.nome).toBe('do B')
  })

  it('updateForTenant de outro tenant não altera nada', async () => {
    expect(await repo.updateForTenant('b1', A, { nome: 'invadido' })).toBeNull()
    expect((await repo.findByIdAndTenant('b1', B))?.nome).toBe('do B')
  })

  it('deleteForTenant de outro tenant não remove nada', async () => {
    expect(await repo.deleteForTenant('b1', A)).toBe(false)
    expect(await repo.existsForTenant('b1', B)).toBe(true)
  })

  it('update com undefined remove o campo ($unset) e devolve o id do domínio', async () => {
    const atualizado = await repo.updateForTenant('a1', A, { opcional: undefined })
    expect(atualizado).toMatchObject({ id: 'a1', nome: 'do A' })
    expect(atualizado).not.toHaveProperty('opcional')
    expect(atualizado).not.toHaveProperty('_id')
  })
})
