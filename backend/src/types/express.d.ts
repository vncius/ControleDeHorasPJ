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
      }
    }
  }
}
