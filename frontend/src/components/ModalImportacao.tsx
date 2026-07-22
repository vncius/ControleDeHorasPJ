import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { importacaoApi } from '../services/api'
import Button from './Button'
import { useFormatarData } from '../contexts/PreferenciasContext'
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

function useStatusLabel() {
  const { t } = useTranslation()
  return (s: StatusLinhaImportacao) => {
    if (s === 'erro') return t('importacao.statusErro')
    if (s === 'aviso') return t('importacao.statusAviso')
    return t('importacao.statusValida')
  }
}

function statusBg(s: StatusLinhaImportacao) {
  if (s === 'erro') return 'color-mix(in srgb, var(--danger) 6%, transparent)'
  if (s === 'aviso') return 'color-mix(in srgb, var(--warning) 6%, transparent)'
  return 'transparent'
}

export default function ModalImportacao({ projetoId, toast, onImportado, onFechar }: Props) {
  const { t } = useTranslation()
  const { formatarData } = useFormatarData()
  const statusLabel = useStatusLabel()
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
    if (carregando) return
    if (!texto.trim()) { toast.error(t('importacao.coleTexto')); return }
    setCarregando(true)
    try {
      const resultado = await importacaoApi.preview(projetoId, texto, ano)
      setLinhas(resultado)
      setEtapa('preview')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('importacao.erroProcessar'))
    } finally {
      setCarregando(false)
    }
  }

  async function confirmar() {
    if (importando) return
    if (validas.length === 0) { toast.error(t('importacao.nenhumaValida')); return }
    setImportando(true)
    try {
      const criados = await importacaoApi.confirmar(projetoId, linhas)
      toast.success(t('importacao.sucesso', { count: criados.length }))
      onImportado()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('importacao.erroImportar'))
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
            <h2 className="modal-title">{t('importacao.titulo')}</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {etapa === 'colar' ? t('importacao.subtituloColar') : t('importacao.subtituloPreview', { count: linhas.length, validas: validas.length })}
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
                  <label className="form-label">{t('importacao.anoLabel')}</label>
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
                <label className="form-label">{t('importacao.dadosLabel')}</label>
                <textarea
                  className="input input-mono"
                  rows={10}
                  placeholder={t('importacao.placeholder', { exemplo: EXEMPLO })}
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
                <strong style={{ color: 'var(--text-secondary)' }}>{t('importacao.formatoTitulo')}</strong><br />
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {t('importacao.formatoColunas')}
                </span><br />
                {t('importacao.exemplo')} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>sex, 01/mai &nbsp; POC - Reunião &nbsp; 09:00 &nbsp; 10:30 &nbsp; 01:30 &nbsp; 1,50</span>
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={onFechar} disabled={carregando}>{t('comum.cancelar')}</button>
              <Button className="btn btn-primary" onClick={preview} disabled={!texto.trim()} loading={carregando}>
                {t('importacao.preVisualizar')}
              </Button>
            </div>
          </>
        )}

        {/* ── Etapa 2: preview ── */}
        {etapa === 'preview' && (
          <>
            {/* Resumo */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[
                { label: t('importacao.validas'), count: linhas.filter(l => l.status === 'valida').length, cor: 'var(--accent)' },
                { label: t('importacao.avisos'), count: avisos.length, cor: 'var(--warning)' },
                { label: t('importacao.erros'), count: erros.length, cor: 'var(--danger)' },
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
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 88 }}>{t('comum.data')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>{t('comum.descricao')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 60 }}>{t('comum.inicio')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 60 }}>{t('comum.fim')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 68 }}>{t('importacao.calculado')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', width: 80 }}>{t('comum.status')}</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--border)' }}>{t('importacao.mensagem')}</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.indice} style={{ background: statusBg(l.status), borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{l.indice}</td>
                      <td style={{ padding: '7px 10px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                        {l.data
                          ? formatarData(l.data)
                          : <span style={{ color: 'var(--danger)' }}>—</span>}
                      </td>
                      <td style={{ padding: '7px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.descricao || <span style={{ color: 'var(--text-muted)' }}>{t('comum.semDescricao')}</span>}
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
                background: 'color-mix(in srgb, var(--warning) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)',
                borderRadius: 'var(--radius)', padding: '10px 14px',
                marginBottom: 16,
              }}>
                {t('importacao.linhasComErro', { count: erros.length })}
                {validas.length === 0 && ` ${t('importacao.nenhumaImportavel')}`}
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setEtapa('colar')} disabled={importando}>{t('importacao.voltar')}</button>
              <Button
                className="btn btn-primary"
                onClick={confirmar}
                disabled={validas.length === 0}
                loading={importando}
              >
                {t('importacao.importarBtn', { count: validas.length })}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
