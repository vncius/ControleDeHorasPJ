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
  auditoriaController,
  contaController,
} from '../controllers'
import { requireAuth, exigirConsentimento } from '../middleware/auth'
import { limiteLogin, limiteImportacao, limiteConta } from '../middleware/rateLimit'
import { validarCorpo } from '../middleware/validacao'
import { auditar, auditarExclusoes, auditarRegularizacao } from '../middleware/auditoria'
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
  consentimentoSchema,
  excluirContaSchema,
} from '../schemas'

const router = Router()

// ----------------------------------------------------------------
// Autenticação (públicas — precisam vir antes do requireAuth)
// ----------------------------------------------------------------
router.post('/auth/google', limiteLogin, validarCorpo(loginGoogleSchema), authController.loginGoogle)
router.post('/auth/logout', authController.logout)
router.get('/auth/me', requireAuth, authController.me)
router.post('/auth/logout-todos', requireAuth, auditar('logout_todos'), authController.logoutTodos)

// ----------------------------------------------------------------
// A partir daqui, todas as rotas exigem sessão válida
// ----------------------------------------------------------------
router.use(requireAuth)

// ----------------------------------------------------------------
// Conta (M15 — LGPD). Antes do exigirConsentimento: aceitar os termos,
// ver/exportar os próprios dados e excluir a conta não dependem do aceite.
// DELETE /conta vem antes do auditarExclusoes — a exclusão da conta é
// registrada anônima pelo controller, não com a identidade apagada.
// ----------------------------------------------------------------
router.get('/conta', contaController.obter)
router.post('/conta/consentimento', validarCorpo(consentimentoSchema), auditar('consentimento'), contaController.aceitarConsentimento)
router.get('/conta/exportar', limiteConta, auditar('exportacao'), contaController.exportar)
router.delete('/conta', limiteConta, validarCorpo(excluirContaSchema), contaController.excluir)

// toda exclusão bem-sucedida entra na trilha de auditoria (M14)
router.use(auditarExclusoes)

// ----------------------------------------------------------------
// Auditoria — eventos do próprio usuário (mais recentes primeiro)
// ----------------------------------------------------------------
router.get('/auditoria', auditoriaController.listar)

// daqui em diante, só com aceite da versão vigente dos termos (M15)
router.use(exigirConsentimento)

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
router.put('/projetos/:id', validarCorpo(atualizarProjetoSchema), auditarRegularizacao, projetosController.atualizar.bind(projetosController))
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
  auditar('importacao'),
  importacaoController.confirmar.bind(importacaoController)
)

export default router
