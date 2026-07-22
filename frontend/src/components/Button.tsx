import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
}

export default function Button({ loading, disabled, children, ...rest }: Props) {
  return (
    <button {...rest} disabled={disabled || loading}>
      {loading ? <span className="spinner spinner-sm" /> : children}
    </button>
  )
}
