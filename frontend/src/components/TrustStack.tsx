import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const stack = [
  { icon: '⚛️', label: 'React' },
  { icon: 'TS', label: 'TypeScript' },
  { icon: '⚡', label: 'Vite' },
  { icon: '🎯', label: 'Kotlin' },
  { icon: '∲', label: 'Flutter' },
  { icon: '🟢', label: 'Node.js' },
  { icon: '⚡', label: 'Supabase' },
  { icon: '🔥', label: 'Firebase' },
  { icon: '☁️', label: 'Cloudflare' },
  { icon: '📦', label: 'PocketBase' },
  { icon: '🐳', label: 'Docker' },
  { icon: '🐙', label: 'GitHub Actions' },
  { icon: '🧠', label: 'LLMs' },
  { icon: '🤖', label: 'Claude Code' },
  { icon: '🧭', label: 'Qdrant' },
  { icon: '⚙️', label: 'n8n' },
];

export default function TrustStack() {
  const { t } = useLanguage();

  return (
    <section id="stack">
      <div className="container">
        <h2 className="section-header">{t('stackHeader')}</h2>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            maxWidth: '620px',
            margin: '-2.5rem auto 3rem',
          }}
        >
          {t('stackSub')}
        </p>

        <div className="tech-grid">
          {stack.map((item) => (
            <div className="tech-item glass glow" key={item.label}>
              <div className="tech-icon">{item.icon}</div>
              <h4>{item.label}</h4>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{t('stackCtaText')}</p>
          <Link
            to="/about#arsenal"
            style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}
          >
            {t('stackCtaLink')}
          </Link>
        </div>
      </div>
    </section>
  );
}
