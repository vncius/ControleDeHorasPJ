import { Request, Response, NextFunction, RequestHandler } from 'express'
import { ZodTypeAny } from 'zod'
import { invalido } from '../errors/AppError'

// ----------------------------------------------------------------
// Validação de entrada
// ----------------------------------------------------------------

/**
 * Valida req.body contra o schema e o substitui pelo resultado (já com
 * trim e coerções aplicados). Falha vira ZodError → 400 no errorHandler.
 */
export function validarCorpo(schema: ZodTypeAny): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const resultado = schema.safeParse(req.body ?? {})
    if (!resultado.success) return next(resultado.error)
    req.body = resultado.data
    next()
  }
}

// Chaves que nunca têm uso legítimo no corpo: operadores do Mongo ($set,
// $where…) e as que mexem em protótipo. Os schemas .strict() já recusam
// campos desconhecidos; isto é a rede de proteção para qualquer rota que
// leia o corpo sem schema.
const CHAVES_PROIBIDAS = new Set(['__proto__', 'constructor', 'prototype'])
const PROFUNDIDADE_MAXIMA = 10

function encontrarChaveProibida(valor: unknown, profundidade = 0): string | undefined {
  if (profundidade > PROFUNDIDADE_MAXIMA || valor === null || typeof valor !== 'object') return undefined
  for (const chave of Object.keys(valor)) {
    if (chave.startsWith('$') || CHAVES_PROIBIDAS.has(chave)) return chave
    const achada = encontrarChaveProibida((valor as Record<string, unknown>)[chave], profundidade + 1)
    if (achada) return achada
  }
  return undefined
}

export function bloquearChavesProibidas(req: Request, _res: Response, next: NextFunction): void {
  const chave = encontrarChaveProibida(req.body)
  if (chave) return next(invalido('validacao.chaveProibida', `Campo não permitido: ${chave}`, { campo: chave }))
  next()
}
