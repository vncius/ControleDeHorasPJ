import { Request, Response } from 'express'
import { clientesService } from '../services/clientesService'
import { projetosService } from '../services/projetosService'
import { escoposService } from '../services/escoposService'
import { lancamentosService } from '../services/lancamentosService'
import { dashboardService } from '../services/dashboardService'
import { importacaoService } from '../services/importacaoService'
import { authService } from '../services/authService'
import { assinarSessao, NOME_COOKIE_SESSAO, OPCOES_COOKIE_SESSAO } from '../middleware/auth'

// ----------------------------------------------------------------
// Helper — wrapper de erros
// ----------------------------------------------------------------
async function handle(res: Response, fn: () => Promise<unknown> | unknown, status = 200): Promise<void> {
  try {
    const data = await fn()
    res.status(status).json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    res.status(400).json({ erro: message })
  }
}

// ----------------------------------------------------------------
// CLIENTES
// ----------------------------------------------------------------
export const clientesController = {
  listar(req: Request, res: Response) {
    handle(res, () => clientesService.listar())
  },
  buscar(req: Request, res: Response) {
    handle(res, () => clientesService.buscarPorId(req.params.id))
  },
  criar(req: Request, res: Response) {
    handle(res, () => clientesService.criar(req.body), 201)
  },
  atualizar(req: Request, res: Response) {
    handle(res, () => clientesService.atualizar(req.params.id, req.body))
  },
  excluir(req: Request, res: Response) {
    handle(res, async () => {
      await clientesService.excluir(req.params.id)
      return { mensagem: 'Cliente excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// PROJETOS
// ----------------------------------------------------------------
export const projetosController = {
  listar(req: Request, res: Response) {
    handle(res, () => projetosService.listar(req.query.clienteId as string | undefined))
  },
  buscar(req: Request, res: Response) {
    handle(res, () => projetosService.buscarPorId(req.params.id))
  },
  resumo(req: Request, res: Response) {
    handle(res, () => projetosService.calcularResumo(req.params.id))
  },
  criar(req: Request, res: Response) {
    handle(res, () => projetosService.criar(req.body), 201)
  },
  atualizar(req: Request, res: Response) {
    handle(res, () => projetosService.atualizar(req.params.id, req.body))
  },
  excluir(req: Request, res: Response) {
    handle(res, async () => {
      await projetosService.excluir(req.params.id)
      return { mensagem: 'Projeto excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// ESCOPOS
// ----------------------------------------------------------------
export const escoposController = {
  listarPorProjeto(req: Request, res: Response) {
    handle(res, () => escoposService.listarPorProjeto(req.params.projetoId))
  },
  criar(req: Request, res: Response) {
    handle(
      res,
      () => escoposService.criar({ ...req.body, projetoId: req.params.projetoId }),
      201
    )
  },
  atualizar(req: Request, res: Response) {
    handle(res, () => escoposService.atualizar(req.params.id, req.body))
  },
  excluir(req: Request, res: Response) {
    handle(res, async () => {
      await escoposService.excluir(req.params.id)
      return { mensagem: 'Escopo excluído com sucesso' }
    })
  },
}

// ----------------------------------------------------------------
// LANÇAMENTOS
// ----------------------------------------------------------------
export const lancamentosController = {
  listarPorProjeto(req: Request, res: Response) {
    handle(res, () => lancamentosService.listarPorProjeto(req.params.projetoId))
  },
  buscar(req: Request, res: Response) {
    handle(res, () => lancamentosService.buscarPorId(req.params.id))
  },
  emAndamento(req: Request, res: Response) {
    handle(res, () => lancamentosService.buscarEmAndamento())
  },
  ultimaDescricao(req: Request, res: Response) {
    handle(res, async () => ({
      descricao: await lancamentosService.obterUltimaDescricao(req.params.projetoId),
    }))
  },
  iniciar(req: Request, res: Response) {
    handle(
      res,
      () => lancamentosService.iniciarTrabalho(req.params.projetoId, req.body.descricao),
      201
    )
  },
  finalizar(req: Request, res: Response) {
    handle(res, () => lancamentosService.finalizarTrabalho(req.params.id, req.body))
  },
  criar(req: Request, res: Response) {
    handle(res, () => lancamentosService.criar(req.body), 201)
  },
  atualizar(req: Request, res: Response) {
    handle(res, () => lancamentosService.atualizar(req.params.id, req.body))
  },
  excluir(req: Request, res: Response) {
    handle(res, async () => {
      await lancamentosService.excluir(req.params.id)
      return { mensagem: 'Lançamento excluído com sucesso' }
    })
  },
  duplicar(req: Request, res: Response) {
    handle(res, () => lancamentosService.duplicar(req.params.id), 201)
  },
}

// ----------------------------------------------------------------
// DASHBOARD
// ----------------------------------------------------------------
export const dashboardController = {
  obter(req: Request, res: Response) {
    handle(res, () => dashboardService.obter())
  },
}

// ----------------------------------------------------------------
// IMPORTAÇÃO
// ----------------------------------------------------------------
export const importacaoController = {
  preview(req: Request, res: Response) {
    handle(res, () => {
      const { texto, ano } = req.body
      if (!texto || typeof texto !== 'string') throw new Error('Campo "texto" obrigatório')
      const anoNum = Number(ano)
      if (!anoNum || anoNum < 2000 || anoNum > 2100) throw new Error('Ano inválido')
      return importacaoService.preview(texto, anoNum)
    })
  },

  confirmar(req: Request, res: Response) {
    handle(res, () => {
      const { linhas } = req.body
      if (!Array.isArray(linhas)) throw new Error('Campo "linhas" deve ser um array')
      return importacaoService.confirmar(req.params.projetoId, linhas)
    }, 201)
  },
}

// ----------------------------------------------------------------
// AUTENTICAÇÃO
// ----------------------------------------------------------------
export const authController = {
  async loginGoogle(req: Request, res: Response) {
    const { credential } = req.body
    if (!credential || typeof credential !== 'string') {
      res.status(400).json({ erro: 'Campo "credential" obrigatório' })
      return
    }

    try {
      const { email, nome } = await authService.loginComGoogle(credential)
      const token = assinarSessao({ email })
      res.cookie(NOME_COOKIE_SESSAO, token, OPCOES_COOKIE_SESSAO)
      res.json({ email, nome })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro interno'
      const status = message === 'E-mail não autorizado' ? 403 : 401
      res.status(status).json({ erro: message })
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
