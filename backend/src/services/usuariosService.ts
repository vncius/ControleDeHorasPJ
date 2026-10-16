import { randomUUID as uuid } from 'node:crypto'
import { usuariosRepo } from '../repositories'
import { Usuario } from '../types'
import { agora } from '../utils/tempo'
import { invalidarCacheUsuario } from '../middleware/auth'

export interface IdentidadeGoogle {
  sub: string
  email: string
  nome?: string
}

export const usuariosService = {
  /**
   * Usuário do login Google (M13 — D6). Ordem de identificação:
   * 1. pelo `sub` do Google — estável mesmo que o e-mail mude;
   * 2. pelo e-mail — usuário criado pela migração 002 (dados de antes da
   *    M13), que ainda não tem `sub`: ele é vinculado agora;
   * 3. senão, conta nova, com `tenantId` = id (UUID) — o e-mail nunca mais
   *    vira chave de dado.
   */
  async entrarComGoogle({ sub, email, nome }: IdentidadeGoogle): Promise<Usuario> {
    const acesso = agora()

    const porSub = await usuariosRepo.buscarPorGoogleSub(sub)
    if (porSub) {
      const atualizado = await usuariosRepo.update(porSub.id, { email, nome, ultimoAcesso: acesso })
      return atualizado ?? porSub
    }

    const porEmail = await usuariosRepo.buscarPorEmail(email)
    if (porEmail) {
      const atualizado = await usuariosRepo.update(porEmail.id, { googleSub: sub, nome, ultimoAcesso: acesso })
      return atualizado ?? porEmail
    }

    const id = uuid()
    return usuariosRepo.create({
      id,
      tenantId: id,
      email,
      googleSub: sub,
      ...(nome && { nome }),
      versaoSessao: 0,
      dataCriacao: acesso,
      ultimoAcesso: acesso,
    })
  },

  /** "Sair de todos os dispositivos": toda sessão emitida até agora deixa de valer. */
  async sairDeTodos(usuarioId: string): Promise<void> {
    await usuariosRepo.incrementarVersaoSessao(usuarioId)
    invalidarCacheUsuario(usuarioId)
  },
}
