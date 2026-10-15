import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// ----------------------------------------------------------------
// Constantes de sessão (cookie)
// ----------------------------------------------------------------
export const NOME_COOKIE_SESSAO = 'sessao'

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

export type SameSite = 'lax' | 'strict' | 'none'
export const VALORES_SAME_SITE: readonly SameSite[] = ['lax', 'strict', 'none']

// Em produção o frontend chama a API pelo proxy same-origin do Cloudflare
// Pages (/api), então o cookie é first-party e 'lax' basta: um site de
// terceiro não consegue fazer o navegador enviá-lo num POST. 'none' só é
// necessário num deploy cross-site sem o proxy (VITE_API_URL apontando
// direto para o backend) — configurável por COOKIE_SAME_SITE (validado no
// boot em utils/ambiente.ts). Navegadores descartam 'none' sem 'secure',
// por isso 'none' força secure mesmo fora de produção.
export function opcoesCookieSessao(env: NodeJS.ProcessEnv = process.env) {
  const sameSite = (env.COOKIE_SAME_SITE?.trim().toLowerCase() || 'lax') as SameSite
  return {
    httpOnly: true,
    sameSite,
    secure: env.NODE_ENV === 'production' || sameSite === 'none',
    maxAge: SETE_DIAS_MS,
  }
}

export const OPCOES_COOKIE_SESSAO = opcoesCookieSessao()

// ----------------------------------------------------------------
// Assinatura / verificação do JWT de sessão
// ----------------------------------------------------------------
export interface SessaoPayload {
  email: string
}

export function assinarSessao(payload: SessaoPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '7d' })
}

export function verificarSessao(token: string): SessaoPayload | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string)
    if (typeof decoded === 'object' && decoded !== null && 'email' in decoded) {
      return { email: (decoded as { email: string }).email }
    }
    return null
  } catch {
    return null
  }
}

// ----------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[NOME_COOKIE_SESSAO]
  const sessao = token ? verificarSessao(token) : null

  if (!sessao) {
    res.status(401).json({ erro: 'Não autenticado' })
    return
  }

  req.usuario = { email: sessao.email }
  next()
}
