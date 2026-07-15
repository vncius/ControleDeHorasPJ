import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { lancamentosApi } from '../services/api'
import { hojeLocal } from '../utils/tempo'
import type { LancamentoHoras, TipoLancamento, AlteracaoEscopo } from '../types'
import type { ToastFns } from '../App'

interface Props {
  projetoId: string
  lancamentos: LancamentoHoras[]
  escopos: AlteracaoEscopo[]
  toast: ToastFns
  onAtualizar: () => void
}

interface FormEdicao {
  data: string
  horaInicio: string
  horaFim: string
  descricao: string
  tipo: TipoLancamento
  escopoId: string
}

const TIPO_BADGE: Record<TipoLancamento, string> = {
  Automatico: '⏱',
  Manual: '✎',
  Ajuste: '⚙',
  Importado: '↓',
}

const TIPO_I18N_KEY: Record<TipoLancamento, string> = {
  Automatico: 'tipoLanc.Automatico',
  Manual: 'tipoLanc.Manual',
  Ajuste: 'tipoLanc.Ajuste',
  Importado: 'tipoLanc.Importado',
}

function BadgeTipo({ tipo }: { tipo: TipoLancamento }) {
  const { t } = useTranslation()
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 4 }}>
      {TIPO_BADGE[tipo]} {t(TIPO_I18N_KEY[tipo])}
    </span>
  )
}

// ── Modal lançamento manual ──────────────────────────────────────

interface ModalManualProps {
  projetoId: string
  escopos: AlteracaoEscopo[]
  toast: ToastFns
  onSalvar: () => void
  onFechar: () => void
}

