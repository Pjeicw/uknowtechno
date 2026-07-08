import { useLanguage } from '../context/LanguageContext';
import Hero3D from './Hero3D';

export default function BusinessHero() {
  const { t } = useLanguage();

  return (
    <section id="hero" className="hero">
      <div className="hero-3d">
        <Hero3D />
        <div className="fallback-content" style={{ display: 'none' }}>
          {t('heroFallback')}
        </div>
      </div>
      {/* The nav bar already shows the logo top-left — repeating it here
          duplicated it and, combined with the fixed header, pushed the
          eyebrow/headline text up underneath the nav on load. */}
      <div className="container hero-content">
        <p
          className="text-glow"
          style={{
            color: 'var(--accent-cyan)',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.08em',
            fontSize: 'clamp(0.75rem, 2vw, 0.95rem)',
            marginBottom: '1rem',
            textTransform: 'uppercase',
            animation: 'fadeInUp 1.6s ease 0.4s both',
          }}
        >
          {t('bizHeroEyebrow')}
        </p>
        <h1 className="holo-text" style={{ marginBottom: '0.5rem' }}>
          {t('bizHeroHeadline')}
        </h1>
        <h2 style={{ color: 'var(--accent-cyan)' }}>{t('bizHeroHighlight')}</h2>
        <p className="tagline" style={{ maxWidth: '640px', margin: '0 auto 2.5rem' }}>
          {t('bizHeroSub')}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '1.25rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '2.5rem',
            animation: 'fadeInUp 1.6s ease 1.4s both',
          }}
        >
          <a href="#apps" className="cta-button enhanced-glow" aria-label={t('bizHeroCtaApps')}>
            {t('bizHeroCtaApps')}
          </a>
          <a
            href="#services"
            className="cta-button"
            style={{ background: 'transparent' }}
            aria-label={t('bizHeroCtaHire')}
          >
            {t('bizHeroCtaHire')}
          </a>
        </div>

        <div
          className="glass"
          style={{
            display: 'inline-flex',
            gap: '2rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
            padding: '1rem 2rem',
            animation: 'fadeInUp 1.6s ease 1.7s both',
          }}
        >
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
            {t('bizHeroStatYears')}
          </span>
          <span style={{ color: 'var(--glass-border)' }}>•</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
            {t('bizHeroStatApps')}
          </span>
          <span style={{ color: 'var(--glass-border)' }}>•</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
            {t('bizHeroStatStack')}
          </span>
        </div>
      </div>
    </section>
  );
}
