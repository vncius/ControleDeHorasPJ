export {}

declare global {
  namespace Express {
    interface Request {
      // Preenchido pelo requireAuth a partir do usuário da sessão. `tenantId`
      // é o que os services recebem; nunca vem do corpo nem da query string.
      usuario?: {
        id: string
        tenantId: string
        email: string
        nome?: string
        // true enquanto não houver aceite da versão vigente dos termos (M15)
        consentimentoPendente: boolean
      }
    }
  }
}
