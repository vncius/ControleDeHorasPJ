import express, { Router, Request, Response, NextFunction } from 'express'

// ----------------------------------------------------------------
// Limites de corpo JSON. A importação recebe texto colado de planilha e as
// linhas pré-visualizadas, então tem um limite maior; o resto da API só
// recebe formulários pequenos.
//
// O parser específico precisa rodar ANTES do global: o body-parser pula
// requisições já parseadas, então o primeiro que casar com a rota vale.
// ----------------------------------------------------------------
export const LIMITE_CORPO_PADRAO = '100kb'
export const LIMITE_CORPO_IMPORTACAO = '2mb'

const ROTAS_IMPORTACAO = /^\/api\/projetos\/[^/]+\/lancamentos\/importar-(preview|confirmar)$/

export function parsersJson(): Router {
  const router = Router()
  router.use(ROTAS_IMPORTACAO, express.json({ limit: LIMITE_CORPO_IMPORTACAO }))
  router.use(express.json({ limit: LIMITE_CORPO_PADRAO }))
  return router
}

/**
 * Erros do body-parser viram JSON no mesmo formato do resto da API (o
 * padrão do Express responde HTML). Os demais erros seguem adiante.
 */
export function errosDeCorpo(err: any, _req: Request, res: Response, next: NextFunction): void {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ erro: 'Conteúdo grande demais para esta requisição' })
    return
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ erro: 'JSON inválido no corpo da requisição' })
    return
  }
  next(err)
}
