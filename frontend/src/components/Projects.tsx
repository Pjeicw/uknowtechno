import { useLanguage } from '../context/LanguageContext';

export default function Projects() {
  const { t } = useLanguage();

  return (
    <section id="projects">
      <div className="container">
        <h2 className="section-header">{t('projectsTitle')}</h2>
        
        <div className="project-grid">
          <div className="project-card glass glow">
            <div className="project-image">
              <span className="text-xl">📱</span>
            </div>
            <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
              {t('project1Title')}
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              {t('project1Desc')}
            </p>
            <div className="project-links">
              <a href="#" className="project-link">{t('projectLinkCode')}</a>
              <a href="#" className="project-link">{t('projectLinkDemo')}</a>
            </div>
          </div>

          <div className="project-card glass glow">
            <div className="project-image">
              <span className="text-xl">🛒</span>
            </div>
            <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
              {t('project2Title')}
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              {t('project2Desc')}
            </p>
            <div className="project-links">
              <a href="#" className="project-link">{t('projectLinkCode')}</a>
              <a href="#" className="project-link">{t('projectLinkDemo')}</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
