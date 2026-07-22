// Toda a lógica de data/hora do app (utils/tempo.ts, dashboardService) assume
// fuso America/Sao_Paulo via horário local do processo. Fixar aqui evita que o
// cálculo de "hoje", hora atual e horas em andamento saia errado quando a
// hospedagem (ex.: Render) roda o container em UTC por padrão.
process.env.TZ = 'America/Sao_Paulo'

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import routes from './routes'
import { conectarMongo } from './repositories/mongoClient'

const app = express()
const PORT = process.env.PORT ?? 3001

// Hospedagens em nuvem colocam a aplicação atrás de um proxy/load balancer.
// Sem isso, o Express nunca vê a requisição original como https e o cookie
// com secure:true (exigido por sameSite:'none') nunca seria considerado seguro.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

// CORS_ORIGIN aceita uma ou mais origins separadas por vírgula, já que
// front e back ficam em domínios/plataformas distintas em produção.
const origensPermitidas = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean)

// ----------------------------------------------------------------
// Middlewares
// ----------------------------------------------------------------
app.use(cors({ origin: origensPermitidas, credentials: true }))
app.use(express.json())
app.use(cookieParser())

// ----------------------------------------------------------------
// Rotas
// ----------------------------------------------------------------
app.use('/api', routes)

// Rota de saúde
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ----------------------------------------------------------------
// Start
// ----------------------------------------------------------------
async function iniciar() {
  await conectarMongo()

  app.listen(PORT, () => {
    console.log(`\n✅ Backend rodando em http://localhost:${PORT}`)
    console.log(`   API disponível em http://localhost:${PORT}/api`)
    console.log(`   Health check: http://localhost:${PORT}/health\n`)
  })
}

iniciar().catch((err) => {
  console.error('Falha ao conectar no MongoDB:', err)
  process.exit(1)
})

export default app
