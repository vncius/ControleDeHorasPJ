import { v4 as uuid } from 'uuid'
import { lancamentosRepo, projetosRepo, preferenciasRepo } from '../repositories'
import {
  LancamentoHoras,
  CriarLancamentoDTO,
  AtualizarLancamentoDTO,
  FinalizarLancamentoDTO,
} from '../types'
import {
  agora,
  hoje,
  horaAtual,
  calcularDiferenca,
  isDataValida,
  isHoraValida,
} from '../utils/tempo'
import { lancamentoEhFaturavel } from '../utils/faturamento'

// ----------------------------------------------------------------
// helpers internos
// ----------------------------------------------------------------

function calcularEAtribuir(
  lancamento: LancamentoHoras
): Pick<LancamentoHoras, 'totalHHMM' | 'totalDecimal'> {
  if (!lancamento.horaFim) return {}
  const diff = calcularDiferenca(lancamento.horaInicio, lancamento.horaFim)
  return { totalHHMM: diff.hhMM, totalDecimal: diff.decimal }
}

async function salvarUltimaDescricao(tenantId: string, projetoId: string, descricao: string): Promise<void> {
  const pref = await preferenciasRepo.findOneBy((p) => p.tenantId === tenantId && p.projetoId === projetoId)
  if (pref) {
    await preferenciasRepo.updateForTenant(pref.id, tenantId, { ultimaDescricaoLancamento: descricao })
  } else {
    await preferenciasRepo.create({
      id: uuid(),
      tenantId,
      projetoId,
      ultimaDescricaoLancamento: descricao,
    })
  }
}

// ----------------------------------------------------------------
// Service
// ----------------------------------------------------------------