function ModalLancamentoManual({ projetoId, escopos, toast, onSalvar, onFechar }: ModalManualProps) {
  const { t } = useTranslation()
  const hoje = hojeLocal()
  const [form, setForm] = useState<FormEdicao>({
    data: hoje, horaInicio: '', horaFim: '', descricao: '', tipo: 'Manual', escopoId: '',
  })
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!form.horaInicio) { toast.error(t('lanc.horaInicioObrigatoria')); return }
    setSalvando(true)
    try {
      await lancamentosApi.criar({
        projetoId,
        escopoId: form.escopoId || undefined,
        data: form.data,
        horaInicio: form.horaInicio,
        horaFim: form.horaFim || undefined,
        descricao: form.descricao,
        tipo: form.tipo,
      })
      toast.success(t('lanc.criado'))
      onSalvar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('comum.erroSalvar'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('lanc.modalTitulo')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('lanc.dataLabel')}</label>
              <input className="input input-mono" type="date" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('comum.tipo')}</label>
              <select className="input" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoLancamento }))}>
                <option value="Manual">{t('tipoLanc.Manual')}</option>
                <option value="Ajuste">{t('tipoLanc.Ajuste')}</option>
                <option value="Automatico">{t('tipoLanc.Automatico')}</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('lanc.horaInicioLabel')}</label>
              <input className="input input-mono" type="time" value={form.horaInicio}
                onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">{t('comum.horaFim')}</label>
              <input className="input input-mono" type="time" value={form.horaFim}
                onChange={e => setForm(f => ({ ...f, horaFim: e.target.value }))} />
            </div>
          </div>
          {escopos.length > 0 && (
            <div className="form-group">
              <label className="form-label">{t('lanc.associarEscopo')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{t('comum.opcional')}</span></label>
              <select className="input" value={form.escopoId}
                onChange={e => setForm(f => ({ ...f, escopoId: e.target.value }))}>
                <option value="">{t('lanc.escopoPrincipal')}</option>
                {escopos.filter(e => e.status === 'Aprovada').map(e => (
                  <option key={e.id} value={e.id}>{e.titulo} (+{e.horasAdicionais.toFixed(1)}h)</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{t('comum.descricao')}</label>
            <textarea className="input" rows={3} placeholder={t('lanc.oQueFoiFeito')}
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={onFechar}>{t('comum.cancelar')}</button>
          <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
            {salvando ? t('comum.salvando') : t('lanc.salvarBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Linha editável ───────────────────────────────────────────────

interface LinhaProps {
  lancamento: LancamentoHoras
  escopos: AlteracaoEscopo[]
  toast: ToastFns
  onAtualizar: () => void
}

function LinhaLancamento({ lancamento, escopos, toast, onAtualizar }: LinhaProps) {
  const { t, i18n } = useTranslation()
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<FormEdicao>({
    data: lancamento.data,
    horaInicio: lancamento.horaInicio,
    horaFim: lancamento.horaFim ?? '',
    descricao: lancamento.descricao,
    tipo: lancamento.tipo,
    escopoId: lancamento.escopoId ?? '',
  })
  const [salvando, setSalvando] = useState(false)

  function cancelar() {
    setForm({
      data: lancamento.data, horaInicio: lancamento.horaInicio, horaFim: lancamento.horaFim ?? '',
      descricao: lancamento.descricao, tipo: lancamento.tipo, escopoId: lancamento.escopoId ?? '',
    })
    setEditando(false)
  }

  async function salvar() {
    setSalvando(true)
    try {
      await lancamentosApi.atualizar(lancamento.id, {
        data: form.data,
        horaInicio: form.horaInicio,
        horaFim: form.horaFim || undefined,
        descricao: form.descricao,
        tipo: form.tipo,
        escopoId: form.escopoId || null,
      })
      toast.success(t('lanc.atualizado'))
      setEditando(false)
      onAtualizar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('comum.erroSalvar'))
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(t('lanc.confirmarExclusao'))) return
    try {
      await lancamentosApi.excluir(lancamento.id)
      toast.success(t('lanc.excluido'))
      onAtualizar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('comum.erroExcluir'))
    }
  }

  async function duplicar(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await lancamentosApi.duplicar(lancamento.id)
      toast.success(t('lanc.duplicado'))
      onAtualizar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('lanc.erroDuplicar'))
    }
  }

  const escopoNome = escopos.find(e => e.id === lancamento.escopoId)?.titulo
  const emAndamento = !lancamento.horaFim

  if (editando) {
    return (
      <tr style={{ background: 'var(--bg-3)' }}>
        <td><input className="input input-mono" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={{ padding: '5px 8px', fontSize: 12 }} /></td>
        <td><input className="input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder={`${t('comum.descricao')}...`} style={{ padding: '5px 8px', fontSize: 12 }} autoFocus /></td>
        <td><input className="input input-mono" type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))} style={{ padding: '5px 8px', fontSize: 12, width: 90 }} /></td>
        <td><input className="input input-mono" type="time" value={form.horaFim} onChange={e => setForm(f => ({ ...f, horaFim: e.target.value }))} style={{ padding: '5px 8px', fontSize: 12, width: 90 }} /></td>
        <td className="td-mono">—</td>
        <td className="td-mono hide-mobile">—</td>
        <td className="hide-mobile">
          <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoLancamento }))} style={{ padding: '5px 8px', fontSize: 12 }}>
            <option value="Automatico">{t('tipoLanc.Automatico')}</option>
            <option value="Manual">{t('tipoLanc.Manual')}</option>
            <option value="Ajuste">{t('tipoLanc.Ajuste')}</option>
          </select>
        </td>
        <td className="hide-mobile">
          {escopos.length > 0 && (
            <select className="input" value={form.escopoId} onChange={e => setForm(f => ({ ...f, escopoId: e.target.value }))} style={{ padding: '5px 8px', fontSize: 11 }}>
              <option value="">{t('lanc.principal')}</option>
              {escopos.filter(e => e.status === 'Aprovada').map(e => (
                <option key={e.id} value={e.id}>{e.titulo}</option>
              ))}
            </select>
          )}
        </td>
        <td onClick={e => e.stopPropagation()}>
          <div className="flex-center gap-4">
            <button className="btn btn-primary btn-sm" onClick={salvar} disabled={salvando}>{salvando ? '...' : '✓'}</button>
            <button className="btn btn-ghost btn-sm" onClick={cancelar}>✕</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr onClick={() => setEditando(true)} style={{ opacity: emAndamento ? 0.8 : 1 }}>
      <td className="td-mono">
        {new Date(lancamento.data + 'T00:00:00').toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit' })}
      </td>
      <td style={{ maxWidth: 220 }}>
        <div style={{ fontSize: 13, color: emAndamento ? 'var(--accent)' : 'var(--text-primary)' }}>
          {lancamento.descricao || <span style={{ color: 'var(--text-muted)' }}>{t('comum.semDescricao')}</span>}
        </div>
        {escopoNome && (
          <div style={{ fontSize: 10, color: 'var(--info)', fontFamily: 'var(--font-mono)', marginTop: 2, background: 'var(--info-bg)', display: 'inline-block', padding: '1px 5px', borderRadius: 3 }}>
            ⊕ {escopoNome}
          </div>
        )}
        {emAndamento && (
          <div className="flex-center gap-4" style={{ marginTop: 4 }}>
            <div className="pulse-dot" style={{ width: 6, height: 6 }} />
            <span style={{ fontSize: 11, color: 'var(--accent)' }}>{t('comum.emAndamento')}</span>
          </div>
        )}
      </td>
      <td className="td-mono">{lancamento.horaInicio}</td>
      <td className="td-mono">{lancamento.horaFim ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
      <td className="td-mono" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{lancamento.totalHHMM ?? '—'}</td>
      <td className="td-mono hide-mobile">{lancamento.totalDecimal != null ? lancamento.totalDecimal.toFixed(2).replace('.', ',') : '—'}</td>
      <td className="hide-mobile"><BadgeTipo tipo={lancamento.tipo} /></td>
      <td className="hide-mobile" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {escopoNome ? escopoNome.substring(0, 14) + (escopoNome.length > 14 ? '…' : '') : '—'}
      </td>
      <td onClick={e => e.stopPropagation()}>
        <div className="flex-center gap-4">
          <button className="btn btn-ghost btn-sm btn-icon" title={t('comum.editar')} onClick={() => setEditando(true)}>✎</button>
          <button className="btn btn-ghost btn-sm btn-icon" title={t('comum.duplicar')} onClick={duplicar}>⧉</button>
          <button className="btn btn-ghost btn-sm btn-icon" title={t('comum.excluir')} style={{ color: 'var(--danger)' }} onClick={excluir}>✕</button>
        </div>
      </td>
    </tr>
  )
}

