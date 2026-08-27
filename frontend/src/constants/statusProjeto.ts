import type { StatusProjeto, StatusPagamentoProjeto } from '../types'

export const STATUS_COR: Record<StatusProjeto, { bg: string; color: string }> = {
  'Aguardando início':  { bg: 'var(--info-bg)',            color: 'var(--info)' },
  'Em desenvolvimento': { bg: 'var(--status-ativo-bg)',    color: 'var(--accent)' },
  'Com impedimento':    { bg: 'var(--danger-dim)',         color: 'var(--danger)' },
  'Em testes':          { bg: 'var(--status-pausado-bg)',  color: 'var(--warning)' },
  'Entregue':           { bg: 'var(--info-bg)',            color: 'var(--info)' },
  'Finalizado':         { bg: 'var(--info-bg)',            color: 'var(--info)' },
  'Cancelado':          { bg: 'var(--danger-dim)',         color: 'var(--danger)' },
}

export const STATUS_PAGAMENTO_COR: Record<StatusPagamentoProjeto, { bg: string; color: string }> = {
  'Não pago': { bg: 'var(--bg-3)',      color: 'var(--text-muted)' },
  'Parcial':  { bg: 'var(--status-pausado-bg)', color: 'var(--warning)' },
  'Pago':     { bg: 'var(--info-bg)',   color: 'var(--info)' },
}

// mapeia o valor canônico (pt, usado como chave de negócio/API) para a chave de tradução
export const STATUS_PAGAMENTO_I18N_KEY: Record<StatusPagamentoProjeto, string> = {
  'Não pago': 'statusPagamento.naoPago',
  'Parcial':  'statusPagamento.parcial',
  'Pago':     'statusPagamento.pago',
}
