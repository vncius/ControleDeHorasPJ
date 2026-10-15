import { Router } from 'express'
import {
  clientesController,
  projetosController,
  escoposController,
  pagamentosController,
  lancamentosController,
  dashboardController,
  importacaoController,
  authController,
} from '../controllers'
import { requireAuth } from '../middleware/auth'
import { limiteLogin, limiteImportacao } from '../middleware/rateLimit'
import { validarCorpo } from '../middleware/validacao'
import {
  loginGoogleSchema,
  criarClienteSchema,
  atualizarClienteSchema,
  criarProjetoSchema,
  atualizarProjetoSchema,
  criarEscopoSchema,
  atualizarEscopoSchema,
  criarPagamentoSchema,
  atualizarPagamentoSchema,
  criarLancamentoSchema,
  atualizarLancamentoSchema,
  iniciarLancamentoSchema,
  finalizarLancamentoSchema,
  previewImportacaoSchema,
  confirmarImportacaoSchema,
} from '../schemas'

const router = Router()

// ----------------------------------------------------------------
// Autenticação (públicas — precisam vir antes do requireAuth)
// ----------------------------------------------------------------
router.post('/auth/google', limiteLogin, validarCorpo(loginGoogleSchema), authController.loginGoogle)
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
router.post('/clientes', validarCorpo(criarClienteSchema), clientesController.criar.bind(clientesController))
router.put('/clientes/:id', validarCorpo(atualizarClienteSchema), clientesController.atualizar.bind(clientesController))
router.delete('/clientes/:id', clientesController.excluir.bind(clientesController))

// ----------------------------------------------------------------
// Projetos
// ----------------------------------------------------------------
router.get('/projetos', projetosController.listar.bind(projetosController))
router.get('/projetos/:id', projetosController.buscar.bind(projetosController))
router.get('/projetos/:id/resumo', projetosController.resumo.bind(projetosController))
router.post('/projetos', validarCorpo(criarProjetoSchema), projetosController.criar.bind(projetosController))
router.put('/projetos/:id', validarCorpo(atualizarProjetoSchema), projetosController.atualizar.bind(projetosController))
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
  validarCorpo(criarEscopoSchema),
  escoposController.criar.bind(escoposController)
)
router.put('/escopos/:id', validarCorpo(atualizarEscopoSchema), escoposController.atualizar.bind(escoposController))
router.delete('/escopos/:id', escoposController.excluir.bind(escoposController))

// ----------------------------------------------------------------
// Pagamentos (por projeto)
// ----------------------------------------------------------------
router.get('/pagamentos', pagamentosController.listarPorTenant.bind(pagamentosController))
router.get(
  '/projetos/:projetoId/pagamentos',
  pagamentosController.listarPorProjeto.bind(pagamentosController)
)
router.post(
  '/projetos/:projetoId/pagamentos',
  validarCorpo(criarPagamentoSchema),
  pagamentosController.criar.bind(pagamentosController)
)
router.put('/pagamentos/:id', validarCorpo(atualizarPagamentoSchema), pagamentosController.atualizar.bind(pagamentosController))
router.delete('/pagamentos/:id', pagamentosController.excluir.bind(pagamentosController))

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
  validarCorpo(iniciarLancamentoSchema),
  lancamentosController.iniciar.bind(lancamentosController)
)
router.post('/lancamentos', validarCorpo(criarLancamentoSchema), lancamentosController.criar.bind(lancamentosController))
router.get('/lancamentos/:id', lancamentosController.buscar.bind(lancamentosController))
router.put('/lancamentos/:id', validarCorpo(atualizarLancamentoSchema), lancamentosController.atualizar.bind(lancamentosController))
router.delete('/lancamentos/:id', lancamentosController.excluir.bind(lancamentosController))
router.post('/lancamentos/:id/finalizar', validarCorpo(finalizarLancamentoSchema), lancamentosController.finalizar.bind(lancamentosController))
router.post('/lancamentos/:id/duplicar', lancamentosController.duplicar.bind(lancamentosController))

// ----------------------------------------------------------------
// Importação de lançamentos
// ----------------------------------------------------------------
router.post(
  '/projetos/:projetoId/lancamentos/importar-preview',
  limiteImportacao,
  validarCorpo(previewImportacaoSchema),
  importacaoController.preview.bind(importacaoController)
)
router.post(
  '/projetos/:projetoId/lancamentos/importar-confirmar',
  limiteImportacao,
  validarCorpo(confirmarImportacaoSchema),
  importacaoController.confirmar.bind(importacaoController)
)

export default router
