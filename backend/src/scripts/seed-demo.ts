// Dados FICTÍCIOS para demonstração e prints do README (M0 de docs/plano-melhorias.md).
//
// Uso (sempre num banco separado, nunca o de produção):
//   MONGODB_DB_NAME=horas-pj-demo npm run seed:demo
//
// APAGA tudo do usuário de demonstração (DEMO_EMAIL, padrão demo@horaspj.dev;
// tenantId fixo 00000000-0000-4000-8000-0000000000de) nesse banco e recria ~3 meses de trabalho verossímil relativos à data de
// hoje: clientes, projetos com horas contratadas e abertas, escopos, pagamentos
// por período de apuração, um projeto regularizado e um lançamento em andamento.
// Os lançamentos são gerados de forma determinística (mesma data = mesmos dados).
// Pode ser rodado de novo quantas vezes quiser.
process.env.TZ = 'America/Sao_Paulo'

import 'dotenv/config'
import { randomUUID as uuid } from 'node:crypto'
import { conectarMongo, getDb, resolverNomeBanco } from '../repositories/mongoClient'
import { preferenciasRepo } from '../repositories'
import { COLECOES_COM_TENANT } from '../migrations'
import { clientesService } from '../services/clientesService'
import { projetosService } from '../services/projetosService'
import { escoposService } from '../services/escoposService'
import { pagamentosService } from '../services/pagamentosService'
import { LancamentoHoras, Projeto } from '../types'
import { agora, calcularDiferenca, dataLocalISO, hoje, periodoApuracao, somarHoras } from '../utils/tempo'

const EMAIL = process.env.DEMO_EMAIL ?? 'demo@horaspj.dev'
// Usuário de demonstração (M13): id = tenantId, fixo para scripts de teste
// local poderem gerar uma sessão sem login Google.
const TENANT = '00000000-0000-4000-8000-0000000000de'

// --- utilitários de data e aleatoriedade determinística ---

function diasAtras(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dataLocalISO(d)
}

function diasUteis(inicio: string, fim: string): string[] {
  const dias: string[] = []
  const d = new Date(inicio + 'T12:00:00')
  const ultimo = new Date(fim + 'T12:00:00')
  while (d <= ultimo) {
    if (d.getDay() !== 0 && d.getDay() !== 6) dias.push(dataLocalISO(d))
    d.setDate(d.getDate() + 1)
  }
  return dias
}

let semente = 20261015
function aleatorio(): number {
  semente = (semente * 1103515245 + 12345) % 2147483648
  return semente / 2147483648
}
const escolher = <T>(lista: T[]): T => lista[Math.floor(aleatorio() * lista.length)]

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

// --- plano de trabalho por projeto ---

interface PlanoProjeto {
  projeto: Projeto
  inicio: string
  fim: string
  metaHoras: number
  tarefas: string[]
  escopoId?: string
  tarefasEscopo?: string[]
}

