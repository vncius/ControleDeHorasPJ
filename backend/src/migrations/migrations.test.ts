import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import 'dotenv/config'
import type { Db } from 'mongodb'
import { executarMigracoes, MIGRACOES, type Migracao } from '.'
import { conectarMongo, getDb, resolverNomeBanco } from '../repositories/mongoClient'

describe('executarMigracoes', () => {
  it('roda todas na ordem e só registra no log as que alteraram algo (sem conteúdo)', async () => {
    const ordem: string[] = []
    const fake = (id: string, alterados: number): Migracao => ({
      id, descricao: id, executar: async () => { ordem.push(id); return alterados },
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await executarMigracoes({} as Db, [fake('a', 0), fake('b', 3)])
    expect(ordem).toEqual(['a', 'b'])
    expect(log.mock.calls).toEqual([['[migracao] b: 3 documento(s) alterado(s)']])
    log.mockRestore()
  })

  it('ids são únicos', () => {
    expect(new Set(MIGRACOES.map((m) => m.id)).size).toBe(MIGRACOES.length)
  })
})

// Integração (opt-in: `npm run test:integracao`), no banco de TESTE.
const habilitado = process.env.TESTES_INTEGRACAO === '1' && !!process.env.MONGODB_URI
const TENANT = 'migracao-teste@exemplo.dev'

describe.skipIf(!habilitado)('001-status-pausado (integração)', () => {
  const migracao = MIGRACOES.find((m) => m.id === '001-status-pausado')!

  beforeAll(async () => {
    expect(resolverNomeBanco()).not.toBe(process.env.MONGODB_DB_NAME ?? 'horas-pj')
    await conectarMongo()
    const projetos = getDb().collection('projetos')
    await projetos.deleteMany({ tenantId: TENANT })
    await projetos.insertMany([
      { _id: 'mig-1', tenantId: TENANT, nome: 'Legado', status: 'Pausado' },
      { _id: 'mig-2', tenantId: TENANT, nome: 'Normal', status: 'Em testes' },
    ] as any[])
  }, 30_000)

  afterAll(async () => {
    await getDb().collection('projetos').deleteMany({ tenantId: TENANT })
  })

  it('converte "Pausado" em "Com impedimento" e não mexe nos demais', async () => {
    expect(await migracao.executar(getDb())).toBeGreaterThanOrEqual(1)
    const docs = await getDb().collection('projetos').find({ tenantId: TENANT }).sort({ _id: 1 }).toArray()
    expect(docs.map((d) => d.status)).toEqual(['Com impedimento', 'Em testes'])
  })

  it('é idempotente: rodar de novo não altera nada', async () => {
    expect(await migracao.executar(getDb())).toBe(0)
  })
})
