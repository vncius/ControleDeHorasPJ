/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  // Política de Privacidade / Termos (M15): quem é o controlador e como contatá-lo
  readonly VITE_LEGAL_CONTROLADOR?: string
  readonly VITE_LEGAL_CONTATO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
