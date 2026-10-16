import { Request, Response, NextFunction } from 'express'
import { clientesService } from '../services/clientesService'
import { projetosService } from '../services/projetosService'
import { escoposService } from '../services/escoposService'
import { pagamentosService } from '../services/pagamentosService'
import { lancamentosService } from '../services/lancamentosService'
import { dashboardService } from '../services/dashboardService'
import { importacaoService } from '../services/importacaoService'
import { authService } from '../services/authService'
import { usuariosService } from '../services/usuariosService'
import { assinarSessao, NOME_COOKIE_SESSAO, OPCOES_COOKIE_SESSAO } from '../middleware/auth'

// Parâmetros de rota tipados: no @types/express 5 o padrão é string | string[]
// (por causa dos curingas `*nome`). As rotas daqui só têm parâmetros nomeados.
type ComId = Request<{ id: string }>
type ComProjetoId = Request<{ projetoId: string }>

// ----------------------------------------------------------------
// Helper — executa o service, responde JSON e repassa qualquer erro ao
// errorHandler (middleware/errorHandler.ts), que decide status e código.
// ----------------------------------------------------------------
async function handle(
  res: Response,
  next: NextFunction,
  fn: () => Promise<unknown> | unknown,
  status = 200
): Promise<void> {
  try {
    const data = await fn()
    res.status(status).json(data)
  } catch (err: unknown) {
    next(err)
  }
}

// ----------------------------------------------------------------
// CLIENTES
// ----------------------------------------------------------------
export const clientesController = {
  listar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => clientesService.listar(req.usuario!.tenantId))
  },
  buscar(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => clientesService.buscarPorId(req.usuario!.tenantId, req.params.id))
  },
  criar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => clientesService.criar(req.usuario!.tenantId, req.body), 201)
  },
  atualizar(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => clientesService.atualizar(req.usuario!.tenantId, req.params.id, req.body))
  },
  excluir(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, async () => {
      await clientesService.excluir(req.usuario!.tenantId, req.params.id)
      return { mensagem: 'Cliente excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// PROJETOS
// ----------------------------------------------------------------
export const projetosController = {
  listar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => projetosService.listar(req.usuario!.tenantId, req.query.clienteId as string | undefined))
  },
  buscar(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => projetosService.buscarPorId(req.usuario!.tenantId, req.params.id))
  },
  resumo(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => projetosService.calcularResumo(req.usuario!.tenantId, req.params.id))
  },
  criar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => projetosService.criar(req.usuario!.tenantId, req.body), 201)
  },
  atualizar(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => projetosService.atualizar(req.usuario!.tenantId, req.params.id, req.body))
  },
  excluir(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, async () => {
      await projetosService.excluir(req.usuario!.tenantId, req.params.id)
      return { mensagem: 'Projeto excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// ESCOPOS
// ----------------------------------------------------------------
export const escoposController = {
  listarPorProjeto(req: ComProjetoId, res: Response, next: NextFunction) {
    handle(res, next, () => escoposService.listarPorProjeto(req.usuario!.tenantId, req.params.projetoId))
  },
  listarPorTenant(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => escoposService.listarPorTenant(req.usuario!.tenantId))
  },
  criar(req: ComProjetoId, res: Response, next: NextFunction) {
    handle(
      res,
      next,
      () => escoposService.criar(req.usuario!.tenantId, { ...req.body, projetoId: req.params.projetoId }),
      201
    )
  },
  atualizar(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => escoposService.atualizar(req.usuario!.tenantId, req.params.id, req.body))
  },
  excluir(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, async () => {
      await escoposService.excluir(req.usuario!.tenantId, req.params.id)
      return { mensagem: 'Escopo excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// PAGAMENTOS
// ----------------------------------------------------------------
export const pagamentosController = {
  listarPorProjeto(req: ComProjetoId, res: Response, next: NextFunction) {
    handle(res, next, () => pagamentosService.listarPorProjeto(req.usuario!.tenantId, req.params.projetoId))
  },
  listarPorTenant(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => pagamentosService.listarPorTenant(req.usuario!.tenantId))
  },
  criar(req: ComProjetoId, res: Response, next: NextFunction) {
    handle(
      res,
      next,
      () => pagamentosService.criar(req.usuario!.tenantId, { ...req.body, projetoId: req.params.projetoId }),
      201
    )
  },
  atualizar(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => pagamentosService.atualizar(req.usuario!.tenantId, req.params.id, req.body))
  },
  excluir(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, async () => {
      await pagamentosService.excluir(req.usuario!.tenantId, req.params.id)
      return { mensagem: 'Pagamento excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// LANÇAMENTOS
// ----------------------------------------------------------------
export const lancamentosController = {
  listarPorProjeto(req: ComProjetoId, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.listarPorProjeto(req.usuario!.tenantId, req.params.projetoId))
  },
  listarPorTenant(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.listarPorTenant(req.usuario!.tenantId))
  },
  buscar(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.buscarPorId(req.usuario!.tenantId, req.params.id))
  },
  emAndamento(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.buscarEmAndamento(req.usuario!.tenantId))
  },
  ultimaDescricao(req: ComProjetoId, res: Response, next: NextFunction) {
    handle(res, next, async () => ({
      descricao: await lancamentosService.obterUltimaDescricao(req.usuario!.tenantId, req.params.projetoId),
      escopoId: await lancamentosService.obterUltimoEscopo(req.usuario!.tenantId, req.params.projetoId),
    }))
  },
  iniciar(req: ComProjetoId, res: Response, next: NextFunction) {
    handle(
      res,
      next,
      () => lancamentosService.iniciarTrabalho(req.usuario!.tenantId, req.params.projetoId, req.body.descricao),
      201
    )
  },
  finalizar(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.finalizarTrabalho(req.usuario!.tenantId, req.params.id, req.body))
  },
  criar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.criar(req.usuario!.tenantId, req.body), 201)
  },
  atualizar(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.atualizar(req.usuario!.tenantId, req.params.id, req.body))
  },
  excluir(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, async () => {
      await lancamentosService.excluir(req.usuario!.tenantId, req.params.id)
      return { mensagem: 'Lançamento excluído com sucesso' }
    })
  },
  duplicar(req: ComId, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.duplicar(req.usuario!.tenantId, req.params.id), 201)
  },
}

