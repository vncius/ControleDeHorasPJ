// ============================================================
// Validação das variáveis de ambiente sensíveis, chamada uma vez no boot
// (server.ts) antes de qualquer conexão. O servidor não sobe com segredo
// ausente, fraco ou copiado do .env.example — falhar no boot é melhor do que
// assinar sessões com uma chave previsível ou recusar todo login em runtime.
// ============================================================

// Valores de exemplo do backend/.env.example: nunca aceitos em produção.
const EXEMPLO_JWT_SECRET = 'replace-with-a-long-random-secret'
const EXEMPLO_GOOGLE_CLIENT_ID = 'your-google-oauth-client-id.apps.googleusercontent.com'

const MIN_BYTES_JWT_SECRET = 32

/**
 * Lança um único erro listando todos os problemas encontrados. Em qualquer
 * ambiente, JWT_SECRET e GOOGLE_CLIENT_ID são obrigatórios; em produção,
 * JWT_SECRET precisa ter ao menos 32 bytes e nenhum dos dois pode ser o valor
 * de exemplo.
 */
export function validarSegredos(env: NodeJS.ProcessEnv = process.env): void {
  const producao = env.NODE_ENV === 'production'
  const problemas: string[] = []

  const jwtSecret = env.JWT_SECRET?.trim()
  if (!jwtSecret) {
    problemas.push('JWT_SECRET não definido')
  } else if (producao) {
    if (jwtSecret === EXEMPLO_JWT_SECRET) problemas.push('JWT_SECRET está com o valor de exemplo do .env.example')
    else if (Buffer.byteLength(jwtSecret) < MIN_BYTES_JWT_SECRET) {
      problemas.push(`JWT_SECRET precisa ter ao menos ${MIN_BYTES_JWT_SECRET} bytes em produção (gere com: openssl rand -base64 48)`)
    }
  }

  const googleClientId = env.GOOGLE_CLIENT_ID?.trim()
  if (!googleClientId) {
    problemas.push('GOOGLE_CLIENT_ID não definido')
  } else if (producao && googleClientId === EXEMPLO_GOOGLE_CLIENT_ID) {
    problemas.push('GOOGLE_CLIENT_ID está com o valor de exemplo do .env.example')
  }

  if (problemas.length > 0) {
    throw new Error(`Configuração inválida em backend/.env:\n  - ${problemas.join('\n  - ')}`)
  }
}
