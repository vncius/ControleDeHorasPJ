import InputDecimal from './InputDecimal'

interface Props {
  value: string // string decimal ("150.5") ou "" — mesmo formato aceito por parseFloat
  onChange: (value: string) => void
  placeholder?: string
}

// Máscara de moeda BR (R$ + duas casas) — ver InputDecimal.
export default function InputMoeda({ value, onChange, placeholder }: Props) {
  return <InputDecimal value={value} onChange={onChange} placeholder={placeholder} prefixo="R$" />
}
