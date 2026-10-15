import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  test: {
    // Timeouts folgados: os testes HTTP sobem o app (que importa rotas,
    // driver do Mongo e google-auth-library) e, em máquina fria ou no CI,
    // o padrão de 10s do beforeAll já estourou uma vez (notas da M8).
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // `npm run test:integracao` (= --mode integracao) liga os testes que usam
    // MongoDB de verdade (*.integracao.test.ts) — ver o cabeçalho deles.
    env: mode === 'integracao' ? { TESTES_INTEGRACAO: '1' } : {},
  },
}))
