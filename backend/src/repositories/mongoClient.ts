import { MongoClient, Db } from 'mongodb'

// ============================================================
// mongoClient — conexão única com o MongoDB Atlas, reusada por
// todos os repositories. `conectarMongo()` deve ser chamada UMA
// vez na inicialização do servidor (ver server.ts); os repositories
// usam `getDb()` para acessar a conexão já estabelecida.
//
// Limitação conhecida: exclusão em cascata de projeto
// (`projetosService.excluir`, que apaga escopos/lançamentos/preferências
// junto com o projeto) NÃO é atômica — não há transação multi-documento
// envolvida. O cluster M0 do Atlas suporta transações (é um replica set),
// mas implementá-las exigiria encapsular a lógica de cascata (hoje no
// service) dentro da camada de repository, o que violaria a regra desta
// migração de não tocar em `services/`. Fica como item futuro.
// ============================================================

let db: Db | undefined

export async function conectarMongo(): Promise<Db> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI não definida em backend/.env')
  }

  const client = new MongoClient(uri)
  await client.connect()

  const nomeBanco = process.env.MONGODB_DB_NAME ?? 'horas-pj'
  const database = client.db(nomeBanco)

  // ping de verificação — falha rápido se a connection string estiver errada
  // ou o cluster estiver inacessível, em vez de falhar silenciosamente na
  // primeira query real.
  await database.command({ ping: 1 })

  db = database

  await criarIndices(database)

  return database
}

export function getDb(): Db {
  if (!db) {
    throw new Error('MongoDB ainda não conectado — chame conectarMongo() antes de usar getDb()')
  }
  return db
}

// --- índices ---
// createIndex é idempotente: não duplica se o índice já existir com a
// mesma definição.

async function criarIndices(database: Db): Promise<void> {
  await Promise.all([
    database.collection('clientes').createIndex({ tenantId: 1 }),

    database.collection('projetos').createIndex({ tenantId: 1 }),
    database.collection('projetos').createIndex({ tenantId: 1, clienteId: 1 }),

    database.collection('alteracoesEscopo').createIndex({ tenantId: 1, projetoId: 1 }),

    database.collection('lancamentosHoras').createIndex({ tenantId: 1, projetoId: 1 }),
    database.collection('lancamentosHoras').createIndex({ tenantId: 1, data: 1 }),

    database.collection('preferenciasProjeto').createIndex({ tenantId: 1, projetoId: 1 }, { unique: true }),
  ])
}
