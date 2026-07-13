import { BaseRepository } from './baseRepository'
import {
  Cliente,
  Projeto,
  AlteracaoEscopo,
  LancamentoHoras,
  PreferenciasProjeto,
} from '../types'

// Cada repository é apenas uma instância tipada do base.
// Adicione métodos específicos aqui se necessário no futuro.

export const clientesRepo = new BaseRepository<Cliente>('clientes.json')

export const projetosRepo = new BaseRepository<Projeto>('projetos.json')

export const escoposRepo = new BaseRepository<AlteracaoEscopo>('alteracoesEscopo.json')

export const lancamentosRepo = new BaseRepository<LancamentoHoras>('lancamentosHoras.json')

export const preferenciasRepo = new BaseRepository<PreferenciasProjeto>('preferenciasProjeto.json')
