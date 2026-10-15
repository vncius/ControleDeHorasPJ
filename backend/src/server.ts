// Toda a lógica de data/hora do app (utils/tempo.ts, dashboardService) assume
// fuso America/Sao_Paulo via horário local do processo. Fixar aqui evita que o
// cálculo de "hoje", hora atual e horas em andamento saia errado quando a
// hospedagem (ex.: Render) roda o container em UTC por padrão.
process.env.TZ = 'America/Sao_Paulo'

import 'dotenv/config'
import { criarApp } from './app'
import { conectarMongo } from './repositories/mongoClient'
import { executarMigracoes } from './migrations'
import { validarAmbiente } from './utils/ambiente'

// Ponto de entrada: valida o ambiente, conecta no MongoDB e só então abre a
// porta. A montagem do Express (middlewares e rotas) fica em app.ts.
const PORT = process.env.PORT ?? 3001

async function iniciar() {
  validarAmbiente()
  const db = await conectarMongo()
  await executarMigracoes(db)

  criarApp().listen(PORT, () => {
    console.log(`\n✅ Backend rodando em http://localhost:${PORT}`)
    console.log(`   API disponível em http://localhost:${PORT}/api`)
    console.log(`   Health check: http://localhost:${PORT}/health\n`)
  })
}

iniciar().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err instanceof Error ? err.message : err)
  process.exit(1)
})
