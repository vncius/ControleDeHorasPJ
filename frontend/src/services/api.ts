import type {
  Cliente,
  Projeto,
  AlteracaoEscopo,
  Pagamento,
  LancamentoHoras,
  ResumoProjeto,
  DashboardData,
  StatusProjeto,
  StatusEscopo,
  TipoLancamento,
} from '../types'
import i18n from '../i18n'

// Em produção front e back ficam em domínios/plataformas distintas, então
// a base da API precisa ser absoluta (VITE_API_URL). Em dev, sem essa
// variável, cai no caminho relativo que o proxy do Vite resolve.
const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`

// X-Requested-With é exigido pelo backend em toda requisição que altera
// estado (proteção contra CSRF — backend/src/middleware/csrf.ts)
const CABECALHOS = { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }

// ----------------------------------------------------------------
// Erros
// ----------------------------------------------------------------
// A API responde erros como { erro, codigo, params? } (backend/src/errors/
// AppError.ts). A mensagem mostrada vem da tradução `erros.<codigo>` no
// idioma ativo; `erro` (pt, do backend) é o fallback para código sem tradução.
export class ErroApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string
  ) {
    super(mensagem)
    this.name = 'ErroApi'
  }
}

interface CorpoErro {
  erro?: string
  codigo?: string
  params?: Record<string, string | number>
}

function traduzirErro(codigo: string, fallback: string, params?: Record<string, string | number>): string {
  return i18n.t(`erros.${codigo}`, { defaultValue: fallback, ...params })
}

// Chamado quando uma rota autenticada responde 401 (sessão expirou ou foi
// invalidada): o AuthContext limpa o usuário e o ProtectedRoute leva ao /login.
let aoExpirarSessao: (() => void) | null = null
export function definirAoExpirarSessao(fn: (() => void) | null): void {
  aoExpirarSessao = fn
}

/** Corpo JSON da resposta, ou null se não for JSON (ex.: página de erro HTML de um proxy). */
async function lerJson(res: Response): Promise<unknown> {
  if (!res.headers.get('content-type')?.includes('application/json')) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: CABECALHOS,
      credentials: 'include',
      ...options,
    })
  } catch {
    throw new ErroApi(0, 'rede', traduzirErro('rede', 'Sem conexão com o servidor.'))
  }

  const corpo = await lerJson(res)

  if (!res.ok) {
    // /auth/* trata o próprio 401 (sem sessão no /me, token inválido no login)
    if (res.status === 401 && !path.startsWith('/auth/')) aoExpirarSessao?.()
    const erro = (corpo ?? {}) as CorpoErro
    const codigo = erro.codigo ?? (corpo ? 'interno' : 'respostaInvalida')
    const fallback = erro.erro ?? `Erro inesperado (status ${res.status})`
    throw new ErroApi(res.status, codigo, traduzirErro(codigo, fallback, { status: res.status, ...erro.params }))
  }
  if (corpo === null) {
    throw new ErroApi(res.status, 'respostaInvalida', traduzirErro('respostaInvalida', 'Resposta inesperada', { status: res.status }))
  }
  return corpo as T
}

const get = <T>(path: string) => req<T>(path)
const post = <T>(path: string, body: unknown) =>
  req<T>(path, { method: 'POST', body: JSON.stringify(body) })
const put = <T>(path: string, body: unknown) =>
  req<T>(path, { method: 'PUT', body: JSON.stringify(body) })
const del = <T>(path: string) => req<T>(path, { method: 'DELETE' })

// ----------------------------------------------------------------
// Autenticação
// ----------------------------------------------------------------
export const authApi = {
  login: (credential: string) => post<{ email: string; nome?: string }>('/auth/google', { credential }),
  logout: () => post<{ mensagem: string }>('/auth/logout', {}),
  logoutTodos: () => post<{ mensagem: string }>('/auth/logout-todos', {}),
  me: () => get<{ email: string; nome?: string }>('/auth/me'),
}

// ----------------------------------------------------------------
// Dashboard
// ----------------------------------------------------------------
export const dashboardApi = {
  obter: () => get<DashboardData>('/dashboard'),
}

// ----------------------------------------------------------------
// Clientes
// ----------------------------------------------------------------
export const clientesApi = {
  listar: () => get<Cliente[]>('/clientes'),
  buscar: (id: string) => get<Cliente>(`/clientes/${id}`),
  criar: (body: { nome: string; observacoes?: string }) =>
    post<Cliente>('/clientes', body),
  atualizar: (id: string, body: { nome?: string; observacoes?: string }) =>
    put<Cliente>(`/clientes/${id}`, body),
  excluir: (id: string) => del<{ mensagem: string }>(`/clientes/${id}`),
}

// ----------------------------------------------------------------
// Projetos
// ----------------------------------------------------------------
export const projetosApi = {
  listar: (clienteId?: string) =>
    get<Projeto[]>(`/projetos${clienteId ? `?clienteId=${clienteId}` : ''}`),
  buscar: (id: string) => get<Projeto>(`/projetos/${id}`),
  resumo: (id: string) => get<ResumoProjeto>(`/projetos/${id}/resumo`),
  criar: (body: {
    clienteId: string
    nome: string
    descricao?: string
    horasContratadas: number
    valorHora?: number
    status?: StatusProjeto
    observacoes?: string
    consideradoPago?: boolean
  }) => post<Projeto>('/projetos', body),
  atualizar: (id: string, body: Omit<Partial<Projeto>, 'horasContratadas'> & { horasContratadas?: number | null }) =>
    put<Projeto>(`/projetos/${id}`, body),
  excluir: (id: string) => del<{ mensagem: string }>(`/projetos/${id}`),
}

// ----------------------------------------------------------------
// Escopos
// ----------------------------------------------------------------
export const escoposApi = {
  listar: (projetoId: string) =>
    get<AlteracaoEscopo[]>(`/projetos/${projetoId}/escopos`),
  listarTudo: () => get<AlteracaoEscopo[]>('/escopos'),
  criar: (
    projetoId: string,
    body: {
      titulo: string
      descricaoDetalhada?: string
      horasAdicionais?: number | null   // null/ausente = horas livres
      status?: StatusEscopo
      dataInicio?: string
      dataFim?: string
      observacoes?: string
    }
  ) => post<AlteracaoEscopo>(`/projetos/${projetoId}/escopos`, body),
  atualizar: (
    id: string,
    body: {
      titulo?: string
      horasAdicionais?: number | null   // null = tornar horas livres
      status?: StatusEscopo
      dataInicio?: string
      dataFim?: string
      observacoes?: string
    }
  ) => put<AlteracaoEscopo>(`/escopos/${id}`, body),
  excluir: (id: string) => del<{ mensagem: string }>(`/escopos/${id}`),
}

// ----------------------------------------------------------------
// Pagamentos
// ----------------------------------------------------------------
export const pagamentosApi = {
  listar: (projetoId: string) =>
    get<Pagamento[]>(`/projetos/${projetoId}/pagamentos`),
  listarTudo: () => get<Pagamento[]>('/pagamentos'),
  criar: (
    projetoId: string,
    body: {
      horasCobertas: number
      valor?: number
      dataPagamento: string
      periodoApuracaoInicio: string
      periodoApuracaoFim: string
      numeroNF?: string
      observacoes?: string
    }
  ) => post<Pagamento>(`/projetos/${projetoId}/pagamentos`, body),
  atualizar: (
    id: string,
    body: {
      horasCobertas?: number
      valor?: number
      dataPagamento?: string
      periodoApuracaoInicio?: string
      periodoApuracaoFim?: string
      numeroNF?: string
      observacoes?: string
    }
  ) => put<Pagamento>(`/pagamentos/${id}`, body),
  excluir: (id: string) => del<{ mensagem: string }>(`/pagamentos/${id}`),
}

// ----------------------------------------------------------------
// Lançamentos
// ----------------------------------------------------------------
export const lancamentosApi = {
  listarPorProjeto: (projetoId: string) =>
    get<LancamentoHoras[]>(`/projetos/${projetoId}/lancamentos`),
  listarTudo: () => get<LancamentoHoras[]>('/lancamentos'),
  emAndamento: async (): Promise<LancamentoHoras | null> => {
    try {
      const res = await fetch(`${BASE}/lancamentos/em-andamento`, {
        headers: CABECALHOS,
        credentials: 'include',
      })
      if (!res.ok) return null
      const data = await res.json()
      return data as LancamentoHoras | null
    } catch {
      return null
    }
  },
  ultimaDescricao: (projetoId: string) =>
    get<{ descricao?: string; escopoId?: string }>(`/projetos/${projetoId}/ultima-descricao`),
  iniciar: (projetoId: string, descricao?: string) =>
    post<LancamentoHoras>(`/projetos/${projetoId}/iniciar`, { descricao }),
  finalizar: (id: string, body: { horaFim: string; descricao?: string; escopoId?: string | null }) =>
    post<LancamentoHoras>(`/lancamentos/${id}/finalizar`, body),
  criar: (body: {
    projetoId: string
    escopoId?: string
    data: string
    horaInicio: string
    horaFim?: string
    descricao: string
    tipo?: TipoLancamento
  }) => post<LancamentoHoras>('/lancamentos', body),
  atualizar: (
    id: string,
    body: {
      escopoId?: string | null
      data?: string
      horaInicio?: string
      horaFim?: string
      descricao?: string
      tipo?: TipoLancamento
    }
  ) => put<LancamentoHoras>(`/lancamentos/${id}`, body),
  excluir: (id: string) => del<{ mensagem: string }>(`/lancamentos/${id}`),
  duplicar: (id: string) =>
    post<LancamentoHoras>(`/lancamentos/${id}/duplicar`, {}),
}

// ----------------------------------------------------------------
// Importação
// ----------------------------------------------------------------
import type { LinhaImportacao } from '../types'

export const importacaoApi = {
  preview: (projetoId: string, texto: string, ano: number) =>
    post<LinhaImportacao[]>(
      `/projetos/${projetoId}/lancamentos/importar-preview`,
      { texto, ano }
    ),
  confirmar: (projetoId: string, linhas: LinhaImportacao[]) =>
    post<LancamentoHoras[]>(
      `/projetos/${projetoId}/lancamentos/importar-confirmar`,
      { linhas }
    ),
}
