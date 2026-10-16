import { Request, Response, NextFunction, RequestHandler } from 'express'
import { auditoriaService, AcaoAuditoria, EventoAuditoria } from '../services/auditoriaService'

// ----------------------------------------------------------------
// Middlewares de auditoria (M14). Gravam DEPOIS que a resposta sai e só se
// deu certo (2xx): uma tentativa recusada (validação, 404, 409) não apagou
// nem importou nada. Caminho sem query string; nunca o corpo.
// ----------------------------------------------------------------

export function contextoDaRequisicao(req: Request): Pick<EventoAuditoria, 'ip' | 'userAgent' | 'detalhes'> {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    detalhes: { metodo: req.method, caminho: req.originalUrl.split('?')[0] },
  }
}

function registrarSeSucesso(req: Request, res: Response, acao: AcaoAuditoria, extra?: { consideradoPago?: boolean }) {
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return
    const contexto = contextoDaRequisicao(req)
    auditoriaService.registrar({
      tenantId: req.usuario?.tenantId ?? null,
      usuarioId: req.usuario?.id ?? null,
      acao,
      ...contexto,
      detalhes: contexto.detalhes && { ...contexto.detalhes, ...extra },
    })
  })
}

/** Middleware de rota: audita a ação quando a rota responder com sucesso. */
export function auditar(acao: AcaoAuditoria): RequestHandler {
  return (req, res, next) => {
    registrarSeSucesso(req, res, acao)
    next()
  }
}

/** Global (depois do requireAuth): todo DELETE bem-sucedido vira `exclusao`. */
export function auditarExclusoes(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'DELETE') registrarSeSucesso(req, res, 'exclusao')
  next()
}

/**
 * PUT /projetos/:id que liga ou desliga "considerado pago" (regularização):
 * gera ou remove pagamentos, então entra na trilha com o novo valor.
 */
export function auditarRegularizacao(req: Request, res: Response, next: NextFunction): void {
  if (typeof req.body?.consideradoPago === 'boolean') {
    registrarSeSucesso(req, res, 'regularizacao', { consideradoPago: req.body.consideradoPago })
  }
  next()
}
