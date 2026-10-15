import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../errors/AppError'

// ----------------------------------------------------------------
// Tratamento de erro único da API (montado por último em app.ts).
//
// - AppError → status e código próprios.
// - ZodError (validarCorpo) → 400 validacao.campoInvalido/campoDesconhecido.
// - Erros do body-parser → 413 (corpo grande) / 400 (JSON inválido).
// - Qualquer outro erro → 500 genérico; o cliente nunca vê a mensagem
//   original (que pode trazer detalhe do Mongo).
// ----------------------------------------------------------------
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) return next(err)

  if (err instanceof AppError) {
    res.status(err.status).json({ erro: err.message, codigo: err.codigo, ...(err.params && { params: err.params }) })
    return
  }
  if (err instanceof ZodError) {
    // Primeiro problema basta para o usuário corrigir; o caminho (ex.:
    // "linhas.3.horaFim") vai em params para a tradução montar a frase.
    const problema = err.issues[0]
    const campo =
      problema.code === 'unrecognized_keys' ? problema.keys.join(', ') : problema.path.join('.') || '(corpo)'
    const codigo = problema.code === 'unrecognized_keys' ? 'validacao.campoDesconhecido' : 'validacao.campoInvalido'
    const erro =
      problema.code === 'unrecognized_keys' ? `Campo não permitido: ${campo}` : `Campo inválido: ${campo}`
    res.status(400).json({ erro, codigo, params: { campo } })
    return
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ erro: 'Conteúdo grande demais para esta requisição', codigo: 'corpo.grandeDemais' })
    return
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ erro: 'JSON inválido no corpo da requisição', codigo: 'corpo.jsonInvalido' })
    return
  }

  // Sem a mensagem: erros do Mongo (ex.: chave duplicada) a montam com
  // valores dos documentos, inclusive o e-mail do tenant. Tipo, código e
  // stack bastam para localizar o problema.
  const stack = typeof err?.stack === 'string' ? err.stack.split('\n').slice(1, 6).join('\n') : ''
  console.error(
    `[erro] ${req.method} ${req.originalUrl.split('?')[0]} ${err?.name ?? typeof err}${err?.code ? ` (${err.code})` : ''}\n${stack}`
  )
  res.status(500).json({ erro: 'Erro interno. Tente novamente.', codigo: 'interno' })
}

/** Rotas /api inexistentes respondem 404 em JSON (o padrão do Express é HTML). */
export function rotaNaoEncontrada(_req: Request, res: Response): void {
  res.status(404).json({ erro: 'Rota não encontrada', codigo: 'rota.naoEncontrada' })
}
