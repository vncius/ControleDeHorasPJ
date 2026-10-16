import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { usuariosRepo } from '../repositories'
import type { Usuario } from '../types'

// ----------------------------------------------------------------
// Constantes de sessão (cookie)
// ----------------------------------------------------------------
export const NOME_COOKIE_SESSAO = 'sessao'

// Sessão de 24h, absoluta (sem renovação deslizante) — D6 do plano.
export const DURACAO_SESSAO_MS = 24 * 60 * 60 * 1000

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
    maxAge: DURACAO_SESSAO_MS,
  }
}

export const OPCOES_COOKIE_SESSAO = opcoesCookieSessao()

// ----------------------------------------------------------------
// Assinatura / verificação do JWT de sessão
//
// O token carrega só o id do usuário (`uid`) e a versão da sessão (`v`) do
// momento do login. "Sair de todos os dispositivos" incrementa
// `usuarios.versaoSessao`, e todo token com versão antiga deixa de valer.
// Tokens do formato anterior à M13 (`{ email }`) são recusados: o usuário só
// precisa entrar de novo.
// ----------------------------------------------------------------
export interface SessaoPayload {
  uid: string
  v: number
}

export function assinarSessao(payload: SessaoPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: DURACAO_SESSAO_MS / 1000 })
}

export function verificarSessao(token: string): SessaoPayload | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string)
    if (typeof decoded === 'object' && decoded !== null && typeof decoded.uid === 'string' && typeof decoded.v === 'number') {
      return { uid: decoded.uid, v: decoded.v }
    }
    return null
  } catch {
    return null
  }
}

// ----------------------------------------------------------------
// Cache de usuários da sessão — evita uma ida ao banco por requisição.
// 60s de validade; invalidado na hora em "sair de todos os dispositivos"
// (mesmo processo). Com mais de uma instância, uma sessão revogada pode
// sobreviver até 60s nas outras.
// ----------------------------------------------------------------
const TTL_CACHE_MS = 60 * 1000
const cache = new Map<string, { usuario: Usuario; expira: number }>()

async function usuarioDaSessao(uid: string): Promise<Usuario | undefined> {
  const agora = Date.now()
  const emCache = cache.get(uid)
  if (emCache && emCache.expira > agora) return emCache.usuario
  const usuario = await usuariosRepo.findById(uid)
  if (usuario) cache.set(uid, { usuario, expira: agora + TTL_CACHE_MS })
  else cache.delete(uid)
  return usuario
}

export function invalidarCacheUsuario(uid: string): void {
  cache.delete(uid)
}

// ----------------------------------------------------------------
// Middleware
// ----------------------------------------------------------------
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[NOME_COOKIE_SESSAO]
    const sessao = token ? verificarSessao(token) : null
    const usuario = sessao ? await usuarioDaSessao(sessao.uid) : undefined

    if (!sessao || !usuario || usuario.versaoSessao !== sessao.v) {
      res.status(401).json({ erro: 'Não autenticado', codigo: 'auth.naoAutenticado' })
      return
    }

    req.usuario = { id: usuario.id, tenantId: usuario.tenantId, email: usuario.email, nome: usuario.nome }
    next()
  } catch (err) {
    next(err)
  }
}
