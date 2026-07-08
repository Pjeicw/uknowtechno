export default function BusinessHome() {
  return (
    <div style={{ position: 'relative', zIndex: 10 }}>
      {/* Business Hero Section */}
      <section id="hero-business" className="hero" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="container hero-content" style={{ textAlign: 'center' }}>
          <img 
            src="/uknow_logo.png" 
            alt="UKnow Logo" 
            style={{ width: '150px', height: '150px', borderRadius: '20px', margin: '0 auto 2rem', boxShadow: '0 0 30px rgba(100, 255, 218, 0.4)' }} 
          />
          <h1 className="text-glow holo-text" style={{ fontSize: '4rem', marginBottom: '1rem' }}>UKnowTechno</h1>
          <h2 style={{ color: 'var(--text-light)', fontSize: '2rem', marginBottom: '1.5rem' }}>
            Building Modern Apps & Websites
          </h2>
          <p className="tagline" style={{ maxWidth: '600px', margin: '0 auto 2rem' }}>
            We specialize in crafting scalable digital products for individuals and corporates. 
            From MVP to Enterprise solutions, we bring your ideas to life.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <a href="#services" className="cta-button enhanced-glow">View Services</a>
            <a href="#products" className="cta-button" style={{ background: 'transparent', border: '1px solid var(--accent-cyan)' }}>Our Products</a>
          </div>
        </div>
      </section>

      {/* Products Showcase */}
      <section id="products" className="section-padding" style={{ padding: '4rem 0' }}>
        <div className="container">
          <h2 className="section-title text-glow">Featured Products</h2>
          <div className="bento-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '2rem' 
          }}>
            {/* Lao QR Parse */}
            <div className="bento-item glass-card hover-glow" style={{ padding: '2rem', borderRadius: '15px' }}>
              <div className="item-header" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>📱</span>
                <h3 style={{ color: 'var(--accent-cyan)', marginTop: '1rem' }}>Lao QR Parse: Pay & Budget</h3>
              </div>
              <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                An intuitive app for parsing QR codes, managing payments, and tracking your budget seamlessly. Currently in production on the Play Store.
              </p>
              <a href="https://play.google.com/store/apps/details?id=com.laoqrparser.app&hl=en" target="_blank" rel="noreferrer" className="tech-item" style={{ display: 'inline-block', padding: '0.5rem 1rem' }}>Play Store</a>
            </div>

            {/* OmniKit */}
            <div className="bento-item glass-card hover-glow" style={{ padding: '2rem', borderRadius: '15px' }}>
              <div className="item-header" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>🛠️</span>
                <h3 style={{ color: 'var(--accent-cyan)', marginTop: '1rem' }}>OmniKit - Toolkit</h3>
              </div>
              <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                Your all-in-one digital toolkit for everyday tasks. High performance, lightweight, and user-friendly. Available now.
              </p>
              <a href="https://play.google.com/store/apps/details?id=app.omnikit.android&hl=en" target="_blank" rel="noreferrer" className="tech-item" style={{ display: 'inline-block', padding: '0.5rem 1rem' }}>Play Store</a>
            </div>

            {/* Smart HR */}
            <div className="bento-item glass-card hover-glow" style={{ padding: '2rem', borderRadius: '15px' }}>
              <div className="item-header" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>👥</span>
                <h3 style={{ color: 'var(--accent-cyan)', marginTop: '1rem' }}>Smart HR: Attendance & Leave</h3>
              </div>
              <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                Streamline employee management with automated attendance tracking and leave requests. (Coming Soon)
              </p>
              <a href="https://play.google.com/store/apps/details?id=com.smarthr.app&hl=en" target="_blank" rel="noreferrer" className="tech-item" style={{ display: 'inline-block', padding: '0.5rem 1rem' }}>View Details</a>
            </div>

            {/* LinkZap */}
            <div className="bento-item glass-card hover-glow" style={{ padding: '2rem', borderRadius: '15px' }}>
              <div className="item-header" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>🍔</span>
                <h3 style={{ color: 'var(--accent-cyan)', marginTop: '1rem' }}>LinkZap: Easy Food</h3>
              </div>
              <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                Currently in development. A revolutionary app connecting food lovers with local eateries quickly and efficiently.
              </p>
              <span className="tech-item" style={{ display: 'inline-block', padding: '0.5rem 1rem', opacity: 0.7 }}>In Development</span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="section-padding" style={{ padding: '4rem 0' }}>
        <div className="container">
          <h2 className="section-title text-glow">Our Services</h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '2rem',
            marginBottom: '3rem'
          }}>
            <div className="glass-card hover-glow" style={{ padding: '2rem', borderRadius: '15px', border: '1px solid var(--accent-cyan)' }}>
              <h3 style={{ color: 'var(--accent-cyan)', fontSize: '1.5rem', marginBottom: '1rem' }}>Small Projects & MVPs</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#fff' }}>Free*</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', color: 'var(--text-light)', lineHeight: '1.8' }}>
                <li>✓ Basic Web / App Development</li>
                <li>✓ Standard UI/UX Design</li>
                <li>✓ Initial Consultation</li>
                <li>✓ Community Support</li>
              </ul>
              <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>*For qualified individuals and small non-profits.</p>
            </div>
            
            <div className="glass-card hover-glow" style={{ padding: '2rem', borderRadius: '15px', background: 'rgba(100, 255, 218, 0.05)' }}>
              <h3 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '1rem' }}>Corporate & Big Projects</h3>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--accent-cyan)' }}>Let's Discuss</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', color: 'var(--text-light)', lineHeight: '1.8' }}>
                <li>✓ Full-Scale Architecture & DB</li>
                <li>✓ Premium Custom Design & Animations</li>
                <li>✓ Advanced AI & Cloudflare Integrations</li>
                <li>✓ Dedicated PM & Ongoing Maintenance</li>
              </ul>
              <a href="#contact" className="cta-button enhanced-glow" style={{ display: 'inline-block', width: '100%', textAlign: 'center' }}>Get a Quote</a>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech-stack" className="section-padding" style={{ padding: '4rem 0' }}>
        <div className="container">
          <h2 className="section-title text-glow">Powered By Modern Stacks</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
            <span className="tech-item glow-hover">React</span>
            <span className="tech-item glow-hover">TypeScript</span>
            <span className="tech-item glow-hover">Vite</span>
            <span className="tech-item glow-hover">Python (FastAPI)</span>
            <span className="tech-item glow-hover">Cloudflare Workers & AI</span>
            <span className="tech-item glow-hover">Pocketbase</span>
            <span className="tech-item glow-hover">SQLite</span>
          </div>
        </div>
      </section>
      
      {/* Footer / Connect */}
      <section id="contact" className="section-padding" style={{ padding: '4rem 0' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 className="section-title text-glow">Connect With Us</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '2rem' }}>
            <a href="https://www.youtube.com/@UknowTechno/" target="_blank" rel="noreferrer" style={{ color: 'var(--text-light)', fontSize: '1.5rem', textDecoration: 'none' }}>YouTube</a>
            <a href="https://github.com/Pjeicw" target="_blank" rel="noreferrer" style={{ color: 'var(--text-light)', fontSize: '1.5rem', textDecoration: 'none' }}>GitHub</a>
            <a href="https://www.facebook.com/UknowTechno" target="_blank" rel="noreferrer" style={{ color: 'var(--text-light)', fontSize: '1.5rem', textDecoration: 'none' }}>Facebook</a>
          </div>
        </div>
      </section>
    </div>
  );
}
