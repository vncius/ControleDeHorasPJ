import { useEffect, useState } from 'react'
import { clientesApi } from '../services/api'
import type { Cliente } from '../types'
import type { ToastFns } from '../App'

interface Props { toast: ToastFns }

interface FormState { nome: string; observacoes: string }
const EMPTY: FormState = { nome: '', observacoes: '' }

export default function Clientes({ toast }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState<'novo' | 'editar' | null>(null)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [salvando, setSalvando] = useState(false)
  const [confirmarExcluir, setConfirmarExcluir] = useState<Cliente | null>(null)

  async function carregar() {
    try {
      setClientes(await clientesApi.listar())
    } catch {
      toast.error('Erro ao carregar clientes')
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
    if (!form.nome.trim()) { toast.error('Nome é obrigatório'); return }
    setSalvando(true)
    try {
      if (modal === 'novo') {
        await clientesApi.criar({ nome: form.nome, observacoes: form.observacoes || undefined })
        toast.success('Cliente criado com sucesso!')
      } else if (editando) {
        await clientesApi.atualizar(editando.id, { nome: form.nome, observacoes: form.observacoes || undefined })
        toast.success('Cliente atualizado!')
      }
      fecharModal()
      carregar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(c: Cliente) {
    try {
      await clientesApi.excluir(c.id)
      toast.success('Cliente excluído!')
      setConfirmarExcluir(null)
      carregar()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir')
      setConfirmarExcluir(null)
    }
  }

  const filtrados = clientes.filter((c) =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  )

  const formatarData = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div style={{ animation: 'slideUp 0.25s ease' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} cadastrado{clientes.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}>+ Novo cliente</button>
      </div>

      {/* Busca */}
      <div style={{ marginBottom: 20 }}>
        <input
          className="input"
          placeholder="Buscar cliente..."
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
            <div>{busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}</div>
            {!busca && (
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={abrirNovo}>
                Criar primeiro cliente
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
                  <th>Nome</th>
                  <th>Observações</th>
                  <th>Criado em</th>
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
                          title="Editar"
                          onClick={() => abrirEditar(c)}
                        >✎</button>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          title="Excluir"
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
                {modal === 'novo' ? 'Novo cliente' : 'Editar cliente'}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={fecharModal}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Nome *</label>
                <input
                  className="input"
                  placeholder="Nome do cliente"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && salvar()}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea
                  className="input"
                  placeholder="Observações opcionais..."
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={fecharModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : modal === 'novo' ? 'Criar cliente' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {confirmarExcluir && (
        <div className="modal-overlay" onClick={() => setConfirmarExcluir(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Excluir cliente</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
              Tem certeza que deseja excluir <strong style={{ color: 'var(--text-primary)' }}>{confirmarExcluir.nome}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmarExcluir(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => excluir(confirmarExcluir)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
