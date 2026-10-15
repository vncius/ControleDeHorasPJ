import { OAuth2Client } from 'google-auth-library'
import { naoAutorizado } from '../errors/AppError'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

// Quem pode logar é controlado no Google Cloud Console (OAuth consent screen
// — app em modo "Testing" com lista de test users, ou app "Internal" restrito
// ao Workspace), não mais por uma allowlist própria aqui: um ID token válido
// e com e-mail verificado já implica que o Google autorizou o login.
export const authService = {
  async loginComGoogle(idToken: string): Promise<{ email: string; nome?: string }> {
    let payload
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      })
      payload = ticket.getPayload()
    } catch {
      throw naoAutorizado('auth.tokenInvalido', 'Token do Google inválido')
    }

    if (!payload?.email_verified) {
      throw naoAutorizado('auth.tokenInvalido', 'Token do Google inválido')
    }

    const email = payload.email!.trim().toLowerCase()
    return { email, nome: payload.name }
  },
}
