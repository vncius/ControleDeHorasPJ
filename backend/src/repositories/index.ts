import { MongoRepository } from './mongoRepository'
import {
  Cliente,
  Projeto,
  AlteracaoEscopo,
  LancamentoHoras,
  PreferenciasProjeto,
  Pagamento,
} from '../types'

// Cada repository é apenas uma instância tipada do Mongo repository.
// Adicione métodos específicos aqui se necessário no futuro.

export const clientesRepo = new MongoRepository<Cliente>('clientes')

export const projetosRepo = new MongoRepository<Projeto>('projetos')

export const escoposRepo = new MongoRepository<AlteracaoEscopo>('alteracoesEscopo')

export const lancamentosRepo = new MongoRepository<LancamentoHoras>('lancamentosHoras')

export const preferenciasRepo = new MongoRepository<PreferenciasProjeto>('preferenciasProjeto')

export const pagamentosRepo = new MongoRepository<Pagamento>('pagamentos')
