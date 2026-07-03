import { useLanguage } from '../context/LanguageContext';
import { useState, useEffect } from 'react';
import Hero3D from './Hero3D';

export default function Hero() {
  const { t } = useLanguage();
  const [typedText, setTypedText] = useState('');

  useEffect(() => {
    const text = 'UknowTechno';
    let i = 0;
    let isDeleting = false;
    let typingTimeout: ReturnType<typeof setTimeout>;

    const type = () => {
      if (!isDeleting) {
        if (i < text.length) {
          setTypedText(text.slice(0, i + 1));
          i++;
          typingTimeout = setTimeout(type, 30); // Very fast typing
        } else {
          typingTimeout = setTimeout(() => {
            isDeleting = true;
            type();
          }, 4000); // Wait 4 seconds before deleting
        }
      } else {
        if (i > 0) {
          setTypedText(text.slice(0, i - 1));
          i--;
          typingTimeout = setTimeout(type, 20); // Very fast deleting
        } else {
          isDeleting = false;
          typingTimeout = setTimeout(type, 500);
        }
      }
    };

    typingTimeout = setTimeout(type, 100); // Start quickly

    return () => clearTimeout(typingTimeout);
  }, []);

  return (
    <section id="hero" className="hero">
      <div className="hero-3d">
        <Hero3D />
        <div className="fallback-content" style={{ display: 'none' }}>
          {t('heroFallback')}
        </div>
      </div>
      <div className="container hero-content">
        <h1 className="text-glow holo-text">{typedText}<span className="cursor">|</span></h1>
        <h2>{t('heroName')}</h2>
        <p className="tagline">{t('heroTagline')}</p>
        <a href="#synopsis" className="cta-button enhanced-glow" aria-label={t('heroCtaAria')}>
          {t('heroCta')}
        </a>
      </div>
    </section>
  );
}
