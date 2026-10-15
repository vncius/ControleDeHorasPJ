import express, { Router } from 'express'

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
// Os erros do body-parser (413, JSON inválido) viram JSON no errorHandler.
