import { v4 as uuid } from 'uuid'
import { projetosRepo, clientesRepo, escoposRepo, lancamentosRepo } from '../repositories'
import {
  Projeto,
  CriarProjetoDTO,
  AtualizarProjetoDTO,
  ResumoProjeto,
} from '../types'
import { agora, somarHoras, isDataValida } from '../utils/tempo'

export const projetosService = {
  async listar(clienteId?: string): Promise<Projeto[]> {
    const todos = await projetosRepo.findAll()
    const filtrados = clienteId ? todos.filter((p) => p.clienteId === clienteId) : todos
    // ordena do mais antigo para o mais novo por dataInicio
    return filtrados.sort((a, b) => {
      const dA = a.dataInicio ?? a.dataCriacao
      const dB = b.dataInicio ?? b.dataCriacao
      return dA.localeCompare(dB)
    })
  },

  async buscarPorId(id: string): Promise<Projeto> {
    const projeto = await projetosRepo.findById(id)
    if (!projeto) throw new Error(`Projeto não encontrado: ${id}`)
    return projeto
  },

  async criar(dto: CriarProjetoDTO): Promise<Projeto> {
    if (!dto.nome?.trim()) throw new Error('Nome do projeto é obrigatório')
    if (!dto.clienteId) throw new Error('Cliente é obrigatório')
    if (!(await clientesRepo.exists(dto.clienteId))) throw new Error('Cliente não encontrado')
    if (dto.horasContratadas !== undefined && dto.horasContratadas <= 0)
      throw new Error('Horas contratadas devem ser maiores que zero')
    if (!dto.dataInicio) throw new Error('Data de início é obrigatória')
    if (!isDataValida(dto.dataInicio)) throw new Error('Data de início inválida (use YYYY-MM-DD)')
    if (dto.dataFim && !isDataValida(dto.dataFim)) throw new Error('Data de fim inválida (use YYYY-MM-DD)')
    if (dto.dataFim && dto.dataFim < dto.dataInicio) throw new Error('Data de fim não pode ser anterior à data de início')

    const projeto: Projeto = {
      id: uuid(),
      clienteId: dto.clienteId,
      nome: dto.nome.trim(),
      descricao: dto.descricao?.trim(),
      horasContratadas: dto.horasContratadas,
      valorHora: dto.valorHora,
      status: dto.status ?? 'Aguardando início',
      pago: dto.pago ?? false,
      dataPagamento: dto.dataPagamento,
      dataInicio: dto.dataInicio,
      dataFim: dto.dataFim,
      dataCriacao: agora(),
      observacoes: dto.observacoes?.trim(),
    }
    return projetosRepo.create(projeto)
  },

  async atualizar(id: string, dto: AtualizarProjetoDTO): Promise<Projeto> {
    const atual = await this.buscarPorId(id)

    if (dto.clienteId && !(await clientesRepo.exists(dto.clienteId))) {
      throw new Error('Cliente não encontrado')
    }
    if (dto.dataInicio && !isDataValida(dto.dataInicio)) throw new Error('Data de início inválida')
    if (dto.dataFim && !isDataValida(dto.dataFim)) throw new Error('Data de fim inválida')

    const dataInicio = dto.dataInicio ?? atual.dataInicio
    const dataFim = dto.dataFim !== undefined ? dto.dataFim : atual.dataFim
    if (dataFim && dataFim < dataInicio) throw new Error('Data de fim não pode ser anterior à data de início')

    // horasContratadas: null = remover limite, undefined = não alterar, número = atualizar
    const horasUpdate: Partial<Projeto> = {}
    if (dto.horasContratadas === null) {
      horasUpdate.horasContratadas = undefined
    } else if (dto.horasContratadas !== undefined) {
      horasUpdate.horasContratadas = dto.horasContratadas
    }

    const atualizado = await projetosRepo.update(id, {
      ...(dto.clienteId && { clienteId: dto.clienteId }),
      ...(dto.nome && { nome: dto.nome.trim() }),
      ...(dto.descricao !== undefined && { descricao: dto.descricao?.trim() }),
      ...horasUpdate,
      ...(dto.valorHora !== undefined && { valorHora: dto.valorHora }),
      ...(dto.status && { status: dto.status }),
      ...(dto.pago !== undefined && { pago: dto.pago }),
      ...(dto.dataPagamento !== undefined && { dataPagamento: dto.dataPagamento ?? undefined }),
      ...(dto.dataInicio && { dataInicio: dto.dataInicio }),
      ...(dto.dataFim !== undefined && { dataFim: dto.dataFim || undefined }),
      ...(dto.observacoes !== undefined && { observacoes: dto.observacoes?.trim() }),
    })
    if (!atualizado) throw new Error('Falha ao atualizar projeto')
    return atualizado
  },

  async excluir(id: string): Promise<void> {
    await this.buscarPorId(id)
    const escopos = await escoposRepo.findBy((e) => e.projetoId === id)
    for (const e of escopos) {
      await escoposRepo.delete(e.id)
    }
    const lancamentos = await lancamentosRepo.findBy((l) => l.projetoId === id)
    for (const l of lancamentos) {
      await lancamentosRepo.delete(l.id)
    }
    await projetosRepo.delete(id)
  },

  async calcularResumo(projetoId: string): Promise<ResumoProjeto> {
    const projeto = await this.buscarPorId(projetoId)
    const cliente = await clientesRepo.findById(projeto.clienteId)
    if (!cliente) throw new Error('Cliente do projeto não encontrado')

    const horasAbertas = projeto.horasContratadas === undefined || projeto.horasContratadas === null

    const escopos = await escoposRepo.findBy(
      (e) => e.projetoId === projetoId && e.status === 'Aprovada'
    )
    const horasExtrasAprovadas = escopos.reduce((acc, e) => acc + e.horasAdicionais, 0)
    const horasContratadas = projeto.horasContratadas ?? 0
    const totalDisponivel = horasAbertas ? 0 : horasContratadas + horasExtrasAprovadas

    const lancamentos = await lancamentosRepo.findBy((l) => l.projetoId === projetoId)
    const finalizados = lancamentos.filter((l) => l.horaFim !== undefined)
    const emAndamento = lancamentos.some((l) => l.horaFim === undefined)

    const totalTrabalhado = Math.round(somarHoras(finalizados.map((l) => l.totalDecimal)) * 100) / 100
    // horas em lançamentos vinculados a escopos
    const totalTrabalhadoEscopos = Math.round(
      somarHoras(finalizados.filter(l => l.escopoId).map(l => l.totalDecimal)) * 100
    ) / 100

    const saldo = horasAbertas ? 0 : Math.round((totalDisponivel - totalTrabalhado) * 100) / 100
    const percentualConsumido = horasAbertas
      ? 0
      : totalDisponivel > 0
        ? Math.round((totalTrabalhado / totalDisponivel) * 10000) / 100
        : 0

    const valorEstimado = projeto.valorHora && !horasAbertas
      ? Math.round(totalDisponivel * projeto.valorHora * 100) / 100
      : undefined
    const valorTrabalhado = projeto.valorHora
      ? Math.round(totalTrabalhado * projeto.valorHora * 100) / 100
      : undefined

    return {
      projeto,
      cliente,
      horasAbertas,
      horasContratadas,
      horasExtrasAprovadas,
      totalDisponivel,
      totalTrabalhado,
      totalTrabalhadoEscopos,
      saldo,
      percentualConsumido,
      valorEstimado,
      valorTrabalhado,
      emAndamento,
    }
  },
}
