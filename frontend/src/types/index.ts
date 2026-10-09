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
  dataInicio: string
  dataFim?: string
  dataCriacao: string
  observacoes?: string
  // Regularização de projeto histórico: quando true, o projeto é tratado
  // como pago independentemente dos pagamentos registrados
  consideradoPago?: boolean
}

// 'Não pago' (nenhuma hora coberta) | 'Parcial' (cobre parte do trabalhado) |
// 'Pago' (cobre tudo que já foi trabalhado, ou projeto marcado como
// consideradoPago) — ver utils/faturamento.ts
export type StatusPagamentoProjeto = 'Não pago' | 'Parcial' | 'Pago'

export type StatusEscopo = 'Pendente' | 'Aprovada' | 'Cancelada'

export interface AlteracaoEscopo {
  id: string
  projetoId: string
  titulo: string
  descricaoDetalhada?: string
  horasAdicionais?: number   // undefined = horas livres (escopo sem horas definidas)
  status: StatusEscopo
  dataInicio?: string
  dataFim?: string
  dataCriacao: string
  observacoes?: string
}

// Um pagamento cobre uma parte (ou o todo) das horas trabalhadas de um
// projeto — a NF é emitida pelo total de horas do período de apuração
// (16 a 15), não por projeto/demanda, então um projeto pode ter vários
// pagamentos parciais ao longo do tempo.
export interface Pagamento {
  id: string
  projetoId: string
  horasCobertas: number
  valor?: number
  dataPagamento: string
  periodoApuracaoInicio: string
  periodoApuracaoFim: string
  numeroNF?: string
  dataCriacao: string
  observacoes?: string
  // true = criado automaticamente pela regularização (Projeto.consideradoPago)
  geradoPorRegularizacao?: boolean
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
  temEscopoPendente: boolean
  totalHorasCobertas: number
  statusPagamento: StatusPagamentoProjeto
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
