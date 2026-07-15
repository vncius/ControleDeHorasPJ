import { useEffect, useState, useMemo } from 'react'
import { clientesApi, projetosApi, lancamentosApi } from '../services/api'
import { dataLocalISO, hojeLocal } from '../utils/tempo'
import type { Cliente, Projeto, LancamentoHoras } from '../types'

interface LancamentoEnriquecido extends LancamentoHoras {
  projeto: Projeto
  cliente: Cliente
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

function fmtReais(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
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

function exportarCSV(lancamentos: LancamentoEnriquecido[], sufixo = '') {
  const cab = ['Data', 'Cliente', 'Projeto', 'Faturável', 'Descrição', 'Início', 'Fim', 'HH:MM', 'Decimal', 'Tipo', 'Valor (R$)']
  const linhas = lancamentos.map(l => [
    fmtData(l.data),
    l.cliente.nome,
    l.projeto.nome,
    l.faturavel ? 'Sim' : 'Não',
    `"${l.descricao.replace(/"/g, '""')}"`,
    l.horaInicio,
    l.horaFim ?? '',
    l.totalHHMM ?? '',
    (l.totalDecimal ?? 0).toFixed(2).replace('.', ','),
    l.tipo,
    l.projeto.valorHora
      ? ((l.totalDecimal ?? 0) * l.projeto.valorHora).toFixed(2).replace('.', ',')
      : '',
  ])
  const csv = [cab, ...linhas].map(r => r.join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `relatorio-horas${sufixo}-${dataHoje()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type VisualizacaoFaturavel = 'todos' | 'faturavel' | 'nao_faturavel'

export default function Relatorios() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [todosLancamentos, setTodosLancamentos] = useState<LancamentoEnriquecido[]>([])
  const [loading, setLoading] = useState(true)
  const [dataInicio, setDataInicio] = useState(dataInicioMes(1))
  const [dataFim, setDataFim] = useState(dataHoje())
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroProjeto, setFiltroProjeto] = useState('')
  const [agrupamento, setAgrupamento] = useState<'cliente' | 'projeto' | 'dia'>('projeto')
  const [visualizacao, setVisualizacao] = useState<VisualizacaoFaturavel>('todos')

  useEffect(() => {
    async function carregar() {
      try {
        const [cs, ps] = await Promise.all([clientesApi.listar(), projetosApi.listar()])
        setClientes(cs)
        setProjetos(ps)
        const resultados = await Promise.all(ps.map(p => lancamentosApi.listarPorProjeto(p.id)))
        const enriquecidos: LancamentoEnriquecido[] = []
        resultados.forEach((lista, i) => {
          const projeto = ps[i]
          const cliente = cs.find(c => c.id === projeto.clienteId)
          if (!cliente) return
          lista.filter(l => l.horaFim).forEach(l => enriquecidos.push({ ...l, projeto, cliente }))
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

  const totalDecimal = useMemo(
    () => lancamentosFiltrados.reduce((a, l) => a + (l.totalDecimal ?? 0), 0),
    [lancamentosFiltrados]
  )
  const totalDecimalFat = useMemo(
    () => lancamentosFat.reduce((a, l) => a + (l.totalDecimal ?? 0), 0),
    [lancamentosFat]
  )
  const totalDecimalNaoFat = useMemo(
    () => lancamentosNaoFat.reduce((a, l) => a + (l.totalDecimal ?? 0), 0),
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
  }, [lancamentosFiltrados, agrupamento])

  function limparFiltros() {
    setDataInicio(dataInicioMes(1))
    setDataFim(dataHoje())
    setFiltroCliente('')
    setFiltroProjeto('')
  }

  const sufixoCSV = visualizacao === 'faturavel'
    ? '-faturavel'
    : visualizacao === 'nao_faturavel' ? '-nao-faturavel' : ''

  if (loading) return (
    <div className="loading-screen"><div className="spinner" /><span>Carregando dados...</span></div>
  )

  return (
    <div style={{ animation: 'slideUp 0.25s ease' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">
            {lancamentosFiltrados.length} lançamento{lancamentosFiltrados.length !== 1 ? 's' : ''} no período
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => exportarCSV(lancamentosFiltrados, sufixoCSV)}
          disabled={lancamentosFiltrados.length === 0}
        >
          ↓ Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">Data início</label>
            <input className="input input-mono" type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Data fim</label>
            <input className="input input-mono" type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Cliente</label>
            <select className="input" value={filtroCliente} onChange={e => { setFiltroCliente(e.target.value); setFiltroProjeto('') }}>
              <option value="">Todos os clientes</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Projeto</label>
            <select className="input" value={filtroProjeto} onChange={e => setFiltroProjeto(e.target.value)} disabled={projetosFiltrados.length === 0}>
              <option value="">Todos os projetos</option>
              {projetosFiltrados.map(p => (
                <option key={p.id} value={p.id}>{p.nome}{p.pago ? ' ✓ pago' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-between">
          <div className="flex-center gap-8">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Período:</span>
            {[
              { label: 'Este mês', inicio: dataInicioMes(0) },
              { label: 'Último mês', inicio: dataInicioMes(1) },
              { label: '3 meses', inicio: dataInicioMes(3) },
              { label: '6 meses', inicio: dataInicioMes(6) },
            ].map(op => (
              <button key={op.label} className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, color: dataInicio === op.inicio ? 'var(--accent)' : 'var(--text-muted)', background: dataInicio === op.inicio ? 'var(--accent-dim)' : 'transparent' }}
                onClick={() => { setDataInicio(op.inicio); setDataFim(dataHoje()) }}>
                {op.label}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: 'var(--text-muted)' }} onClick={limparFiltros}>
              ✕ Limpar
            </button>
          </div>
          <div className="flex-center gap-8">
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Agrupar por:</span>
            {(['cliente', 'projeto', 'dia'] as const).map(op => (
              <button key={op} className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, color: agrupamento === op ? 'var(--accent)' : 'var(--text-muted)', background: agrupamento === op ? 'var(--accent-dim)' : 'transparent' }}
                onClick={() => setAgrupamento(op)}>
                {op.charAt(0).toUpperCase() + op.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {lancamentosBase.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">◧</div>
            <div>Nenhum lançamento no período selecionado</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Ajuste os filtros de data ou cliente</div>
          </div>
        </div>
      ) : (
        <>
          {/* Cards resumo faturável x não faturável */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Faturável */}
            <div style={{ background: 'var(--bg-2)', border: '1px solid rgba(168,255,62,0.2)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                Faturável
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'HH:MM', value: decimalParaHHMM(totalDecimalFat) },
                  { label: 'Decimal', value: totalDecimalFat.toFixed(2).replace('.', ',') + 'h' },
                  { label: 'Valor', value: totalValorFat > 0 ? fmtReais(totalValorFat) : '—' },
                ].map(m => (
                  <div key={m.label}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                {lancamentosFat.length} lançamento{lancamentosFat.length !== 1 ? 's' : ''} em {new Set(lancamentosFat.map(l => l.projeto.id)).size} projeto{new Set(lancamentosFat.map(l => l.projeto.id)).size !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Não faturável */}
            <div style={{ background: 'var(--bg-2)', border: '1px solid rgba(92,200,255,0.2)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                Não faturável (projetos pagos)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'HH:MM', value: decimalParaHHMM(totalDecimalNaoFat) },
                  { label: 'Decimal', value: totalDecimalNaoFat.toFixed(2).replace('.', ',') + 'h' },
                  { label: 'Custo', value: '—' },
                ].map(m => (
                  <div key={m.label}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--info)' }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                {lancamentosNaoFat.length} lançamento{lancamentosNaoFat.length !== 1 ? 's' : ''} em {new Set(lancamentosNaoFat.map(l => l.projeto.id)).size} projeto{new Set(lancamentosNaoFat.map(l => l.projeto.id)).size !== 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Abas */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            {([
              { key: 'todos', label: `Todos (${lancamentosBase.length})` },
              { key: 'faturavel', label: `Faturáveis (${lancamentosFat.length})` },
              { key: 'nao_faturavel', label: `Não faturáveis (${lancamentosNaoFat.length})` },
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Total HH:MM', value: decimalParaHHMM(totalDecimal) },
              { label: 'Total decimal', value: totalDecimal.toFixed(2).replace('.', ',') + 'h' },
              { label: 'Lançamentos', value: String(lancamentosFiltrados.length) },
              { label: 'Valor faturável', value: totalValor > 0 ? fmtReais(totalValor) : '—' },
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
              Por {agrupamento === 'dia' ? 'dia' : agrupamento}
            </h3>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table>
                <thead>
                  <tr>
                    <th>{agrupamento === 'dia' ? 'Data' : agrupamento === 'cliente' ? 'Cliente' : 'Projeto'}</th>
                    {visualizacao === 'todos' && <th style={{ width: 90 }}>Faturável</th>}
                    <th style={{ width: 100 }}>Lançamentos</th>
                    <th style={{ width: 100 }}>HH:MM</th>
                    <th style={{ width: 100 }}>Decimal</th>
                    <th style={{ width: 140 }}>Valor (R$)</th>
                    <th style={{ width: 100 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasAgrupadas.map((row, i) => {
                    const p = totalDecimal > 0 ? (row.totalDecimal / totalDecimal) * 100 : 0
                    return (
                      <tr key={i} style={{ cursor: 'default' }}>
                        <td style={{ fontWeight: 500 }}>{row.label}</td>
                        {visualizacao === 'todos' && (
                          <td>
                            {row.naoFaturavel
                              ? <span className="badge" style={{ background: 'rgba(92,200,255,0.12)', color: 'var(--info)' }}>Não</span>
                              : <span className="badge badge-ativo">Sim</span>}
                          </td>
                        )}
                        <td className="td-mono">{row.qtdLancamentos}</td>
                        <td className="td-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{row.totalHHMM}</td>
                        <td className="td-mono">{row.totalDecimal.toFixed(2).replace('.', ',')}</td>
                        <td className="td-mono" style={{ color: row.valorTotal ? 'var(--accent)' : 'var(--text-muted)' }}>
                          {row.valorTotal != null && row.valorTotal > 0 ? fmtReais(row.valorTotal) : '—'}
                        </td>
                        <td>
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
                    <td colSpan={visualizacao === 'todos' ? 2 : 1} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>{lancamentosFiltrados.length}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{decimalParaHHMM(totalDecimal)}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{totalDecimal.toFixed(2).replace('.', ',')}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{totalValor > 0 ? fmtReais(totalValor) : '—'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tabela detalhada */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              Lançamentos detalhados
            </h3>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 88 }}>Data</th>
                      <th style={{ width: 120 }}>Cliente</th>
                      <th style={{ width: 150 }}>Projeto</th>
                      {visualizacao === 'todos' && <th style={{ width: 80 }}>Faturável</th>}
                      <th>Descrição</th>
                      <th style={{ width: 68 }}>Início</th>
                      <th style={{ width: 68 }}>Fim</th>
                      <th style={{ width: 76 }}>HH:MM</th>
                      <th style={{ width: 72 }}>Decimal</th>
                      <th style={{ width: 120 }}>Valor (R$)</th>
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
                          <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{l.cliente.nome}</td>
                          <td style={{ fontSize: 12, fontWeight: 500 }}>
                            {l.projeto.nome}
                            {!faturavel && (
                              <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--info)', background: 'rgba(92,200,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>
                                pago
                              </span>
                            )}
                          </td>
                          {visualizacao === 'todos' && (
                            <td>
                              {faturavel
                                ? <span className="badge badge-ativo">Sim</span>
                                : <span className="badge" style={{ background: 'rgba(92,200,255,0.12)', color: 'var(--info)' }}>Não</span>}
                            </td>
                          )}
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.descricao || '—'}</td>
                          <td className="td-mono">{l.horaInicio}</td>
                          <td className="td-mono">{l.horaFim ?? '—'}</td>
                          <td className="td-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.totalHHMM ?? '—'}</td>
                          <td className="td-mono">{l.totalDecimal != null ? l.totalDecimal.toFixed(2).replace('.', ',') : '—'}</td>
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
    </div>
  )
}
