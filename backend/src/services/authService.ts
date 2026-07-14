import { OAuth2Client } from 'google-auth-library'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

function obterAllowlist(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

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
      throw new Error('Token do Google inválido')
    }

    if (!payload?.email_verified) {
      throw new Error('Token do Google inválido')
    }

    const email = payload.email!.trim().toLowerCase()
    const allowlist = obterAllowlist()

    if (!allowlist.includes(email)) {
      throw new Error('E-mail não autorizado')
    }

    return { email, nome: payload.name }
  },
}
