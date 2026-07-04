import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CanvasBackground from './components/CanvasBackground';
import Hero3D from './components/Hero3D';
import Hero from './components/Hero';
import About from './components/About';
import Skills from './components/Skills';
import Experience from './components/Experience';
import Education from './components/Education';
import Projects from './components/Projects';
import Contact from './components/Contact';
import ChatWidget from './components/ChatWidget';
import AdminPanel from './components/AdminPanel';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import React, { useState, useEffect, useRef } from 'react';

function NavBar() {
  const { language, toggleLanguage, t } = useLanguage();
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
      <nav className={`nav-menu ${isVisible || isOpen ? 'active' : ''} ${isOpen ? 'mobile-open' : ''}`} id="navMenu">
        <div className="nav-container">
          <a href="#hero" className="nav-logo">UknowTechno</a>
          <ul className="nav-links">
            <li><a href="#synopsis" onClick={() => setIsOpen(false)}>{t('navAbout')}</a></li>
            <li><a href="#arsenal" onClick={() => setIsOpen(false)}>{t('navSkills')}</a></li>
            <li><a href="#blueprint" onClick={() => setIsOpen(false)}>{t('navExperience')}</a></li>
            <li><a href="#education" onClick={() => setIsOpen(false)}>{t('navEducation')}</a></li>
            <li><a href="#projects" onClick={() => setIsOpen(false)}>{t('navProjects')}</a></li>
            <li><a href="#contact" onClick={() => setIsOpen(false)}>{t('navContact')}</a></li>
          </ul>
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
  const [activeSection, setActiveSection] = useState('hero');
  const [showIndicators, setShowIndicators] = useState(false);

  const sections = [
    { id: 'hero', key: 'scrollHome' },
    { id: 'synopsis', key: 'scrollAbout' },
    { id: 'arsenal', key: 'scrollSkills' },
    { id: 'blueprint', key: 'scrollExperience' },
    { id: 'education', key: 'scrollEducation' },
    { id: 'projects', key: 'scrollProjects' },
    { id: 'contact', key: 'scrollContact' }
  ];

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
  }, []);

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

function PortfolioLayout() {
  return (
    <ErrorBoundary>
      <NavBar />
      <FloatingControls />
      <CanvasBackground />
      <div className="aurora-bg"></div>
      <div className="scan-lines"></div>
      
      <div style={{ position: 'relative', zIndex: 10 }}>
        <Hero />
        <About />
        <Skills />
        <Experience />
        <Education />
        <Projects />
        <Contact />
      </div>
      
      <ChatWidget />
    </ErrorBoundary>
  );
}

function AdminLayout() {
  return (
    <div className="admin-layout relative z-10 min-h-screen bg-[#0A192F] overflow-hidden flex flex-col">
      <CanvasBackground />
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
        <Hero3D />
      </div>
      
      {/* Admin Header */}
      <header className="relative z-20 w-full p-4 md:p-6 md:px-10 flex justify-between items-center gap-3 border-b border-[var(--accent-cyan)]/20 bg-[#0a192f]/80 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <a href="/" className="flex items-center gap-2 md:gap-3 text-gray-400 hover:text-[var(--accent-cyan)] transition-colors font-mono tracking-widest text-xs md:text-sm font-bold">
           <span className="text-xl leading-none">←</span> <span className="hidden sm:inline">RETURN TO PORTFOLIO</span><span className="sm:hidden">BACK</span>
        </a>
        <div className="flex items-center gap-2 md:gap-4">
           <div className="w-2 h-2 bg-[var(--accent-cyan)] rounded-full animate-pulse shadow-[0_0_10px_var(--accent-cyan)]"></div>
           <div className="text-[var(--accent-cyan)] font-black tracking-widest text-sm md:text-lg drop-shadow-[0_0_10px_rgba(100,255,218,0.5)]">
              SYSTEM ADMINISTRATION
           </div>
        </div>
      </header>

      <div className="relative z-10 w-full flex-1 flex items-center justify-center p-3 md:p-10">
        <AdminPanel />
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <CustomCursor />
        <Routes>
          <Route path="/" element={<PortfolioLayout />} />
          <Route path="/admin" element={<AdminLayout />} />
        </Routes>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
