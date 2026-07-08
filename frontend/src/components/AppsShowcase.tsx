import type { ReactElement } from 'react';
import { useLanguage } from '../context/LanguageContext';
import laoQrScreenshot from '../assets/laoqrparse.png';
import smartHrScreenshot from '../assets/smarthr.png';
import omniKitScreenshot from '../assets/omnikit.png';

type AppStatus = 'live' | 'beta' | 'dev';

interface AppItem {
  icon: string;
  titleKey: 'app1Title' | 'app2Title' | 'app3Title' | 'app4Title';
  descKey: 'app1Desc' | 'app2Desc' | 'app3Desc' | 'app4Desc';
  status: AppStatus;
  url?: string;
  Slide: () => ReactElement;
}

// Real Play Store screenshot, shown inside the same phone-frame chrome as
// the generated slides so every card stays visually consistent.
function ScreenshotSlide({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'top center',
          display: 'block',
        }}
      />
    </div>
  );
}

// --- Generated app-preview "slide" (fallback, no screenshot yet) --------
// Lightweight phone-frame SVG mockup used only for apps without a real
// screenshot on hand (currently just LinkZap).
function PhoneFrame({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <svg viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`slide-bg-${accent}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F2137" />
          <stop offset="100%" stopColor="#0A192F" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="200" height="200" fill={`url(#slide-bg-${accent})`} />
      {/* phone silhouette */}
      <rect x="62" y="14" width="76" height="172" rx="14" fill="#112240" stroke={accent} strokeWidth="1.5" opacity="0.9" />
      <rect x="68" y="24" width="64" height="140" rx="4" fill="#0A192F" />
      <rect x="90" y="18" width="20" height="3" rx="1.5" fill={accent} opacity="0.6" />
      {children}
      <rect x="68" y="170" width="64" height="6" rx="3" fill={accent} opacity="0.25" />
    </svg>
  );
}

function LinkZapSlide() {
  const c = '#FF6B9D';
  return (
    <PhoneFrame accent="food">
      <circle cx="100" cy="55" r="22" fill="none" stroke={c} strokeWidth="2" opacity="0.8" />
      <circle cx="100" cy="55" r="13" fill={c} opacity="0.15" />
      <text
        x="100"
        y="63"
        fontSize="20"
        fontWeight="bold"
        fill={c}
        textAnchor="middle"
        fontFamily="'Space Grotesk', sans-serif"
      >
        L
      </text>
      <rect x="78" y="94" width="44" height="9" rx="4.5" fill={c} opacity="0.18" />
      <rect x="78" y="94" width="26" height="9" rx="4.5" fill={c} opacity="0.55" />
      <rect x="78" y="110" width="44" height="9" rx="4.5" fill={c} opacity="0.18" />
      <rect x="78" y="126" width="44" height="16" rx="8" fill={c} opacity="0.75" />
      <text x="100" y="137" fontSize="8" fill="#0A192F" textAnchor="middle" fontWeight="bold">SOON</text>
    </PhoneFrame>
  );
}

const apps: AppItem[] = [
  {
    icon: '🧾',
    titleKey: 'app1Title',
    descKey: 'app1Desc',
    status: 'live',
    url: 'https://play.google.com/store/apps/details?id=com.laoqrparser.app&hl=en',
    Slide: () => <ScreenshotSlide src={laoQrScreenshot} alt="Lao QR Parse app screenshot" />,
  },
  {
    icon: '🧰',
    titleKey: 'app2Title',
    descKey: 'app2Desc',
    status: 'live',
    url: 'https://play.google.com/store/apps/details?id=app.omnikit.android&hl=en',
    Slide: () => <ScreenshotSlide src={omniKitScreenshot} alt="OmniKit app screenshot" />,
  },
  {
    icon: '🗓️',
    titleKey: 'app3Title',
    descKey: 'app3Desc',
    status: 'beta',
    url: 'https://play.google.com/store/apps/details?id=com.smarthr.app&hl=en',
    Slide: () => <ScreenshotSlide src={smartHrScreenshot} alt="Smart HR app screenshot" />,
  },
  {
    icon: '🍔',
    titleKey: 'app4Title',
    descKey: 'app4Desc',
    status: 'dev',
    // No screenshot yet — LinkZap shows a stylized "L" monogram placeholder
    // instead (see LinkZapSlide) until real screenshots are ready.
    Slide: LinkZapSlide,
  },
];

const statusStyle: Record<AppStatus, { key: 'statusLive' | 'statusBeta' | 'statusDev'; color: string }> = {
  live: { key: 'statusLive', color: 'var(--accent-cyan)' },
  beta: { key: 'statusBeta', color: '#FFB86B' },
  dev: { key: 'statusDev', color: '#8B45FF' },
};

export default function AppsShowcase() {
  const { t } = useLanguage();

  return (
    <section id="apps">
      <div className="container">
        <h2 className="section-header">{t('appsHeader')}</h2>
        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            maxWidth: '620px',
            margin: '-2.5rem auto 3rem',
          }}
        >
          {t('appsSub')}
        </p>

        <div className="project-grid">
          {apps.map((app) => {
            const status = statusStyle[app.status];
            const Slide = app.Slide;
            return (
              <div className="project-card glass glow" key={app.titleKey}>
                <div
                  className="project-image"
                  style={{
                    background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-primary))',
                    padding: 0,
                    overflow: 'hidden',
                  }}
                >
                  <Slide />
                </div>

                <span
                  className="app-status-badge"
                  style={{ borderColor: status.color, color: status.color }}
                >
                  <span className="app-status-dot" style={{ background: status.color }} />
                  {t(status.key)}
                </span>

                <h3
                  style={{
                    color: 'var(--accent-cyan)',
                    margin: '1rem 0 0.75rem',
                    fontSize: '1.4rem',
                    fontWeight: 'bold',
                  }}
                >
                  {t(app.titleKey)}
                </h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  {t(app.descKey)}
                </p>

                <div className="project-links">
                  {app.url ? (
                    <a href={app.url} target="_blank" rel="noreferrer" className="project-link">
                      {t('appCtaInstall')}
                    </a>
                  ) : (
                    <span
                      className="project-link"
                      style={{ opacity: 0.6, cursor: 'default', pointerEvents: 'none' }}
                    >
                      {t('appCtaSoon')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
