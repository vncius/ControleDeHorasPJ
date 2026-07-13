import { v4 as uuid } from 'uuid'
import { escoposRepo, projetosRepo } from '../repositories'
import { AlteracaoEscopo, CriarEscopoDTO, AtualizarEscopoDTO } from '../types'
import { agora } from '../utils/tempo'

export const escoposService = {
  listarPorProjeto(projetoId: string): AlteracaoEscopo[] {
    return escoposRepo
      .findBy((e) => e.projetoId === projetoId)
      .sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime())
  },

  buscarPorId(id: string): AlteracaoEscopo {
    const escopo = escoposRepo.findById(id)
    if (!escopo) throw new Error(`Alteração de escopo não encontrada: ${id}`)
    return escopo
  },

  criar(dto: CriarEscopoDTO): AlteracaoEscopo {
    if (!dto.titulo?.trim()) throw new Error('Título é obrigatório')
    if (!projetosRepo.exists(dto.projetoId)) throw new Error('Projeto não encontrado')
    if (dto.horasAdicionais <= 0) throw new Error('Horas adicionais devem ser maiores que zero')
    if (dto.dataInicio && dto.dataFim && dto.dataFim < dto.dataInicio)
      throw new Error('Data fim não pode ser anterior à data início do escopo')

    const escopo: AlteracaoEscopo = {
      id: uuid(),
      projetoId: dto.projetoId,
      titulo: dto.titulo.trim(),
      descricaoDetalhada: dto.descricaoDetalhada?.trim(),
      horasAdicionais: dto.horasAdicionais,
      status: dto.status ?? 'Pendente',
      dataInicio: dto.dataInicio,
      dataFim: dto.dataFim,
      faturavel: dto.faturavel ?? true,
      dataCriacao: agora(),
      observacoes: dto.observacoes?.trim(),
    }
    return escoposRepo.create(escopo)
  },

  atualizar(id: string, dto: AtualizarEscopoDTO): AlteracaoEscopo {
    this.buscarPorId(id)
    if (dto.dataInicio && dto.dataFim && dto.dataFim < dto.dataInicio)
      throw new Error('Data fim não pode ser anterior à data início do escopo')

    const atualizado = escoposRepo.update(id, {
      ...(dto.titulo && { titulo: dto.titulo.trim() }),
      ...(dto.descricaoDetalhada !== undefined && { descricaoDetalhada: dto.descricaoDetalhada?.trim() }),
      ...(dto.horasAdicionais !== undefined && { horasAdicionais: dto.horasAdicionais }),
      ...(dto.status && { status: dto.status }),
      ...(dto.dataInicio !== undefined && { dataInicio: dto.dataInicio }),
      ...(dto.dataFim !== undefined && { dataFim: dto.dataFim }),
      ...(dto.faturavel !== undefined && { faturavel: dto.faturavel }),
      ...(dto.observacoes !== undefined && { observacoes: dto.observacoes?.trim() }),
    })
    if (!atualizado) throw new Error('Falha ao atualizar escopo')
    return atualizado
  },

  excluir(id: string): void {
    this.buscarPorId(id)
    escoposRepo.delete(id)
  },
}
