import { z } from 'zod'

// ============================================================
// Schemas de entrada da API (validados na borda por validarCorpo, em
// middleware/validacao.ts). Garantem FORMATO: tipos, enums, datas/horas,
// tamanhos e nenhum campo desconhecido (.strict() — tenantId,
// geradoPorRegularizacao etc. nunca entram pelo corpo).
//
// Regras de NEGÓCIO (posse por tenant, saldo, faturabilidade, fim depois
// do início…) continuam nos services/utils. Os tipos dos DTOs saem daqui
// (z.infer) e são reexportados por types/index.ts.
// ============================================================

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD')
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM')
const id = z.string().min(1).max(100)
const texto = (max: number) => z.string().max(max)
const obrigatorio = (max: number) => z.string().trim().min(1).max(max)

const STATUS_PROJETO = [
  'Aguardando início',
  'Em desenvolvimento',
  'Com impedimento',
  'Em testes',
  'Entregue',
  'Finalizado',
  'Cancelado',
] as const
const STATUS_ESCOPO = ['Pendente', 'Aprovada', 'Cancelada'] as const
const TIPO_LANCAMENTO = ['Automatico', 'Manual', 'Ajuste', 'Importado'] as const

// --- Clientes ---
export const criarClienteSchema = z
  .object({ nome: obrigatorio(200), observacoes: texto(5000).optional() })
  .strict()
export const atualizarClienteSchema = z
  .object({ nome: obrigatorio(200).optional(), observacoes: texto(5000).optional() })
  .strict()

// --- Projetos ---
const camposProjeto = {
  clienteId: id,
  nome: obrigatorio(200),
  descricao: texto(5000).optional(),
  valorHora: z.number().nonnegative().optional(),
  status: z.enum(STATUS_PROJETO).optional(),
  dataInicio: data,
  dataFim: data.optional(),
  observacoes: texto(5000).optional(),
  consideradoPago: z.boolean().optional(),
}
export const criarProjetoSchema = z
  .object({ ...camposProjeto, horasContratadas: z.number().positive().optional() })
  .strict()
export const atualizarProjetoSchema = z
  .object({
    ...camposProjeto,
    clienteId: id.optional(),
    nome: obrigatorio(200).optional(),
    dataInicio: data.optional(),
    // null = remover o limite (horas abertas); ausente = não alterar
    horasContratadas: z.number().positive().nullable().optional(),
  })
  .strict()

// --- Escopos (projetoId vem da URL) ---
const camposEscopo = {
  titulo: obrigatorio(200),
  descricaoDetalhada: texto(5000).optional(),
  // null/ausente = horas livres
  horasAdicionais: z.number().positive().nullable().optional(),
  status: z.enum(STATUS_ESCOPO).optional(),
  dataInicio: data.optional(),
  dataFim: data.optional(),
  observacoes: texto(5000).optional(),
}
export const criarEscopoSchema = z.object(camposEscopo).strict()
export const atualizarEscopoSchema = z.object({ ...camposEscopo, titulo: obrigatorio(200).optional() }).strict()

// --- Pagamentos (projetoId vem da URL; geradoPorRegularizacao nunca vem do cliente) ---
const camposPagamento = {
  horasCobertas: z.number().positive(),
  valor: z.number().nonnegative().optional(),
  dataPagamento: data,
  periodoApuracaoInicio: data,
  periodoApuracaoFim: data,
  numeroNF: texto(50).optional(),
  observacoes: texto(5000).optional(),
}
export const criarPagamentoSchema = z.object(camposPagamento).strict()
export const atualizarPagamentoSchema = z.object(camposPagamento).partial().strict()

// --- Lançamentos ---
export const criarLancamentoSchema = z
  .object({
    projetoId: id,
    escopoId: id.optional(),
    data,
    horaInicio: hora,
    horaFim: hora.optional(),
    descricao: obrigatorio(2000),
    tipo: z.enum(TIPO_LANCAMENTO).optional(),
  })
  .strict()
export const atualizarLancamentoSchema = z
  .object({
    escopoId: id.nullable().optional(),
    data: data.optional(),
    horaInicio: hora.optional(),
    horaFim: hora.optional(),
    descricao: obrigatorio(2000).optional(),
    tipo: z.enum(TIPO_LANCAMENTO).optional(),
  })
  .strict()
export const iniciarLancamentoSchema = z.object({ descricao: texto(2000).optional() }).strict()
export const finalizarLancamentoSchema = z
  .object({ horaFim: hora, descricao: texto(2000).optional(), escopoId: id.nullable().optional() })
  .strict()

// --- Importação ---
export const MAX_LINHAS_IMPORTACAO = 2000

export const previewImportacaoSchema = z
  .object({
    texto: obrigatorio(500_000),
    ano: z.coerce.number().int().min(2000).max(2100),
  })
  .strict()

// Linha devolvida pelo preview e reenviada no confirmar: o cliente pode tê-la
// alterado, então data/horas são revalidadas aqui (o total é recalculado no service).
const linhaImportacaoSchema = z
  .object({
    indice: z.number().int().nonnegative(),
    textoOriginal: texto(5000),
    data: data.optional(),
    descricao: texto(2000).optional(),
    horaInicio: hora.optional(),
    horaFim: hora.optional(),
    totalHHMMInformado: texto(10).optional(),
    totalDecimalInformado: z.number().optional(),
    totalHHMMCalculado: texto(10).optional(),
    totalDecimalCalculado: z.number().optional(),
    status: z.enum(['valida', 'aviso', 'erro']),
    mensagem: texto(1000).optional(),
  })
  .strict()

export const confirmarImportacaoSchema = z
  .object({ linhas: z.array(linhaImportacaoSchema).max(MAX_LINHAS_IMPORTACAO) })
  .strict()

// --- Autenticação ---
export const loginGoogleSchema = z.object({ credential: z.string().min(1).max(10_000) }).strict()

// --- Tipos (DTOs) ---
export type CriarClienteDTO = z.infer<typeof criarClienteSchema>
export type AtualizarClienteDTO = z.infer<typeof atualizarClienteSchema>
export type CriarProjetoDTO = z.infer<typeof criarProjetoSchema>
export type AtualizarProjetoDTO = z.infer<typeof atualizarProjetoSchema>
export type CriarEscopoDTO = z.infer<typeof criarEscopoSchema> & { projetoId: string }
export type AtualizarEscopoDTO = z.infer<typeof atualizarEscopoSchema>
export type CriarPagamentoDTO = z.infer<typeof criarPagamentoSchema> & {
  projetoId: string
  // só a regularização (projetosService) gera; nunca vem do corpo
  geradoPorRegularizacao?: boolean
}
export type AtualizarPagamentoDTO = z.infer<typeof atualizarPagamentoSchema>
export type CriarLancamentoDTO = z.infer<typeof criarLancamentoSchema>
export type AtualizarLancamentoDTO = z.infer<typeof atualizarLancamentoSchema>
export type FinalizarLancamentoDTO = z.infer<typeof finalizarLancamentoSchema>
