import express from 'express'
import cors from 'cors'
import routes from './routes'

const app = express()
const PORT = process.env.PORT ?? 3001

// ----------------------------------------------------------------
// Middlewares
// ----------------------------------------------------------------
app.use(cors({ origin: 'http://localhost:5173' })) // Vite dev server
app.use(express.json())

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
app.listen(PORT, () => {
  console.log(`\n✅ Backend rodando em http://localhost:${PORT}`)
  console.log(`   API disponível em http://localhost:${PORT}/api`)
  console.log(`   Health check: http://localhost:${PORT}/health\n`)
})

export default app