async function main() {
  const nomeBanco = resolverNomeBanco()
  if (!nomeBanco.toLowerCase().includes('demo')) {
    throw new Error(`Recusado: o banco "${nomeBanco}" não contém "demo" no nome. Use MONGODB_DB_NAME=horas-pj-demo.`)
  }

  await conectarMongo()
  const db = getDb()
  // limpa o tenant atual e o do formato antigo (tenantId = e-mail, antes da M13)
  for (const colecao of COLECOES_COM_TENANT) {
    await db.collection(colecao).deleteMany({ tenantId: { $in: [TENANT, EMAIL] } })
  }
  await db.collection('usuarios').deleteMany({ $or: [{ _id: TENANT as never }, { email: EMAIL }] })
  await db.collection('usuarios').insertOne({
    _id: TENANT as never, tenantId: TENANT, email: EMAIL, nome: 'Demonstração', versaoSessao: 0, dataCriacao: agora(),
  })

  // --- clientes ---
  const atlas = await clientesService.criar(TENANT, { nome: 'Atlas Logística', observacoes: 'Contrato anual, NF até o dia 20.' })
  const vitalis = await clientesService.criar(TENANT, { nome: 'Clínica Vitalis' })
  const nimbus = await clientesService.criar(TENANT, { nome: 'Nimbus Software', observacoes: 'Sustentação mensal por hora.' })
  const grao = await clientesService.criar(TENANT, { nome: 'Padaria Grão Dourado' })

  // --- projetos ---
  const portal = await projetosService.criar(TENANT, {
    clienteId: atlas.id, nome: 'Portal de rastreamento de cargas', horasContratadas: 160, valorHora: 120,
    status: 'Em desenvolvimento', dataInicio: diasAtras(85), descricao: 'Portal web para clientes acompanharem entregas.',
  })
  const agenda = await projetosService.criar(TENANT, {
    clienteId: vitalis.id, nome: 'App de agendamento de consultas', horasContratadas: 80, valorHora: 140,
    status: 'Em testes', dataInicio: diasAtras(60),
  })
  const sustentacao = await projetosService.criar(TENANT, {
    clienteId: nimbus.id, nome: 'Sustentação da plataforma', valorHora: 110,
    status: 'Em desenvolvimento', dataInicio: diasAtras(90),
  })
  const site = await projetosService.criar(TENANT, {
    clienteId: grao.id, nome: 'Site institucional', horasContratadas: 40, valorHora: 90,
    status: 'Em desenvolvimento', dataInicio: diasAtras(88), dataFim: diasAtras(50),
  })
  await projetosService.criar(TENANT, {
    clienteId: atlas.id, nome: 'Dashboard de frota', horasContratadas: 60, valorHora: 120,
    status: 'Aguardando início', dataInicio: diasAtras(-7),
  })

  // --- escopos ---
  const escopoCorreios = await escoposService.criar(TENANT, {
    projetoId: portal.id, titulo: 'Integração com API dos Correios', horasAdicionais: 24, status: 'Aprovada',
    dataInicio: diasAtras(30),
  })
  await escoposService.criar(TENANT, {
    projetoId: portal.id, titulo: 'Notificações por WhatsApp', horasAdicionais: 12, status: 'Pendente',
    descricaoDetalhada: 'Aviso automático de saída para entrega e entrega concluída.',
  })
  const escopoLevantamento = await escoposService.criar(TENANT, {
    projetoId: sustentacao.id, titulo: 'Levantamento do módulo financeiro', status: 'Aprovada', dataInicio: diasAtras(20),
  })

  const planos: PlanoProjeto[] = [
    {
      projeto: portal, inicio: diasAtras(85), fim: hoje(), metaHoras: 138,
      tarefas: ['Modelagem das entidades de entrega', 'Tela de rastreamento por código', 'Ajustes de layout responsivo',
        'Reunião de alinhamento com o cliente', 'Autenticação de clientes', 'Histórico de eventos da carga', 'Correções da homologação'],
      escopoId: escopoCorreios.id,
      tarefasEscopo: ['Integração com API dos Correios', 'Cálculo de prazo por CEP', 'Testes da integração de frete'],
    },
    {
      projeto: agenda, inicio: diasAtras(60), fim: diasAtras(3), metaHoras: 68,
      tarefas: ['Agenda por profissional', 'Confirmação de consulta por e-mail', 'Tela de pacientes',
        'Ajustes pedidos na homologação', 'Relatório de faltas'],
    },
    {
      projeto: sustentacao, inicio: diasAtras(90), fim: hoje(), metaHoras: 46,
      tarefas: ['Correção de bug no relatório mensal', 'Atualização de dependências', 'Suporte ao time de operações',
        'Otimização de consulta lenta', 'Deploy da versão 2.4'],
      escopoId: escopoLevantamento.id,
      tarefasEscopo: ['Levantamento do módulo financeiro', 'Entrevistas com usuários do financeiro'],
    },
    {
      projeto: site, inicio: diasAtras(88), fim: diasAtras(50), metaHoras: 38,
      tarefas: ['Layout da página inicial', 'Página de produtos', 'Formulário de encomendas', 'Publicação e SEO básico'],
    },
  ]

  // --- lançamentos: dia a dia, sem sobreposição de horário entre projetos ---
  const trabalhado = new Map<string, number>(planos.map((p) => [p.projeto.id, 0]))
  const lancamentos: LancamentoHoras[] = []
  const ontem = diasAtras(1)

  for (const dia of diasUteis(diasAtras(90), ontem)) {
    const ativos = planos.filter((p) => dia >= p.inicio && dia <= p.fim && trabalhado.get(p.projeto.id)! < p.metaHoras)
    if (ativos.length === 0 || aleatorio() < 0.12) continue // alguns dias sem lançamento

    let minuto = 8 * 60 + 30 + Math.floor(aleatorio() * 4) * 15
    const doDia = ativos.sort(() => aleatorio() - 0.5).slice(0, 2 + Math.floor(aleatorio() * 2))

    for (const plano of doDia) {
      if (minuto >= 12 * 60 && minuto < 13 * 60 + 30) minuto = 13 * 60 + 30 // almoço
      const duracao = (6 + Math.floor(aleatorio() * 10)) * 15 // 1h30 a 3h45
      const fim = Math.min(minuto + duracao, 19 * 60)
      if (fim - minuto < 30) break

      const usaEscopo = plano.escopoId && plano.tarefasEscopo && dia >= diasAtras(30) && aleatorio() < 0.45
      const horaInicio = hhmm(minuto)
      const horaFim = hhmm(fim)
      const calculo = calcularDiferenca(horaInicio, horaFim)
      lancamentos.push({
        id: uuid(), tenantId: TENANT, projetoId: plano.projeto.id,
        ...(usaEscopo && { escopoId: plano.escopoId }),
        data: dia, horaInicio, horaFim, totalHHMM: calculo.hhMM, totalDecimal: calculo.decimal,
        descricao: escolher(usaEscopo ? plano.tarefasEscopo! : plano.tarefas),
        tipo: aleatorio() < 0.75 ? 'Automatico' : 'Manual',
        dataCriacao: agora(), dataAtualizacao: agora(),
      })
      trabalhado.set(plano.projeto.id, trabalhado.get(plano.projeto.id)! + calculo.decimal)
      minuto = fim + (1 + Math.floor(aleatorio() * 4)) * 15
    }
  }

  // hoje: um bloco finalizado pela manhã e o lançamento em andamento (começou há ~1h15)
  const agoraMin = new Date().getHours() * 60 + new Date().getMinutes()
  const inicioAndamento = Math.max(agoraMin - 75, 0)
  if (inicioAndamento >= 9 * 60 + 30) {
    const calculo = calcularDiferenca('08:45', hhmm(Math.min(inicioAndamento - 15, 12 * 60)))
    lancamentos.push({
      id: uuid(), tenantId: TENANT, projetoId: sustentacao.id, data: hoje(), horaInicio: '08:45',
      horaFim: hhmm(Math.min(inicioAndamento - 15, 12 * 60)), totalHHMM: calculo.hhMM, totalDecimal: calculo.decimal,
      descricao: 'Suporte ao time de operações', tipo: 'Automatico', dataCriacao: agora(), dataAtualizacao: agora(),
    })
  }
  lancamentos.push({
    id: uuid(), tenantId: TENANT, projetoId: portal.id, data: hoje(), horaInicio: hhmm(inicioAndamento),
    descricao: 'Tela de rastreamento por código', tipo: 'Automatico', dataCriacao: agora(), dataAtualizacao: agora(),
  })

  await db.collection('lancamentosHoras').insertMany(lancamentos.map(({ id, ...resto }) => ({ _id: id, ...resto })) as any[])

  // preferências: última descrição/escopo por projeto, como o uso real deixaria
  for (const plano of planos) {
    const doProjeto = lancamentos.filter((l) => l.projetoId === plano.projeto.id)
    const ultimo = doProjeto[doProjeto.length - 1]
    if (!ultimo) continue
    await preferenciasRepo.create({
      id: uuid(), tenantId: TENANT, projetoId: plano.projeto.id,
      ultimaDescricaoLancamento: ultimo.descricao,
      ...(ultimo.escopoId && { ultimoEscopoLancamento: ultimo.escopoId }),
    })
  }

  // --- pagamentos: um por período de apuração (16 a 15) já encerrado ---
  const periodoAtual = periodoApuracao(hoje())
  const fimAnterior = new Date(periodoAtual.inicio + 'T12:00:00')
  fimAnterior.setDate(fimAnterior.getDate() - 1)
  const anterior = periodoApuracao(dataLocalISO(fimAnterior))
  const fimRetrasado = new Date(anterior.inicio + 'T12:00:00')
  fimRetrasado.setDate(fimRetrasado.getDate() - 1)
  const retrasado = periodoApuracao(dataLocalISO(fimRetrasado))

  const pagar = async (projeto: Projeto, periodo: { inicio: string; fim: string }, nf: string) => {
    const horas = somarHoras(
      lancamentos.filter((l) => l.projetoId === projeto.id && l.data >= periodo.inicio && l.data <= periodo.fim).map((l) => l.totalDecimal)
    )
    if (horas <= 0) return
    const dataPagamento = new Date(periodo.fim + 'T12:00:00')
    dataPagamento.setDate(dataPagamento.getDate() + 10)
    await pagamentosService.criar(TENANT, {
      projetoId: projeto.id, horasCobertas: Math.round(horas * 100) / 100,
      valor: Math.round(horas * (projeto.valorHora ?? 0) * 100) / 100,
      dataPagamento: dataLocalISO(dataPagamento), periodoApuracaoInicio: periodo.inicio, periodoApuracaoFim: periodo.fim,
      numeroNF: nf,
    })
  }

  await pagar(portal, retrasado, '1021')
  await pagar(portal, anterior, '1034')
  await pagar(agenda, anterior, '1035')
  await pagar(sustentacao, retrasado, '1022')
  await pagar(sustentacao, anterior, '1036')

  // site entregue e regularizado: gera o pagamento de regularização pelo fluxo real
  await projetosService.atualizar(TENANT, site.id, { status: 'Entregue', consideradoPago: true })

  console.log(`Demo recriada no banco "${nomeBanco}" para o tenant ${TENANT}: ${lancamentos.length} lançamentos.`)
  for (const plano of planos) console.log(`  ${plano.projeto.nome}: ${trabalhado.get(plano.projeto.id)!.toFixed(2)}h`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
