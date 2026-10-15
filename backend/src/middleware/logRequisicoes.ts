import { Request, Response, NextFunction } from 'express'

// ----------------------------------------------------------------
// Log de requisições: método, caminho, status e duração — uma linha por
// requisição, no fim da resposta. Nunca registra corpo, cookies, cabeçalhos,
// e-mail do usuário nem query string (o caminho é cortado no "?"), para o
// log da hospedagem não virar cópia de dados de clientes/faturamento.
// O /health fica de fora: é chamado o tempo todo pelo monitor da hospedagem.
// ----------------------------------------------------------------
export function linhaDeLog(metodo: string, url: string, status: number, ms: number): string {
  const caminho = url.split('?')[0]
  return `[http] ${metodo} ${caminho} ${status} ${ms}ms`
}

export function logRequisicoes(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health') return next()

  const inicio = process.hrtime.bigint()
  res.on('finish', () => {
    const ms = Math.round(Number(process.hrtime.bigint() - inicio) / 1e6)
    console.log(linhaDeLog(req.method, req.originalUrl, res.statusCode, ms))
  })
  next()
}
