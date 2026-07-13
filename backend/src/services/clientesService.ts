import { v4 as uuid } from 'uuid'
import { clientesRepo, projetosRepo } from '../repositories'
import { Cliente, CriarClienteDTO, AtualizarClienteDTO } from '../types'
import { agora } from '../utils/tempo'

export const clientesService = {
  listar(): Cliente[] {
    return clientesRepo.findAll().sort(
      (a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime()
    )
  },

  buscarPorId(id: string): Cliente {
    const cliente = clientesRepo.findById(id)
    if (!cliente) throw new Error(`Cliente não encontrado: ${id}`)
    return cliente
  },

  criar(dto: CriarClienteDTO): Cliente {
    if (!dto.nome?.trim()) throw new Error('Nome do cliente é obrigatório')
    const cliente: Cliente = {
      id: uuid(),
      nome: dto.nome.trim(),
      observacoes: dto.observacoes?.trim(),
      dataCriacao: agora(),
    }
    return clientesRepo.create(cliente)
  },

  atualizar(id: string, dto: AtualizarClienteDTO): Cliente {
    this.buscarPorId(id) // valida existência
    const atualizado = clientesRepo.update(id, {
      ...(dto.nome && { nome: dto.nome.trim() }),
      ...(dto.observacoes !== undefined && { observacoes: dto.observacoes?.trim() }),
    })
    if (!atualizado) throw new Error('Falha ao atualizar cliente')
    return atualizado
  },

  excluir(id: string): void {
    this.buscarPorId(id) // valida existência

    // Verificar se há projetos vinculados
    const projetos = projetosRepo.findBy((p) => p.clienteId === id)
    if (projetos.length > 0) {
      throw new Error(
        `Não é possível excluir: cliente possui ${projetos.length} projeto(s) vinculado(s)`
      )
    }

    clientesRepo.delete(id)
  },
}
