import type { StatusProjeto } from '../types'

export const STATUS_COR: Record<StatusProjeto, { bg: string; color: string }> = {
  'Aguardando início':  { bg: 'rgba(92,200,255,0.12)',  color: 'var(--info)' },
  'Em desenvolvimento': { bg: 'rgba(168,255,62,0.12)',  color: 'var(--accent)' },
  'Com impedimento':    { bg: 'rgba(255,92,122,0.12)',  color: 'var(--danger)' },
  'Em testes':          { bg: 'rgba(255,209,102,0.12)', color: 'var(--warning)' },
  'Entregue':           { bg: 'rgba(92,200,255,0.12)',  color: 'var(--info)' },
  'Finalizado':         { bg: 'rgba(92,200,255,0.12)',  color: 'var(--info)' },
  'Cancelado':          { bg: 'rgba(255,92,122,0.12)',  color: 'var(--danger)' },
}
