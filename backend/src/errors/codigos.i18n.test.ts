import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import pt from '../../../frontend/src/i18n/pt'
import en from '../../../frontend/src/i18n/en'
import es from '../../../frontend/src/i18n/es'

// Rede de segurança entre os dois pacotes: todo código de erro que o backend
// emite precisa de tradução `erros.<codigo>` em pt/en/es (senão o usuário vê
// a mensagem em pt em qualquer idioma), e os três dicionários precisam ter as
// mesmas chaves.

const DICIONARIOS = { pt, en, es } as Record<string, Record<string, unknown>>

function arquivosFonte(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivosFonte(caminho)
    return caminho.endsWith('.ts') && !caminho.endsWith('.test.ts') ? [caminho] : []
  })
}

function codigosEmitidos(): string[] {
  const codigos = new Set<string>()
  for (const arquivo of arquivosFonte(join(__dirname, '..'))) {
    const fonte = readFileSync(arquivo, 'utf8')
    for (const m of fonte.matchAll(/(?:invalido|naoEncontrado|conflito|naoAutorizado)\(\s*'([a-zA-Z.]+)'/g)) codigos.add(m[1])
    for (const m of fonte.matchAll(/codigo: '([a-zA-Z.]+)'/g)) codigos.add(m[1])
    for (const m of fonte.matchAll(/'(validacao\.[a-zA-Z]+)'/g)) codigos.add(m[1])
  }
  return [...codigos].sort()
}

function temTraducao(dicionario: Record<string, unknown>, codigo: string): boolean {
  const partes = `erros.${codigo}`.split('.')
  let no: any = dicionario
  for (const parte of partes.slice(0, -1)) no = no?.[parte]
  const folha = partes[partes.length - 1]
  return !!no && (folha in no || `${folha}_other` in no)
}

const achatar = (o: Record<string, unknown>, prefixo = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? achatar(v as Record<string, unknown>, `${prefixo}${k}.`)
      : [`${prefixo}${k.replace(/_(zero|one|two|few|many|other)$/, '')}`]
  )

describe('códigos de erro × traduções', () => {
  const codigos = codigosEmitidos()

  it('encontra os códigos emitidos pelo backend (sanidade do scanner)', () => {
    expect(codigos.length).toBeGreaterThan(30)
    expect(codigos).toContain('projeto.naoEncontrado')
    expect(codigos).toContain('validacao.campoInvalido')
  })

  it.each(Object.keys(DICIONARIOS))('todo código tem tradução em %s', (idioma) => {
    expect(codigos.filter((c) => !temTraducao(DICIONARIOS[idioma], c))).toEqual([])
  })

  it.each(['en', 'es'])('pt e %s têm exatamente as mesmas chaves', (idioma) => {
    const referencia = new Set(achatar(DICIONARIOS.pt))
    const outro = new Set(achatar(DICIONARIOS[idioma]))
    expect([...referencia].filter((k) => !outro.has(k))).toEqual([])
    expect([...outro].filter((k) => !referencia.has(k))).toEqual([])
  })
})
