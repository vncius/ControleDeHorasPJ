import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

// ============================================================
// Modal acessível — único jeito de abrir um diálogo no app.
//
// - role="dialog" + aria-modal; aria-labelledby aponta para o `.modal-title`
//   que o conteúdo já renderiza (leitor de tela anuncia o título);
// - Esc fecha; clicar fora fecha;
// - foco: ao abrir vai para dentro (respeita um autoFocus do conteúdo; senão
//   o primeiro elemento focável); Tab/Shift+Tab circulam só dentro do modal;
//   ao fechar, volta para o elemento que estava focado antes (o botão que
//   abriu o modal);
// - modais empilhados (ex.: confirmação por cima da edição): só o do topo
//   reage a Esc/Tab.
// ============================================================

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// pilha de modais abertos (o último é o do topo)
const pilha: string[] = []

interface Props {
  onFechar: () => void
  /** Classes do painel; padrão "modal" (use "modal modal-lg" para o largo). */
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export default function Modal({ onFechar, className = 'modal', style, children }: Props) {
  const id = useId()
  const painel = useRef<HTMLDivElement>(null)
  // onFechar muda a cada render do pai; a ref evita reinstalar os listeners
  const fechar = useRef(onFechar)
  fechar.current = onFechar
  // Capturado no primeiro RENDER, não no efeito: um autoFocus do conteúdo
  // move o foco para dentro do modal antes de qualquer efeito rodar.
  const [anterior] = useState(() => document.activeElement as HTMLElement | null)

  useEffect(() => {
    pilha.push(id)

    const el = painel.current!
    const titulo = el.querySelector<HTMLElement>('.modal-title')
    if (titulo) {
      if (!titulo.id) titulo.id = `${id}-titulo`
      el.setAttribute('aria-labelledby', titulo.id)
    }
    // autoFocus do conteúdo já roda antes deste efeito; só foca se nada lá dentro tem foco
    if (!el.contains(document.activeElement)) {
      ;(el.querySelector<HTMLElement>(SELETOR_FOCAVEL) ?? el).focus()
    }

    function aoTeclar(e: KeyboardEvent) {
      if (pilha[pilha.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        fechar.current()
        return
      }
      if (e.key !== 'Tab') return
      const focaveis = Array.from(el.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL))
      if (focaveis.length === 0) {
        e.preventDefault()
        return
      }
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (e.shiftKey && (document.activeElement === primeiro || !el.contains(document.activeElement))) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (document.activeElement === ultimo || !el.contains(document.activeElement))) {
        e.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      const i = pilha.lastIndexOf(id)
      if (i >= 0) pilha.splice(i, 1)
      if (anterior && document.contains(anterior)) anterior.focus()
    }
  }, [id, anterior])

  return (
    <div className="modal-overlay" onClick={() => fechar.current()}>
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={className}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
