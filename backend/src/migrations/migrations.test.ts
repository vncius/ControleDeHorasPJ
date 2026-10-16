import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import 'dotenv/config'
import type { Db } from 'mongodb'
import { executarMigracoes, MIGRACOES, COLECOES_COM_TENANT, type Migracao } from '.'
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

describe.skipIf(!habilitado)('002-tenant-email-para-uuid (integração)', () => {
  const migracao = MIGRACOES.find((m) => m.id === '002-tenant-email-para-uuid')!
  const A = 'migracao-a@exemplo.dev'
  const B = 'migracao-b@exemplo.dev'
  const ID_B = '00000000-0000-4000-8000-00000000000b'
  const limpar = async () => {
    const db = getDb()
    const ids = (await db.collection('usuarios').find({ email: { $in: [A, B] } }).toArray()).map((u) => u.tenantId)
    for (const c of COLECOES_COM_TENANT) await db.collection(c).deleteMany({ tenantId: { $in: [A, B, ...ids] } })
    await db.collection('usuarios').deleteMany({ email: { $in: [A, B] } })
  }

  beforeAll(async () => {
    expect(resolverNomeBanco()).not.toBe(process.env.MONGODB_DB_NAME ?? 'horas-pj')
    await conectarMongo()
    await limpar()
    const db = getDb()
    await db.collection('clientes').insertMany([
      { _id: 'm2-c1', tenantId: A, nome: 'Cliente A' },
      { _id: 'm2-c2', tenantId: B, nome: 'Cliente B' },
    ] as any[])
    await db.collection('lancamentosHoras').insertOne({ _id: 'm2-l1', tenantId: A, descricao: 'x' } as any)
    // B já tem usuário (ex.: rodada anterior interrompida): o tenantId dele deve ser reaproveitado
    await db.collection('usuarios').insertOne({ _id: ID_B, tenantId: ID_B, email: B, versaoSessao: 0 } as any)
  }, 30_000)

  afterAll(limpar)

  it('cria usuário para cada e-mail e regrava o tenantId em todas as coleções', async () => {
    const db = getDb()
    expect(await migracao.executar(db)).toBeGreaterThanOrEqual(3)

    const usuarioA = await db.collection('usuarios').findOne({ email: A })
    expect(usuarioA?.tenantId).toMatch(/^[0-9a-f-]{36}$/)
    expect(usuarioA?.tenantId).toBe(usuarioA?._id)
    expect((await db.collection('clientes').findOne({ _id: 'm2-c1' as any }))?.tenantId).toBe(usuarioA?.tenantId)
    expect((await db.collection('lancamentosHoras').findOne({ _id: 'm2-l1' as any }))?.tenantId).toBe(usuarioA?.tenantId)
    expect((await db.collection('clientes').findOne({ _id: 'm2-c2' as any }))?.tenantId).toBe(ID_B)
    expect(await db.collection('usuarios').countDocuments({ email: { $in: [A, B] } })).toBe(2)
  })

  it('é idempotente: nenhum tenantId com @ sobra e rodar de novo não altera nada', async () => {
    const db = getDb()
    for (const c of COLECOES_COM_TENANT) expect(await db.collection(c).countDocuments({ tenantId: { $in: [A, B] } })).toBe(0)
    expect(await migracao.executar(db)).toBe(0)
  })
})
