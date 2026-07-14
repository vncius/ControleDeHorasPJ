export interface Cliente {
  id: string
  nome: string
  observacoes?: string
  dataCriacao: string
}

export type StatusProjeto =
  | 'Aguardando início'
  | 'Em desenvolvimento'
  | 'Com impedimento'
  | 'Em testes'
  | 'Entregue'
  | 'Finalizado'
  | 'Cancelado'

export interface Projeto {
  id: string
  clienteId: string
  nome: string
  descricao?: string
  horasContratadas?: number
  valorHora?: number
  status: StatusProjeto
  pago: boolean
  dataPagamento?: string
  dataInicio: string
  dataFim?: string
  dataCriacao: string
  observacoes?: string
}

export type StatusEscopo = 'Pendente' | 'Aprovada' | 'Cancelada'

export interface AlteracaoEscopo {
  id: string
  projetoId: string
  titulo: string
  descricaoDetalhada?: string
  horasAdicionais: number
  status: StatusEscopo
  dataInicio?: string
  dataFim?: string
  dataCriacao: string
  observacoes?: string
}

export type TipoLancamento = 'Automatico' | 'Manual' | 'Ajuste' | 'Importado'

export interface LancamentoHoras {
  id: string
  projetoId: string
  escopoId?: string
  data: string
  horaInicio: string
  horaFim?: string
  totalHHMM?: string
  totalDecimal?: number
  descricao: string
  tipo: TipoLancamento
  dataCriacao: string
  dataAtualizacao: string
  faturavel?: boolean // computado pelo backend (utils/faturamento.ts) — não persistido
}

export interface ResumoProjeto {
  projeto: Projeto
  cliente: Cliente
  horasAbertas: boolean
  horasContratadas: number
  horasExtrasAprovadas: number
  totalDisponivel: number
  totalTrabalhado: number
  totalTrabalhadoEscopos: number
  saldo: number
  percentualConsumido: number
  valorEstimado?: number
  valorTrabalhado?: number
  emAndamento: boolean
}

export interface DashboardData {
  horasHoje: number
  horasSemana: number
  horasMes: number
  horasHojePago: number
  horasSemanaPago: number
  horasMesPago: number
  projetosAtivos: number
  lancamentoEmAndamento: (LancamentoHoras & { projeto: Projeto; cliente: Cliente }) | null
  resumosProjetos: ResumoProjeto[]
  resumosProjetosPagos: ResumoProjeto[]
  projetosProximosLimite: ResumoProjeto[]
}

// ── Importação ──────────────────────────────────────────────────
export type StatusLinhaImportacao = 'valida' | 'aviso' | 'erro'

export interface LinhaImportacao {
  indice: number
  textoOriginal: string
  data?: string
  descricao?: string
  horaInicio?: string
  horaFim?: string
  totalHHMMInformado?: string
  totalDecimalInformado?: number
  totalHHMMCalculado?: string
  totalDecimalCalculado?: number
  status: StatusLinhaImportacao
  mensagem?: string
}
