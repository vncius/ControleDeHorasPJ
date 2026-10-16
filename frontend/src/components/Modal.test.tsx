// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import Modal from './Modal'

afterEach(cleanup)

function Exemplo({ onFechar = () => {} }: { onFechar?: () => void }) {
  return (
    <Modal onFechar={onFechar}>
      <h2 className="modal-title">Editar cliente</h2>
      <input aria-label="nome" />
      <button>Salvar</button>
    </Modal>
  )
}

describe('Modal', () => {
  it('é um diálogo modal rotulado pelo título', () => {
    render(<Exemplo />)
    const dialogo = screen.getByRole('dialog', { name: 'Editar cliente' })
    expect(dialogo.getAttribute('aria-modal')).toBe('true')
  })

  it('leva o foco para o primeiro elemento focável ao abrir', () => {
    render(<Exemplo />)
    expect(document.activeElement).toBe(screen.getByLabelText('nome'))
  })

  it('respeita um autoFocus do conteúdo', () => {
    render(
      <Modal onFechar={() => {}}>
        <input aria-label="primeiro" />
        <input aria-label="segundo" autoFocus />
      </Modal>
    )
    expect(document.activeElement).toBe(screen.getByLabelText('segundo'))
  })

  it('Esc e clique fora chamam onFechar; clique dentro não', () => {
    const onFechar = vi.fn()
    render(<Exemplo onFechar={onFechar} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onFechar).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onFechar).toHaveBeenCalledTimes(2)
  })

  it('Tab e Shift+Tab ficam presos dentro do modal', () => {
    render(<Exemplo />)
    const nome = screen.getByLabelText('nome')
    const salvar = screen.getByRole('button', { name: 'Salvar' })
    salvar.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(nome)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(salvar)
  })

  it('ao fechar, devolve o foco a quem abriu', () => {
    function Tela() {
      const [aberto, setAberto] = useState(false)
      return (
        <>
          <button onClick={() => setAberto(true)}>Abrir</button>
          {aberto && <Exemplo onFechar={() => setAberto(false)} />}
        </>
      )
    }
    render(<Tela />)
    const abrir = screen.getByRole('button', { name: 'Abrir' })
    abrir.focus()
    fireEvent.click(abrir)
    expect(document.activeElement).not.toBe(abrir)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(abrir)
  })

  it('devolve o foco a quem abriu mesmo quando o conteúdo tem autoFocus', () => {
    function Tela() {
      const [aberto, setAberto] = useState(false)
      return (
        <>
          <button onClick={() => setAberto(true)}>Novo cliente</button>
          {aberto && (
            <Modal onFechar={() => setAberto(false)}>
              <input aria-label="nome" autoFocus />
            </Modal>
          )}
        </>
      )
    }
    render(<Tela />)
    const abrir = screen.getByRole('button', { name: 'Novo cliente' })
    abrir.focus()
    fireEvent.click(abrir)
    expect(document.activeElement).toBe(screen.getByLabelText('nome'))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(abrir)
  })

  it('com modais empilhados, Esc fecha só o do topo', () => {
    const fecharBase = vi.fn()
    const fecharTopo = vi.fn()
    render(
      <>
        <Modal onFechar={fecharBase}><h2 className="modal-title">Base</h2></Modal>
        <Modal onFechar={fecharTopo}><h2 className="modal-title">Confirmação</h2></Modal>
      </>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(fecharTopo).toHaveBeenCalledTimes(1)
    expect(fecharBase).not.toHaveBeenCalled()
  })
})
