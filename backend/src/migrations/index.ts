import { randomUUID } from 'node:crypto'
import { Db } from 'mongodb'

// ============================================================
// Migrações de dados, executadas no boot (server.ts) depois de conectar no
// MongoDB e antes de abrir a porta.
//
// Regras para uma migração nova:
// - IDEMPOTENTE: roda em todo boot, então o filtro precisa casar só com o
//   que ainda não foi migrado (rodar de novo não muda nada);
// - barata quando não há o que migrar (filtro indexável / updateMany);
// - nível de sistema: atravessa todos os tenants, porque corrige o formato
//   do dado, não age em nome de um usuário;
// - o log traz só contagens — nunca conteúdo de documento.
// Para aposentar uma migração, remova-a da lista depois que todo ambiente
// (produção, demo, teste) tiver rodado com ela.
// ============================================================

// Coleções de dados do usuário (toda entidade com tenantId, exceto `usuarios`).
// Entidade nova com tenantId entra aqui também.
export const COLECOES_COM_TENANT = [
  'clientes',
  'projetos',
  'alteracoesEscopo',
  'lancamentosHoras',
  'preferenciasProjeto',
  'pagamentos',
] as const

export interface Migracao {
  id: string
  descricao: string
  /** Devolve quantos documentos foram alterados. */
  executar(db: Db): Promise<number>
}

export const MIGRACOES: Migracao[] = [
  {
    id: '001-status-pausado',
    descricao: 'Projeto com status legado "Pausado" (fora de StatusProjeto) vira "Com impedimento"',
    async executar(db) {
      const r = await db
        .collection('projetos')
        .updateMany({ status: 'Pausado' }, { $set: { status: 'Com impedimento' } })
      return r.modifiedCount
    },
  },
  {
    id: '002-tenant-email-para-uuid',
    descricao:
      'tenantId deixa de ser o e-mail (M13 — D6): cada e-mail ganha um usuário com tenantId UUID, regravado nas coleções de dados',
    async executar(db) {
      // e-mails ainda usados como tenantId em qualquer coleção
      const emails = new Set<string>()
      for (const colecao of COLECOES_COM_TENANT) {
        for (const email of await db.collection(colecao).distinct('tenantId', { tenantId: /@/ })) emails.add(email)
      }

      let alterados = 0
      for (const email of emails) {
        // usuário existente (rodada anterior interrompida ou login já feito) ou novo
        let usuario = await db.collection('usuarios').findOne({ email })
        if (!usuario) {
          const id = randomUUID()
          usuario = { _id: id as never, tenantId: id, email, versaoSessao: 0, dataCriacao: new Date().toISOString() }
          await db.collection('usuarios').insertOne(usuario)
        }
        for (const colecao of COLECOES_COM_TENANT) {
          const r = await db.collection(colecao).updateMany({ tenantId: email }, { $set: { tenantId: usuario.tenantId } })
          alterados += r.modifiedCount
        }
      }
      return alterados
    },
  },
]

export async function executarMigracoes(db: Db, migracoes: Migracao[] = MIGRACOES): Promise<void> {
  for (const m of migracoes) {
    const alterados = await m.executar(db)
    if (alterados > 0) console.log(`[migracao] ${m.id}: ${alterados} documento(s) alterado(s)`)
  }
}
