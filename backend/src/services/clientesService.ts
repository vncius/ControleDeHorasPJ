import { v4 as uuid } from 'uuid'
import { clientesRepo, projetosRepo } from '../repositories'
import { Cliente, CriarClienteDTO, AtualizarClienteDTO } from '../types'
import { agora } from '../utils/tempo'

export const clientesService = {
  async listar(tenantId: string): Promise<Cliente[]> {
    const clientes = await clientesRepo.findAllByTenant(tenantId)
    return clientes.sort(
      (a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime()
    )
  },

  async buscarPorId(tenantId: string, id: string): Promise<Cliente> {
    const cliente = await clientesRepo.findByIdAndTenant(id, tenantId)
    if (!cliente) throw new Error(`Cliente não encontrado: ${id}`)
    return cliente
  },

  async criar(tenantId: string, dto: CriarClienteDTO): Promise<Cliente> {
    if (!dto.nome?.trim()) throw new Error('Nome do cliente é obrigatório')
    const cliente: Cliente = {
      id: uuid(),
      tenantId,
      nome: dto.nome.trim(),
      observacoes: dto.observacoes?.trim(),
      dataCriacao: agora(),
    }
    return clientesRepo.create(cliente)
  },

  async atualizar(tenantId: string, id: string, dto: AtualizarClienteDTO): Promise<Cliente> {
    await this.buscarPorId(tenantId, id) // valida existência e posse
    const atualizado = await clientesRepo.updateForTenant(id, tenantId, {
      ...(dto.nome && { nome: dto.nome.trim() }),
      ...(dto.observacoes !== undefined && { observacoes: dto.observacoes?.trim() }),
    })
    if (!atualizado) throw new Error('Falha ao atualizar cliente')
    return atualizado
  },

  async excluir(tenantId: string, id: string): Promise<void> {
    await this.buscarPorId(tenantId, id) // valida existência e posse

    // Verificar se há projetos vinculados
    const projetos = await projetosRepo.findBy((p) => p.tenantId === tenantId && p.clienteId === id)
    if (projetos.length > 0) {
      throw new Error(
        `Não é possível excluir: cliente possui ${projetos.length} projeto(s) vinculado(s)`
      )
    }

    await clientesRepo.deleteForTenant(id, tenantId)
  },
}
