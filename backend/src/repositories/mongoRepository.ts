import { Collection, ClientSession } from 'mongodb'
import { getDb } from './mongoClient'

// ============================================================
// MongoRepository — camada de persistência MongoDB genérica.
// Substitui a antiga BaseRepository (JSON em disco).
//
// Trade-off consciente de design (não repensar sem motivo novo):
// `findAll`, `findBy` e `findOneBy` recebem/possuem predicados que são
// funções JS arbitrárias — não há como traduzir uma closure para uma
// query nativa do Mongo (sem reflection de AST). Por isso esses três
// métodos buscam TODOS os documentos da coleção (equivalente a um
// `find({})`) e aplicam o predicado em JavaScript, exatamente como o
// comportamento anterior com JSON. Isso preserva 100% do comportamento
// dos services sem exigir nenhuma mudança neles.
//
// Já os métodos "ByTenant"/"ForTenant" — que são o caminho mais usado
// por todos os services — viram queries reais do Mongo (`{ tenantId }`,
// `{ _id, tenantId }`), aproveitando os índices criados em mongoClient.ts.
//
// Call sites que hoje usam findBy/findOneBy com predicado composto
// (ex.: dashboardService, clientesService.excluir, projetosService.excluir,
// salvarUltimaDescricao em lancamentosService) continuam fazendo fetch
// completo da coleção — otimizar isso para queries nativas fica para um
// item futuro, se a escala um dia justificar.
//
// Mapeamento id <-> _id: o domínio usa `id: string` (UUID) como
// identificador em tudo. Para não remapear nenhuma referência existente,
// usamos o próprio UUID como `_id` do Mongo (string, não ObjectId gerado).
//
// `session?: ClientSession` é opcional em findAll/findBy/deleteForTenant
// especificamente para suportar transações multi-documento (ver
// mongoClient.ts `withTransaction`), usadas hoje só pela exclusão em
// cascata de projeto. Sem transação (uso normal), passe undefined.
// ============================================================

interface ComId {
  id: string
  tenantId: string
}

export class MongoRepository<T extends ComId> {
  private nomeColecao: string

  constructor(nomeColecao: string) {
    this.nomeColecao = nomeColecao
  }

  protected collection(): Collection<any> {
    return getDb().collection(this.nomeColecao)
  }

  // --- mapeamento id <-> _id ---

  private paraDocumento(item: T): any {
    const { id, ...resto } = item as any
    return { _id: id, ...resto }
  }

  protected paraEntidade(doc: any): T {
    if (!doc) return doc
    const { _id, ...resto } = doc
    return { id: _id, ...resto } as T
  }

  // --- leitura genérica (fetch completo — ver comentário no topo) ---

  async findAll(session?: ClientSession): Promise<T[]> {
    const docs = await this.collection().find({}, { session }).toArray()
    return docs.map((d) => this.paraEntidade(d))
  }

  async findById(id: string): Promise<T | undefined> {
    const doc = await this.collection().findOne({ _id: id })
    return doc ? this.paraEntidade(doc) : undefined
  }

  async findBy(predicate: (item: T) => boolean, session?: ClientSession): Promise<T[]> {
    const all = await this.findAll(session)
    return all.filter(predicate)
  }

  async findOneBy(predicate: (item: T) => boolean): Promise<T | undefined> {
    const all = await this.findAll()
    return all.find(predicate)
  }

  async create(item: T): Promise<T> {
    const doc = this.paraDocumento(item)
    await this.collection().insertOne(doc)
    return item
  }

  async update(id: string, partial: Partial<T>): Promise<T | null> {
    const existente = await this.collection().findOne({ _id: id })
    if (!existente) return null

    const partialDoc: any = { ...partial }
    delete partialDoc.id // nunca alterar o _id via $set

    const camposParaRemover: string[] = []
    const camposParaSetar: any = {}

    for (const key of Object.keys(partialDoc)) {
      if (partialDoc[key] === undefined) {
        camposParaRemover.push(key)
      } else {
        camposParaSetar[key] = partialDoc[key]
      }
    }

    const updateOps: any = {}
    if (Object.keys(camposParaSetar).length > 0) updateOps.$set = camposParaSetar
    if (camposParaRemover.length > 0) {
      updateOps.$unset = Object.fromEntries(camposParaRemover.map((k) => [k, '']))
    }

    if (Object.keys(updateOps).length > 0) {
      await this.collection().updateOne({ _id: id }, updateOps)
    }

    const atualizado = await this.collection().findOne({ _id: id })
    return this.paraEntidade(atualizado)
  }

  async delete(id: string): Promise<boolean> {
    const resultado = await this.collection().deleteOne({ _id: id })
    return resultado.deletedCount > 0
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.collection().countDocuments({ _id: id }, { limit: 1 })
    return count > 0
  }

  // --- Conveniências com checagem de tenant centralizada (queries reais) ---
  // Nunca reimplemente a checagem de posse (item.tenantId === tenantId)
  // manualmente nos services — sempre use os métodos abaixo.

  async findAllByTenant(tenantId: string): Promise<T[]> {
    const docs = await this.collection().find({ tenantId }).toArray()
    return docs.map((d) => this.paraEntidade(d))
  }

  async findByIdAndTenant(id: string, tenantId: string): Promise<T | undefined> {
    const doc = await this.collection().findOne({ _id: id, tenantId })
    return doc ? this.paraEntidade(doc) : undefined
  }

  async updateForTenant(id: string, tenantId: string, partial: Partial<T>): Promise<T | null> {
    const item = await this.findByIdAndTenant(id, tenantId)
    if (!item) return null
    return this.update(id, partial)
  }

  async deleteForTenant(id: string, tenantId: string, session?: ClientSession): Promise<boolean> {
    const resultado = await this.collection().deleteOne({ _id: id, tenantId }, { session })
    return resultado.deletedCount > 0
  }

  async existsForTenant(id: string, tenantId: string): Promise<boolean> {
    const count = await this.collection().countDocuments({ _id: id, tenantId }, { limit: 1 })
    return count > 0
  }
}
