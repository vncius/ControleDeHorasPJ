import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { clientesApi, projetosApi, lancamentosApi, escoposApi, pagamentosApi } from '../services/api'
import { dataLocalISO, hojeLocal, periodoApuracao, somarHoras } from '../utils/tempo'
import { useFormatarData } from '../contexts/PreferenciasContext'
import { useFormatarNumero, formatarDecimal } from '../utils/formatoNumero'
import { campoTexto, campoNumero, montarCsv } from '../utils/csv'
import DatePicker from '../components/DatePicker'
import type { Cliente, Projeto, LancamentoHoras, Pagamento } from '../types'

interface LancamentoEnriquecido extends LancamentoHoras {
  projeto: Projeto
  cliente: Cliente
  escopoTitulo?: string
}

interface AgrupamentoRow {
  label: string
  totalDecimal: number
  totalHHMM: string
  qtdLancamentos: number
  valorTotal?: number
  naoFaturavel?: boolean
}

function decimalParaHHMM(decimal: number): string {
  const h = Math.floor(decimal)
  const m = Math.round((decimal - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function dataInicioMes(mesesAtras: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - mesesAtras)
  d.setDate(1)
  return dataLocalISO(d)
}

function dataHoje(): string {
  return hojeLocal()
}

// Cabeçalho, sim/não e tipo no idioma ativo; números com o separador decimal
// do idioma (a data fica em YYYY-MM-DD, que toda planilha reconhece). Textos do
// usuário passam por campoTexto (escape + neutralização de fórmula).
function exportarCSV(lancamentos: LancamentoEnriquecido[], sufixo: string, t: TFunction, idioma: string) {
  const cab = [
    t('comum.data'), t('comum.cliente'), t('comum.projeto'), t('relatorios.escopo'), t('relatorios.faturavel'),
    t('comum.descricao'), t('comum.inicio'), t('comum.fim'), t('comum.hhmm'), t('comum.decimal'), t('comum.tipo'),
    t('comum.valorReais'),
  ].map(campoTexto)
  const linhas = lancamentos.map(l => [
    campoNumero(l.data),
    campoTexto(l.cliente.nome),
    campoTexto(l.projeto.nome),
    campoTexto(l.escopoTitulo),
    campoTexto(l.faturavel ? t('comum.sim') : t('comum.nao')),
    campoTexto(l.descricao),
    campoNumero(l.horaInicio),
    campoNumero(l.horaFim),
    campoNumero(l.totalHHMM),
    campoNumero(formatarDecimal(l.totalDecimal ?? 0, 2, idioma)),
    campoTexto(t(`tipoLanc.${l.tipo}`)),
    campoNumero(l.projeto.valorHora ? formatarDecimal((l.totalDecimal ?? 0) * l.projeto.valorHora, 2, idioma) : ''),
  ])
  const blob = new Blob([montarCsv([cab, ...linhas])], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${t('relatorios.csvNomeArquivo')}${sufixo}-${dataHoje()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface DocPDF {
  getNumberOfPages(): number
  setPage(n: number): unknown
  setFontSize(n: number): unknown
  setTextColor(n: number): unknown
  text(s: string, x: number, y: number): unknown
  internal: { pageSize: { getHeight(): number } }
}

/** Rodapé "Gerado em … · página x/y" em todas as páginas do PDF. */
function rodapePDF(doc: DocPDF, t: TFunction, idioma: string) {
  const paginas = doc.getNumberOfPages()
  const geradoEm = new Date().toLocaleString(idioma)
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(140)
    doc.text(t('relatorios.pdfRodape', { data: geradoEm, pagina: i, total: paginas }), 14, doc.internal.pageSize.getHeight() - 8)
  }
}

async function exportarPDF(
  lancamentos: LancamentoEnriquecido[],
  projeto: Projeto,
  cliente: Cliente,
  dataInicio: string,
  dataFim: string,
  fmtData: (d: string) => string,
  t: TFunction,
  idioma: string,
) {
  // carregado sob demanda: jspdf/jspdf-autotable só são baixados quando o PDF é gerado
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const totalDecimal = somarHoras(lancamentos.map(l => l.totalDecimal))
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text(t('relatorios.pdfTitulo'), 14, 18)

  doc.setFontSize(11)
  doc.text(t('relatorios.pdfProjeto', { nome: projeto.nome }), 14, 28)
  doc.text(t('relatorios.pdfCliente', { nome: cliente.nome }), 14, 35)
  doc.text(t('relatorios.pdfPeriodo', { inicio: fmtData(dataInicio), fim: fmtData(dataFim) }), 14, 42)

  autoTable(doc, {
    startY: 50,
    head: [[t('comum.data'), t('comum.descricao'), t('comum.inicio'), t('comum.fim'), t('relatorios.horas')]],
    body: lancamentos.map(l => [
      fmtData(l.data),
      l.descricao || '\u2014',
      l.horaInicio,
      l.horaFim ?? '\u2014',
      l.totalHHMM ?? '\u2014',
    ]),
    foot: [['', '', '', t('comum.total'), decimalParaHHMM(totalDecimal)]],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30] },
    footStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 1: { cellWidth: 'auto' } },
  })

  rodapePDF(doc, t, idioma)
  doc.save(`${t('relatorios.pdfNomeArquivo')}-${projeto.nome.replace(/\s+/g, '-')}-${dataHoje()}.pdf`)
}

type VisualizacaoFaturavel = 'todos' | 'faturavel' | 'nao_faturavel'

type Agrupamento = 'cliente' | 'projeto' | 'escopo' | 'dia'
const ROTULO_AGRUPAMENTO: Record<Agrupamento, string> = {
  cliente: 'relatorios.porCliente', projeto: 'relatorios.porProjeto', escopo: 'relatorios.porEscopo', dia: 'relatorios.porDia',
}
const GRUPO_AGRUPAMENTO: Record<Agrupamento, string> = {
  cliente: 'relatorios.grupoCliente', projeto: 'relatorios.grupoProjeto', escopo: 'relatorios.grupoEscopo', dia: 'relatorios.grupoDia',
}

// ── Relatório por período de apuração (16 a 15) ───────────────────

interface LinhaPeriodoApuracao {
  projeto: Projeto
  cliente: Cliente
  totalHistorico: number
  totalJaPago: number
  totalNoPeriodo: number
  saldoAFaturar: number
}

function diaAnterior(data: string): string {
  const [ano, mes, dia] = data.split('-').map(Number)
  const d = new Date(ano, mes - 1, dia)
  d.setDate(d.getDate() - 1)
  return dataLocalISO(d)
}

async function exportarPDFPeriodo(
  linhas: LinhaPeriodoApuracao[],
  periodoInicio: string,
  periodoFim: string,
  fmtData: (d: string) => string,
  t: TFunction,
  idioma: string,
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const horas = (valor: number) => `${formatarDecimal(valor, 1, idioma)}h`
  const somar = (campo: keyof Pick<LinhaPeriodoApuracao, 'totalHistorico' | 'totalJaPago' | 'totalNoPeriodo' | 'saldoAFaturar'>) =>
    somarHoras(linhas.map(l => l[campo]))

  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(t('relatorios.pdfTituloPeriodo'), 14, 18)
  doc.setFontSize(11)
  doc.text(t('relatorios.pdfPeriodo', { inicio: fmtData(periodoInicio), fim: fmtData(periodoFim) }), 14, 28)

  autoTable(doc, {
    startY: 36,
    head: [[
      t('comum.projeto'), t('comum.cliente'), t('relatorios.historico'),
      t('relatorios.jaPago'), t('relatorios.noPeriodo'), t('relatorios.saldoAFaturar'),
    ]],
    body: linhas.map(l => [
      l.projeto.nome,
      l.cliente.nome,
      horas(l.totalHistorico),
      horas(l.totalJaPago),
      horas(l.totalNoPeriodo),
      horas(l.saldoAFaturar),
    ]),
    foot: [['', t('comum.total'),
      horas(somar('totalHistorico')),
      horas(somar('totalJaPago')),
      horas(somar('totalNoPeriodo')),
      horas(somar('saldoAFaturar')),
    ]],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [30, 30, 30] },
    footStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: 'bold' },
  })

  rodapePDF(doc, t, idioma)
  doc.save(`${t('relatorios.pdfNomeArquivoPeriodo')}-${periodoInicio}-${periodoFim}.pdf`)
}

