import express, { Express } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import routes from './routes'
import { exigirCabecalhoCsrf } from './middleware/csrf'
import { limiteGeral } from './middleware/rateLimit'
import { parsersJson } from './middleware/corpo'
import { errorHandler, rotaNaoEncontrada } from './middleware/errorHandler'
import { logRequisicoes } from './middleware/logRequisicoes'

// ============================================================
// Monta o Express (middlewares + rotas) sem conectar no banco nem abrir
// porta — isso fica em server.ts. Separado para os testes HTTP subirem o
// app numa porta efêmera sem MongoDB (as rotas que não chegam ao banco —
// health, CSRF, 401, limites — já são testáveis assim).
// ============================================================
export function criarApp(env: NodeJS.ProcessEnv = process.env): Express {
  const app = express()

  // Hospedagens em nuvem colocam a aplicação atrás de um proxy/load balancer.
  // Sem isso, o Express nunca vê a requisição original como https e o cookie
  // com secure:true nunca seria considerado seguro.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
  }

  // CORS_ORIGIN aceita uma ou mais origins separadas por vírgula, já que
  // front e back ficam em domínios/plataformas distintas em produção.
  const origensPermitidas = (env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean)

  // ----------------------------------------------------------------
  // Middlewares
  // ----------------------------------------------------------------
  if (env.NODE_ENV !== 'test') app.use(logRequisicoes)
  // A API só devolve JSON: CSP fechada (nada é renderizado a partir dela) e os
  // demais cabeçalhos padrão do helmet (HSTS, nosniff, sem X-Powered-By…). Os
  // cabeçalhos das páginas do frontend ficam em frontend/public/_headers.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      frameguard: { action: 'deny' },
    })
  )
  app.use(cors({ origin: origensPermitidas, credentials: true }))
  // Depois do cors: um 429 sem cabeçalhos CORS chegaria ao frontend como erro de rede.
  app.use('/api', limiteGeral)
  app.use(parsersJson())
  app.use(cookieParser())

  // ----------------------------------------------------------------
  // Rotas
  // ----------------------------------------------------------------
  app.use('/api', exigirCabecalhoCsrf, routes)
  app.use('/api', rotaNaoEncontrada)

  // Rota de saúde
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // Por último: qualquer erro (services, body-parser) vira JSON com status e código.
  app.use(errorHandler)

  return app
}
