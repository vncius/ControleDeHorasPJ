import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// ----------------------------------------------------------------
// Constantes de sessão (cookie)
// ----------------------------------------------------------------
export const NOME_COOKIE_SESSAO = 'sessao'

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000

export const OPCOES_COOKIE_SESSAO = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SETE_DIAS_MS,
}

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