// ----------------------------------------------------------------
// DASHBOARD
// ----------------------------------------------------------------
export const dashboardController = {
  obter(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => dashboardService.obter(req.usuario!.tenantId))
  },
}

// ----------------------------------------------------------------
// IMPORTAÇÃO
// ----------------------------------------------------------------
export const importacaoController = {
  preview(req: Request, res: Response, next: NextFunction) {
    // corpo já validado por previewImportacaoSchema (texto obrigatório, ano 2000–2100)
    handle(res, next, () => importacaoService.preview(req.body.texto, req.body.ano))
  },

  confirmar(req: ComProjetoId, res: Response, next: NextFunction) {
    // corpo já validado por confirmarImportacaoSchema (linhas com data/horas revalidadas)
    handle(res, next, () => importacaoService.confirmar(req.usuario!.tenantId, req.params.projetoId, req.body.linhas), 201)
  },
}

// ----------------------------------------------------------------
// AUTENTICAÇÃO
// ----------------------------------------------------------------
export const authController = {
  async loginGoogle(req: Request, res: Response, next: NextFunction) {
    try {
      // corpo já validado por loginGoogleSchema
      const identidade = await authService.loginComGoogle(req.body.credential)
      const usuario = await usuariosService.entrarComGoogle(identidade)
      const token = assinarSessao({ uid: usuario.id, v: usuario.versaoSessao })
      res.cookie(NOME_COOKIE_SESSAO, token, OPCOES_COOKIE_SESSAO)
      res.json({ email: usuario.email, nome: usuario.nome })
    } catch (err: unknown) {
      next(err)
    }
  },

  logout(_req: Request, res: Response) {
    limparCookieSessao(res)
    res.json({ mensagem: 'Logout realizado' })
  },

  // Sair de todos os dispositivos: invalida toda sessão emitida até agora
  // (inclusive a deste navegador, cujo cookie também é limpo).
  async logoutTodos(req: Request, res: Response, next: NextFunction) {
    try {
      await usuariosService.sairDeTodos(req.usuario!.id)
      limparCookieSessao(res)
      res.json({ mensagem: 'Logout realizado em todos os dispositivos' })
    } catch (err: unknown) {
      next(err)
    }
  },

  me(req: Request, res: Response) {
    res.json({ email: req.usuario!.email, nome: req.usuario!.nome })
  },
}

function limparCookieSessao(res: Response) {
  const { maxAge: _maxAge, ...opcoesLimpeza } = OPCOES_COOKIE_SESSAO
  res.clearCookie(NOME_COOKIE_SESSAO, opcoesLimpeza)
}
