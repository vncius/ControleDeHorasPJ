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
]

export async function executarMigracoes(db: Db, migracoes: Migracao[] = MIGRACOES): Promise<void> {
  for (const m of migracoes) {
    const alterados = await m.executar(db)
    if (alterados > 0) console.log(`[migracao] ${m.id}: ${alterados} documento(s) alterado(s)`)
  }
}
