// Versão vigente dos Termos de Uso + Política de Privacidade (M15 — D7).
// Mudou o texto das chaves `legal.*` em i18n/*.ts? Incremente aqui E em
// backend/src/utils/consentimento.ts (os dois precisam bater): todo usuário
// volta a ver a tela de aceite.
export const VERSAO_TERMOS = 1
export const TERMOS_VIGENTES_DESDE = '2026-10-16'

// Controlador dos dados e canal de contato, exibidos nas políticas. Em
// produção, defina no Cloudflare Pages (VITE_LEGAL_CONTROLADOR / VITE_LEGAL_CONTATO);
// sem eles, as políticas usam um texto genérico.
export const CONTROLADOR = import.meta.env.VITE_LEGAL_CONTROLADOR?.trim() || ''
export const CONTATO = import.meta.env.VITE_LEGAL_CONTATO?.trim() || ''
