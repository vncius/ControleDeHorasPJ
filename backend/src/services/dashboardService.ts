import { lancamentosRepo, projetosRepo, clientesRepo } from '../repositories'
import { DashboardData, Projeto, LancamentoHoras } from '../types'
import { hoje, somarHoras } from '../utils/tempo'
import { STATUS_ENCERRADO, projetoEhFaturavel, lancamentoEhFaturavel } from '../utils/faturamento'
import { projetosService } from './projetosService'

function dataInicioSemana(): string {
  const d = new Date()
  const dia = d.getDay()
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

function dataInicioMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function horasEmAndamento(horaInicio: string, data: string): number {
  if (data !== hoje()) return 0
  const [h, m] = horaInicio.split(':').map(Number)
  const inicio = new Date()
  inicio.setHours(h, m, 0, 0)
  const diffMs = Math.max(0, Date.now() - inicio.getTime())
  return Math.round((diffMs / 3600000) * 100) / 100
}

// Um lançamento é faturável segundo a regra única de utils/faturamento.ts
function lancamentoFaturavel(l: LancamentoHoras, projetoMap: Map<string, Projeto>): boolean {
  const projeto = projetoMap.get(l.projetoId)
  if (!projeto) return false
  return lancamentoEhFaturavel(l, projeto)
}

export const dashboardService = {
  obter(): DashboardData {
    const dataHoje = hoje()
    const inicioSemana = dataInicioSemana()
    const inicioMes = dataInicioMes()

    const todosLancamentos = lancamentosRepo.findAll()
    const todosProjetos = projetosRepo.findAll()

    const projetoMap = new Map(todosProjetos.map(p => [p.id, p]))

    // Projetos que aparecem nos totais: tudo exceto Finalizado e Cancelado
    const projetosAtivos = todosProjetos.filter(
      p => !STATUS_ENCERRADO.has(p.status)
    )
    const idsAtivos = new Set(projetosAtivos.map(p => p.id))

    // lançamento em aberto
    const emAndamento = lancamentosRepo.findOneBy((l) => !l.horaFim)
    const horasAberto = emAndamento ? horasEmAndamento(emAndamento.horaInicio, emAndamento.data) : 0
    const abertoFaturavel = emAndamento
      ? lancamentoFaturavel(emAndamento, projetoMap)
      : false

    // lançamentos finalizados de projetos não encerrados num período
    function filtrarPeriodo(dataMin: string) {
      return todosLancamentos.filter(
        l => idsAtivos.has(l.projetoId) && l.data >= dataMin && l.horaFim && l.totalDecimal !== undefined
      )
    }

    function somarFat(lista: LancamentoHoras[]) {
      return somarHoras(lista.filter(l => lancamentoFaturavel(l, projetoMap)).map(l => l.totalDecimal))
    }

    function somarNaoFat(lista: LancamentoHoras[]) {
      return somarHoras(lista.filter(l => !lancamentoFaturavel(l, projetoMap)).map(l => l.totalDecimal))
    }

    const listaHoje   = filtrarPeriodo(dataHoje)
    const listaSemana = filtrarPeriodo(inicioSemana)
    const listaMes    = filtrarPeriodo(inicioMes)

    const horasHoje   = somarFat(listaHoje)   + (abertoFaturavel ? horasAberto : 0)
    const horasSemana = somarFat(listaSemana) + (abertoFaturavel ? horasAberto : 0)
    const horasMes    = somarFat(listaMes)    + (abertoFaturavel ? horasAberto : 0)

    const horasHojePago   = somarNaoFat(listaHoje)   + (!abertoFaturavel && emAndamento ? horasAberto : 0)
    const horasSemanaPago = somarNaoFat(listaSemana) + (!abertoFaturavel && emAndamento ? horasAberto : 0)
    const horasMesPago    = somarNaoFat(listaMes)    + (!abertoFaturavel && emAndamento ? horasAberto : 0)

    // lançamento em andamento enriquecido
    let lancamentoEmAndamento: DashboardData['lancamentoEmAndamento'] = null
    if (emAndamento) {
      const projeto = projetosRepo.findById(emAndamento.projetoId)
      const cliente = projeto ? clientesRepo.findById(projeto.clienteId) : undefined
      if (projeto && cliente) lancamentoEmAndamento = { ...emAndamento, projeto, cliente }
    }

    // Separação para os cards de projetos:
    // faturáveis = não pago + não encerrado
    // não faturáveis = pago + não encerrado (ainda em andamento mas já recebido)
    const projFaturaveis  = projetosAtivos.filter(p => projetoEhFaturavel(p))
    const projNaoFaturaveis = projetosAtivos.filter(p => !projetoEhFaturavel(p))

    const resumosProjetos       = projFaturaveis.map(p => projetosService.calcularResumo(p.id))
    const resumosProjetosPagos  = projNaoFaturaveis.map(p => projetosService.calcularResumo(p.id))

    const projetosProximosLimite = resumosProjetos.filter(
      r => !r.horasAbertas && r.percentualConsumido >= 80
    )

    return {
      horasHoje:       Math.round(horasHoje * 100) / 100,
      horasSemana:     Math.round(horasSemana * 100) / 100,
      horasMes:        Math.round(horasMes * 100) / 100,
      horasHojePago:   Math.round(horasHojePago * 100) / 100,
      horasSemanaPago: Math.round(horasSemanaPago * 100) / 100,
      horasMesPago:    Math.round(horasMesPago * 100) / 100,
      projetosAtivos:  projetosAtivos.length,
      lancamentoEmAndamento,
      resumosProjetos,
      resumosProjetosPagos,
      projetosProximosLimite,
    }
  },
}
