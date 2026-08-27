import { lancamentosRepo, projetosRepo, clientesRepo, pagamentosRepo } from '../repositories'
import { DashboardData, Projeto, LancamentoHoras } from '../types'
import { hoje, dataLocalISO, somarHoras, instanteDe } from '../utils/tempo'
import { STATUS_ENCERRADO, projetoTemSaldoAFaturar, marcarLancamentosFaturaveis } from '../utils/faturamento'
import { projetosService } from './projetosService'

function dataInicioSemana(): string {
  const d = new Date()
  const dia = d.getDay()
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1)
  d.setDate(diff)
  return dataLocalISO(d)
}

function dataInicioMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

// Decorrido do lançamento aberto, ancorado na DATA de início — um ponto
// iniciado ontem à noite (virada de meia-noite) continua contando, em vez
// de sumir dos totais.
function horasEmAndamento(horaInicio: string, data: string): number {
  const diffMs = Math.max(0, Date.now() - instanteDe(data, horaInicio).getTime())
  return Math.round((diffMs / 3600000) * 100) / 100
}

// Marca faturável de cada lançamento agrupando por projeto e aplicando a
// regra única de utils/faturamento.ts (FIFO de horas cobertas por pagamento).
function construirFaturavelMap(
  lancamentos: LancamentoHoras[],
  projetoMap: Map<string, Projeto>,
  horasCobertasPorProjeto: Map<string, number>
): Map<string, boolean> {
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
      lista.forEach((l) => faturavelMap.set(l.id, false))
      continue
    }
    const marcados = marcarLancamentosFaturaveis(lista, projeto, horasCobertasPorProjeto.get(projetoId) ?? 0)
    marcados.forEach((v, k) => faturavelMap.set(k, v))
  }
  return faturavelMap
}

export const dashboardService = {
  async obter(tenantId: string): Promise<DashboardData> {
    const dataHoje = hoje()
    const inicioSemana = dataInicioSemana()
    const inicioMes = dataInicioMes()

    const [todosLancamentos, todosProjetos, todosPagamentos] = await Promise.all([
      lancamentosRepo.findAllByTenant(tenantId),
      projetosRepo.findAllByTenant(tenantId),
      pagamentosRepo.findAllByTenant(tenantId),
    ])

    const projetoMap = new Map(todosProjetos.map(p => [p.id, p]))

    const horasCobertasPorProjeto = new Map<string, number>()
    todosPagamentos.forEach(p => {
      horasCobertasPorProjeto.set(p.projetoId, (horasCobertasPorProjeto.get(p.projetoId) ?? 0) + p.horasCobertas)
    })

    const totalTrabalhadoPorProjeto = new Map<string, number>()
    todosLancamentos.filter(l => l.horaFim && l.totalDecimal !== undefined).forEach(l => {
      totalTrabalhadoPorProjeto.set(l.projetoId, (totalTrabalhadoPorProjeto.get(l.projetoId) ?? 0) + (l.totalDecimal ?? 0))
    })

    const faturavelMap = construirFaturavelMap(todosLancamentos, projetoMap, horasCobertasPorProjeto)
    function lancamentoFaturavel(l: LancamentoHoras): boolean {
      return faturavelMap.get(l.id) ?? false
    }

    // Projetos que aparecem nos totais: tudo exceto Finalizado e Cancelado
    const projetosAtivos = todosProjetos.filter(
      p => !STATUS_ENCERRADO.has(p.status)
    )
    const idsAtivos = new Set(projetosAtivos.map(p => p.id))

    // lançamento em aberto
    const [emAndamento] = await lancamentosRepo.findBy((l) => l.tenantId === tenantId && !l.horaFim)
    const horasAberto = emAndamento ? horasEmAndamento(emAndamento.horaInicio, emAndamento.data) : 0
    const abertoFaturavel = emAndamento ? lancamentoFaturavel(emAndamento) : false

    // lançamentos finalizados de projetos não encerrados num período
    function filtrarPeriodo(dataMin: string) {
      return todosLancamentos.filter(
        l => idsAtivos.has(l.projetoId) && l.data >= dataMin && l.horaFim && l.totalDecimal !== undefined
      )
    }

    function somarFat(lista: LancamentoHoras[]) {
      return somarHoras(lista.filter(l => lancamentoFaturavel(l)).map(l => l.totalDecimal))
    }

    function somarNaoFat(lista: LancamentoHoras[]) {
      return somarHoras(lista.filter(l => !lancamentoFaturavel(l)).map(l => l.totalDecimal))
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
      const projeto = await projetosRepo.findByIdAndTenant(emAndamento.projetoId, tenantId)
      const cliente = projeto ? await clientesRepo.findByIdAndTenant(projeto.clienteId, tenantId) : undefined
      if (projeto && cliente) lancamentoEmAndamento = { ...emAndamento, projeto, cliente }
    }

    // Separação para os cards de projetos:
    // com saldo a faturar = ainda não totalmente pago + não encerrado
    // sem saldo a faturar = já totalmente pago + não encerrado (ainda em andamento mas já recebido)
    const projFaturaveis = projetosAtivos.filter(p =>
      projetoTemSaldoAFaturar(p, horasCobertasPorProjeto.get(p.id) ?? 0, totalTrabalhadoPorProjeto.get(p.id) ?? 0)
    )
    const projNaoFaturaveis = projetosAtivos.filter(p =>
      !projetoTemSaldoAFaturar(p, horasCobertasPorProjeto.get(p.id) ?? 0, totalTrabalhadoPorProjeto.get(p.id) ?? 0)
    )

    const resumosProjetos       = await Promise.all(projFaturaveis.map(p => projetosService.calcularResumo(tenantId, p.id)))
    const resumosProjetosPagos  = await Promise.all(projNaoFaturaveis.map(p => projetosService.calcularResumo(tenantId, p.id)))

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
