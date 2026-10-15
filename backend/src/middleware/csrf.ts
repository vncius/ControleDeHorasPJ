import { Request, Response, NextFunction } from 'express'

// ----------------------------------------------------------------
// Proteção contra CSRF
//
// Toda requisição que altera estado precisa do cabeçalho
// `X-Requested-With: XMLHttpRequest`. Um formulário ou <img> de outro site
// não consegue enviar cabeçalho customizado, e um fetch cross-origin com ele
// dispara preflight CORS — que só é liberado para CORS_ORIGIN. Não depende
// de cookie de terceiro, então funciona igual no Safari/iOS. Complementa o
// cookie SameSite=Lax (middleware/auth.ts).
// ----------------------------------------------------------------
export const CABECALHO_CSRF = 'X-Requested-With'
export const VALOR_CABECALHO_CSRF = 'XMLHttpRequest'

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function exigirCabecalhoCsrf(req: Request, res: Response, next: NextFunction): void {
  if (METODOS_SEGUROS.has(req.method) || req.get(CABECALHO_CSRF) === VALOR_CABECALHO_CSRF) {
    next()
    return
  }
  res.status(403).json({ erro: 'Requisição recusada: cabeçalho de segurança ausente', codigo: 'csrf.cabecalhoAusente' })
}
