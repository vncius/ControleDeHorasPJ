import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import routes from './routes'
import { conectarMongo } from './repositories/mongoClient'

const app = express()
const PORT = process.env.PORT ?? 3001

// ----------------------------------------------------------------
// Middlewares
// ----------------------------------------------------------------
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }))
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
