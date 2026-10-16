// Backup do banco em arquivos JSON locais (o Atlas M0 não tem backup automático).
//
// Uso (na pasta backend/; lê MONGODB_URI e MONGODB_DB_NAME do backend/.env):
//   npm run backup
//
// Grava uma pasta backend/backups/<banco>-<data-hora>/ com um <coleção>.json
// por coleção, em EJSON canônico (preserva tipos do Mongo). A pasta está no
// .gitignore: contém os dados reais — nunca commitar nem compartilhar.
// O terminal mostra só nomes de coleção e quantidades, nunca o conteúdo.
//
// Para restaurar uma coleção (MongoDB Database Tools):
//   mongoimport --uri "<URI>" --db horas-pj --collection <coleção> --jsonArray --file <coleção>.json
import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MongoClient, BSON } from 'mongodb'

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI não definida em backend/.env')
  const nomeBanco = process.env.MONGODB_DB_NAME ?? 'horas-pj'

  const carimbo = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const pasta = join(__dirname, '..', '..', 'backups', `${nomeBanco}-${carimbo}`)
  mkdirSync(pasta, { recursive: true })

  const cliente = await new MongoClient(uri).connect()
  try {
    const db = cliente.db(nomeBanco)
    const colecoes = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).sort()
    let total = 0
    for (const nome of colecoes) {
      const docs = await db.collection(nome).find({}).toArray()
      writeFileSync(join(pasta, `${nome}.json`), BSON.EJSON.stringify(docs, undefined, 2, { relaxed: false }))
      total += docs.length
      console.log(`  ${nome}: ${docs.length} documento(s)`)
    }
    console.log(`\nBackup de "${nomeBanco}" concluído: ${colecoes.length} coleção(ões), ${total} documento(s).`)
    console.log(`Pasta: ${pasta}`)
  } finally {
    await cliente.close()
  }
}

main().catch((err) => {
  console.error('Falha no backup:', err instanceof Error ? err.message : err)
  process.exit(1)
})
