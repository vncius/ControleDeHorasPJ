import { randomUUID as uuid } from 'node:crypto'
import { escoposRepo, projetosRepo } from '../repositories'
import { AlteracaoEscopo, CriarEscopoDTO, AtualizarEscopoDTO } from '../types'
import { agora } from '../utils/tempo'
import { invalido, naoEncontrado } from '../errors/AppError'

export const escoposService = {
  async listarPorProjeto(tenantId: string, projetoId: string): Promise<AlteracaoEscopo[]> {
    const escopos = await escoposRepo.findBy((e) => e.tenantId === tenantId && e.projetoId === projetoId)
    return escopos.sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime())
  },

  // Todos os escopos do tenant numa única leitura — mesma lógica de
  // lancamentosService.listarPorTenant, usada por telas que precisariam
  // de 1 requisição por projeto (lista de Projetos, Relatórios).
  async listarPorTenant(tenantId: string): Promise<AlteracaoEscopo[]> {
    const escopos = await escoposRepo.findAllByTenant(tenantId)
    return escopos.sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime())
  },

  async buscarPorId(tenantId: string, id: string): Promise<AlteracaoEscopo> {
    const escopo = await escoposRepo.findByIdAndTenant(id, tenantId)
    if (!escopo) throw naoEncontrado('escopo.naoEncontrado', 'Alteração de escopo não encontrada')
    return escopo
  },

  async criar(tenantId: string, dto: CriarEscopoDTO): Promise<AlteracaoEscopo> {
    if (!dto.titulo?.trim()) throw invalido('escopo.tituloObrigatorio', 'Título é obrigatório')
    if (!(await projetosRepo.existsForTenant(dto.projetoId, tenantId))) throw naoEncontrado('projeto.naoEncontrado', 'Projeto não encontrado')
    // horasAdicionais ausente = escopo de horas livres (levantamento, estimativa etc.)
    const horasAdicionais = dto.horasAdicionais ?? undefined
    if (horasAdicionais !== undefined && horasAdicionais <= 0)
      throw invalido('escopo.horasInvalidas', 'Horas adicionais devem ser maiores que zero')
    if (dto.dataInicio && dto.dataFim && dto.dataFim < dto.dataInicio)
      throw invalido('escopo.dataFimAntesInicio', 'Data fim não pode ser anterior à data início do escopo')

    const escopo: AlteracaoEscopo = {
      id: uuid(),
      tenantId,
      projetoId: dto.projetoId,
      titulo: dto.titulo.trim(),
      descricaoDetalhada: dto.descricaoDetalhada?.trim(),
      // chave ausente (não undefined): o driver do Mongo grava undefined como null
      ...(horasAdicionais !== undefined && { horasAdicionais }),
      status: dto.status ?? 'Pendente',
      dataInicio: dto.dataInicio,
      dataFim: dto.dataFim,
      dataCriacao: agora(),
      observacoes: dto.observacoes?.trim(),
    }
    return escoposRepo.create(escopo)
  },

  async atualizar(tenantId: string, id: string, dto: AtualizarEscopoDTO): Promise<AlteracaoEscopo> {
    await this.buscarPorId(tenantId, id)
    if (dto.dataInicio && dto.dataFim && dto.dataFim < dto.dataInicio)
      throw invalido('escopo.dataFimAntesInicio', 'Data fim não pode ser anterior à data início do escopo')
    if (typeof dto.horasAdicionais === 'number' && dto.horasAdicionais <= 0)
      throw invalido('escopo.horasInvalidas', 'Horas adicionais devem ser maiores que zero')

    const atualizado = await escoposRepo.updateForTenant(id, tenantId, {
      ...(dto.titulo && { titulo: dto.titulo.trim() }),
      ...(dto.descricaoDetalhada !== undefined && { descricaoDetalhada: dto.descricaoDetalhada?.trim() }),
      // null = remover horas (escopo livre); o repository faz $unset quando o valor é undefined
      ...(dto.horasAdicionais !== undefined && { horasAdicionais: dto.horasAdicionais ?? undefined }),
      ...(dto.status && { status: dto.status }),
      ...(dto.dataInicio !== undefined && { dataInicio: dto.dataInicio }),
      ...(dto.dataFim !== undefined && { dataFim: dto.dataFim }),
      ...(dto.observacoes !== undefined && { observacoes: dto.observacoes?.trim() }),
    })
    if (!atualizado) throw naoEncontrado('escopo.naoEncontrado', 'Alteração de escopo não encontrada')
    return atualizado
  },

  async excluir(tenantId: string, id: string): Promise<void> {
    await this.buscarPorId(tenantId, id)
    await escoposRepo.deleteForTenant(id, tenantId)
  },
}
