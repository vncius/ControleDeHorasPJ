import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Lê os cabeçalhos da regra "/*" de public/_headers (formato do Cloudflare
// Pages) para o `vite preview` servir o build com os mesmos cabeçalhos de
// produção — é como testar a CSP localmente.
function cabecalhosCloudflare(): Record<string, string> {
  const cabecalhos: Record<string, string> = {}
  let naRegra = false
  for (const linha of readFileSync('public/_headers', 'utf8').split(/\r?\n/)) {
    if (!linha.trim() || linha.trimStart().startsWith('#')) continue
    if (!/^\s/.test(linha)) {
      naRegra = linha.trim() === '/*'
      continue
    }
    if (!naRegra) continue
    const idx = linha.indexOf(':')
    cabecalhos[linha.slice(0, idx).trim()] = linha.slice(idx + 1).trim()
  }
  // HSTS/upgrade-insecure-requests não fazem sentido em http://localhost.
  delete cabecalhos['Strict-Transport-Security']
  if (cabecalhos['Content-Security-Policy']) {
    cabecalhos['Content-Security-Policy'] = cabecalhos['Content-Security-Policy'].replace(
      /;\s*upgrade-insecure-requests/,
      ''
    )
  }
  return cabecalhos
}

// Mesmo papel do proxy /api do Cloudflare Pages: a API fica same-origin.
const proxyApi = {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: proxyApi,
  },
  preview: {
    port: 4173,
    proxy: proxyApi,
    headers: cabecalhosCloudflare(),
  },
})
