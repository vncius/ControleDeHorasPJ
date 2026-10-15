import { v4 as uuid } from 'uuid'
import { lancamentosRepo, projetosRepo, preferenciasRepo, pagamentosRepo, escoposRepo } from '../repositories'
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
  isInstanteFuturo,
} from '../utils/tempo'
import { marcarLancamentosFaturaveis } from '../utils/faturamento'
import { conflito, invalido, naoEncontrado } from '../errors/AppError'

const descricaoObrigatoria = () =>
  invalido('lancamento.descricaoObrigatoria', 'Descrição obrigatória: informe o que foi feito')

// escopoId vem do cliente: precisa existir no mesmo tenant E pertencer ao
// mesmo projeto do lançamento. Vazio/null = escopo principal, sempre válido.
async function validarEscopo(tenantId: string, projetoId: string, escopoId?: string | null): Promise<void> {
  if (!escopoId) return
  const escopo = await escoposRepo.findByIdAndTenant(escopoId, tenantId)
  if (!escopo || escopo.projetoId !== projetoId) throw invalido('lancamento.escopoInvalido', 'Escopo não encontrado neste projeto')
}

async function somarHorasCobertas(tenantId: string, projetoId: string): Promise<number> {
  const pagamentos = await pagamentosRepo.findBy((p) => p.tenantId === tenantId && p.projetoId === projetoId)
  return pagamentos.reduce((acc, p) => acc + p.horasCobertas, 0)
}

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

