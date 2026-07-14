import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-0)',
      }}
    >
      <div
        className="card"
        style={{
          width: 360,
          padding: '32px 28px',
          textAlign: 'center',
          animation: 'slideUp 0.25s ease',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Horas
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: 24,
          }}
        >
          PJ <span style={{ color: 'var(--accent)' }}>_</span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
          Entre com sua conta Google para acessar
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              setErro(null)
              try {
                if (!credentialResponse.credential) {
                  throw new Error('Credencial do Google ausente')
                }
                await login(credentialResponse.credential)
                navigate('/', { replace: true })
              } catch (e) {
                setErro(e instanceof Error ? e.message : 'Falha ao autenticar')
              }
            }}
            onError={() => setErro('Não foi possível autenticar com o Google')}
          />
        </div>

        {erro && (
          <div
            style={{
              marginTop: 18,
              fontSize: 12,
              color: 'var(--danger)',
              background: 'var(--danger-dim)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
            }}
          >
            {erro}
          </div>
        )}
      </div>
    </div>
  )
}
