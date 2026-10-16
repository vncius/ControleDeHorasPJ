import { MongoClient, Db, ClientSession } from 'mongodb'

// ============================================================
// mongoClient — conexão única com o MongoDB Atlas, reusada por
// todos os repositories. `conectarMongo()` deve ser chamada UMA
// vez na inicialização do servidor (ver server.ts); os repositories
// usam `getDb()` para acessar a conexão já estabelecida.
//
// `withTransaction()` expõe transações multi-documento (o cluster M0
// do Atlas é um replica set e suporta isso) para os poucos fluxos que
// precisam de atomicidade entre coleções — hoje só a exclusão em
// cascata de projeto (`projetosService.excluir`).
// ============================================================

let db: Db | undefined
let mongoClient: MongoClient | undefined

/**
 * Nome do banco a usar. Em NODE_ENV=test resolve para o banco de teste
 * (MONGODB_DB_NAME_TEST, default "<produção>-test") e NUNCA pode coincidir
 * com o banco de produção — testes não tocam dados reais.
 */
export function resolverNomeBanco(): string {
  const nomeProducao = process.env.MONGODB_DB_NAME ?? 'horas-pj'
  if (process.env.NODE_ENV !== 'test') return nomeProducao

  const nomeTeste = process.env.MONGODB_DB_NAME_TEST ?? `${nomeProducao}-test`
  if (nomeTeste === nomeProducao) {
    throw new Error(
      'MONGODB_DB_NAME_TEST não pode ser igual a MONGODB_DB_NAME — testes nunca rodam no banco de produção'
    )
  }
  return nomeTeste
}

export async function conectarMongo(): Promise<Db> {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI não definida em backend/.env')
  }

  const client = new MongoClient(uri)
  await client.connect()

  const nomeBanco = resolverNomeBanco()
  const database = client.db(nomeBanco)

  // ping de verificação — falha rápido se a connection string estiver errada
  // ou o cluster estiver inacessível, em vez de falhar silenciosamente na
  // primeira query real.
  await database.command({ ping: 1 })

  db = database
  mongoClient = client

  await criarIndices(database)

  return database
}

export function getDb(): Db {
  if (!db) {
    throw new Error('MongoDB ainda não conectado — chame conectarMongo() antes de usar getDb()')
  }
  return db
}

// --- transações ---

/**
 * Executa `fn` dentro de uma transação multi-documento. Use apenas quando
 * várias escritas em coleções diferentes precisam ser atômicas (ex.:
 * exclusão em cascata). Para leituras/escritas isoladas de uma única
 * entidade, não há necessidade de transação.
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  if (!mongoClient) {
    throw new Error('MongoDB ainda não conectado — chame conectarMongo() antes de usar withTransaction()')
  }
  const session = mongoClient.startSession()
  try {
    let resultado: T
    await session.withTransaction(async () => {
      resultado = await fn(session)
    })
    return resultado!
  } finally {
    await session.endSession()
  }
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

    database.collection('usuarios').createIndex({ email: 1 }, { unique: true }),
    // googleSub só existe depois do 1º login de um usuário migrado
    database.collection('usuarios').createIndex(
      { googleSub: 1 },
      { unique: true, partialFilterExpression: { googleSub: { $type: 'string' } } }
    ),
  ])
}
