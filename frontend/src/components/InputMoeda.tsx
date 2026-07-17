import { useState } from 'react'

interface Props {
  value: string // string decimal ("150.5") ou "" — mesmo formato aceito por parseFloat
  onChange: (value: string) => void
  placeholder?: string
}

function valorParaDigitos(value: string): string {
  const num = parseFloat(value)
  if (!value || Number.isNaN(num)) return ''
  return Math.round(num * 100).toString()
}

function digitosParaValor(digitos: string): string {
  if (!digitos) return ''
  return (parseInt(digitos, 10) / 100).toString()
}

function formatarExibicao(digitos: string): string {
  if (!digitos) return ''
  const num = parseInt(digitos, 10)
  const centavos = (num % 100).toString().padStart(2, '0')
  const inteiro = Math.floor(num / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${inteiro},${centavos}`
}

// Máscara de moeda BR: usuário digita só números, "." e "," aparecem sozinhos
// (ex.: digitar 1 5 0 5 0 vira "150,50") — o valor exposto ao formulário
// continua um decimal comum ("150.5"), sem afetar o resto do payload.
export default function InputMoeda({ value, onChange, placeholder }: Props) {
  const [digitos, setDigitos] = useState(() => valorParaDigitos(value))

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
    setDigitos(raw)
    onChange(digitosParaValor(raw))
  }

  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none' }}>
        R$
      </span>
      <input
        className="input input-mono"
        inputMode="numeric"
        value={formatarExibicao(digitos)}
        onChange={handleChange}
        placeholder={placeholder ?? '0,00'}
        style={{ paddingLeft: 34 }}
      />
    </div>
  )
}
