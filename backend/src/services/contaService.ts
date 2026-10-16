import { getDb, withTransaction } from '../repositories/mongoClient'
import { usuariosRepo } from '../repositories'
import { COLECOES_COM_TENANT } from '../migrations'
import { COLECAO_AUDITORIA } from './auditoriaService'
import { invalidarCacheUsuario } from '../middleware/auth'
import { VERSAO_CONSENTIMENTO } from '../utils/consentimento'
import { agora } from '../utils/tempo'
import { invalido, naoEncontrado } from '../errors/AppError'

// ============================================================
// Direitos do titular e consentimento (M15 — D7; LGPD art. 8º e 18).
// ============================================================

/** Formato do arquivo exportado — incremente se a estrutura mudar. */
export const VERSAO_EXPORTACAO = 1

export const contaService = {
  /** Aceite dos Termos + Política na versão vigente (só ela é aceita). */
  async aceitarConsentimento(usuarioId: string, versao: number): Promise<{ versaoConsentimento: number; consentimentoEm: string }> {
    if (versao !== VERSAO_CONSENTIMENTO) {
      throw invalido('conta.versaoConsentimentoInvalida', 'Versão dos termos desatualizada. Recarregue a página.')
    }
    const consentimentoEm = agora()
    const atualizado = await usuariosRepo.update(usuarioId, { versaoConsentimento: versao, consentimentoEm })
    if (!atualizado) throw naoEncontrado('conta.naoEncontrada', 'Conta não encontrada')
    invalidarCacheUsuario(usuarioId)
    return { versaoConsentimento: versao, consentimentoEm }
  },

  /**
   * Portabilidade / acesso (art. 18, II e V): tudo o que o app guarda do
   * usuário, num JSON só. Campos internos (_id, tenantId, googleSub,
   * versaoSessao) ficam de fora — `id` de cada registro permanece, para as
   * referências entre entidades continuarem legíveis.
   */
  async exportar(usuarioId: string, tenantId: string) {
    const usuario = await usuariosRepo.findById(usuarioId)
    if (!usuario) throw naoEncontrado('conta.naoEncontrada', 'Conta não encontrada')
    const db = getDb()

    const dados: Record<string, unknown[]> = {}
    for (const colecao of COLECOES_COM_TENANT) {
      const docs = await db.collection(colecao).find({ tenantId }, { projection: { tenantId: 0 } }).toArray()
      dados[colecao] = docs.map(({ _id, ...resto }) => ({ id: _id, ...resto }))
    }
    const auditoria = await db
      .collection(COLECAO_AUDITORIA)
      .find({ tenantId }, { projection: { _id: 0, tenantId: 0, usuarioId: 0 } })
      .sort({ data: 1 })
      .toArray()

    return {
      formato: 'horas-pj-exportacao',
      versaoFormato: VERSAO_EXPORTACAO,
      exportadoEm: agora(),
      conta: {
        email: usuario.email,
        nome: usuario.nome,
        dataCriacao: usuario.dataCriacao,
        versaoConsentimento: usuario.versaoConsentimento,
        consentimentoEm: usuario.consentimentoEm,
      },
      dados,
      auditoria,
    }
  },

  /**
   * Eliminação (art. 18, VI): apaga todos os dados do tenant e o usuário, numa
   * transação. A trilha de auditoria do usuário é ANONIMIZADA (fica só ação +
   * data, sem tenant, usuário, IP nem navegador) em vez de apagada: registra
   * que algo aconteceu, sem identificar ninguém. Sessões abertas em outros
   * aparelhos deixam de valer na hora — o requireAuth não encontra o usuário.
   * Confirmação: o usuário redigita o próprio e-mail.
   */
  async excluirConta(usuarioId: string, tenantId: string, emailConfirmacao: string): Promise<void> {
    const usuario = await usuariosRepo.findById(usuarioId)
    if (!usuario) throw naoEncontrado('conta.naoEncontrada', 'Conta não encontrada')
    if (emailConfirmacao.trim().toLowerCase() !== usuario.email) {
      throw invalido('conta.confirmacaoInvalida', 'O e-mail digitado não confere com o da conta')
    }

    const db = getDb()
    await withTransaction(async (session) => {
      for (const colecao of COLECOES_COM_TENANT) {
        await db.collection(colecao).deleteMany({ tenantId }, { session })
      }
      await db
        .collection(COLECAO_AUDITORIA)
        .updateMany(
          { tenantId },
          { $set: { tenantId: null, usuarioId: null, ip: null, userAgent: null, detalhes: null } },
          { session }
        )
      await db.collection('usuarios').deleteOne({ _id: usuarioId as never }, { session })
    })
    invalidarCacheUsuario(usuarioId)
  },
}
