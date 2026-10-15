import { Request, Response, NextFunction } from 'express'
import { invalido } from '../errors/AppError'
import { clientesService } from '../services/clientesService'
import { projetosService } from '../services/projetosService'
import { escoposService } from '../services/escoposService'
import { pagamentosService } from '../services/pagamentosService'
import { lancamentosService } from '../services/lancamentosService'
import { dashboardService } from '../services/dashboardService'
import { importacaoService } from '../services/importacaoService'
import { authService } from '../services/authService'
import { assinarSessao, NOME_COOKIE_SESSAO, OPCOES_COOKIE_SESSAO } from '../middleware/auth'

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
    handle(res, next, () => clientesService.listar(req.usuario!.email))
  },
  buscar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => clientesService.buscarPorId(req.usuario!.email, req.params.id))
  },
  criar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => clientesService.criar(req.usuario!.email, req.body), 201)
  },
  atualizar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => clientesService.atualizar(req.usuario!.email, req.params.id, req.body))
  },
  excluir(req: Request, res: Response, next: NextFunction) {
    handle(res, next, async () => {
      await clientesService.excluir(req.usuario!.email, req.params.id)
      return { mensagem: 'Cliente excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// PROJETOS
// ----------------------------------------------------------------
export const projetosController = {
  listar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => projetosService.listar(req.usuario!.email, req.query.clienteId as string | undefined))
  },
  buscar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => projetosService.buscarPorId(req.usuario!.email, req.params.id))
  },
  resumo(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => projetosService.calcularResumo(req.usuario!.email, req.params.id))
  },
  criar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => projetosService.criar(req.usuario!.email, req.body), 201)
  },
  atualizar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => projetosService.atualizar(req.usuario!.email, req.params.id, req.body))
  },
  excluir(req: Request, res: Response, next: NextFunction) {
    handle(res, next, async () => {
      await projetosService.excluir(req.usuario!.email, req.params.id)
      return { mensagem: 'Projeto excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// ESCOPOS
// ----------------------------------------------------------------
export const escoposController = {
  listarPorProjeto(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => escoposService.listarPorProjeto(req.usuario!.email, req.params.projetoId))
  },
  listarPorTenant(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => escoposService.listarPorTenant(req.usuario!.email))
  },
  criar(req: Request, res: Response, next: NextFunction) {
    handle(
      res,
      next,
      () => escoposService.criar(req.usuario!.email, { ...req.body, projetoId: req.params.projetoId }),
      201
    )
  },
  atualizar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => escoposService.atualizar(req.usuario!.email, req.params.id, req.body))
  },
  excluir(req: Request, res: Response, next: NextFunction) {
    handle(res, next, async () => {
      await escoposService.excluir(req.usuario!.email, req.params.id)
      return { mensagem: 'Escopo excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// PAGAMENTOS
// ----------------------------------------------------------------
export const pagamentosController = {
  listarPorProjeto(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => pagamentosService.listarPorProjeto(req.usuario!.email, req.params.projetoId))
  },
  listarPorTenant(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => pagamentosService.listarPorTenant(req.usuario!.email))
  },
  criar(req: Request, res: Response, next: NextFunction) {
    handle(
      res,
      next,
      () => pagamentosService.criar(req.usuario!.email, { ...req.body, projetoId: req.params.projetoId }),
      201
    )
  },
  atualizar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => pagamentosService.atualizar(req.usuario!.email, req.params.id, req.body))
  },
  excluir(req: Request, res: Response, next: NextFunction) {
    handle(res, next, async () => {
      await pagamentosService.excluir(req.usuario!.email, req.params.id)
      return { mensagem: 'Pagamento excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// LANÇAMENTOS
// ----------------------------------------------------------------
export const lancamentosController = {
  listarPorProjeto(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.listarPorProjeto(req.usuario!.email, req.params.projetoId))
  },
  listarPorTenant(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.listarPorTenant(req.usuario!.email))
  },
  buscar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.buscarPorId(req.usuario!.email, req.params.id))
  },
  emAndamento(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.buscarEmAndamento(req.usuario!.email))
  },
  ultimaDescricao(req: Request, res: Response, next: NextFunction) {
    handle(res, next, async () => ({
      descricao: await lancamentosService.obterUltimaDescricao(req.usuario!.email, req.params.projetoId),
      escopoId: await lancamentosService.obterUltimoEscopo(req.usuario!.email, req.params.projetoId),
    }))
  },
  iniciar(req: Request, res: Response, next: NextFunction) {
    handle(
      res,
      next,
      () => lancamentosService.iniciarTrabalho(req.usuario!.email, req.params.projetoId, req.body.descricao),
      201
    )
  },
  finalizar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.finalizarTrabalho(req.usuario!.email, req.params.id, req.body))
  },
  criar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.criar(req.usuario!.email, req.body), 201)
  },
  atualizar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.atualizar(req.usuario!.email, req.params.id, req.body))
  },
  excluir(req: Request, res: Response, next: NextFunction) {
    handle(res, next, async () => {
      await lancamentosService.excluir(req.usuario!.email, req.params.id)
      return { mensagem: 'Lançamento excluído com sucesso' }
    })
  },
  duplicar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => lancamentosService.duplicar(req.usuario!.email, req.params.id), 201)
  },
}

// ----------------------------------------------------------------
// DASHBOARD
// ----------------------------------------------------------------
export const dashboardController = {
  obter(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => dashboardService.obter(req.usuario!.email))
  },
}

// ----------------------------------------------------------------
// IMPORTAÇÃO
// ----------------------------------------------------------------
export const importacaoController = {
  preview(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => {
      const { texto, ano } = req.body
      if (!texto || typeof texto !== 'string') throw invalido('importacao.textoObrigatorio', 'Campo "texto" obrigatório')
      const anoNum = Number(ano)
      if (!anoNum || anoNum < 2000 || anoNum > 2100) throw invalido('importacao.anoInvalido', 'Ano inválido')
      return importacaoService.preview(texto, anoNum)
    })
  },

  confirmar(req: Request, res: Response, next: NextFunction) {
    handle(res, next, () => {
      const { linhas } = req.body
      if (!Array.isArray(linhas)) throw invalido('importacao.linhasInvalidas', 'Campo "linhas" deve ser um array')
      return importacaoService.confirmar(req.usuario!.email, req.params.projetoId, linhas)
    }, 201)
  },
}

// ----------------------------------------------------------------
// AUTENTICAÇÃO
// ----------------------------------------------------------------
export const authController = {
  async loginGoogle(req: Request, res: Response, next: NextFunction) {
    try {
      const { credential } = req.body ?? {}
      if (!credential || typeof credential !== 'string') {
        throw invalido('auth.credentialObrigatorio', 'Campo "credential" obrigatório')
      }
      const { email, nome } = await authService.loginComGoogle(credential)
      const token = assinarSessao({ email })
      res.cookie(NOME_COOKIE_SESSAO, token, OPCOES_COOKIE_SESSAO)
      res.json({ email, nome })
    } catch (err: unknown) {
      next(err)
    }
  },

  logout(_req: Request, res: Response) {
    const { maxAge: _maxAge, ...opcoesLimpeza } = OPCOES_COOKIE_SESSAO
    res.clearCookie(NOME_COOKIE_SESSAO, opcoesLimpeza)
    res.json({ mensagem: 'Logout realizado' })
  },

  me(req: Request, res: Response) {
    res.json({ email: req.usuario!.email })
  },
}
