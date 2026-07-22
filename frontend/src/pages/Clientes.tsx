import { useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { clientesApi } from '../services/api'
import type { Cliente } from '../types'
import type { ToastFns } from '../App'
import ConfirmModal from '../components/ConfirmModal'
import Button from '../components/Button'

interface Props { toast: ToastFns }

interface FormState { nome: string; observacoes: string }
const EMPTY: FormState = { nome: '', observacoes: '' }

export default function Clientes({ toast }: Props) {
  const { t, i18n } = useTranslation()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [salvando, setSalvando] = useState(false)
  const [confirmarExcluir, setConfirmarExcluir] = useState<Cliente | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  async function carregar() {
    try {
      setClientes(await clientesApi.listar())
    } catch {
      toast.error(t('clientes.erroCarregar'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setForm(EMPTY)
    setEditando(null)
    setModal('novo')
  }

  function abrirEditar(c: Cliente) {
    setForm({ nome: c.nome, observacoes: c.observacoes ?? '' })
    setEditando(c)
    setModal('editar')
  }

  function fecharModal() {
    setModal(null)
    setEditando(null)
    setForm(EMPTY)
  }

  async function salvar() {
    if (salvando) return
    if (!form.nome.trim()) { toast.error(t('clientes.nomeObrigatorio')); return }
    setSalvando(true)
    try {
      if (modal === 'novo') {
        await clientesApi.criar({ nome: form.nome, observacoes: form.observacoes || undefined })
        toast.success(t('clientes.criado'))
      } else if (editando) {
        await clientesApi.atualizar(editando.id, { nome: form.nome, observacoes: form.observacoes || undefined })
        toast.success(t('clientes.atualizado'))
      }
      fecharModal()
      carregar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('comum.erroSalvar'))
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(c: Cliente) {
    if (excluindo) return
    setExcluindo(true)
    try {
      await clientesApi.excluir(c.id)
      toast.success(t('clientes.excluido'))
      setConfirmarExcluir(null)
      carregar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('comum.erroExcluir'))
    } finally {
      setExcluindo(false)
    }
  }

  const filtrados = clientes.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  )

  const formatarData = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div style={{ animation: 'slideUp 0.25s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('clientes.titulo')}</h1>
          <p className="page-subtitle">{t('clientes.subtitulo', { count: clientes.length })}</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}>{t('clientes.novo')}</button>
      </div>

      {/* Busca */}
      <div style={{ marginBottom: 20 }}>
        <input
          className="input"
          placeholder={t('clientes.buscar')}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="loading-screen" style={{ height: 200 }}>
          <div className="spinner" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">◉</div>
            <div>{busca ? t('clientes.nenhumEncontrado') : t('clientes.nenhumCadastrado')}</div>
            {!busca && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={abrirNovo}>
                {t('clientes.criarPrimeiro')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('clientes.nome')}</th>
                  <th>{t('comum.observacoes')}</th>
                  <th>{t('clientes.criadoEm')}</th>
                  <th style={{ width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} onClick={() => abrirEditar(c)}>
                    <td style={{ fontWeight: 500 }}>{c.nome}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {c.observacoes || '—'}
                    </td>
                    <td className="td-mono">{formatarData(c.dataCriacao)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex-center gap-4">
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          title={t('comum.editar')}
                          onClick={() => abrirEditar(c)}
                        >✎</button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          title={t('comum.excluir')}
                          style={{ color: 'var(--danger)' }}
                          onClick={() => setConfirmarExcluir(c)}
                        >✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Criar/Editar */}
      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {modal === 'novo' ? t('clientes.novoTitulo') : t('clientes.editarTitulo')}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={fecharModal}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">{t('clientes.nomeLabel')}</label>
                <input
                  className="input"
                  placeholder={t('clientes.nomePlaceholder')}
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && salvar()}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('comum.observacoes')}</label>
                <textarea
                  className="input"
                  placeholder={t('comum.observacoesPlaceholder')}
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={fecharModal} disabled={salvando}>{t('comum.cancelar')}</button>
              <Button className="btn btn-primary" onClick={salvar} loading={salvando}>
                {modal === 'novo' ? t('clientes.criarBtn') : t('comum.salvar')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {confirmarExcluir && (
        <ConfirmModal
          titulo={t('clientes.excluirTitulo')}
          mensagem={
            <Trans i18nKey="clientes.confirmarExclusao" values={{ nome: confirmarExcluir.nome }}>
              <strong style={{ color: 'var(--text-primary)' }} />
            </Trans>
          }
          confirmarLabel={t('comum.excluir')}
          perigo
          confirmando={excluindo}
          onConfirmar={() => excluir(confirmarExcluir)}
          onFechar={() => setConfirmarExcluir(null)}
        />
      )}
    </div>
  )
}
