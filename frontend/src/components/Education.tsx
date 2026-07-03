import { useLanguage } from '../context/LanguageContext';

export default function Education() {
  const { t } = useLanguage();

  const certs = [
    { title: 'cert1Title', date: 'cert1Date', desc: 'cert1Desc' },
    { title: 'cert2Title', date: 'cert2Date', desc: 'cert2Desc' },
    { title: 'cert3Title', date: 'cert3Date', desc: 'cert3Desc' }
  ];

  const educations = [
    { title: 'edu1Title', date: 'edu1Date', desc: 'edu1Desc' },
    { title: 'edu2Title', date: 'edu2Date', desc: 'edu2Desc' }
  ];

  return (
    <section id="education">
      <div className="container">
        <h2 className="section-header">{t('certHeader')}</h2>
        <div className="cert-grid">
          {certs.map((cert, idx) => (
            <div className="cert-card glass glow" key={idx}>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '1rem' }}>
                {t(cert.title as any)}
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                {t(cert.date as any)}
              </p>
              <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>
                {t(cert.desc as any)}
              </p>
            </div>
          ))}
        </div>

        <h3 style={{ color: 'var(--accent-cyan)', textAlign: 'center', fontSize: '2rem', margin: '4rem 0 2rem' }}>
          {t('eduHeader')}
        </h3>
        
        <div className="cert-grid">
          {educations.map((edu, idx) => (
            <div className="cert-card glass glow" key={idx}>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '1rem' }}>
                {t(edu.title as any)}
              </h3>
              <p style={{ marginBottom: '1rem' }}>
                {t(edu.date as any)}
              </p>
              <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>
                {t(edu.desc as any)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
