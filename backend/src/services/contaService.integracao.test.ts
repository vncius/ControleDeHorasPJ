import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import 'dotenv/config'
import { conectarMongo, getDb, resolverNomeBanco } from '../repositories/mongoClient'
import { COLECOES_COM_TENANT } from '../migrations'
import { COLECAO_AUDITORIA } from './auditoriaService'
import { contaService } from './contaService'
import { VERSAO_CONSENTIMENTO } from '../utils/consentimento'

// Integração (opt-in: `npm run test:integracao`), no banco de TESTE.
const habilitado = process.env.TESTES_INTEGRACAO === '1' && !!process.env.MONGODB_URI
const A = '00000000-0000-4000-8000-0000000000a1'
const B = '00000000-0000-4000-8000-0000000000b1'
const EMAIL_A = 'conta-a@exemplo.dev'

describe.skipIf(!habilitado)('contaService (integração)', () => {
  const limpar = async () => {
    const db = getDb()
    for (const c of COLECOES_COM_TENANT) await db.collection(c).deleteMany({ tenantId: { $in: [A, B] } })
    await db.collection(COLECAO_AUDITORIA).deleteMany({ $or: [{ tenantId: { $in: [A, B] } }, { userAgent: 'conta-teste' }] })
    await db.collection('usuarios').deleteMany({ _id: { $in: [A, B] } as never })
  }

  beforeAll(async () => {
    expect(resolverNomeBanco()).not.toBe(process.env.MONGODB_DB_NAME ?? 'horas-pj')
    await conectarMongo()
    await limpar()
    const db = getDb()
    await db.collection('usuarios').insertMany([
      { _id: A, tenantId: A, email: EMAIL_A, googleSub: 'g-a', versaoSessao: 2, dataCriacao: '2026-01-01T00:00:00.000Z' },
      { _id: B, tenantId: B, email: 'conta-b@exemplo.dev', versaoSessao: 0, dataCriacao: '2026-01-01T00:00:00.000Z' },
    ] as never[])
    await db.collection('clientes').insertMany([
      { _id: 'cc-a', tenantId: A, nome: 'Cliente A' },
      { _id: 'cc-b', tenantId: B, nome: 'Cliente B' },
    ] as never[])
    await db.collection('lancamentosHoras').insertOne({ _id: 'cl-a', tenantId: A, descricao: 'x' } as never)
    await db.collection(COLECAO_AUDITORIA).insertOne({
      _id: 'ca-a', tenantId: A, usuarioId: A, acao: 'login', ip: '1.2.3.4', userAgent: 'conta-teste',
      detalhes: { metodo: 'POST', caminho: '/api/auth/google' }, data: '2026-01-02T00:00:00.000Z',
    } as never)
  }, 30_000)

  afterAll(limpar)

  it('aceita só a versão vigente dos termos', async () => {
    await expect(contaService.aceitarConsentimento(A, VERSAO_CONSENTIMENTO + 1)).rejects.toMatchObject({ status: 400 })
    const r = await contaService.aceitarConsentimento(A, VERSAO_CONSENTIMENTO)
    expect(r.versaoConsentimento).toBe(VERSAO_CONSENTIMENTO)
    expect((await getDb().collection('usuarios').findOne({ _id: A as never }))?.consentimentoEm).toBe(r.consentimentoEm)
  })

  it('exporta só os dados do próprio usuário, sem campos internos', async () => {
    const exp = await contaService.exportar(A, A)
    expect(exp.conta).toMatchObject({ email: EMAIL_A, versaoConsentimento: VERSAO_CONSENTIMENTO })
    expect(exp.dados.clientes).toEqual([{ id: 'cc-a', nome: 'Cliente A' }])
    expect(exp.dados.lancamentosHoras).toHaveLength(1)
    expect(exp.auditoria).toHaveLength(1)
    const texto = JSON.stringify(exp)
    for (const interno of ['tenantId', 'googleSub', 'versaoSessao', '_id', 'Cliente B']) expect(texto).not.toContain(interno)
  })

  it('exclusão exige o e-mail certo', async () => {
    await expect(contaService.excluirConta(A, A, 'outro@exemplo.dev')).rejects.toMatchObject({ status: 400, codigo: 'conta.confirmacaoInvalida' })
    expect(await getDb().collection('usuarios').countDocuments({ _id: A as never })).toBe(1)
  })

  it('exclusão apaga dados e usuário, anonimiza a auditoria e não toca no outro tenant', async () => {
    await contaService.excluirConta(A, A, ' CONTA-A@exemplo.dev ')
    const db = getDb()
    for (const c of COLECOES_COM_TENANT) expect(await db.collection(c).countDocuments({ tenantId: A })).toBe(0)
    expect(await db.collection('usuarios').countDocuments({ _id: A as never })).toBe(0)

    const evento = await db.collection(COLECAO_AUDITORIA).findOne({ _id: 'ca-a' as never })
    expect(evento).toMatchObject({ acao: 'login', data: '2026-01-02T00:00:00.000Z', tenantId: null, usuarioId: null, ip: null, userAgent: null, detalhes: null })

    expect(await db.collection('clientes').countDocuments({ tenantId: B })).toBe(1)
    expect(await db.collection('usuarios').countDocuments({ _id: B as never })).toBe(1)
  })
})
