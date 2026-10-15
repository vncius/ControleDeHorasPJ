// ============================================================
// Erro de negócio com status HTTP e código estável.
//
// A API responde `{ erro, codigo, params? }`: `codigo` (ex.:
// "projeto.naoEncontrado") é o que o frontend traduz (chave `erros.<codigo>`
// em frontend/src/i18n); `erro` é a mensagem em pt, usada como fallback;
// `params` alimenta a interpolação da tradução (ex.: { count }).
//
// Qualquer erro que NÃO seja AppError vira 500 genérico no errorHandler —
// o detalhe (mensagem do Mongo, stack) fica só no log do servidor.
// ============================================================
export type ParamsErro = Record<string, string | number>

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly params?: ParamsErro
  ) {
    super(mensagem)
    this.name = 'AppError'
  }
}

/** 400 — dado enviado inválido ou regra de preenchimento violada. */
export const invalido = (codigo: string, mensagem: string, params?: ParamsErro) =>
  new AppError(400, codigo, mensagem, params)

/** 401 — sem sessão ou credencial inválida. */
export const naoAutorizado = (codigo: string, mensagem: string) => new AppError(401, codigo, mensagem)

/** 404 — recurso inexistente (ou de outro tenant: não revelamos a diferença). */
export const naoEncontrado = (codigo: string, mensagem: string) => new AppError(404, codigo, mensagem)

/** 409 — conflito com o estado atual (ex.: já em andamento, possui vínculos). */
export const conflito = (codigo: string, mensagem: string, params?: ParamsErro) =>
  new AppError(409, codigo, mensagem, params)
