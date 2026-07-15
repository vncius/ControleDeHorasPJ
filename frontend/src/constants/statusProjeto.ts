import type { StatusProjeto } from '../types'

export const STATUS_COR: Record<StatusProjeto, { bg: string; color: string }> = {
  'Aguardando início':  { bg: 'var(--info-bg)',            color: 'var(--info)' },
  'Em desenvolvimento': { bg: 'var(--status-ativo-bg)',    color: 'var(--accent)' },
  'Com impedimento':    { bg: 'var(--danger-dim)',         color: 'var(--danger)' },
  'Em testes':          { bg: 'var(--status-pausado-bg)',  color: 'var(--warning)' },
  'Entregue':           { bg: 'var(--info-bg)',            color: 'var(--info)' },
  'Finalizado':         { bg: 'var(--info-bg)',            color: 'var(--info)' },
  'Cancelado':          { bg: 'var(--danger-dim)',         color: 'var(--danger)' },
}
