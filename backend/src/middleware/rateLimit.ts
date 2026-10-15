import { Request, Response, NextFunction, RequestHandler } from 'express'

// ----------------------------------------------------------------
// Limite de requisições em memória (janela fixa), sem dependência nova.
// Suficiente para um processo único (Render); com mais de uma instância
// cada uma contaria separado — aí o caminho é um store compartilhado.
//
// IP: `req.ip` respeita o `trust proxy` de server.ts. Atrás do proxy do
// Cloudflare Pages o IP visto é o de saída do Cloudflare, compartilhado
// entre usuários — por isso os limites por IP são folgados e o de
// importação é por tenant. IP real do cliente: item futuro do plano.
// ----------------------------------------------------------------

interface OpcoesLimitador {
  janelaMs: number
  max: number
  chave: (req: Request) => string | undefined
  // injetável nos testes
  agora?: () => number
}

interface Contagem {
  inicio: number
  total: number
}

const MENSAGEM = 'Muitas requisições. Aguarde um pouco e tente novamente.'

export function criarLimitador({ janelaMs, max, chave, agora = Date.now }: OpcoesLimitador): RequestHandler {
  const contagens = new Map<string, Contagem>()

  // limpeza periódica das janelas vencidas; unref para não segurar o processo
  const limpeza = setInterval(() => {
    const limite = agora() - janelaMs
    for (const [k, c] of contagens) if (c.inicio <= limite) contagens.delete(k)
  }, janelaMs)
  limpeza.unref?.()

  return (req: Request, res: Response, next: NextFunction) => {
    const k = chave(req)
    if (!k) return next()

    const instante = agora()
    let c = contagens.get(k)
    if (!c || instante - c.inicio >= janelaMs) {
      c = { inicio: instante, total: 0 }
      contagens.set(k, c)
    }
    c.total++

    if (c.total > max) {
      res.setHeader('Retry-After', String(Math.ceil((c.inicio + janelaMs - instante) / 1000)))
      res.status(429).json({ erro: MENSAGEM })
      return
    }
    next()
  }
}

const UM_MINUTO = 60 * 1000

const porIp = (req: Request) => req.ip ?? req.socket.remoteAddress

/** Toda a API: 600 requisições por minuto por IP. */
export const limiteGeral = criarLimitador({ janelaMs: UM_MINUTO, max: 600, chave: porIp })

/** Login com Google: 20 tentativas por minuto por IP. */
export const limiteLogin = criarLimitador({ janelaMs: UM_MINUTO, max: 20, chave: porIp })

/** Importação (pré-visualizar + confirmar): 30 a cada 10 minutos por tenant. Depois do requireAuth. */
export const limiteImportacao = criarLimitador({
  janelaMs: 10 * UM_MINUTO,
  max: 30,
  chave: (req) => req.usuario?.email,
})