export const lancamentosService = {
  async listarPorProjeto(tenantId: string, projetoId: string): Promise<LancamentoHoras[]> {
    const projeto = await projetosRepo.findByIdAndTenant(projetoId, tenantId)
    const lancamentos = await lancamentosRepo.findBy((l) => l.tenantId === tenantId && l.projetoId === projetoId)
    return lancamentos
      .sort((a, b) => {
        const dataDiff = b.data.localeCompare(a.data)
        if (dataDiff !== 0) return dataDiff
        return b.horaInicio.localeCompare(a.horaInicio)
      })
      .map((l) => ({ ...l, faturavel: projeto ? lancamentoEhFaturavel(l, projeto) : true }))
  },

  // Todos os lançamentos do tenant numa única leitura — usado por telas que
  // hoje fariam 1 requisição por projeto (Projetos, Relatórios). Mesmo
  // enriquecimento de `faturavel` que listarPorProjeto, aplicado com um
  // Map<projetoId, Projeto> em vez de buscar o projeto um a um.
  async listarPorTenant(tenantId: string): Promise<LancamentoHoras[]> {
    const [lancamentos, projetos] = await Promise.all([
      lancamentosRepo.findAllByTenant(tenantId),
      projetosRepo.findAllByTenant(tenantId),
    ])
    const projetoMap = new Map(projetos.map((p) => [p.id, p]))
    return lancamentos
      .sort((a, b) => {
        const dataDiff = b.data.localeCompare(a.data)
        if (dataDiff !== 0) return dataDiff
        return b.horaInicio.localeCompare(a.horaInicio)
      })
      .map((l) => {
        const projeto = projetoMap.get(l.projetoId)
        return { ...l, faturavel: projeto ? lancamentoEhFaturavel(l, projeto) : true }
      })
  },

  async buscarPorId(tenantId: string, id: string): Promise<LancamentoHoras> {
    const lancamento = await lancamentosRepo.findByIdAndTenant(id, tenantId)
    if (!lancamento) throw new Error(`Lançamento não encontrado: ${id}`)
    return lancamento
  },

  async buscarEmAndamento(tenantId: string): Promise<LancamentoHoras | null> {
    const [lancamento] = await lancamentosRepo.findBy((l) => l.tenantId === tenantId && !l.horaFim)
    return lancamento ?? null
  },

  async obterUltimaDescricao(tenantId: string, projetoId: string): Promise<string | undefined> {
    const pref = await preferenciasRepo.findOneBy((p) => p.tenantId === tenantId && p.projetoId === projetoId)
    return pref?.ultimaDescricaoLancamento
  },

  // --- Controle de ponto: Iniciar ---
  async iniciarTrabalho(tenantId: string, projetoId: string, descricao?: string): Promise<LancamentoHoras> {
    if (!(await projetosRepo.existsForTenant(projetoId, tenantId))) throw new Error('Projeto não encontrado')

    const emAndamento = await this.buscarEmAndamento(tenantId)
    if (emAndamento) {
      throw new Error(
        `Já existe um lançamento em andamento (projeto: ${emAndamento.projetoId}). Finalize-o antes de iniciar outro.`
      )
    }

    const ultimaDesc = await this.obterUltimaDescricao(tenantId, projetoId)
    const lancamento: LancamentoHoras = {
      id: uuid(),
      tenantId,
      projetoId,
      data: hoje(),
      horaInicio: horaAtual(),
      descricao: descricao ?? ultimaDesc ?? '',
      tipo: 'Automatico',
      dataCriacao: agora(),
      dataAtualizacao: agora(),
    }
    return lancamentosRepo.create(lancamento)
  },

  // --- Controle de ponto: Finalizar ---
  async finalizarTrabalho(tenantId: string, id: string, dto: FinalizarLancamentoDTO): Promise<LancamentoHoras> {
    const lancamento = await this.buscarPorId(tenantId, id)
    if (lancamento.horaFim) throw new Error('Lançamento já foi finalizado')

    const horaFim = dto.horaFim ?? horaAtual()
    const calculo = calcularDiferenca(lancamento.horaInicio, horaFim)

    const descricao = dto.descricao ?? lancamento.descricao

    const atualizado = await lancamentosRepo.updateForTenant(id, tenantId, {
      horaFim,
      totalHHMM: calculo.hhMM,
      totalDecimal: calculo.decimal,
      descricao,
      ...(dto.escopoId !== undefined && { escopoId: dto.escopoId ?? undefined }),
      dataAtualizacao: agora(),
    })
    if (!atualizado) throw new Error('Falha ao finalizar lançamento')

    if (descricao) await salvarUltimaDescricao(tenantId, lancamento.projetoId, descricao)
    return atualizado
  },

  // --- Lançamento manual ---
  async criar(tenantId: string, dto: CriarLancamentoDTO): Promise<LancamentoHoras> {
    if (!(await projetosRepo.existsForTenant(dto.projetoId, tenantId))) throw new Error('Projeto não encontrado')
    if (!isDataValida(dto.data)) throw new Error('Data inválida (esperado YYYY-MM-DD)')
    if (!isHoraValida(dto.horaInicio)) throw new Error('Hora início inválida (esperado HH:MM)')

    const partial: Partial<Pick<LancamentoHoras, 'totalHHMM' | 'totalDecimal' | 'horaFim'>> = {}

    if (dto.horaFim) {
      if (!isHoraValida(dto.horaFim)) throw new Error('Hora fim inválida (esperado HH:MM)')
      const calculo = calcularDiferenca(dto.horaInicio, dto.horaFim)
      partial.horaFim = dto.horaFim
      partial.totalHHMM = calculo.hhMM
      partial.totalDecimal = calculo.decimal
    }

    const lancamento: LancamentoHoras = {
      id: uuid(),
      tenantId,
      projetoId: dto.projetoId,
      escopoId: dto.escopoId,
      data: dto.data,
      horaInicio: dto.horaInicio,
      ...partial,
      descricao: dto.descricao ?? '',
      tipo: dto.tipo ?? 'Manual',
      dataCriacao: agora(),
      dataAtualizacao: agora(),
    }

    const criado = await lancamentosRepo.create(lancamento)
    if (dto.descricao) await salvarUltimaDescricao(tenantId, dto.projetoId, dto.descricao)
    return criado
  },

  // --- Edição ---
  async atualizar(tenantId: string, id: string, dto: AtualizarLancamentoDTO): Promise<LancamentoHoras> {
    const lancamento = await this.buscarPorId(tenantId, id)

    const horaInicio = dto.horaInicio ?? lancamento.horaInicio
    const horaFim = dto.horaFim !== undefined ? dto.horaFim : lancamento.horaFim

    const partial: Partial<LancamentoHoras> = {
      ...(dto.escopoId !== undefined && { escopoId: dto.escopoId ?? undefined }),
      ...(dto.data && { data: dto.data }),
      ...(dto.horaInicio && { horaInicio: dto.horaInicio }),
      ...(dto.horaFim !== undefined && { horaFim: dto.horaFim || undefined }),
      ...(dto.descricao !== undefined && { descricao: dto.descricao }),
      ...(dto.tipo && { tipo: dto.tipo }),
      dataAtualizacao: agora(),
    }

    // Recalcular totais se ambas as horas estiverem presentes
    if (horaFim) {
      const calculo = calcularDiferenca(horaInicio, horaFim)
      partial.totalHHMM = calculo.hhMM
      partial.totalDecimal = calculo.decimal
    } else {
      partial.totalHHMM = undefined
      partial.totalDecimal = undefined
    }

    const atualizado = await lancamentosRepo.updateForTenant(id, tenantId, partial)
    if (!atualizado) throw new Error('Falha ao atualizar lançamento')

    if (dto.descricao) await salvarUltimaDescricao(tenantId, lancamento.projetoId, dto.descricao)
    return atualizado
  },

  // --- Cancelar (excluir lançamento em andamento ou qualquer um) ---
  async excluir(tenantId: string, id: string): Promise<void> {
    await this.buscarPorId(tenantId, id)
    await lancamentosRepo.deleteForTenant(id, tenantId)
  },

  // --- Duplicar ---
  async duplicar(tenantId: string, id: string): Promise<LancamentoHoras> {
    const original = await this.buscarPorId(tenantId, id)
    return this.criar(tenantId, {
      projetoId: original.projetoId,
      escopoId: original.escopoId,
      data: original.data,
      horaInicio: original.horaInicio,
      horaFim: original.horaFim,
      descricao: original.descricao,
      tipo: 'Manual',
    })
  },
}
