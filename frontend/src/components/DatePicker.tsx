import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormatarData } from '../contexts/PreferenciasContext'
import { hojeLocal } from '../utils/tempo'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  opcional?: boolean
}

function paraISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// grade de 42 células (6 semanas) cobrindo o mês, com dias vizinhos para preencher
function gradeDoMes(ano: number, mes: number): { data: Date; doMes: boolean }[] {
  const primeiroDia = new Date(ano, mes, 1)
  const inicioGrade = new Date(ano, mes, 1 - primeiroDia.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicioGrade)
    d.setDate(inicioGrade.getDate() + i)
    return { data: d, doMes: d.getMonth() === mes }
  })
}

export default function DatePicker({ value, onChange, placeholder, opcional }: Props) {
  const { t, i18n } = useTranslation()
  const { formatarData } = useFormatarData()
  const [aberto, setAberto] = useState(false)
  const base = value ? new Date(value + 'T00:00:00') : new Date()
  const [visivel, setVisivel] = useState({ ano: base.getFullYear(), mes: base.getMonth() })

  function abrir() {
    const b = value ? new Date(value + 'T00:00:00') : new Date()
    setVisivel({ ano: b.getFullYear(), mes: b.getMonth() })
    setAberto(true)
  }

  function mudarMes(delta: number) {
    setVisivel(v => {
      const d = new Date(v.ano, v.mes + delta, 1)
      return { ano: d.getFullYear(), mes: d.getMonth() }
    })
  }

  function selecionar(dia: Date) {
    onChange(paraISO(dia.getFullYear(), dia.getMonth(), dia.getDate()))
    setAberto(false)
  }

  const nomeMes = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(new Date(visivel.ano, visivel.mes, 1))
  const nomesDiasSemana = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' }).format(new Date(2000, 0, 2 + i))
  )
  const grade = gradeDoMes(visivel.ano, visivel.mes)
  const hoje = hojeLocal()

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="input input-mono"
        onClick={abrir}
        style={{ textAlign: 'left', cursor: 'pointer', color: value ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span>{value ? formatarData(value) : (placeholder ?? '—')}</span>
        <span style={{ opacity: 0.6 }}>📅</span>
      </button>

      {aberto && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setAberto(false)} />
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 150,
            background: 'var(--bg-2)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)', padding: 12, minWidth: 260,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <div className="flex-between" style={{ marginBottom: 8 }}>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => mudarMes(-1)}>‹</button>
              <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{nomeMes}</span>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => mudarMes(1)}>›</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
              {nomesDiasSemana.map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '4px 0' }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {grade.map(({ data, doMes }, i) => {
                const iso = paraISO(data.getFullYear(), data.getMonth(), data.getDate())
                const selecionado = iso === value
                const ehHoje = iso === hoje
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => selecionar(data)}
                    style={{
                      padding: '6px 0',
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      textAlign: 'center',
                      borderRadius: 6,
                      border: ehHoje && !selecionado ? '1px solid var(--border-light)' : '1px solid transparent',
                      background: selecionado ? 'var(--accent)' : 'transparent',
                      color: selecionado ? '#07070d' : doMes ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: selecionado ? 700 : 400,
                      cursor: 'pointer',
                      opacity: doMes ? 1 : 0.4,
                    }}
                  >
                    {data.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="flex-between" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => selecionar(new Date())}>{t('datePicker.hoje')}</button>
              {opcional && value && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--danger)' }} onClick={() => { onChange(''); setAberto(false) }}>{t('datePicker.limpar')}</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
