import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useFormatarData } from '../contexts/PreferenciasContext'
import { CONTATO, CONTROLADOR, TERMOS_VIGENTES_DESDE, VERSAO_TERMOS } from '../config/legal'

// Páginas públicas (sem login) da Política de Privacidade e dos Termos de
// Uso (M15). O texto vive em i18n (chaves legal.*); mudou o texto, suba a
// versão em config/legal.ts e no backend.

const SECOES = {
  privacidade: ['dados', 'finalidade', 'base', 'compartilhamento', 'retencao', 'direitos', 'seguranca', 'cookies', 'alteracoes'],
  termos: ['servico', 'conta', 'uso', 'disponibilidade', 'encerramento', 'alteracoes'],
} as const

export default function Legal({ tipo }: { tipo: 'privacidade' | 'termos' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { formatarData } = useFormatarData()
  const vars = {
    controlador: CONTROLADOR || t('legal.controladorPadrao'),
    contato: CONTATO ? `(${CONTATO})` : t('legal.contatoPadrao'),
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', padding: '32px 20px' }}>
      <article className="card" style={{ maxWidth: 760, margin: '0 auto', padding: '32px 28px', lineHeight: 1.65 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          {t('legal.voltar')}
        </button>
        <h1 className="page-title" style={{ marginBottom: 4 }}>
          {tipo === 'privacidade' ? t('legal.politicaPrivacidade') : t('legal.termosUso')}
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
          {t('legal.versao', { versao: VERSAO_TERMOS, data: formatarData(TERMOS_VIGENTES_DESDE) })}
        </p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{t(`legal.${tipo}.intro`, vars)}</p>
        {SECOES[tipo].map((secao) => (
          <section key={secao} style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{t(`legal.${tipo}.${secao}Titulo`)}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{t(`legal.${tipo}.${secao}`, vars)}</p>
          </section>
        ))}
        <p style={{ fontSize: 13, marginTop: 24 }}>
          <Link to={tipo === 'privacidade' ? '/termos' : '/privacidade'}>
            {tipo === 'privacidade' ? t('legal.termosUso') : t('legal.politicaPrivacidade')}
          </Link>
        </p>
      </article>
    </div>
  )
}