// ── Componente principal ─────────────────────────────────────────

export default function TabelaLancamentos({ projetoId, lancamentos, escopos, toast, onAtualizar }: Props) {
  const { t } = useTranslation()
  const [modalManual, setModalManual] = useState(false)

  const totalDecimal = lancamentos.reduce((acc, l) => acc + (l.totalDecimal ?? 0), 0)
  const totalHoras = Math.floor(totalDecimal)
  const totalMinutos = Math.round((totalDecimal - totalHoras) * 60)
  const totalHHMM = `${String(totalHoras).padStart(2, '0')}:${String(totalMinutos).padStart(2, '0')}`

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div className="flex-center gap-8">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('comum.lancamentos')}</h3>
          {lancamentos.length > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 4 }}>
              {lancamentos.length}
            </span>
          )}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setModalManual(true)}>{t('lanc.manual')}</button>
      </div>

      {lancamentos.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '32px 24px' }}>
            <div className="empty-state-icon">⏱</div>
            <div>{t('lanc.nenhum')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{t('lanc.dica')}</div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 72 }}>{t('comum.data')}</th>
                  <th>{t('comum.descricao')}</th>
                  <th style={{ width: 80 }}>{t('comum.inicio')}</th>
                  <th style={{ width: 80 }}>{t('comum.fim')}</th>
                  <th style={{ width: 80 }}>{t('comum.hhmm')}</th>
                  <th className="hide-mobile" style={{ width: 72 }}>{t('comum.decimal')}</th>
                  <th className="hide-mobile" style={{ width: 100 }}>{t('comum.tipo')}</th>
                  <th className="hide-mobile" style={{ width: 120 }}>{t('lanc.colEscopo')}</th>
                  <th style={{ width: 110 }}></th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map(l => (
                  <LinhaLancamento key={l.id} lancamento={l} escopos={escopos} toast={toast} onAtualizar={onAtualizar} />
                ))}
              </tbody>
              {lancamentos.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td colSpan={4} style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('comum.total')}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>{totalHHMM}</td>
                    <td className="hide-mobile" style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>{totalDecimal.toFixed(2).replace('.', ',')}</td>
                    <td className="hide-mobile" colSpan={2} />
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {modalManual && (
        <ModalLancamentoManual
          projetoId={projetoId}
          escopos={escopos}
          toast={toast}
          onSalvar={() => { setModalManual(false); onAtualizar() }}
          onFechar={() => setModalManual(false)}
        />
      )}
    </div>
  )
}
