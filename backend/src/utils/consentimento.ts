import type { Usuario } from '../types'

// Versão vigente dos Termos de Uso + Política de Privacidade (M15 — D7).
// Ao mudar o texto das políticas no frontend (frontend/src/i18n/*.ts, chaves
// `legal.*`), incremente aqui E em frontend/src/config/legal.ts: todo usuário
// volta a ver a tela de aceite, e as rotas de dados ficam bloqueadas até o
// novo aceite. Exportar e excluir a conta continuam liberados (direitos do
// titular não dependem de aceitar termos novos).
export const VERSAO_CONSENTIMENTO = 2

export function temConsentimentoVigente(usuario: Pick<Usuario, 'versaoConsentimento'>): boolean {
  return usuario.versaoConsentimento === VERSAO_CONSENTIMENTO
}
