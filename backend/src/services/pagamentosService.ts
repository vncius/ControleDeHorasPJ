import { v4 as uuid } from 'uuid'
import { pagamentosRepo, projetosRepo } from '../repositories'
import { Pagamento, CriarPagamentoDTO, AtualizarPagamentoDTO } from '../types'
import { agora, isDataValida } from '../utils/tempo'

function validarPeriodo(inicio: string, fim: string): void {
  if (!isDataValida(inicio)) throw new Error('Início do período de apuração inválido (use YYYY-MM-DD)')
  if (!isDataValida(fim)) throw new Error('Fim do período de apuração inválido (use YYYY-MM-DD)')
  if (fim < inicio) throw new Error('Fim do período de apuração não pode ser anterior ao início')
}

export const pagamentosService = {
  async listarPorProjeto(tenantId: string, projetoId: string): Promise<Pagamento[]> {
    const pagamentos = await pagamentosRepo.findBy((p) => p.tenantId === tenantId && p.projetoId === projetoId)
    return pagamentos.sort((a, b) => b.dataPagamento.localeCompare(a.dataPagamento))
  },

  // Todos os pagamentos do tenant numa única leitura — mesmo padrão de
  // escoposService/lancamentosService.listarPorTenant.
  async listarPorTenant(tenantId: string): Promise<Pagamento[]> {
    const pagamentos = await pagamentosRepo.findAllByTenant(tenantId)
    return pagamentos.sort((a, b) => b.dataPagamento.localeCompare(a.dataPagamento))
  },

  async buscarPorId(tenantId: string, id: string): Promise<Pagamento> {
    const pagamento = await pagamentosRepo.findByIdAndTenant(id, tenantId)
    if (!pagamento) throw new Error(`Pagamento não encontrado: ${id}`)
    return pagamento
  },

  async criar(tenantId: string, dto: CriarPagamentoDTO): Promise<Pagamento> {
    if (!(await projetosRepo.existsForTenant(dto.projetoId, tenantId))) throw new Error('Projeto não encontrado')
    if (!dto.horasCobertas || dto.horasCobertas <= 0) throw new Error('Horas cobertas devem ser maiores que zero')
    if (!isDataValida(dto.dataPagamento)) throw new Error('Data de pagamento inválida (use YYYY-MM-DD)')
    validarPeriodo(dto.periodoApuracaoInicio, dto.periodoApuracaoFim)

    const pagamento: Pagamento = {
      id: uuid(),
      tenantId,
      projetoId: dto.projetoId,
      horasCobertas: dto.horasCobertas,
      valor: dto.valor,
      dataPagamento: dto.dataPagamento,
      periodoApuracaoInicio: dto.periodoApuracaoInicio,
      periodoApuracaoFim: dto.periodoApuracaoFim,
      numeroNF: dto.numeroNF?.trim(),
      dataCriacao: agora(),
      observacoes: dto.observacoes?.trim(),
      ...(dto.geradoPorRegularizacao && { geradoPorRegularizacao: true }),
    }
    return pagamentosRepo.create(pagamento)
  },

  async atualizar(tenantId: string, id: string, dto: AtualizarPagamentoDTO): Promise<Pagamento> {
    const atual = await this.buscarPorId(tenantId, id)
    if (dto.horasCobertas !== undefined && dto.horasCobertas <= 0)
      throw new Error('Horas cobertas devem ser maiores que zero')
    if (dto.dataPagamento !== undefined && !isDataValida(dto.dataPagamento))
      throw new Error('Data de pagamento inválida (use YYYY-MM-DD)')

    const periodoInicio = dto.periodoApuracaoInicio ?? atual.periodoApuracaoInicio
    const periodoFim = dto.periodoApuracaoFim ?? atual.periodoApuracaoFim
    if (dto.periodoApuracaoInicio !== undefined || dto.periodoApuracaoFim !== undefined) {
      validarPeriodo(periodoInicio, periodoFim)
    }

    const atualizado = await pagamentosRepo.updateForTenant(id, tenantId, {
      ...(dto.horasCobertas !== undefined && { horasCobertas: dto.horasCobertas }),
      ...(dto.valor !== undefined && { valor: dto.valor }),
      ...(dto.dataPagamento && { dataPagamento: dto.dataPagamento }),
      ...(dto.periodoApuracaoInicio && { periodoApuracaoInicio: dto.periodoApuracaoInicio }),
      ...(dto.periodoApuracaoFim && { periodoApuracaoFim: dto.periodoApuracaoFim }),
      ...(dto.numeroNF !== undefined && { numeroNF: dto.numeroNF?.trim() }),
      ...(dto.observacoes !== undefined && { observacoes: dto.observacoes?.trim() }),
    })
    if (!atualizado) throw new Error('Falha ao atualizar pagamento')
    return atualizado
  },

  async excluir(tenantId: string, id: string): Promise<void> {
    await this.buscarPorId(tenantId, id)
    await pagamentosRepo.deleteForTenant(id, tenantId)
  },
}
