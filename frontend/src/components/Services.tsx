import { useLanguage } from '../context/LanguageContext';

const services = [
  { icon: '📱', titleKey: 'service1Title', descKey: 'service1Desc' },
  { icon: '🌐', titleKey: 'service2Title', descKey: 'service2Desc' },
  { icon: '🔌', titleKey: 'service3Title', descKey: 'service3Desc' },
  { icon: '🖥️', titleKey: 'service4Title', descKey: 'service4Desc' },
  { icon: '🧠', titleKey: 'service5Title', descKey: 'service5Desc' },
  { icon: '🗄️', titleKey: 'service6Title', descKey: 'service6Desc' },
] as const;

export default function Services() {
  const { t } = useLanguage();

  return (
    <section id="services">
      <div className="container">
        <h2 className="section-header">{t('servicesHeader')}</h2>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            maxWidth: '620px',
            margin: '-2.5rem auto 3rem',
          }}
        >
          {t('servicesSub')}
        </p>

        <div className="bento-grid">
          {services.map((svc) => (
            <div className="bento-item glass glow" key={svc.titleKey}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{svc.icon}</div>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '0.75rem' }}>{t(svc.titleKey)}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t(svc.descKey)}</p>
            </div>
          ))}
        </div>

        <div
          className="glass glow"
          style={{
            padding: '2.5rem',
            textAlign: 'center',
            maxWidth: '720px',
            margin: '0 auto',
          }}
        >
          <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '0.75rem', fontSize: '1.3rem' }}>
            {t('servicesPricingTitle')}
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            {t('servicesPricingText')}
          </p>
          <a href="#connect" className="cta-button enhanced-glow" aria-label={t('servicesCta')}>
            {t('servicesCta')}
          </a>
        </div>
      </div>
    </section>
  );
}