// Guarda a descrição e o escopo do último lançamento do projeto, para serem
// reaproveitados no próximo. escopoId ausente limpa o escopo (volta ao principal).
async function salvarUltimaDescricao(
  tenantId: string,
  projetoId: string,
  descricao: string,
  escopoId?: string | null
): Promise<void> {
  const ultimoEscopoLancamento = escopoId ?? undefined
  const pref = await preferenciasRepo.findOneBy((p) => p.tenantId === tenantId && p.projetoId === projetoId)
  if (pref) {
    // undefined em ultimoEscopoLancamento vira $unset no repository
    await preferenciasRepo.updateForTenant(pref.id, tenantId, {
      ultimaDescricaoLancamento: descricao,
      ultimoEscopoLancamento,
    })
  } else {
    await preferenciasRepo.create({
      id: uuid(),
      tenantId,
      projetoId,
      ultimaDescricaoLancamento: descricao,
      // chave ausente (não undefined): o driver do Mongo grava undefined como null
      ...(ultimoEscopoLancamento && { ultimoEscopoLancamento }),
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
    const faturavelMap = projeto
      ? marcarLancamentosFaturaveis(lancamentos, projeto, await somarHorasCobertas(tenantId, projetoId))
      : new Map<string, boolean>()
    return lancamentos
      .sort((a, b) => {
        const dataDiff = b.data.localeCompare(a.data)
        if (dataDiff !== 0) return dataDiff
        return b.horaInicio.localeCompare(a.horaInicio)
      })
      .map((l) => ({ ...l, faturavel: faturavelMap.get(l.id) ?? true }))
  },

  // Todos os lançamentos do tenant numa única leitura — usado por telas que
  // hoje fariam 1 requisição por projeto (Projetos, Relatórios). Mesmo
  // enriquecimento de `faturavel` que listarPorProjeto, agrupando lançamentos
  // e pagamentos por projeto em vez de buscar um a um.
  async listarPorTenant(tenantId: string): Promise<LancamentoHoras[]> {
    const [lancamentos, projetos, pagamentos] = await Promise.all([
      lancamentosRepo.findAllByTenant(tenantId),
      projetosRepo.findAllByTenant(tenantId),
      pagamentosRepo.findAllByTenant(tenantId),
    ])
    const projetoMap = new Map(projetos.map((p) => [p.id, p]))
    const horasCobertasPorProjeto = new Map<string, number>()
    pagamentos.forEach((p) => {
      horasCobertasPorProjeto.set(p.projetoId, (horasCobertasPorProjeto.get(p.projetoId) ?? 0) + p.horasCobertas)
    })
    const lancamentosPorProjeto = new Map<string, LancamentoHoras[]>()
    lancamentos.forEach((l) => {
      const lista = lancamentosPorProjeto.get(l.projetoId) ?? []
      lista.push(l)
      lancamentosPorProjeto.set(l.projetoId, lista)
    })

    const faturavelMap = new Map<string, boolean>()
    for (const [projetoId, lista] of lancamentosPorProjeto) {
      const projeto = projetoMap.get(projetoId)
      if (!projeto) {
        lista.forEach((l) => faturavelMap.set(l.id, true))
        continue
      }
      const marcados = marcarLancamentosFaturaveis(lista, projeto, horasCobertasPorProjeto.get(projetoId) ?? 0)
      marcados.forEach((v, k) => faturavelMap.set(k, v))
    }

    return lancamentos
      .sort((a, b) => {
        const dataDiff = b.data.localeCompare(a.data)
        if (dataDiff !== 0) return dataDiff
        return b.horaInicio.localeCompare(a.horaInicio)
      })
      .map((l) => ({ ...l, faturavel: faturavelMap.get(l.id) ?? true }))
  },

  async buscarPorId(tenantId: string, id: string): Promise<LancamentoHoras> {
    const lancamento = await lancamentosRepo.findByIdAndTenant(id, tenantId)
    if (!lancamento) throw naoEncontrado('lancamento.naoEncontrado', 'Lançamento não encontrado')
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

  // Escopo do último lançamento, só se ainda pode receber lançamentos (existe no
  // projeto e está aprovado) — escopo excluído/cancelado/pendente não é reaproveitado.
  async obterUltimoEscopo(tenantId: string, projetoId: string): Promise<string | undefined> {
    const pref = await preferenciasRepo.findOneBy((p) => p.tenantId === tenantId && p.projetoId === projetoId)
    const escopoId = pref?.ultimoEscopoLancamento
    if (!escopoId) return undefined
    const escopo = await escoposRepo.findByIdAndTenant(escopoId, tenantId)
    return escopo && escopo.projetoId === projetoId && escopo.status === 'Aprovada' ? escopo.id : undefined
  },

  // --- Controle de ponto: Iniciar ---
  async iniciarTrabalho(tenantId: string, projetoId: string, descricao?: string): Promise<LancamentoHoras> {
    if (!(await projetosRepo.existsForTenant(projetoId, tenantId))) throw naoEncontrado('projeto.naoEncontrado', 'Projeto não encontrado')

    const emAndamento = await this.buscarEmAndamento(tenantId)
    if (emAndamento) {
      throw conflito(
        'lancamento.jaEmAndamento',
        'Já existe um lançamento em andamento. Finalize-o antes de iniciar outro.'
      )
    }

    const ultimaDesc = await this.obterUltimaDescricao(tenantId, projetoId)
    const descricaoFinal = descricao?.trim() || ultimaDesc?.trim()
    if (!descricaoFinal) throw descricaoObrigatoria()

    // reaproveita o escopo do último lançamento (o usuário ainda pode trocá-lo ao finalizar)
    const escopoId = await this.obterUltimoEscopo(tenantId, projetoId)

    const lancamento: LancamentoHoras = {
      id: uuid(),
      tenantId,
      projetoId,
      ...(escopoId && { escopoId }),
      data: hoje(),
      horaInicio: horaAtual(),
      descricao: descricaoFinal,
      tipo: 'Automatico',
      dataCriacao: agora(),
      dataAtualizacao: agora(),
    }
    return lancamentosRepo.create(lancamento)
  },

  // --- Controle de ponto: Finalizar ---
  async finalizarTrabalho(tenantId: string, id: string, dto: FinalizarLancamentoDTO): Promise<LancamentoHoras> {
    const lancamento = await this.buscarPorId(tenantId, id)
    if (lancamento.horaFim) throw conflito('lancamento.jaFinalizado', 'Lançamento já foi finalizado')
    await validarEscopo(tenantId, lancamento.projetoId, dto.escopoId)

    const horaFim = dto.horaFim ?? horaAtual()
    const calculo = calcularDiferenca(lancamento.horaInicio, horaFim)

    const descricao = (dto.descricao ?? lancamento.descricao)?.trim()
    if (!descricao) throw descricaoObrigatoria()

    const atualizado = await lancamentosRepo.updateForTenant(id, tenantId, {
      horaFim,
      totalHHMM: calculo.hhMM,
      totalDecimal: calculo.decimal,
      descricao,
      ...(dto.escopoId !== undefined && { escopoId: dto.escopoId ?? undefined }),
      dataAtualizacao: agora(),
    })
    if (!atualizado) throw naoEncontrado('lancamento.naoEncontrado', 'Lançamento não encontrado')

    if (descricao) await salvarUltimaDescricao(tenantId, lancamento.projetoId, descricao, atualizado.escopoId)
    return atualizado
  },

  // --- Lançamento manual ---
  async criar(tenantId: string, dto: CriarLancamentoDTO): Promise<LancamentoHoras> {
    if (!(await projetosRepo.existsForTenant(dto.projetoId, tenantId))) throw naoEncontrado('projeto.naoEncontrado', 'Projeto não encontrado')
    await validarEscopo(tenantId, dto.projetoId, dto.escopoId)
    if (!isDataValida(dto.data)) throw invalido('lancamento.dataInvalida', 'Data inválida (esperado YYYY-MM-DD)')
    if (!isHoraValida(dto.horaInicio)) throw invalido('lancamento.horaInicioInvalida', 'Hora início inválida (esperado HH:MM)')
    if (!dto.descricao?.trim()) throw descricaoObrigatoria()
    if (!dto.horaFim && isInstanteFuturo(dto.data, dto.horaInicio)) {
      throw invalido(
        'lancamento.inicioNoFuturo',
        'Início no futuro: um lançamento em andamento não pode começar depois de agora. Se corrigiu a hora para antes da meia-noite, ajuste também a data.'
      )
    }

    const partial: Partial<Pick<LancamentoHoras, 'totalHHMM' | 'totalDecimal' | 'horaFim'>> = {}

    if (dto.horaFim) {
      if (!isHoraValida(dto.horaFim)) throw invalido('lancamento.horaFimInvalida', 'Hora fim inválida (esperado HH:MM)')
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
    if (dto.descricao) await salvarUltimaDescricao(tenantId, dto.projetoId, dto.descricao, dto.escopoId)
    return criado
  },

  // --- Edição ---
  async atualizar(tenantId: string, id: string, dto: AtualizarLancamentoDTO): Promise<LancamentoHoras> {
    const lancamento = await this.buscarPorId(tenantId, id)
    await validarEscopo(tenantId, lancamento.projetoId, dto.escopoId)

    const horaInicio = dto.horaInicio ?? lancamento.horaInicio
    const horaFim = dto.horaFim !== undefined ? dto.horaFim : lancamento.horaFim
    const data = dto.data ?? lancamento.data

    if (dto.descricao !== undefined && !dto.descricao.trim()) throw descricaoObrigatoria()

    if (!horaFim && isInstanteFuturo(data, horaInicio)) {
      throw invalido(
        'lancamento.inicioNoFuturo',
        'Início no futuro: um lançamento em andamento não pode começar depois de agora. Se corrigiu a hora para antes da meia-noite, ajuste também a data.'
      )
    }

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
    if (!atualizado) throw naoEncontrado('lancamento.naoEncontrado', 'Lançamento não encontrado')

    if (dto.descricao) await salvarUltimaDescricao(tenantId, lancamento.projetoId, dto.descricao, atualizado.escopoId)
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
