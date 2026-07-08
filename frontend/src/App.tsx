import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import CanvasBackground from './components/CanvasBackground';
import BusinessHero from './components/BusinessHero';
import AppsShowcase from './components/AppsShowcase';
import Services from './components/Services';
import TrustStack from './components/TrustStack';
import Connect from './components/Connect';
import About from './components/About';
import Skills from './components/Skills';
import Experience from './components/Experience';
import Education from './components/Education';
import Contact from './components/Contact';
import ChatWidget from './components/ChatWidget';
import Logo from './components/Logo';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import React, { useState, useEffect, useRef } from 'react';
import { Home, Smartphone, Briefcase, Cpu, Share2, User, Award, GraduationCap } from 'lucide-react';

const HOME_SECTIONS = [
  { id: 'hero', key: 'scrollHome' },
  { id: 'apps', key: 'scrollApps' },
  { id: 'services', key: 'scrollServices' },
  { id: 'stack', key: 'scrollStack' },
  { id: 'connect', key: 'scrollConnect' },
];

const ABOUT_SECTIONS = [
  { id: 'synopsis', key: 'scrollAbout' },
  { id: 'arsenal', key: 'scrollSkills' },
  { id: 'blueprint', key: 'scrollExperience' },
  { id: 'education', key: 'scrollEducation' },
];

// Icons paired with each nav label so mobile can collapse long text down to
// icon-only once the drawer gets too narrow to show full words (see
// .nav-icon / .nav-label rules in index.css).
const HOME_NAV_ICONS: Record<string, React.ReactNode> = {
  hero: <Home size={18} className="nav-icon" />,
  apps: <Smartphone size={18} className="nav-icon" />,
  services: <Briefcase size={18} className="nav-icon" />,
  stack: <Cpu size={18} className="nav-icon" />,
  connect: <Share2 size={18} className="nav-icon" />,
};
const ABOUT_NAV_ICONS: Record<string, React.ReactNode> = {
  synopsis: <User size={18} className="nav-icon" />,
  arsenal: <Award size={18} className="nav-icon" />,
  blueprint: <Briefcase size={18} className="nav-icon" />,
  education: <GraduationCap size={18} className="nav-icon" />,
};

// Cross-page anchor links (e.g. footer "Services" clicked while on /about)
// need a client-side scroll pass once the target page has rendered, since
// react-router doesn't auto-scroll to a hash on navigation.
function ScrollToHash() {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
    return () => clearTimeout(t);
  }, [location.pathname, location.hash]);
  return null;
}

