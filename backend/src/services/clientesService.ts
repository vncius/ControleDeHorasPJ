import { randomUUID as uuid } from 'node:crypto'
import { clientesRepo, projetosRepo } from '../repositories'
import { Cliente, CriarClienteDTO, AtualizarClienteDTO } from '../types'
import { agora } from '../utils/tempo'
import { conflito, invalido, naoEncontrado } from '../errors/AppError'

export const clientesService = {
  async listar(tenantId: string): Promise<Cliente[]> {
    const clientes = await clientesRepo.findAllByTenant(tenantId)
    return clientes.sort(
      (a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime()
    )
  },

  async buscarPorId(tenantId: string, id: string): Promise<Cliente> {
    const cliente = await clientesRepo.findByIdAndTenant(id, tenantId)
    if (!cliente) throw naoEncontrado('cliente.naoEncontrado', 'Cliente não encontrado')
    return cliente
  },

  async criar(tenantId: string, dto: CriarClienteDTO): Promise<Cliente> {
    if (!dto.nome?.trim()) throw invalido('cliente.nomeObrigatorio', 'Nome do cliente é obrigatório')
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
    if (!atualizado) throw naoEncontrado('cliente.naoEncontrado', 'Cliente não encontrado')
    return atualizado
  },

  async excluir(tenantId: string, id: string): Promise<void> {
    await this.buscarPorId(tenantId, id) // valida existência e posse

    // Verificar se há projetos vinculados
    const projetos = await projetosRepo.findBy((p) => p.tenantId === tenantId && p.clienteId === id)
    if (projetos.length > 0) {
      throw conflito(
        'cliente.possuiProjetos',
        `Não é possível excluir: cliente possui ${projetos.length} projeto(s) vinculado(s)`,
        { count: projetos.length }
      )
    }

    await clientesRepo.deleteForTenant(id, tenantId)
  },
}
