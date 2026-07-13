import { useState } from 'react'
import { importacaoApi } from '../services/api'
import type { LinhaImportacao, StatusLinhaImportacao } from '../types'
import type { ToastFns } from '../App'

interface Props {
  projetoId: string
  toast: ToastFns
  onImportado: () => void
  onFechar: () => void
}

const EXEMPLO = `sex, 01/mai\tPOC - Criando estrutura do projeto\t16:05\t18:44\t02:39\t2,65
seg, 04/mai\tPOC - Criando estrutura do projeto\t08:30\t15:20\t06:50\t6,83
ter, 05/mai\tPOC - Entendendo solução proposta\t07:45\t08:45\t01:00\t1,00`

type Etapa = 'colar' | 'preview'

function statusCor(s: StatusLinhaImportacao) {
  if (s === 'erro') return 'var(--danger)'
  if (s === 'aviso') return 'var(--warning)'
  return 'var(--accent)'
}

function statusLabel(s: StatusLinhaImportacao) {
  if (s === 'erro') return '✕ Erro'
  if (s === 'aviso') return '⚠ Aviso'
  return '✓ Válida'
}

function statusBg(s: StatusLinhaImportacao) {
  if (s === 'erro') return 'rgba(255,92,122,0.06)'
  if (s === 'aviso') return 'rgba(255,209,102,0.06)'
  return 'transparent'
}

export default function ModalImportacao({ projetoId, toast, onImportado, onFechar }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('colar')
  const [texto, setTexto] = useState('')
  const [ano, setAno] = useState(new Date().getFullYear())
  const [linhas, setLinhas] = useState<LinhaImportacao[]>([])
  const [carregando, setCarregando] = useState(false)
  const [importando, setImportando] = useState(false)

  const validas = linhas.filter(l => l.status !== 'erro')
  const erros = linhas.filter(l => l.status === 'erro')
  const avisos = linhas.filter(l => l.status === 'aviso')

  async function preview() {
    if (!texto.trim()) { toast.error('Cole o texto da planilha primeiro'); return }
    setCarregando(true)
    try {
      const resultado = await importacaoApi.preview(projetoId, texto, ano)
      setLinhas(resultado)
      setEtapa('preview')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao processar')
    } finally {
      setCarregando(false)
    }
  }

  async function confirmar() {
    if (validas.length === 0) { toast.error('Nenhuma linha válida para importar'); return }
    setImportando(true)
    try {
      const criados = await importacaoApi.confirmar(projetoId, linhas)
      toast.success(`${criados.length} lançamento${criados.length !== 1 ? 's' : ''} importado${criados.length !== 1 ? 's' : ''} com sucesso!`)
      onImportado()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao importar')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div
        className="modal"
        style={{ maxWidth: etapa === 'preview' ? 900 : 560, width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Importar lançamentos</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {etapa === 'colar' ? 'Cole as linhas da planilha abaixo' : `${linhas.length} linha${linhas.length !== 1 ? 's' : ''} processada${linhas.length !== 1 ? 's' : ''} — ${validas.length} importável${validas.length !== 1 ? 'is' : ''}`}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}>✕</button>
        </div>

        {/* ── Etapa 1: colar ── */}
        {etapa === 'colar' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ano de referência *</label>
                  <input
                    className="input input-mono"
                    type="number"
                    value={ano}
                    min={2000}
                    max={2100}
                    onChange={e => setAno(Number(e.target.value))}
                    style={{ maxWidth: 120 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Dados da planilha (cole aqui) *</label>
                <textarea
                  className="input input-mono"
                  rows={10}
                  placeholder={`Cole as linhas copiadas do Excel ou Google Sheets.\n\nExemplo:\n${EXEMPLO}`}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  style={{ fontSize: 12, lineHeight: 1.6 }}
                  autoFocus
                />
              </div>

              <div style={{
                background: 'var(--bg-3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.7,
              }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Formato esperado (colunas separadas por TAB):</strong><br />
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  Data &nbsp;·&nbsp; Descrição &nbsp;·&nbsp; Hora início &nbsp;·&nbsp; Hora fim &nbsp;·&nbsp; Total HH:MM &nbsp;·&nbsp; Total decimal
                </span><br />
                Exemplo: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>sex, 01/mai &nbsp; POC - Reunião &nbsp; 09:00 &nbsp; 10:30 &nbsp; 01:30 &nbsp; 1,50</span>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={onFechar}>Cancelar</button>
              <button className="btn btn-primary" onClick={preview} disabled={carregando || !texto.trim()}>
                {carregando ? 'Processando...' : '→ Pré-visualizar'}
              </button>
            </div>
          </>
        )}

        {/* ── Etapa 2: preview ── */}
        {etapa === 'preview' && (
          <>
            {/* Resumo */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Válidas', count: linhas.filter(l => l.status === 'valida').length, cor: 'var(--accent)' },
                { label: 'Avisos', count: avisos.length, cor: 'var(--warning)' },
                { label: 'Erros', count: erros.length, cor: 'var(--danger)' },
              ].map(m => (
                <div key={m.label} style={{
                  flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '10px 14px', textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: m.cor }}>{m.count}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* Tabela */}
            <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 28 }}>#</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 88 }}>Data</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>Descrição</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 60 }}>Início</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 60 }}>Fim</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 68 }}>Calculado</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 80 }}>Status</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.indice} style={{ background: statusBg(l.status), borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{l.indice}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {l.data
                          ? new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : <span style={{ color: 'var(--danger)' }}>—</span>}
                      </td>
                      <td style={{ padding: '7px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.descricao || <span style={{ color: 'var(--text-muted)' }}>sem descrição</span>}
                      </td>
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.horaInicio ?? '—'}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{l.horaFim ?? '—'}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {l.totalHHMMCalculado ?? '—'}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                          color: statusCor(l.status),
                        }}>
                          {statusLabel(l.status)}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', fontSize: 11, color: statusCor(l.status), maxWidth: 220 }}>
                        {l.mensagem ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {erros.length > 0 && (
              <div style={{
                fontSize: 12, color: 'var(--warning)',
                background: 'rgba(255,209,102,0.06)',
                border: '1px solid rgba(255,209,102,0.2)',
                borderRadius: 'var(--radius)', padding: '10px 14px',
                marginBottom: 16,
              }}>
                ⚠ {erros.length} linha{erros.length !== 1 ? 's' : ''} com erro {erros.length !== 1 ? 'serão ignoradas' : 'será ignorada'} na importação.
                {validas.length === 0 && ' Nenhuma linha pode ser importada.'}
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setEtapa('colar')}>← Voltar</button>
              <button
                className="btn btn-primary"
                onClick={confirmar}
                disabled={importando || validas.length === 0}
              >
                {importando ? 'Importando...' : `↓ Importar ${validas.length} lançamento${validas.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
