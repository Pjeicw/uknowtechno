import { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function About() {
  const { t } = useLanguage();
  const [showLearningLinks, setShowLearningLinks] = useState(false);

  return (
    <section id="synopsis">
      <div className="container">
        <h2 className="section-header">{t('synopsisHeader')}</h2>
        <div className="bento-grid">
          <div className="bento-item bento-large glass glow">
            <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '1rem' }}>{t('profileTitle')}</h3>
            <p>{t('profileText')}</p>
          </div>
          <div className="bento-item glass glow">
            <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '1rem' }}>{t('interestsTitle')}</h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
              
              {/* Learning Tech with Popup */}
              <div style={{ position: 'relative' }}>
                <div 
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => setShowLearningLinks(true)}
                  className="group"
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }} className="group-hover:scale-110 transition-transform">💻</div>
                  <span className="group-hover:text-[var(--accent-cyan)] transition-colors font-semibold">{t('interestTech')}</span>
                </div>
              </div>

              {/* Adventure Link */}
              <a href="https://worldadventuretours.com/" target="_blank" rel="noreferrer" style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }} className="group">
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }} className="group-hover:scale-110 transition-transform">🏞️</div>
                <span className="group-hover:text-[var(--accent-cyan)] transition-colors font-semibold">{t('interestAdventure')}</span>
              </a>
              
              {/* Sport Link */}
              <a href="https://www.bbc.com/sport/football" target="_blank" rel="noreferrer" style={{ textAlign: 'center', textDecoration: 'none', color: 'inherit' }} className="group">
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }} className="group-hover:scale-110 transition-transform">⚽</div>
                <span className="group-hover:text-[var(--accent-cyan)] transition-colors font-semibold">{t('interestSports')}</span>
              </a>

            </div>
          </div>
        </div>
      </div>
      
      {/* Learning Tech Popup Modal */}
      {showLearningLinks && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(10, 25, 47, 0.8)',
          backdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} onClick={() => setShowLearningLinks(false)}>
          <div style={{
            background: 'rgba(17, 34, 64, 0.95)',
            border: '1px solid var(--accent-cyan)',
            boxShadow: '0 10px 40px rgba(100,255,218,0.2)',
            borderRadius: '16px',
            padding: '24px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            minWidth: '250px',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setShowLearningLinks(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
              className="hover:text-[var(--accent-cyan)] transition-colors"
            >
              ✕
            </button>
            <h3 style={{ color: 'var(--accent-cyan)', textAlign: 'center', marginBottom: '8px', fontSize: '1.2rem' }}>Learning Resources</h3>
            <a href="https://www.geeksforgeeks.org/" target="_blank" rel="noreferrer" className="text-base text-gray-200 hover:text-[var(--accent-cyan)] transition-colors text-center font-medium bg-[#0A192F] py-3 rounded-lg border border-[#1e293b] hover:border-[var(--accent-cyan)]/50">GeeksforGeeks</a>
            <a href="https://www.w3schools.com/" target="_blank" rel="noreferrer" className="text-base text-gray-200 hover:text-[var(--accent-cyan)] transition-colors text-center font-medium bg-[#0A192F] py-3 rounded-lg border border-[#1e293b] hover:border-[var(--accent-cyan)]/50">W3Schools</a>
            <a href="https://www.tpointtech.com/" target="_blank" rel="noreferrer" className="text-base text-gray-200 hover:text-[var(--accent-cyan)] transition-colors text-center font-medium bg-[#0A192F] py-3 rounded-lg border border-[#1e293b] hover:border-[var(--accent-cyan)]/50">TPointTech</a>
          </div>
        </div>
      )}
    </section>
  );
}
