import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { lancamentosApi } from '../services/api'
import { hojeLocal } from '../utils/tempo'
import { useFormatarData } from '../contexts/PreferenciasContext'
import DatePicker from './DatePicker'
import Button from './Button'
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

// ── Modal de lançamento — cria (editando=null) ou edita/exclui/duplica ──

type Acao = 'excluir' | 'duplicar'

interface ModalLancamentoProps {
  projetoId: string
  editando: LancamentoHoras | null
  escopos: AlteracaoEscopo[]
  toast: ToastFns
  onSalvar: () => void
  onFechar: () => void
}

function ModalLancamento({ projetoId, editando, escopos, toast, onSalvar, onFechar }: ModalLancamentoProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormEdicao>({
    data: editando?.data ?? hojeLocal(),
    horaInicio: editando?.horaInicio ?? '',
    horaFim: editando?.horaFim ?? '',
    descricao: editando?.descricao ?? '',
    tipo: editando?.tipo ?? 'Manual',
    escopoId: editando?.escopoId ?? '',
  })
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState<Acao | null>(null)
  const [processandoAcao, setProcessandoAcao] = useState(false)

  async function salvar() {
    if (salvando) return
    if (!form.horaInicio) { toast.error(t('lanc.horaInicioObrigatoria')); return }
    if (!form.descricao.trim()) { toast.error(t('comum.descricaoObrigatoria')); return }
    setSalvando(true)
    try {
      if (editando) {
        await lancamentosApi.atualizar(editando.id, {
          data: form.data,
          horaInicio: form.horaInicio,
          horaFim: form.horaFim || undefined,
          descricao: form.descricao,
          tipo: form.tipo,
          escopoId: form.escopoId || null,
        })
        toast.success(t('lanc.atualizado'))
      } else {
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
      }
      onSalvar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('comum.erroSalvar'))
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarAcao() {
    if (processandoAcao) return
    if (!editando || !confirmando) return
    setProcessandoAcao(true)
    try {
      if (confirmando === 'excluir') {
        await lancamentosApi.excluir(editando.id)
        toast.success(t('lanc.excluido'))
      } else {
        await lancamentosApi.duplicar(editando.id)
        toast.success(t('lanc.duplicado'))
      }
      onSalvar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t(confirmando === 'excluir' ? 'comum.erroExcluir' : 'lanc.erroDuplicar'))
      setConfirmando(null)
      setProcessandoAcao(false)
    }
  }

  if (confirmando) {
    return (
      <div className="modal-overlay" onClick={onFechar}>
        <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">{confirmando === 'excluir' ? t('comum.excluir') : t('comum.duplicar')}</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            {confirmando === 'excluir' ? t('lanc.confirmarExclusao') : t('lanc.confirmarDuplicar')}
          </p>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setConfirmando(null)} disabled={processandoAcao}>{t('comum.cancelar')}</button>
            <Button className={confirmando === 'excluir' ? 'btn btn-danger' : 'btn btn-primary'} onClick={confirmarAcao} loading={processandoAcao}>
              {t('comum.confirmar')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{editando ? t('lanc.modalTituloEditar') : t('lanc.modalTitulo')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onFechar}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('lanc.dataLabel')}</label>
              <DatePicker value={form.data}
                onChange={v => setForm(f => ({ ...f, data: v }))} />
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
                  <option key={e.id} value={e.id}>{e.titulo} ({e.horasAdicionais !== undefined ? `+${e.horasAdicionais.toFixed(1)}h` : t('escopo.horasLivres')})</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">{t('comum.descricao')} *</label>
            <textarea className="input" rows={3} placeholder={t('lanc.oQueFoiFeito')}
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: 24, justifyContent: editando ? 'space-between' : 'flex-end' }}>
          {editando && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmando('excluir')}>
              {t('comum.excluir')}
            </button>
          )}
          <div className="flex-center gap-8">
            {editando && (
              <button className="btn btn-secondary" onClick={() => setConfirmando('duplicar')}>{t('comum.duplicar')}</button>
            )}
            <button className="btn btn-secondary" onClick={onFechar}>{t('comum.cancelar')}</button>
            <Button className="btn btn-primary" onClick={salvar} loading={salvando}>
              {editando ? t('comum.salvar') : t('lanc.salvarBtn')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Linha (somente leitura — clique abre o modal de edição) ──────

function LinhaLancamento({ lancamento, escopos, t }: {
  lancamento: LancamentoHoras
  escopos: AlteracaoEscopo[]
  t: (key: string) => string
}) {
  const { formatarDataCurta } = useFormatarData()
  const escopoNome = escopos.find(e => e.id === lancamento.escopoId)?.titulo
  const emAndamento = !lancamento.horaFim

  return (
    <Fragment>
      <td className="td-mono">
        {formatarDataCurta(lancamento.data)}
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
    </Fragment>
  )
}

// ── Componente principal ─────────────────────────────────────────

export default function TabelaLancamentos({ projetoId, lancamentos, escopos, toast, onAtualizar }: Props) {
  const { t } = useTranslation()
  const [modalManual, setModalManual] = useState(false)
  const [editando, setEditando] = useState<LancamentoHoras | null>(null)

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
                </tr>
              </thead>
              <tbody>
                {lancamentos.map(l => (
                  <tr key={l.id} onClick={() => setEditando(l)} style={{ cursor: 'pointer', opacity: l.horaFim ? 1 : 0.8 }}>
                    <LinhaLancamento lancamento={l} escopos={escopos} t={t} />
                  </tr>
                ))}
              </tbody>
              {lancamentos.length > 1 && (
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td colSpan={4} style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('comum.total')}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>{totalHHMM}</td>
                    <td className="hide-mobile" style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 13 }}>{totalDecimal.toFixed(2).replace('.', ',')}</td>
                    <td className="hide-mobile" colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {modalManual && (
        <ModalLancamento
          projetoId={projetoId}
          editando={null}
          escopos={escopos}
          toast={toast}
          onSalvar={() => { setModalManual(false); onAtualizar() }}
          onFechar={() => setModalManual(false)}
        />
      )}

      {editando && (
        <ModalLancamento
          projetoId={projetoId}
          editando={editando}
          escopos={escopos}
          toast={toast}
          onSalvar={() => { setEditando(null); onAtualizar() }}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  )
}
