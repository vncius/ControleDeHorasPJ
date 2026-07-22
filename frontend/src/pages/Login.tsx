import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const [autenticando, setAutenticando] = useState(false)

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-0)',
        padding: 20,
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 360,
          width: '100%',
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
          {t('login.subtitulo')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', opacity: autenticando ? 0.5 : 1, pointerEvents: autenticando ? 'none' : 'auto' }}>
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              if (autenticando) return
              setErro(null)
              setAutenticando(true)
              try {
                if (!credentialResponse.credential) {
                  throw new Error(t('login.credencialAusente'))
                }
                await login(credentialResponse.credential)
                navigate('/', { replace: true })
              } catch (e) {
                setErro(e instanceof Error ? e.message : t('login.falhaAutenticar'))
                setAutenticando(false)
              }
            }}
            onError={() => setErro(t('login.erroGoogle'))}
          />
        </div>

        {autenticando && (
          <div className="flex-center gap-8" style={{ marginTop: 18, justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            <span className="spinner spinner-sm" />
            {t('login.autenticando')}
          </div>
        )}

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
