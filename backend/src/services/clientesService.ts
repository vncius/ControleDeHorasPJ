import { v4 as uuid } from 'uuid'
import { clientesRepo, projetosRepo } from '../repositories'
import { Cliente, CriarClienteDTO, AtualizarClienteDTO } from '../types'
import { agora } from '../utils/tempo'

export const clientesService = {
  async listar(): Promise<Cliente[]> {
    const clientes = await clientesRepo.findAll()
    return clientes.sort(
      (a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime()
    )
  },

  async buscarPorId(id: string): Promise<Cliente> {
    const cliente = await clientesRepo.findById(id)
    if (!cliente) throw new Error(`Cliente não encontrado: ${id}`)
    return cliente
  },

  async criar(dto: CriarClienteDTO): Promise<Cliente> {
    if (!dto.nome?.trim()) throw new Error('Nome do cliente é obrigatório')
    const cliente: Cliente = {
      id: uuid(),
      nome: dto.nome.trim(),
      observacoes: dto.observacoes?.trim(),
      dataCriacao: agora(),
    }
    return clientesRepo.create(cliente)
  },

  async atualizar(id: string, dto: AtualizarClienteDTO): Promise<Cliente> {
    await this.buscarPorId(id) // valida existência
    const atualizado = await clientesRepo.update(id, {
      ...(dto.nome && { nome: dto.nome.trim() }),
      ...(dto.observacoes !== undefined && { observacoes: dto.observacoes?.trim() }),
    })
    if (!atualizado) throw new Error('Falha ao atualizar cliente')
    return atualizado
  },

  async excluir(id: string): Promise<void> {
    await this.buscarPorId(id) // valida existência

    // Verificar se há projetos vinculados
    const projetos = await projetosRepo.findBy((p) => p.clienteId === id)
    if (projetos.length > 0) {
      throw new Error(
        `Não é possível excluir: cliente possui ${projetos.length} projeto(s) vinculado(s)`
      )
    }

    await clientesRepo.delete(id)
  },
}
