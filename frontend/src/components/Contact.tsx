import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const GithubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const YouTubeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const PlayStoreIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.018 13.298l-1.928-1.127-4.103-4.104 4.098-4.098 1.943-1.136c.928-.541 1.776-.089 1.776 1.011v9.444c0 1.096-.848 1.553-1.786 1.01zm-7.669-6.884l3.166 3.166-3.165 3.167-8.318-8.319c.478-.292 1.026-.298 1.543.003l6.774 3.983zm-6.774 11.171c-.517.301-1.065.295-1.543.003l8.318-8.318 3.165 3.167-3.166 3.166-6.774 3.982zM1.849 20.354A1.91 1.91 0 0 1 1 18.73V5.269c0-.623.295-1.18.784-1.517l10.222 10.222L1.849 20.354z"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.6 5.82c-1.03-.9-1.65-2.19-1.65-3.62h-3.14v13.44c0 1.55-1.26 2.81-2.81 2.81a2.81 2.81 0 0 1 0-5.62c.28 0 .55.04.81.12V9.9a6.02 6.02 0 0 0-.81-.06 6 6 0 0 0-6 6 6 6 0 0 0 6 6c3.31 0 6-2.69 6-6V8.51a9.11 9.11 0 0 0 5.33 1.71V7.08c-1.19 0-2.29-.4-3.19-1.07-.2-.14-.38-.25-.54-.19z"/>
  </svg>
);

const footerProducts = [
  { titleKey: 'app1Title' as const, url: 'https://play.google.com/store/apps/details?id=com.laoqrparser.app&hl=en' },
  { titleKey: 'app2Title' as const, url: 'https://play.google.com/store/apps/details?id=app.omnikit.android&hl=en' },
  { titleKey: 'app3Title' as const, url: 'https://play.google.com/store/apps/details?id=com.smarthr.app&hl=en' },
  { titleKey: 'app4Title' as const, url: '#apps' },
];

type ContactProps = {
  /** Set false to hide the "Get in Touch" hero block and keep only the
   * footer — used on /about, where Home already shows this section. */
  showContactSection?: boolean;
};

export default function Contact({ showContactSection = true }: ContactProps) {
  const { t } = useLanguage();
  const location = useLocation();
  const onHome = location.pathname === '/';

  // Footer nav links are shared between "/" and "/about". A plain
  // `href="#services"` only scrolls when that section actually exists on the
  // current page, which is why "Services" silently did nothing from /about.
  // Route through "/#id" (react-router Link + ScrollToHash in App.tsx)
  // whenever we're not already on the page that owns the target section.
  const homeAnchor = (id: string) => (onHome ? `#${id}` : `/#${id}`);

  return (
    <>
      {showContactSection && (
        <section id="contact" className="contact">
          <div className="container">
            <h2 className="section-header">{t('contactHeader')}</h2>
            <p>{t('contactText')}</p>
            <a href="mailto:phengsavanh@example.com" className="contact-email">
              {t('contactEmail')}
            </a>
            <div className="social-links" style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
              <a href="https://github.com/Pjeicw" className="social-link" target="_blank" rel="noreferrer" aria-label={t('contactGitHubAria')} style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                <GithubIcon />
              </a>
              <a href="https://www.youtube.com/@UknowTechno" className="social-link" target="_blank" rel="noreferrer" aria-label="YouTube Channel" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                <YouTubeIcon />
              </a>
              <a href="https://play.google.com/store/apps/developer?id=Uknowtechno&hl=en" className="social-link" target="_blank" rel="noreferrer" aria-label="Google Play Store" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                <PlayStoreIcon />
              </a>
              <a href="https://wa.me/8562028915965" className="social-link" target="_blank" rel="noreferrer" aria-label="WhatsApp" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                <WhatsAppIcon />
              </a>
            </div>
          </div>
        </section>
      )}

      <footer>
        <div className="footer-content">
          <div className="footer-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <img src="/favicon.svg" alt="UknowTechno" width={28} height={28} style={{ borderRadius: '22%' }} />
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>UknowTechno</span>
            </div>
            <p style={{ maxWidth: '280px' }}>{t('footerTagline')}</p>
          </div>
          <div className="footer-section">
            <h4>{t('footerProductsTitle')}</h4>
            {footerProducts.map((p) => (
              <p key={p.titleKey}>
                {p.url.startsWith('#') ? (
                  <Link to={homeAnchor(p.url.slice(1))}>{t(p.titleKey)}</Link>
                ) : (
                  <a href={p.url} target="_blank" rel="noreferrer">{t(p.titleKey)}</a>
                )}
              </p>
            ))}
          </div>
          <div className="footer-section">
            <h4>{t('footerLinksTitle')}</h4>
            <p><Link to={homeAnchor('hero')}>{t('navHome')}</Link></p>
            <p><Link to={homeAnchor('services')}>{t('navServices')}</Link></p>
            <p><Link to="/about#arsenal">{t('navSkills')}</Link></p>
            <p><Link to="/about">{t('navAboutMe')}</Link></p>
          </div>
          <div className="footer-section">
            <h4>{t('footerConnectTitle')}</h4>
            <div className="footer-social" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <a href="https://github.com/Pjeicw" target="_blank" rel="noreferrer" aria-label={t('contactGitHubAria')} style={{ width: '24px', display: 'inline-block' }}><GithubIcon /></a>
              <a href="https://www.youtube.com/@UknowTechno" target="_blank" rel="noreferrer" aria-label="YouTube Channel" style={{ width: '24px', display: 'inline-block' }}><YouTubeIcon /></a>
              <a href="https://www.tiktok.com/@uknowtechno?_r=1&_t=ZS-97qayEgdEg8" target="_blank" rel="noreferrer" aria-label={t('connectTikTokAria')} style={{ width: '24px', display: 'inline-block' }}><TikTokIcon /></a>
              <a href="https://play.google.com/store/apps/developer?id=Uknowtechno&hl=en" target="_blank" rel="noreferrer" aria-label="Google Play Store" style={{ width: '24px', display: 'inline-block' }}><PlayStoreIcon /></a>
              <a href="https://wa.me/8562028915965" target="_blank" rel="noreferrer" aria-label="WhatsApp" style={{ width: '24px', display: 'inline-block' }}><WhatsAppIcon /></a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>{t('footerCopyright')}</p>
        </div>
      </footer>
    </>
  );
}
