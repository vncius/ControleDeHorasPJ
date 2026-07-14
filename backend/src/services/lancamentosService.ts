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
  if (!diff) throw new Error('Hora fim não pode ser anterior à hora início')
  return { totalHHMM: diff.hhMM, totalDecimal: diff.decimal }
}

async function salvarUltimaDescricao(projetoId: string, descricao: string): Promise<void> {
  const pref = await preferenciasRepo.findOneBy((p) => p.projetoId === projetoId)
  if (pref) {
    await preferenciasRepo.update(pref.id, { ultimaDescricaoLancamento: descricao })
  } else {
    await preferenciasRepo.create({
      id: uuid(),
      projetoId,
      ultimaDescricaoLancamento: descricao,
    })
  }
}

// ----------------------------------------------------------------
// Service
// ----------------------------------------------------------------

export const lancamentosService = {
  async listarPorProjeto(projetoId: string): Promise<LancamentoHoras[]> {
    const projeto = await projetosRepo.findById(projetoId)
    const lancamentos = await lancamentosRepo.findBy((l) => l.projetoId === projetoId)
    return lancamentos
      .sort((a, b) => {
        const dataDiff = b.data.localeCompare(a.data)
        if (dataDiff !== 0) return dataDiff
        return b.horaInicio.localeCompare(a.horaInicio)
      })
      .map((l) => ({ ...l, faturavel: projeto ? lancamentoEhFaturavel(l, projeto) : true }))
  },

  async buscarPorId(id: string): Promise<LancamentoHoras> {
    const lancamento = await lancamentosRepo.findById(id)
    if (!lancamento) throw new Error(`Lançamento não encontrado: ${id}`)
    return lancamento
  },

  async buscarEmAndamento(): Promise<LancamentoHoras | null> {
    const lancamento = await lancamentosRepo.findOneBy((l) => !l.horaFim)
    return lancamento ?? null
  },

  async obterUltimaDescricao(projetoId: string): Promise<string | undefined> {
    const pref = await preferenciasRepo.findOneBy((p) => p.projetoId === projetoId)
    return pref?.ultimaDescricaoLancamento
  },

  // --- Controle de ponto: Iniciar ---
  async iniciarTrabalho(projetoId: string, descricao?: string): Promise<LancamentoHoras> {
    if (!(await projetosRepo.exists(projetoId))) throw new Error('Projeto não encontrado')

    const emAndamento = await this.buscarEmAndamento()
    if (emAndamento) {
      throw new Error(
        `Já existe um lançamento em andamento (projeto: ${emAndamento.projetoId}). Finalize-o antes de iniciar outro.`
      )
    }

    const ultimaDesc = await this.obterUltimaDescricao(projetoId)
    const lancamento: LancamentoHoras = {
      id: uuid(),
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
  async finalizarTrabalho(id: string, dto: FinalizarLancamentoDTO): Promise<LancamentoHoras> {
    const lancamento = await this.buscarPorId(id)
    if (lancamento.horaFim) throw new Error('Lançamento já foi finalizado')

    const horaFim = dto.horaFim ?? horaAtual()
    const calculo = calcularDiferenca(lancamento.horaInicio, horaFim)
    if (!calculo) throw new Error('Hora fim não pode ser anterior à hora início')

    const descricao = dto.descricao ?? lancamento.descricao

    const atualizado = await lancamentosRepo.update(id, {
      horaFim,
      totalHHMM: calculo.hhMM,
      totalDecimal: calculo.decimal,
      descricao,
      dataAtualizacao: agora(),
    })
    if (!atualizado) throw new Error('Falha ao finalizar lançamento')

    if (descricao) await salvarUltimaDescricao(lancamento.projetoId, descricao)
    return atualizado
  },

  // --- Lançamento manual ---
  async criar(dto: CriarLancamentoDTO): Promise<LancamentoHoras> {
    if (!(await projetosRepo.exists(dto.projetoId))) throw new Error('Projeto não encontrado')
    if (!isDataValida(dto.data)) throw new Error('Data inválida (esperado YYYY-MM-DD)')
    if (!isHoraValida(dto.horaInicio)) throw new Error('Hora início inválida (esperado HH:MM)')

    const partial: Partial<Pick<LancamentoHoras, 'totalHHMM' | 'totalDecimal' | 'horaFim'>> = {}

    if (dto.horaFim) {
      if (!isHoraValida(dto.horaFim)) throw new Error('Hora fim inválida (esperado HH:MM)')
      const calculo = calcularDiferenca(dto.horaInicio, dto.horaFim)
      if (!calculo) throw new Error('Hora fim não pode ser anterior à hora início')
      partial.horaFim = dto.horaFim
      partial.totalHHMM = calculo.hhMM
      partial.totalDecimal = calculo.decimal
    }

    const lancamento: LancamentoHoras = {
      id: uuid(),
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
    if (dto.descricao) await salvarUltimaDescricao(dto.projetoId, dto.descricao)
    return criado
  },

  // --- Edição ---
  async atualizar(id: string, dto: AtualizarLancamentoDTO): Promise<LancamentoHoras> {
    const lancamento = await this.buscarPorId(id)

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
      if (!calculo) throw new Error('Hora fim não pode ser anterior à hora início')
      partial.totalHHMM = calculo.hhMM
      partial.totalDecimal = calculo.decimal
    } else {
      partial.totalHHMM = undefined
      partial.totalDecimal = undefined
    }

    const atualizado = await lancamentosRepo.update(id, partial)
    if (!atualizado) throw new Error('Falha ao atualizar lançamento')

    if (dto.descricao) await salvarUltimaDescricao(lancamento.projetoId, dto.descricao)
    return atualizado
  },

  // --- Cancelar (excluir lançamento em andamento ou qualquer um) ---
  async excluir(id: string): Promise<void> {
    await this.buscarPorId(id)
    await lancamentosRepo.delete(id)
  },

  // --- Duplicar ---
  async duplicar(id: string): Promise<LancamentoHoras> {
    const original = await this.buscarPorId(id)
    return this.criar({
      projetoId: original.projetoId,
      data: hoje(),
      horaInicio: original.horaInicio,
      horaFim: original.horaFim,
      descricao: original.descricao,
      tipo: 'Manual',
    })
  },
}
