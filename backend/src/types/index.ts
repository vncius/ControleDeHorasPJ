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
  dataInicio: string            // YYYY-MM-DD obrigatório
  dataFim?: string
  dataCriacao: string
  observacoes?: string
  // Regularização de projeto histórico: quando true, o projeto é tratado
  // como pago independentemente dos pagamentos registrados — ver
  // utils/faturamento.ts. Marcar gera um pagamento de regularização
  // cobrindo o saldo em aberto (projetosService.atualizar).
  consideradoPago?: boolean
}

// 'Não pago' (nenhuma hora coberta) | 'Parcial' (cobre parte do trabalhado) |
// 'Pago' (cobre tudo que já foi trabalhado, ou projeto marcado como
// consideradoPago) — ver utils/faturamento.ts
export type StatusPagamentoProjeto = 'Não pago' | 'Parcial' | 'Pago'

export type StatusEscopo = 'Pendente' | 'Aprovada' | 'Cancelada'

export interface AlteracaoEscopo {
  id: string
  tenantId: string
  projetoId: string
  titulo: string
  descricaoDetalhada?: string
  horasAdicionais?: number      // undefined = horas livres (escopo sem horas definidas)
  status: StatusEscopo
  // controle de período próprio
  dataInicio?: string           // YYYY-MM-DD início do escopo
  dataFim?: string              // YYYY-MM-DD fim do escopo
  dataCriacao: string
  observacoes?: string
}

// Um pagamento cobre uma parte (ou o todo) das horas trabalhadas de um
// projeto — a NF é emitida pelo total de horas do período de apuração
// (16 a 15), não por projeto/demanda, então um projeto pode ter vários
// pagamentos parciais ao longo do tempo.
export interface Pagamento {
  id: string
  tenantId: string
  projetoId: string
  horasCobertas: number          // unidade principal (nem todo projeto tem valorHora)
  valor?: number                 // valor da NF — opcional/informativo
  dataPagamento: string          // YYYY-MM-DD
  periodoApuracaoInicio: string  // YYYY-MM-DD
  periodoApuracaoFim: string     // YYYY-MM-DD
  numeroNF?: string
  dataCriacao: string
  observacoes?: string
  // true = pagamento criado automaticamente pela regularização
  // (Projeto.consideradoPago). Desmarcar a opção remove só estes.
  geradoPorRegularizacao?: boolean
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
  dataInicio: string
  dataFim?: string
  observacoes?: string
  consideradoPago?: boolean
}

export interface AtualizarProjetoDTO {
  clienteId?: string
  nome?: string
  descricao?: string
  horasContratadas?: number | null
  valorHora?: number
  status?: StatusProjeto
  dataInicio?: string
  dataFim?: string
  observacoes?: string
  consideradoPago?: boolean
}

export interface CriarPagamentoDTO {
  projetoId: string
  horasCobertas: number
  valor?: number
  dataPagamento: string
  periodoApuracaoInicio: string
  periodoApuracaoFim: string
  numeroNF?: string
  observacoes?: string
  geradoPorRegularizacao?: boolean
}

export interface AtualizarPagamentoDTO {
  horasCobertas?: number
  valor?: number
  dataPagamento?: string
  periodoApuracaoInicio?: string
  periodoApuracaoFim?: string
  numeroNF?: string
  observacoes?: string
}

export interface CriarEscopoDTO {
  projetoId: string
  titulo: string
  descricaoDetalhada?: string
  horasAdicionais?: number | null   // null/ausente = horas livres
  status?: StatusEscopo
  dataInicio?: string
  dataFim?: string
  observacoes?: string
}

export interface AtualizarEscopoDTO {
  titulo?: string
  descricaoDetalhada?: string
  horasAdicionais?: number | null   // null = tornar horas livres, undefined = não alterar
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
  totalHorasCobertas: number       // soma de Pagamento.horasCobertas do projeto
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
