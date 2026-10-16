import { randomUUID } from 'node:crypto'
import { getDb } from '../repositories/mongoClient'

// ============================================================
// Trilha de auditoria (M14): quem, quando, de onde e qual rota — para
// login/logout e para o que apaga, importa em massa ou muda a situação de
// pagamento de um projeto. Nunca grava corpo de requisição, e-mail nem
// dado de negócio (nome de cliente, horas, valores).
//
// Gravação "fire and forget": a auditoria nunca atrasa nem derruba a
// requisição — se o Mongo falhar, fica só a linha no log do servidor.
// ============================================================

export type AcaoAuditoria =
  | 'login'
  | 'login_falhou'
  | 'logout'
  | 'logout_todos'
  | 'exclusao'
  | 'importacao'
  | 'regularizacao'

export interface EventoAuditoria {
  id: string
  tenantId: string | null       // null em login_falhou (não se sabe quem era)
  usuarioId: string | null
  acao: AcaoAuditoria
  ip: string | null
  userAgent: string | null
  detalhes: { metodo: string; caminho: string; consideradoPago?: boolean } | null
  data: string                  // ISO 8601
}

export const COLECAO_AUDITORIA = 'auditoria'
const LIMITE_LISTAGEM = 100

export const auditoriaService = {
  registrar(evento: Omit<EventoAuditoria, 'id' | 'data'>): void {
    const doc = { _id: randomUUID(), ...evento, data: new Date().toISOString() }
    void Promise.resolve()
      .then(() => getDb().collection(COLECAO_AUDITORIA).insertOne(doc as never))
      .catch((err) => console.error(`[auditoria] falha ao gravar "${evento.acao}": ${err?.name ?? 'erro'}`))
  },

  /** Eventos do próprio tenant, mais recentes primeiro. */
  async listar(tenantId: string): Promise<Omit<EventoAuditoria, 'tenantId' | 'usuarioId'>[]> {
    const docs = await getDb()
      .collection(COLECAO_AUDITORIA)
      .find({ tenantId }, { projection: { tenantId: 0, usuarioId: 0 } })
      .sort({ data: -1 })
      .limit(LIMITE_LISTAGEM)
      .toArray()
    return docs.map(({ _id, ...resto }) => ({ id: String(_id), ...resto }) as never)
  },
}