export default function Relatorios() {
  const { t } = useTranslation()
  const { formatarData: fmtData } = useFormatarData()
  const { idioma, formatarDecimal: fmtDec, formatarMoeda: fmtReais } = useFormatarNumero()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [todosLancamentos, setTodosLancamentos] = useState<LancamentoEnriquecido[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [loading, setLoading] = useState(true)
  const [dataInicio, setDataInicio] = useState(dataInicioMes(1))
  const [dataFim, setDataFim] = useState(dataHoje())
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroProjeto, setFiltroProjeto] = useState('')
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('projeto')
  const [visualizacao, setVisualizacao] = useState<VisualizacaoFaturavel>('todos')
  const [visaoRelatorio, setVisaoRelatorio] = useState<'detalhado' | 'periodo'>('detalhado')
  const periodoAtual = useMemo(() => periodoApuracao(hojeLocal()), [])
  const [periodoRelInicio, setPeriodoRelInicio] = useState(periodoAtual.inicio)
  const [periodoRelFim, setPeriodoRelFim] = useState(periodoAtual.fim)

  useEffect(() => {
    async function carregar() {
      try {
        const [cs, ps, todos, escopos, pgs] = await Promise.all([
          clientesApi.listar(), projetosApi.listar(), lancamentosApi.listarTudo(), escoposApi.listarTudo(), pagamentosApi.listarTudo(),
        ])
        setClientes(cs)
        setProjetos(ps)
        setPagamentos(pgs)
        const projetoMap = new Map(ps.map(p => [p.id, p]))
        const clienteMap = new Map(cs.map(c => [c.id, c]))
        const escopoMap = new Map(escopos.map(e => [e.id, e.titulo]))
        const enriquecidos: LancamentoEnriquecido[] = []
        todos.filter(l => l.horaFim).forEach(l => {
          const projeto = projetoMap.get(l.projetoId)
          const cliente = projeto && clienteMap.get(projeto.clienteId)
          if (!projeto || !cliente) return
          enriquecidos.push({ ...l, projeto, cliente, escopoTitulo: l.escopoId ? escopoMap.get(l.escopoId) : undefined })
        })
        enriquecidos.sort((a, b) => b.data.localeCompare(a.data) || b.horaInicio.localeCompare(a.horaInicio))
        setTodosLancamentos(enriquecidos)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [])

  const lancamentosBase = useMemo(() =>
    todosLancamentos.filter(l => {
      if (l.data < dataInicio || l.data > dataFim) return false
      if (filtroCliente && l.cliente.id !== filtroCliente) return false
      if (filtroProjeto && l.projeto.id !== filtroProjeto) return false
      return true
    }),
    [todosLancamentos, dataInicio, dataFim, filtroCliente, filtroProjeto]
  )

  const lancamentosFat = useMemo(
    () => lancamentosBase.filter(l => l.faturavel),
    [lancamentosBase]
  )
  const lancamentosNaoFat = useMemo(
    () => lancamentosBase.filter(l => !l.faturavel),
    [lancamentosBase]
  )

  const lancamentosFiltrados = useMemo(() => {
    if (visualizacao === 'faturavel') return lancamentosFat
    if (visualizacao === 'nao_faturavel') return lancamentosNaoFat
    return lancamentosBase
  }, [visualizacao, lancamentosBase, lancamentosFat, lancamentosNaoFat])

  const projetosFiltrados = useMemo(
    () => !filtroCliente ? projetos : projetos.filter(p => p.clienteId === filtroCliente),
    [projetos, filtroCliente]
  )

  // linhas do relatório por período de apuração: um projeto por linha, com
  // histórico completo trabalhado, já pago (pagamentos de períodos
  // anteriores ao selecionado), trabalhado no período selecionado e saldo
  // que ainda falta cobrir (histórico − já pago).
  const linhasPeriodoApuracao = useMemo((): LinhaPeriodoApuracao[] => {
    return projetosFiltrados
      .map(p => {
        const cliente = clientes.find(c => c.id === p.clienteId)
        if (!cliente) return null
        const lancamentosProjeto = todosLancamentos.filter(l => l.projeto.id === p.id)
        const totalHistorico = somarHoras(lancamentosProjeto.map(l => l.totalDecimal))
        const totalNoPeriodo = somarHoras(
          lancamentosProjeto
            .filter(l => l.data >= periodoRelInicio && l.data <= periodoRelFim)
            .map(l => l.totalDecimal)
        )
        // pagamentos de períodos de apuração anteriores ao selecionado, mais os
        // de regularização — estes não representam um período real, e sim todo
        // o histórico do projeto, então contam independentemente da data.
        const totalJaPago = somarHoras(
          pagamentos
            .filter(pg => pg.projetoId === p.id &&
              (pg.geradoPorRegularizacao || pg.periodoApuracaoFim < periodoRelInicio))
            .map(pg => pg.horasCobertas)
        )
        // projeto considerado pago não tem saldo a faturar, mesmo que horas
        // novas tenham sido lançadas depois da regularização
        const saldoAFaturar = p.consideradoPago ? 0 : Math.max(0, somarHoras([totalHistorico, -totalJaPago]))
        return { projeto: p, cliente, totalHistorico, totalJaPago, totalNoPeriodo, saldoAFaturar }
      })
      .filter((l): l is LinhaPeriodoApuracao => l !== null && l.totalHistorico > 0)
      .sort((a, b) => b.saldoAFaturar - a.saldoAFaturar)
  }, [projetosFiltrados, clientes, todosLancamentos, pagamentos, periodoRelInicio, periodoRelFim])

  // relatório em PDF (formalização de horas) exige um único projeto selecionado
  const projetoParaPDF = filtroProjeto ? projetos.find(p => p.id === filtroProjeto) : undefined
  const clienteParaPDF = projetoParaPDF ? clientes.find(c => c.id === projetoParaPDF.clienteId) : undefined

  const totalDecimal = useMemo(
    () => somarHoras(lancamentosFiltrados.map(l => l.totalDecimal)),
    [lancamentosFiltrados]
  )
  const totalDecimalFat = useMemo(
    () => somarHoras(lancamentosFat.map(l => l.totalDecimal)),
    [lancamentosFat]
  )
  const totalDecimalNaoFat = useMemo(
    () => somarHoras(lancamentosNaoFat.map(l => l.totalDecimal)),
    [lancamentosNaoFat]
  )
  const totalValor = useMemo(
    () => lancamentosFiltrados.reduce((a, l) =>
      l.projeto.valorHora ? a + (l.totalDecimal ?? 0) * l.projeto.valorHora : a, 0),
    [lancamentosFiltrados]
  )
  const totalValorFat = useMemo(
    () => lancamentosFat.reduce((a, l) =>
      l.projeto.valorHora ? a + (l.totalDecimal ?? 0) * l.projeto.valorHora : a, 0),
    [lancamentosFat]
  )

  const linhasAgrupadas = useMemo((): AgrupamentoRow[] => {
    const mapa = new Map<string, AgrupamentoRow>()
    lancamentosFiltrados.forEach(l => {
      let key = '', label = ''
      if (agrupamento === 'cliente') { key = l.cliente.id; label = l.cliente.nome }
      else if (agrupamento === 'projeto') { key = l.projeto.id; label = `${l.projeto.nome} · ${l.cliente.nome}` }
      else if (agrupamento === 'escopo') { key = l.escopoId ?? '__sem_escopo__'; label = l.escopoTitulo ?? t('relatorios.semEscopo') }
      else { key = l.data; label = fmtData(l.data) }
      const ex = mapa.get(key)
      const decimal = (ex?.totalDecimal ?? 0) + (l.totalDecimal ?? 0)
      const valor = l.projeto.valorHora
        ? ((ex?.valorTotal ?? 0) + (l.totalDecimal ?? 0) * l.projeto.valorHora)
        : ex?.valorTotal
      mapa.set(key, {
        label,
        totalDecimal: decimal,
        totalHHMM: decimalParaHHMM(decimal),
        qtdLancamentos: (ex?.qtdLancamentos ?? 0) + 1,
        valorTotal: valor,
        naoFaturavel: !l.faturavel,
      })
    })
    return Array.from(mapa.values()).sort((a, b) => b.totalDecimal - a.totalDecimal)
  }, [lancamentosFiltrados, agrupamento, fmtData, t])

  function limparFiltros() {
    setDataInicio(dataInicioMes(1))
    setDataFim(dataHoje())
    setFiltroCliente('')
    setFiltroProjeto('')
  }

  const sufixoCSV = visualizacao === 'faturavel'
    ? t('relatorios.csvSufixoFat')
    : visualizacao === 'nao_faturavel' ? t('relatorios.csvSufixoNaoFat') : ''

  if (loading) return (
    <div className="loading-screen"><div className="spinner" /><span>{t('relatorios.carregandoDados')}</span></div>
  )

  return (
    <div style={{ animation: 'slideUp 0.25s ease' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('relatorios.titulo')}</h1>
          <p className="page-subtitle">
            {t('relatorios.subtitulo', { count: lancamentosFiltrados.length })}
          </p>
        </div>
        {visaoRelatorio === 'detalhado' && (
          <div className="flex-center gap-8">
            <button
              className="btn btn-secondary"
              onClick={() => projetoParaPDF && clienteParaPDF && exportarPDF(lancamentosFiltrados, projetoParaPDF, clienteParaPDF, dataInicio, dataFim, fmtData, t, idioma)}
              disabled={!projetoParaPDF || !clienteParaPDF || lancamentosFiltrados.length === 0}
              title={!projetoParaPDF ? t('relatorios.dicaPDF') : undefined}
            >
              {t('relatorios.exportarPDF')}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => exportarCSV(lancamentosFiltrados, sufixoCSV, t, idioma)}
              disabled={lancamentosFiltrados.length === 0}
            >
              {t('relatorios.exportarCSV')}
            </button>
          </div>
        )}
      </div>

      {/* Abas de visão */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {([
          { key: 'detalhado', label: t('relatorios.abaDetalhado') },
          { key: 'periodo', label: t('relatorios.abaPeriodo') },
        ] as { key: typeof visaoRelatorio; label: string }[]).map(tab => (
          <button key={tab.key} onClick={() => setVisaoRelatorio(tab.key)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            borderBottom: visaoRelatorio === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
            color: visaoRelatorio === tab.key ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 13, fontWeight: visaoRelatorio === tab.key ? 600 : 400,
            fontFamily: 'var(--font-ui)', cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {visaoRelatorio === 'periodo' && (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">{t('relatorios.inicioPeriodo')}</label>
                <DatePicker value={periodoRelInicio} onChange={setPeriodoRelInicio} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('relatorios.fimPeriodo')}</label>
                <DatePicker value={periodoRelFim} onChange={setPeriodoRelFim} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('comum.cliente')}</label>
                <select className="input" value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}>
                  <option value="">{t('relatorios.todosClientes')}</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="flex-center gap-8">
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('relatorios.atalhos')}</span>
              <button className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, color: periodoRelInicio === periodoAtual.inicio ? 'var(--accent)' : 'var(--text-muted)', background: periodoRelInicio === periodoAtual.inicio ? 'var(--accent-dim)' : 'transparent' }}
                onClick={() => { setPeriodoRelInicio(periodoAtual.inicio); setPeriodoRelFim(periodoAtual.fim) }}>
                {t('relatorios.periodoAtual', { inicio: fmtData(periodoAtual.inicio), fim: fmtData(periodoAtual.fim) })}
              </button>
              {(() => {
                const anterior = periodoApuracao(diaAnterior(periodoAtual.inicio))
                return (
                  <button className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12, color: periodoRelInicio === anterior.inicio ? 'var(--accent)' : 'var(--text-muted)', background: periodoRelInicio === anterior.inicio ? 'var(--accent-dim)' : 'transparent' }}
                    onClick={() => { setPeriodoRelInicio(anterior.inicio); setPeriodoRelFim(anterior.fim) }}>
                    {t('relatorios.periodoAnterior', { inicio: fmtData(anterior.inicio), fim: fmtData(anterior.fim) })}
                  </button>
                )
              })()}
            </div>
          </div>

          <div className="page-header" style={{ marginBottom: 16 }}>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {t('relatorios.projetosComHoras', { count: linhasPeriodoApuracao.length })}
            </p>
            <button
              className="btn btn-secondary"
              onClick={() => exportarPDFPeriodo(linhasPeriodoApuracao, periodoRelInicio, periodoRelFim, fmtData, t, idioma)}
              disabled={linhasPeriodoApuracao.length === 0}
            >
              {t('relatorios.exportarPDF')}
            </button>
          </div>

          {linhasPeriodoApuracao.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon">◧</div>
                <div>{t('relatorios.nenhumProjetoPeriodo')}</div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('comum.projeto')}</th>
                      <th className="hide-mobile" style={{ width: 140 }}>{t('comum.cliente')}</th>
                      <th style={{ width: 100 }}>{t('relatorios.historico')}</th>
                      <th className="hide-mobile" style={{ width: 100 }}>{t('relatorios.jaPago')}</th>
                      <th style={{ width: 100 }}>{t('relatorios.noPeriodo')}</th>
                      <th style={{ width: 120 }}>{t('relatorios.saldoAFaturar')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasPeriodoApuracao.map(l => (
                      <tr key={l.projeto.id} style={{ cursor: 'default' }}>
                        <td style={{ fontWeight: 500 }}>
                          {l.projeto.nome}
                          {l.projeto.consideradoPago && (
                            <span className="badge" style={{ background: 'var(--bg-3)', color: 'var(--text-muted)', fontSize: 10, marginLeft: 8 }}>
                              {t('relatorios.consideradoPago')}
                            </span>
                          )}
                        </td>
                        <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.cliente.nome}</td>
                        <td className="td-mono">{fmtDec(l.totalHistorico, 1)}h</td>
                        <td className="td-mono hide-mobile">{fmtDec(l.totalJaPago, 1)}h</td>
                        <td className="td-mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtDec(l.totalNoPeriodo, 1)}h</td>
                        <td className="td-mono" style={{ color: l.saldoAFaturar > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 600 }}>{fmtDec(l.saldoAFaturar, 1)}h</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('comum.total')}</td>
                      <td className="hide-mobile" />
                      <td className="td-mono" style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                        {fmtDec(somarHoras(linhasPeriodoApuracao.map(l => l.totalHistorico)), 1)}h
                      </td>
                      <td className="td-mono hide-mobile" style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
                        {fmtDec(somarHoras(linhasPeriodoApuracao.map(l => l.totalJaPago)), 1)}h
                      </td>
                      <td className="td-mono" style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                        {fmtDec(somarHoras(linhasPeriodoApuracao.map(l => l.totalNoPeriodo)), 1)}h
                      </td>
                      <td className="td-mono" style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--warning)' }}>
                        {fmtDec(somarHoras(linhasPeriodoApuracao.map(l => l.saldoAFaturar)), 1)}h
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {visaoRelatorio === 'detalhado' && (
      <>
      {/* Filtros */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">{t('comum.dataInicio')}</label>
            <DatePicker value={dataInicio} onChange={setDataInicio} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('comum.dataFim')}</label>
            <DatePicker value={dataFim} onChange={setDataFim} />
          </div>
          <div className="form-group">
            <label className="form-label">{t('comum.cliente')}</label>
            <select className="input" value={filtroCliente} onChange={e => { setFiltroCliente(e.target.value); setFiltroProjeto('') }}>
              <option value="">{t('relatorios.todosClientes')}</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('comum.projeto')}</label>
            <select className="input" value={filtroProjeto} onChange={e => setFiltroProjeto(e.target.value)} disabled={projetosFiltrados.length === 0}>
              <option value="">{t('relatorios.todosProjetos')}</option>
              {projetosFiltrados.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-between" style={{ flexWrap: 'wrap', rowGap: 8 }}>
          <div className="flex-center gap-8">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('relatorios.periodo')}</span>
            {[
              { label: t('relatorios.esteMes'), inicio: dataInicioMes(0) },
              { label: t('relatorios.ultimoMes'), inicio: dataInicioMes(1) },
              { label: t('relatorios.tresMeses'), inicio: dataInicioMes(3) },
              { label: t('relatorios.seisMeses'), inicio: dataInicioMes(6) },
            ].map(op => (
              <button key={op.label} className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, color: dataInicio === op.inicio ? 'var(--accent)' : 'var(--text-muted)', background: dataInicio === op.inicio ? 'var(--accent-dim)' : 'transparent' }}
                onClick={() => { setDataInicio(op.inicio); setDataFim(dataHoje()) }}>
                {op.label}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--text-muted)' }} onClick={limparFiltros}>
              {t('relatorios.limpar')}
            </button>
          </div>
          <div className="flex-center gap-8">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('relatorios.agruparPor')}</span>
            {(['cliente', 'projeto', 'escopo', 'dia'] as const).map(op => (
              <button key={op} className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, color: agrupamento === op ? 'var(--accent)' : 'var(--text-muted)', background: agrupamento === op ? 'var(--accent-dim)' : 'transparent' }}
                onClick={() => setAgrupamento(op)}>
                {t(ROTULO_AGRUPAMENTO[op])}
              </button>
            ))}
          </div>
        </div>
      </div>

      {lancamentosBase.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">◧</div>
            <div>{t('relatorios.nenhumNoPeriodo')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('relatorios.ajusteFiltros')}</div>
          </div>
        </div>
      ) : (
        <>
          {/* Cards resumo faturável x não faturável */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 24 }}>
            {/* Faturável */}
            <div style={{ background: 'var(--bg-2)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                {t('relatorios.faturavel')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: t('comum.hhmm'), value: decimalParaHHMM(totalDecimalFat) },
                  { label: t('comum.decimal'), value: fmtDec(totalDecimalFat) + 'h' },
                  { label: t('relatorios.valor'), value: totalValorFat > 0 ? fmtReais(totalValorFat) : '—' },
                ].map(m => (
                  <div key={m.label}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                {t('relatorios.resumoLancamentos', { count: lancamentosFat.length, projetos: new Set(lancamentosFat.map(l => l.projeto.id)).size })}
              </div>
            </div>

            {/* Não faturável */}
            <div style={{ background: 'var(--bg-2)', border: '1px solid color-mix(in srgb, var(--info) 20%, transparent)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                {t('relatorios.naoFaturavelPagos')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: t('comum.hhmm'), value: decimalParaHHMM(totalDecimalNaoFat) },
                  { label: t('comum.decimal'), value: fmtDec(totalDecimalNaoFat) + 'h' },
                  { label: t('relatorios.custo'), value: '—' },
                ].map(m => (
                  <div key={m.label}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--info)' }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                {t('relatorios.resumoLancamentos', { count: lancamentosNaoFat.length, projetos: new Set(lancamentosNaoFat.map(l => l.projeto.id)).size })}
              </div>
            </div>
          </div>

          {/* Abas */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            {([
              { key: 'todos', label: t('relatorios.abaTodos', { count: lancamentosBase.length }) },
              { key: 'faturavel', label: t('relatorios.abaFaturaveis', { count: lancamentosFat.length }) },
              { key: 'nao_faturavel', label: t('relatorios.abaNaoFaturaveis', { count: lancamentosNaoFat.length }) },
            ] as { key: VisualizacaoFaturavel; label: string }[]).map(tab => (
              <button key={tab.key} onClick={() => setVisualizacao(tab.key)} style={{
                padding: '8px 16px', background: 'transparent', border: 'none',
                borderBottom: visualizacao === tab.key
                  ? `2px solid ${tab.key === 'nao_faturavel' ? 'var(--info)' : 'var(--accent)'}`
                  : '2px solid transparent',
                color: visualizacao === tab.key
                  ? (tab.key === 'nao_faturavel' ? 'var(--info)' : 'var(--accent)')
                  : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: visualizacao === tab.key ? 600 : 400,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
                marginBottom: -1,
                transition: 'all 0.15s',
              }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Cards totais da aba atual */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
            {[
              { label: t('relatorios.totalHHMM'), value: decimalParaHHMM(totalDecimal) },
              { label: t('relatorios.totalDecimal'), value: fmtDec(totalDecimal) + 'h' },
              { label: t('comum.lancamentos'), value: String(lancamentosFiltrados.length) },
              { label: t('relatorios.valorFaturavel'), value: totalValor > 0 ? fmtReais(totalValor) : '—' },
            ].map(m => (
              <div key={m.label} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{m.label}</div>
                <div style={{
                  fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: visualizacao === 'nao_faturavel' ? 'var(--info)' : 'var(--accent)',
                  letterSpacing: '-0.02em',
                }}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          {/* Tabela agrupada */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              {t('relatorios.tituloAgrupado', { grupo: t(GRUPO_AGRUPAMENTO[agrupamento]) })}
            </h3>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{agrupamento === 'dia' ? t('comum.data') : agrupamento === 'cliente' ? t('comum.cliente') : agrupamento === 'escopo' ? t('relatorios.escopo') : t('comum.projeto')}</th>
                      {visualizacao === 'todos' && <th className="hide-mobile" style={{ width: 90 }}>{t('relatorios.faturavel')}</th>}
                      <th className="hide-mobile" style={{ width: 100 }}>{t('comum.lancamentos')}</th>
                      <th style={{ width: 100 }}>{t('comum.hhmm')}</th>
                      <th className="hide-mobile" style={{ width: 100 }}>{t('comum.decimal')}</th>
                      <th style={{ width: 140 }}>{t('comum.valorReais')}</th>
                      <th className="hide-mobile" style={{ width: 100 }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasAgrupadas.map((row, i) => {
                      const p = totalDecimal > 0 ? (row.totalDecimal / totalDecimal) * 100 : 0
                      return (
                        <tr key={i} style={{ cursor: 'default' }}>
                          <td style={{ fontWeight: 500 }}>{row.label}</td>
                          {visualizacao === 'todos' && (
                            <td className="hide-mobile">
                              {row.naoFaturavel
                                ? <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>{t('comum.nao')}</span>
                                : <span className="badge badge-ativo">{t('comum.sim')}</span>}
                            </td>
                          )}
                          <td className="td-mono hide-mobile">{row.qtdLancamentos}</td>
                          <td className="td-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.totalHHMM}</td>
                          <td className="td-mono hide-mobile">{fmtDec(row.totalDecimal)}</td>
                          <td className="td-mono" style={{ color: row.valorTotal ? 'var(--accent)' : 'var(--text-muted)' }}>
                            {row.valorTotal != null && row.valorTotal > 0 ? fmtReais(row.valorTotal) : '—'}
                          </td>
                          <td className="hide-mobile">
                            <div className="flex-center gap-8">
                              <div className="progress-bar" style={{ flex: 1, height: 3 }}>
                                <div className="progress-fill progress-ok" style={{ width: `${p}%` }} />
                              </div>
                              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: 32 }}>{p.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('comum.total')}</td>
                      {visualizacao === 'todos' && <td className="hide-mobile" />}
                      <td className="td-mono hide-mobile" style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>{lancamentosFiltrados.length}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{decimalParaHHMM(totalDecimal)}</td>
                      <td className="hide-mobile" style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{fmtDec(totalDecimal)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{totalValor > 0 ? fmtReais(totalValor) : '—'}</td>
                      <td className="hide-mobile" style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Tabela detalhada */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              {t('relatorios.detalhados')}
            </h3>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 88 }}>{t('comum.data')}</th>
                      <th className="hide-mobile" style={{ width: 120 }}>{t('comum.cliente')}</th>
                      <th style={{ width: 150 }}>{t('comum.projeto')}</th>
                      {visualizacao === 'todos' && <th className="hide-mobile" style={{ width: 80 }}>{t('relatorios.faturavel')}</th>}
                      <th>{t('comum.descricao')}</th>
                      <th className="hide-mobile" style={{ width: 110 }}>{t('relatorios.escopo')}</th>
                      <th className="hide-mobile" style={{ width: 68 }}>{t('comum.inicio')}</th>
                      <th className="hide-mobile" style={{ width: 68 }}>{t('comum.fim')}</th>
                      <th style={{ width: 76 }}>{t('comum.hhmm')}</th>
                      <th className="hide-mobile" style={{ width: 72 }}>{t('comum.decimal')}</th>
                      <th style={{ width: 120 }}>{t('comum.valorReais')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lancamentosFiltrados.map(l => {
                      const faturavel = !!l.faturavel
                      const valor = l.projeto.valorHora && l.totalDecimal
                        ? l.totalDecimal * l.projeto.valorHora
                        : null
                      return (
                        <tr key={l.id} style={{ cursor: 'default', opacity: faturavel ? 1 : 0.85 }}>
                          <td className="td-mono">{fmtData(l.data)}</td>
                          <td className="hide-mobile" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.cliente.nome}</td>
                          <td style={{ fontSize: 12, fontWeight: 500 }}>
                            {l.projeto.nome}
                            {!faturavel && (
                              <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--info)', background: 'color-mix(in srgb, var(--info) 10%, transparent)', padding: '1px 5px', borderRadius: 3 }}>
                                {t('relatorios.tagPago')}
                              </span>
                            )}
                          </td>
                          {visualizacao === 'todos' && (
                            <td className="hide-mobile">
                              {faturavel
                                ? <span className="badge badge-ativo">{t('comum.sim')}</span>
                                : <span className="badge" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>{t('comum.nao')}</span>}
                            </td>
                          )}
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.descricao || '—'}</td>
                          <td className="hide-mobile" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.escopoTitulo ?? '—'}</td>
                          <td className="td-mono hide-mobile">{l.horaInicio}</td>
                          <td className="td-mono hide-mobile">{l.horaFim ?? '—'}</td>
                          <td className="td-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.totalHHMM ?? '—'}</td>
                          <td className="td-mono hide-mobile">{l.totalDecimal != null ? fmtDec(l.totalDecimal) : '—'}</td>
                          <td className="td-mono" style={{ color: valor ? 'var(--accent)' : 'var(--text-muted)' }}>
                            {valor != null ? fmtReais(valor) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
      </>
      )}
    </div>
  )
}
