// ============================================================
// TIPOS COMPARTILHADOS — espelhar no frontend também
// ============================================================

export interface Cliente {
  id: string
  tenantId: string
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
  tenantId: string
  clienteId: string
  nome: string
  descricao?: string
  horasContratadas?: number     // undefined = horas em aberto
  valorHora?: number
  status: StatusProjeto
  pago: boolean
  dataPagamento?: string        // YYYY-MM-DD — linha de corte de faturabilidade
  dataInicio: string            // YYYY-MM-DD obrigatório
  dataFim?: string
  dataCriacao: string
  observacoes?: string
}

export type StatusEscopo = 'Pendente' | 'Aprovada' | 'Cancelada'

export interface AlteracaoEscopo {
  id: string
  tenantId: string
  projetoId: string
  titulo: string
  descricaoDetalhada?: string
  horasAdicionais: number
  status: StatusEscopo
  // controle de período próprio
  dataInicio?: string           // YYYY-MM-DD início do escopo
  dataFim?: string              // YYYY-MM-DD fim do escopo
  dataCriacao: string
  observacoes?: string
}

export type TipoLancamento = 'Automatico' | 'Manual' | 'Ajuste' | 'Importado'

export interface LancamentoHoras {
  id: string
  tenantId: string
  projetoId: string
  escopoId?: string             // associação opcional a alteração de escopo
  data: string                  // YYYY-MM-DD
  horaInicio: string            // HH:MM
  horaFim?: string              // HH:MM — undefined = em andamento
  totalHHMM?: string
  totalDecimal?: number
  descricao: string
  tipo: TipoLancamento
  dataCriacao: string
  dataAtualizacao: string
  faturavel?: boolean           // computado na leitura (ver utils/faturamento.ts) — não persistido
}

export interface PreferenciasProjeto {
  id: string
  tenantId: string
  projetoId: string
  ultimaDescricaoLancamento?: string
}

// ============================================================
// IMPORTAÇÃO DE LANÇAMENTOS
// ============================================================

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

export interface PreviewImportacaoDTO { texto: string; ano: number }
export interface ConfirmarImportacaoDTO { linhas: LinhaImportacao[] }

// ============================================================
// DTOs
// ============================================================

export interface CriarClienteDTO { nome: string; observacoes?: string }
export interface AtualizarClienteDTO { nome?: string; observacoes?: string }

export interface CriarProjetoDTO {
  clienteId: string
  nome: string
  descricao?: string
  horasContratadas?: number
  valorHora?: number
  status?: StatusProjeto
  pago?: boolean
  dataPagamento?: string
  dataInicio: string
  dataFim?: string
  observacoes?: string
}

export interface AtualizarProjetoDTO {
  clienteId?: string
  nome?: string
  descricao?: string
  horasContratadas?: number | null
  valorHora?: number
  status?: StatusProjeto
  pago?: boolean
  dataPagamento?: string | null
  dataInicio?: string
  dataFim?: string
  observacoes?: string
}

export interface CriarEscopoDTO {
  projetoId: string
  titulo: string
  descricaoDetalhada?: string
  horasAdicionais: number
  status?: StatusEscopo
  dataInicio?: string
  dataFim?: string
  observacoes?: string
}

export interface AtualizarEscopoDTO {
  titulo?: string
  descricaoDetalhada?: string
  horasAdicionais?: number
  status?: StatusEscopo
  dataInicio?: string
  dataFim?: string
  observacoes?: string
}

export interface CriarLancamentoDTO {
  projetoId: string
  escopoId?: string
  data: string
  horaInicio: string
  horaFim?: string
  descricao: string
  tipo?: TipoLancamento
}

export interface AtualizarLancamentoDTO {
  escopoId?: string | null
  data?: string
  horaInicio?: string
  horaFim?: string
  descricao?: string
  tipo?: TipoLancamento
}

export interface FinalizarLancamentoDTO { horaFim: string; descricao?: string; escopoId?: string | null }

// ============================================================
// TIPOS DE RESPOSTA
// ============================================================

export interface ResumoProjeto {
  projeto: Projeto
  cliente: Cliente
  horasAbertas: boolean
  horasContratadas: number
  horasExtrasAprovadas: number
  totalDisponivel: number
  totalTrabalhado: number
  totalTrabalhadoEscopos: number   // horas em escopos separadas
  saldo: number
  percentualConsumido: number
  valorEstimado?: number
  valorTrabalhado?: number
  emAndamento: boolean
  temEscopoPendente: boolean       // há alteração de escopo aguardando aprovação
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
