import { useLanguage } from '../context/LanguageContext';

export default function Experience() {
  const { t } = useLanguage();

  const jobs = [
    {
      title: 'job1Title',
      company: 'job1Company',
      date: 'job1Date',
      desc: 'job1Desc'
    },
    {
      title: 'job2Title',
      company: 'job2Company',
      date: 'job2Date',
      desc: 'job2Desc'
    },
    {
      title: 'job3Title',
      company: 'job3Company',
      date: 'job3Date',
      desc: 'job3Desc'
    }
  ];

  return (
    <section id="blueprint">
      <div className="container">
        <h2 className="section-header">{t('blueprintHeader')}</h2>
        <div className="timeline">
          {jobs.map((job, idx) => (
            <div className="timeline-item glass glow" key={idx}>
              <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '1rem' }}>
                {t(job.title as any)}
              </h3>
              <h4 style={{ opacity: 0.8, marginBottom: '0.5rem' }}>
                {t(job.company as any)}
              </h4>
              <p style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                {t(job.date as any)}
              </p>
              <p>{t(job.desc as any)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
