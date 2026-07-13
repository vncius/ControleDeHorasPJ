import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardApi, lancamentosApi } from '../services/api'
import type { DashboardData, ResumoProjeto } from '../types'
import type { ToastFns } from '../App'

function fmt(h: number) { return h.toFixed(1).replace('.', ',') + 'h' }
function pct(v: number) { return Math.min(v, 100) }
function progressClass(p: number) {
  if (p >= 90) return 'progress-danger'
  if (p >= 75) return 'progress-warning'
  return 'progress-ok'
}
function fmtData(iso?: string) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Props { toast: ToastFns }

// ── Card de projeto reutilizável ─────────────────────────────────
function CardProjeto({ r, pago, onClick }: { r: ResumoProjeto; pago?: boolean; onClick: () => void }) {
  return (
    <div
      className="card"
      style={{
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        padding: '16px 20px',
        borderColor: pago ? 'rgba(92,200,255,0.2)' : 'var(--border)',
      }}
      onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.borderColor = pago ? 'rgba(92,200,255,0.4)' : 'var(--border-light)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = pago ? 'rgba(92,200,255,0.2)' : 'var(--border)')}
    >
      <div className="flex-between" style={{ marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{r.projeto.nome}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.cliente.nome}</div>
        </div>
        {!r.horasAbertas && !pago && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: r.saldo < 0 ? 'var(--danger)' : 'var(--accent)', fontWeight: 600 }}>
              {r.saldo >= 0 ? '+' : ''}{r.saldo.toFixed(1)}h
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>saldo</div>
          </div>
        )}
        {pago && (
          <span className="badge" style={{ background: 'rgba(92,200,255,0.12)', color: 'var(--info)' }}>✓ Pago</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
        {fmtData(r.projeto.dataInicio)}
        {r.projeto.dataFim ? ` → ${fmtData(r.projeto.dataFim)}` : ' → em andamento'}
      </div>
      {r.horasAbertas ? (
        <div className="flex-between">
          <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>∞ horas em aberto</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {r.totalTrabalhado.toFixed(1)}h trabalhadas
          </span>
        </div>
      ) : (
        <>
          <div className="flex-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {r.totalTrabalhado.toFixed(1)}h / {r.totalDisponivel.toFixed(1)}h
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: r.percentualConsumido >= 90 ? 'var(--danger)' : r.percentualConsumido >= 75 ? 'var(--warning)' : 'var(--text-secondary)' }}>
              {r.percentualConsumido.toFixed(0)}%
            </span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-fill ${pago ? '' : progressClass(r.percentualConsumido)}`}
              style={{ width: `${pct(r.percentualConsumido)}%`, background: pago ? 'var(--info)' : undefined }}
            />
          </div>
        </>
      )}
      {r.emAndamento && (
        <div className="flex-center gap-4" style={{ marginTop: 8 }}>
          <div className="pulse-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>em andamento</span>
        </div>
      )}
    </div>
  )
}

// ── Seção de projetos com filtro ─────────────────────────────────
function SecaoProjetos({
  titulo, projetos, pago, cor, nav,
}: {
  titulo: string
  projetos: ResumoProjeto[]
  pago?: boolean
  cor: string
  nav: (path: string) => void
}) {
  const [busca, setBusca] = useState('')
  const filtrados = projetos.filter(r =>
    !busca ||
    r.projeto.nome.toLowerCase().includes(busca.toLowerCase()) ||
    r.cliente.nome.toLowerCase().includes(busca.toLowerCase())
  )
  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: cor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {titulo}
          <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 4 }}>
            {projetos.length}
          </span>
        </h2>
        <input
          className="input"
          placeholder="Filtrar..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ width: 140, padding: '5px 10px', fontSize: 12 }}
        />
      </div>
      {filtrados.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '24px' }}>
            <div>{busca ? 'Nenhum projeto encontrado' : 'Nenhum projeto nesta seção'}</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(r => (
            <CardProjeto key={r.projeto.id} r={r} pago={pago} onClick={() => nav(`/projetos/${r.projeto.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dashboard principal ──────────────────────────────────────────
export default function Dashboard({ toast }: Props) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [finalizando, setFinalizando] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nav = useNavigate()

  async function carregar(silencioso = false) {
    try { setData(await dashboardApi.obter()) }
    catch { if (!silencioso) toast.error('Erro ao carregar dashboard') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    carregar()
    intervalRef.current = setInterval(() => carregar(true), 60000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  async function handleFinalizar() {
    if (!data?.lancamentoEmAndamento) return
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    setFinalizando(true)
    try {
      await lancamentosApi.finalizar(data.lancamentoEmAndamento.id, { horaFim: `${hh}:${mm}` })
      toast.success('Trabalho finalizado!')
      carregar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao finalizar')
    } finally { setFinalizando(false) }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Carregando...</span></div>
  if (!data) return null

  const temProjetosPagos = data.resumosProjetosPagos.length > 0
  const temHorasPagas = data.horasHojePago > 0 || data.horasSemanaPago > 0 || data.horasMesPago > 0

  return (
    <div style={{ animation: 'slideUp 0.25s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Atualização automática a cada minuto</p>
        </div>
        <button className="btn btn-secondary" onClick={() => carregar()}>↻ Atualizar</button>
      </div>

      {/* Lançamento em andamento */}
      {data.lancamentoEmAndamento && (
        <div style={{
          background: 'var(--accent-dim)', border: '1px solid rgba(168,255,62,0.3)',
          borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div className="flex-center gap-12">
            <div className="pulse-dot" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Trabalho em andamento</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                {data.lancamentoEmAndamento.projeto.nome} · {data.lancamentoEmAndamento.cliente.nome}
                &nbsp;· Iniciado às {data.lancamentoEmAndamento.horaInicio}
                {data.lancamentoEmAndamento.projeto.pago && (
                  <span style={{ marginLeft: 8, color: 'var(--info)' }}>[pago]</span>
                )}
              </div>
              {data.lancamentoEmAndamento.descricao && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{data.lancamentoEmAndamento.descricao}</div>
              )}
            </div>
          </div>
          <div className="flex-center gap-8">
            <button className="btn btn-secondary btn-sm" onClick={() => nav(`/projetos/${data.lancamentoEmAndamento!.projetoId}`)}>Ver projeto</button>
            <button className="btn btn-primary btn-sm" onClick={handleFinalizar} disabled={finalizando}>
              {finalizando ? '...' : '⏹ Finalizar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Cards faturáveis ── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Horas faturáveis
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: temHorasPagas ? 24 : 32 }}>
          {[
            { label: 'Hoje', value: fmt(data.horasHoje), sub: data.lancamentoEmAndamento && !data.lancamentoEmAndamento.projeto.pago ? 'inclui tempo em aberto' : 'horas finalizadas' },
            { label: 'Semana', value: fmt(data.horasSemana), sub: 'horas faturáveis' },
            { label: 'Mês', value: fmt(data.horasMes), sub: 'horas faturáveis' },
            { label: 'Projetos', value: data.resumosProjetos.length, sub: 'faturáveis ativos' },
          ].map(m => (
            <div key={m.label} className="card" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{m.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '-0.02em', marginBottom: 4 }}>{m.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cards não faturáveis (apenas se houver) ── */}
      {(temHorasPagas || temProjetosPagos) && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--info)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Horas em projetos pagos (não faturáveis)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[
              { label: 'Hoje', value: fmt(data.horasHojePago), sub: 'não faturável' },
              { label: 'Semana', value: fmt(data.horasSemanaPago), sub: 'não faturável' },
              { label: 'Mês', value: fmt(data.horasMesPago), sub: 'não faturável' },
              { label: 'Projetos', value: data.resumosProjetosPagos.length, sub: 'pagos em andamento' },
            ].map(m => (
              <div key={m.label} className="card" style={{ padding: '20px 24px', borderColor: 'rgba(92,200,255,0.2)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{m.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--info)', letterSpacing: '-0.02em', marginBottom: 4 }}>{m.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Listas de projetos ── */}
      <div style={{ display: 'grid', gridTemplateColumns: temProjetosPagos ? '1fr 1fr' : '1fr 1fr', gap: 24 }}>
        {/* Faturáveis */}
        <SecaoProjetos
          titulo="Projetos faturáveis"
          projetos={data.resumosProjetos}
          cor="var(--text-secondary)"
          nav={nav}
        />

        {/* Direita: Alertas OU Pagos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Alertas */}
          {data.projetosProximosLimite.length > 0 && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Atenção — Próximos do Limite
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.projetosProximosLimite.map(r => (
                  <div
                    key={r.projeto.id}
                    className="card"
                    style={{ cursor: 'pointer', borderColor: r.percentualConsumido >= 100 ? 'rgba(255,92,122,0.4)' : 'rgba(255,209,102,0.3)', padding: '16px 20px' }}
                    onClick={() => nav(`/projetos/${r.projeto.id}`)}
                  >
                    <div className="flex-between" style={{ marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.projeto.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.cliente.nome}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: r.percentualConsumido >= 100 ? 'var(--danger)' : 'var(--warning)' }}>
                        {r.percentualConsumido.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {r.totalTrabalhado.toFixed(1)}h de {r.totalDisponivel.toFixed(1)}h
                      {r.saldo < 0 && <span style={{ color: 'var(--danger)' }}> · {Math.abs(r.saldo).toFixed(1)}h excedidas</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projetos pagos */}
          {temProjetosPagos && (
            <SecaoProjetos
              titulo="Pagos — em andamento"
              projetos={data.resumosProjetosPagos}
              pago
              cor="var(--info)"
              nav={nav}
            />
          )}

          {/* Estado vazio */}
          {data.projetosProximosLimite.length === 0 && !temProjetosPagos && (
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Atenção — Próximos do Limite
              </h2>
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon" style={{ fontSize: 24 }}>✓</div>
                  <div style={{ color: 'var(--text-secondary)' }}>Todos os projetos estão dentro do limite</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
