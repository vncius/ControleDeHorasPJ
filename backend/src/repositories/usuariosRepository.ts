import { MongoRepository } from './mongoRepository'
import { Usuario } from '../types'

// Usuários (M13). Além do CRUD genérico, as buscas do login viram queries
// nativas (com índice único em mongoClient.ts), em vez do findOneBy com
// fetch completo da coleção.
export class UsuariosRepository extends MongoRepository<Usuario> {
  constructor() {
    super('usuarios')
  }

  async buscarPorGoogleSub(googleSub: string): Promise<Usuario | undefined> {
    const doc = await this.collection().findOne({ googleSub })
    return doc ? this.paraEntidade(doc) : undefined
  }

  async buscarPorEmail(email: string): Promise<Usuario | undefined> {
    const doc = await this.collection().findOne({ email })
    return doc ? this.paraEntidade(doc) : undefined
  }

  /** Invalida todas as sessões abertas ("sair de todos os dispositivos"). */
  async incrementarVersaoSessao(id: string): Promise<void> {
    await this.collection().updateOne({ _id: id }, { $inc: { versaoSessao: 1 } })
  }
}