function NavBar() {
  const { language, toggleLanguage, t } = useLanguage();
  const location = useLocation();
  const isAboutPage = location.pathname.startsWith('/about');
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState('cyan');
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 50) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY.current) {
        if (!isOpenRef.current) setIsVisible(false); // Only hide if menu is not open
      } else if (currentScrollY < lastScrollY.current) {
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const themes = ['cyan', 'purple', 'green', 'orange'];

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, []);

  const handleThemeToggle = () => {
    const nextIndex = (themes.indexOf(theme) + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    setTheme(nextTheme);
    document.body.setAttribute('data-theme', nextTheme);
  };

  return (
    <>
      <div className="menu-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span>{isOpen ? '✕' : '☰'}</span>
      </div>
      {/* Tap outside the drawer to close it (mobile only — CSS keeps this
          invisible/inert on desktop). */}
      <div className={`nav-backdrop ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(false)} />
      <nav className={`nav-menu ${isVisible || isOpen ? 'active' : ''} ${isOpen ? 'mobile-open' : ''}`} id="navMenu">
        <div className="nav-container">
          <Link to="/" className="nav-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }} onClick={() => setIsOpen(false)}>
            <Logo size={32} />
            <span>UknowTechno</span>
          </Link>
          {isAboutPage ? (
            <ul className="nav-links">
              <li><Link to="/" onClick={() => setIsOpen(false)}><Home size={18} className="nav-icon" /><span className="nav-label">{t('navHome')}</span></Link></li>
              {ABOUT_SECTIONS.map((sec) => (
                <li key={sec.id}>
                  <a href={`#${sec.id}`} onClick={() => setIsOpen(false)}>{ABOUT_NAV_ICONS[sec.id]}<span className="nav-label">{t(sec.key as any)}</span></a>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="nav-links">
              <li><a href="#hero" onClick={() => setIsOpen(false)}>{HOME_NAV_ICONS.hero}<span className="nav-label">{t('navHome')}</span></a></li>
              <li><a href="#apps" onClick={() => setIsOpen(false)}>{HOME_NAV_ICONS.apps}<span className="nav-label">{t('navApps')}</span></a></li>
              <li><a href="#services" onClick={() => setIsOpen(false)}>{HOME_NAV_ICONS.services}<span className="nav-label">{t('navServices')}</span></a></li>
              <li><a href="#stack" onClick={() => setIsOpen(false)}>{HOME_NAV_ICONS.stack}<span className="nav-label">{t('navSkills')}</span></a></li>
              <li><a href="#connect" onClick={() => setIsOpen(false)}>{HOME_NAV_ICONS.connect}<span className="nav-label">{t('navConnect')}</span></a></li>
              <li><Link to="/about" onClick={() => setIsOpen(false)}><User size={18} className="nav-icon" /><span className="nav-label">{t('navAboutMe')}</span></Link></li>
            </ul>
          )}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button className="lang-toggle" onClick={toggleLanguage}>
              <span>🌐</span> <span>{language.toUpperCase()}</span>
            </button>
            <button className="theme-toggle" onClick={handleThemeToggle}>
              <span>🎨</span> <span style={{ textTransform: 'capitalize' }}>{theme}</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

function CustomCursor() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isHover, setIsHover] = useState(false);
  const [angle, setAngle] = useState(0);
  // Touch devices have no cursor — skip the rocket + fire trail entirely.
  const [hasPointer] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches
  );

  useEffect(() => {
    if (!hasPointer) return;
    let lastX = 0;
    let lastY = 0;

    const createTrail = (x: number, y: number, dx: number, dy: number) => {
      const mag = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / mag;
      const ny = dy / mag;
      // Spawn 15px behind the cursor
      const trailX = x - nx * 15;
      const trailY = y - ny * 15;

      const trail = document.createElement('div');
      trail.className = 'rocket-trail';
      trail.style.left = trailX + 'px';
      trail.style.top = trailY + 'px';

      // Randomize size and rotation for realistic fire
      const size = 6 + Math.random() * 6;
      trail.style.width = size + 'px';
      trail.style.height = size + 'px';

      document.body.appendChild(trail);
      setTimeout(() => trail.remove(), 600);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        const newAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        setAngle(newAngle + 90); // SVG points up by default, so offset by 90
      }

      lastX = e.clientX;
      lastY = e.clientY;
      setPos({ x: e.clientX, y: e.clientY });

      if (Math.random() > 0.3 && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        createTrail(e.clientX, e.clientY, dx, dy);
      }
    };

    const handleMouseOver = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('a, button, .tech-item, .project-card, .bento-item, .scroll-indicator, .float-btn')) {
        setIsHover(true);
      } else {
        setIsHover(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseover', handleMouseOver);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseover', handleMouseOver);
    };
  }, [hasPointer]);

  if (!hasPointer) return null;

  return (
    <div
      className={`custom-cursor-rocket ${isHover ? 'hover' : ''}`}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px) rotate(${angle}deg)`,
        position: 'fixed',
        top: -16,
        left: -16,
        width: '32px',
        height: '32px',
        pointerEvents: 'none',
        zIndex: 9999,
        transition: 'transform 0.05s linear',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: isHover ? 'drop-shadow(0 0 15px var(--accent-cyan)) scale(1.2)' : 'drop-shadow(0 0 8px var(--accent-cyan))'
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="var(--glass-bg)" stroke="var(--accent-cyan)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L9 9V18L12 21L15 18V9L12 2Z" fill="rgba(10, 25, 47, 0.8)"/>
        <path d="M9 16L4 20" />
        <path d="M15 16L20 20" />
        <circle cx="12" cy="11" r="2" fill="var(--accent-cyan)" />
      </svg>
    </div>
  );
}

function FloatingControls() {
  const { t } = useLanguage();
  const location = useLocation();
  const isAboutPage = location.pathname.startsWith('/about');
  const sections = isAboutPage ? ABOUT_SECTIONS : HOME_SECTIONS;
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [showIndicators, setShowIndicators] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;

      const atTop = scrollTop < 100;
      const atBottom = (window.innerHeight + scrollTop) >= document.body.offsetHeight - 100;
      const shouldShow = !atTop && !atBottom && scrollTop > window.innerHeight / 3;

      setShowIndicators(shouldShow);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
          entry.target.classList.add('visible');
          entry.target.classList.remove('morphing');
        } else {
          entry.target.classList.add('morphing');
        }
      });
    }, { threshold: 0.1 });

    const sectionElements = document.querySelectorAll('section');
    sectionElements.forEach(section => observer.observe(section));
    window.addEventListener('scroll', handleScroll);

    return () => {
      sectionElements.forEach(section => observer.unobserve(section));
      window.removeEventListener('scroll', handleScroll);
    };
  }, [location.pathname]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <div className={`scroll-indicators ${showIndicators ? 'visible' : 'hidden'}`}>
        {sections.map((sec) => (
          <div
            key={sec.id}
            className={`scroll-indicator ${activeSection === sec.id ? 'active' : ''}`}
            data-tooltip={t(sec.key as any)}
            onClick={() => scrollTo(sec.id)}
          />
        ))}
      </div>
      <div className={`floating-buttons ${showIndicators ? 'visible' : 'hidden'}`}>
        <button
          className="float-btn float-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title={t('floatTopTitle')}
          aria-label={t('floatTopAria')}
        >
          ↑
        </button>
      </div>
    </>
  );
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{padding: 50, color: 'white', background: 'red', position: 'fixed', zIndex: 999999, top:0, left:0, width: '100%', height: '100%'}}>
        <h1>Something went wrong.</h1>
        <pre>{this.state.error?.toString()}</pre>
        <pre>{this.state.error?.stack}</pre>
      </div>;
    }
    return this.props.children;
  }
}

function HomeLayout() {
  return (
    <>
      <BusinessHero />
      <AppsShowcase />
      <Services />
      <TrustStack />
      <Connect />
      <Contact />
    </>
  );
}

function AboutPageLayout() {
  return (
    <>
      <About />
      <Skills />
      <Experience />
      <Education />
      {/* Project Showcase and the "Get in Touch" contact block already live
          on the home page now — only the footer (product/nav links) repeats
          here, so About isn't a dead end. */}
      <Contact showContactSection={false} />
    </>
  );
}

function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <NavBar />
      <FloatingControls />
      <CanvasBackground />
      <div className="aurora-bg"></div>
      <div className="scan-lines"></div>

      <div style={{ position: 'relative', zIndex: 10 }}>
        {children}
      </div>

      <ChatWidget />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <CustomCursor />
        <ScrollToHash />
        <Routes>
          <Route path="/" element={<SiteChrome><HomeLayout /></SiteChrome>} />
          <Route path="/about" element={<SiteChrome><AboutPageLayout /></SiteChrome>} />
        </Routes>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
