import { Router } from 'express'
import {
  clientesController,
  projetosController,
  escoposController,
  lancamentosController,
  dashboardController,
  importacaoController,
  authController,
} from '../controllers'
import { requireAuth } from '../middleware/auth'

const router = Router()

// ----------------------------------------------------------------
// Autenticação (públicas — precisam vir antes do requireAuth)
// ----------------------------------------------------------------
router.post('/auth/google', authController.loginGoogle)
router.post('/auth/logout', authController.logout)
router.get('/auth/me', requireAuth, authController.me)

// ----------------------------------------------------------------
// A partir daqui, todas as rotas exigem sessão válida
// ----------------------------------------------------------------
router.use(requireAuth)

// ----------------------------------------------------------------
// Dashboard
// ----------------------------------------------------------------
router.get('/dashboard', dashboardController.obter.bind(dashboardController))

// ----------------------------------------------------------------
// Clientes
// ----------------------------------------------------------------
router.get('/clientes', clientesController.listar.bind(clientesController))
router.get('/clientes/:id', clientesController.buscar.bind(clientesController))
router.post('/clientes', clientesController.criar.bind(clientesController))
router.put('/clientes/:id', clientesController.atualizar.bind(clientesController))
router.delete('/clientes/:id', clientesController.excluir.bind(clientesController))

// ----------------------------------------------------------------
// Projetos
// ----------------------------------------------------------------
router.get('/projetos', projetosController.listar.bind(projetosController))
router.get('/projetos/:id', projetosController.buscar.bind(projetosController))
router.get('/projetos/:id/resumo', projetosController.resumo.bind(projetosController))
router.post('/projetos', projetosController.criar.bind(projetosController))
router.put('/projetos/:id', projetosController.atualizar.bind(projetosController))
router.delete('/projetos/:id', projetosController.excluir.bind(projetosController))

// ----------------------------------------------------------------
// Escopos (por projeto)
// ----------------------------------------------------------------
router.get('/escopos', escoposController.listarPorTenant.bind(escoposController))
router.get(
  '/projetos/:projetoId/escopos',
  escoposController.listarPorProjeto.bind(escoposController)
)
router.post(
  '/projetos/:projetoId/escopos',
  escoposController.criar.bind(escoposController)
)
router.put('/escopos/:id', escoposController.atualizar.bind(escoposController))
router.delete('/escopos/:id', escoposController.excluir.bind(escoposController))

// ----------------------------------------------------------------
// Lançamentos
// ----------------------------------------------------------------
router.get('/lancamentos', lancamentosController.listarPorTenant.bind(lancamentosController))
router.get('/lancamentos/em-andamento', lancamentosController.emAndamento.bind(lancamentosController))
router.get(
  '/projetos/:projetoId/lancamentos',
  lancamentosController.listarPorProjeto.bind(lancamentosController)
)
router.get(
  '/projetos/:projetoId/ultima-descricao',
  lancamentosController.ultimaDescricao.bind(lancamentosController)
)
router.post(
  '/projetos/:projetoId/iniciar',
  lancamentosController.iniciar.bind(lancamentosController)
)
router.post('/lancamentos', lancamentosController.criar.bind(lancamentosController))
router.get('/lancamentos/:id', lancamentosController.buscar.bind(lancamentosController))
router.put('/lancamentos/:id', lancamentosController.atualizar.bind(lancamentosController))
router.delete('/lancamentos/:id', lancamentosController.excluir.bind(lancamentosController))
router.post('/lancamentos/:id/finalizar', lancamentosController.finalizar.bind(lancamentosController))
router.post('/lancamentos/:id/duplicar', lancamentosController.duplicar.bind(lancamentosController))

// ----------------------------------------------------------------
// Importação de lançamentos
// ----------------------------------------------------------------
router.post(
  '/projetos/:projetoId/lancamentos/importar-preview',
  importacaoController.preview.bind(importacaoController)
)
router.post(
  '/projetos/:projetoId/lancamentos/importar-confirmar',
  importacaoController.confirmar.bind(importacaoController)
)

export default router
