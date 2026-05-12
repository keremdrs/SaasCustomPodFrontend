import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

/* ─── Google Fonts ─────────────────────────────────────────────────────────── */
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap';

/* ─── DATA ──────────────────────────────────────────────────────────────────── */
const STATS = [
  { value: '2 min',  label: 'Average AI design time' },
  { value: '95%',   label: 'Customer approval rate' },
  { value: '10×',   label: 'More orders, same effort' },
  { value: '$0',    label: 'Monthly subscription' },
];

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI Face Personalization',
    desc: 'Two AI models — InstantID for speed, FLUX PuLID for quality. Transform any customer photo into a stunning custom product design in under 2 minutes.',
  },
  {
    icon: '🎨',
    title: 'Live 3D Product Preview',
    desc: 'See exactly how the final product looks before sending it to print. Drag, scale, and position the design on a live 3D product preview.',
  },
  {
    icon: '✅',
    title: 'Customer Approval Links',
    desc: 'Send a private link to your customer. They approve or request changes. You only send to print when they\'re 100% happy.',
  },
  {
    icon: '📦',
    title: 'One-Click Printify',
    desc: 'Approved designs go straight to your Printify account. No copy-pasting, no manual uploads. Just click and ship.',
  },
  {
    icon: '🏪',
    title: 'Your Own Upload Page',
    desc: 'Every seller gets a unique URL (snapmycase.com/your-shop). Share it with customers so they can upload their photo and order number.',
  },
  {
    icon: '💳',
    title: 'Pay Per Use',
    desc: 'No monthly fees. Buy credits and spend them only when you process an order. Slow month? You pay nothing.',
  },
];

const STEPS = [
  { no: '01', title: 'Customer uploads a photo', desc: 'They visit your personal upload page, enter their Etsy order number, and upload a clear photo.' },
  { no: '02', title: 'You generate the AI design', desc: 'Pick a style template, hit Standard or Premium AI — the personalized design is ready in under 2 minutes.' },
  { no: '03', title: 'Customer approves the design', desc: 'Share a private preview link. They approve or leave revision notes — you revise and resend until perfect.' },
  { no: '04', title: 'One click to Printify', desc: 'The final print-ready file goes straight to Printify. Printing, packing and shipping are all handled for you.' },
];

const CREDIT_COSTS = [
  { action: '⚡ Standard AI (InstantID)',    cost: '2 credits', fast: true },
  { action: '🎨 Premium AI (FLUX PuLID)',    cost: '5 credits', fast: false },
  { action: '📸 Printify Mockup Generation', cost: '1 credit',  fast: true },
  { action: '🚀 Send Order to Printify',     cost: 'Free',      fast: true },
  { action: '🔗 Customer Approval Link',     cost: 'Free',      fast: true },
];

const PACKAGES = [
  { name: 'Starter',  credits: 20,  price: '$12', per: '$0.60/credit', desc: '~10 standard designs',  popular: false },
  { name: 'Growth',   credits: 60,  price: '$29', per: '$0.48/credit', desc: '~30 standard designs',  popular: true  },
  { name: 'Pro',      credits: 150, price: '$59', per: '$0.39/credit', desc: '~75 standard designs',  popular: false },
];

const FAQS = [
  { q: 'Do I need a Printify account?', a: 'Yes. You connect your own Printify account in Settings. Orders go directly to your Printify shop — you keep full control of your products and pricing.' },
  { q: 'What happens if the customer doesn\'t like the design?', a: 'They can leave revision notes on the approval page. The order is flagged for revision in your dashboard and you regenerate with their feedback.' },
  { q: 'Can I use my own AI-generated images?', a: 'Absolutely. You can upload any image directly in the design workspace instead of using AI generation, using 0 credits.' },
  { q: 'How is the credit system different from a subscription?', a: 'You only pay for what you use. If you have a slow week, you spend nothing. Credits don\'t expire.' },
  { q: 'Is there a free trial?', a: 'Sign up is free. You get 0 credits to start — buy a Starter pack to process your first orders.' },
];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_LINK;
    document.head.appendChild(link);

    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={s.page}>
      <style>{CSS}</style>

      {/* ── NAV ── */}
      <nav style={{ ...s.nav, ...(scrolled ? s.navScrolled : {}) }}>
        <div style={s.navInner}>
          <div style={s.logo}>
            <span style={s.logoCup}>🎨</span>
            <span style={s.logoName}>SnapMyCase</span>
          </div>
          <div style={s.navLinks}>
            <a href="#features" style={s.navLink}>Features</a>
            <a href="#how" style={s.navLink}>How it works</a>
            <a href="#pricing" style={s.navLink}>Pricing</a>
            <Link to="/login"    style={s.navLink}>Sign in</Link>
            <Link to="/register" style={s.navCta}>Start free →</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={s.hero}>
        <div style={s.heroBg} />
        <div style={s.heroInner}>
          <div style={s.heroTag}>AI Personalization for POD Sellers</div>
          <h1 style={s.heroTitle}>
            Turn Customer Photos<br />
            Into Print-Ready<br />
            <span style={s.heroAccent}>Designs. Fast.</span>
          </h1>
          <p style={s.heroSub}>
            Works for mugs, phone cases, t-shirts, canvas prints, and any Printify product.
            AI personalization · customer approval · one-click fulfillment. All in one place.
          </p>
          <div style={s.heroCtas}>
            <Link to="/register" style={s.ctaPrimary}>
              Get started free
              <span style={s.ctaArrow}>→</span>
            </Link>
            <a href="#how" style={s.ctaSecondary}>See how it works</a>
          </div>
          <p style={s.heroNote}>No monthly fee · Pay only per order · Cancel anytime</p>
        </div>

        {/* Floating mockup cards */}
        <div style={s.heroVisual}>
          <div style={s.mockupCard} className="float-a">
            <div style={s.mockupLabel}>Customer uploads</div>
            <div style={s.mockupIcon}>📸</div>
            <div style={s.mockupText}>Order #1234567<br />Photo received</div>
          </div>
          <div style={{ ...s.mockupCard, ...s.mockupCardB }} className="float-b">
            <div style={s.mockupLabel}>AI Design ready</div>
            <div style={s.mockupIcon}>🤖</div>
            <div style={s.mockupText}>Generated in<br /><strong style={{ color: 'var(--brand)' }}>1m 43s</strong></div>
          </div>
          <div style={{ ...s.mockupCard, ...s.mockupCardC }} className="float-c">
            <div style={s.mockupLabel}>Customer approved</div>
            <div style={s.mockupIcon}>✅</div>
            <div style={s.mockupText}>Sent to Printify<br />automatically</div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={s.stats}>
        {STATS.map(st => (
          <div key={st.label} style={s.stat}>
            <div style={s.statValue}>{st.value}</div>
            <div style={s.statLabel}>{st.label}</div>
          </div>
        ))}
      </section>

      {/* ── FEATURES ── */}
      <section style={s.section} id="features">
        <div style={s.sectionInner}>
          <div style={s.pill}>Everything you need</div>
          <h2 style={s.sectionTitle}>Built for POD sellers<br />who take personalization seriously</h2>
          <div style={s.featureGrid}>
            {FEATURES.map((f, i) => (
              <div key={f.title} style={{ ...s.featureCard, animationDelay: `${i * 0.08}s` }} className="fade-up">
                <div style={s.featureIcon}>{f.icon}</div>
                <h3 style={s.featureTitle}>{f.title}</h3>
                <p style={s.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ ...s.section, ...s.darkSection }} id="how">
        <div style={s.sectionInner}>
          <div style={s.pill}>Simple workflow</div>
          <h2 style={s.sectionTitle}>From order to shipment<br />in four steps</h2>
          <div style={s.stepsGrid}>
            {STEPS.map((st, i) => (
              <div key={st.no} style={s.step}>
                <div style={s.stepNo}>{st.no}</div>
                {i < STEPS.length - 1 && <div style={s.stepLine} />}
                <h3 style={s.stepTitle}>{st.title}</h3>
                <p style={s.stepDesc}>{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section style={s.section} id="pricing">
        <div style={s.sectionInner}>
          <div style={s.pill}>Transparent pricing</div>
          <h2 style={s.sectionTitle}>Pay only for what you use</h2>
          <p style={s.sectionSub}>No subscriptions. No hidden fees. Credits never expire.</p>

          {/* Cost table */}
          <div style={s.costTable}>
            <div style={s.costHeader}>What each action costs</div>
            {CREDIT_COSTS.map(row => (
              <div key={row.action} style={s.costRow}>
                <span style={s.costAction}>{row.action}</span>
                <span style={{
                  ...s.costVal,
                  color: row.cost === 'Free' ? 'var(--success)' : 'var(--brand)'
                }}>{row.cost}</span>
              </div>
            ))}
          </div>

          {/* Packages */}
          <div style={s.packages}>
            {PACKAGES.map(p => (
              <div key={p.name} style={{ ...s.package, ...(p.popular ? s.packagePopular : {}) }}>
                {p.popular && <div style={s.popularBadge}>MOST POPULAR</div>}
                <div style={s.packageName}>{p.name}</div>
                <div style={s.packageCredits}>
                  <span style={s.packageNum}>{p.credits}</span>
                  <span style={s.packageCreditWord}>credits</span>
                </div>
                <div style={s.packagePrice}>{p.price}</div>
                <div style={s.packagePer}>{p.per}</div>
                <div style={s.packageDesc}>{p.desc}</div>
                <Link to="/register" style={{ ...s.packageBtn, ...(p.popular ? s.packageBtnPopular : {}) }}>
                  Get started →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ ...s.section, ...s.darkSection }}>
        <div style={{ ...s.sectionInner, maxWidth: 680 }}>
          <div style={s.pill}>FAQ</div>
          <h2 style={s.sectionTitle}>Common questions</h2>
          <div style={s.faqList}>
            {FAQS.map((faq, i) => (
              <div
                key={i}
                style={s.faqItem}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <div style={s.faqQ}>
                  <span>{faq.q}</span>
                  <span style={{ ...s.faqChevron, transform: openFaq === i ? 'rotate(180deg)' : 'none' }}>
                    ↓
                  </span>
                </div>
                {openFaq === i && <div style={s.faqA}>{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={s.ctaSection}>
        <div style={s.ctaInner}>
          <div style={s.ctaBig}>🎨</div>
          <h2 style={s.ctaTitle}>Ready to scale your<br />POD business with AI?</h2>
          <p style={s.ctaSub}>Mugs, cases, prints, apparel — personalize any product, ship faster, earn more.</p>
          <Link to="/register" style={s.ctaPrimaryLg}>
            Create your free account →
          </Link>
          <p style={s.ctaNote}>No credit card required to sign up</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.logo}>
            <span>🎨</span>
            <span style={s.logoName}>SnapMyCase</span>
          </div>
          <div style={s.footerLinks}>
            <a href="#features" style={s.footerLink}>Features</a>
            <a href="#pricing"  style={s.footerLink}>Pricing</a>
            <Link to="/login"   style={s.footerLink}>Sign in</Link>
            <Link to="/register" style={s.footerLink}>Register</Link>
          </div>
          <div style={s.footerNote}>
            © {new Date().getFullYear()} SnapMyCase · The term "Etsy" is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── STYLES ────────────────────────────────────────────────────────────────── */
const s = {
  page:  { background: '#080808', color: '#f0f0f0', fontFamily: "'Plus Jakarta Sans', sans-serif", overflowX: 'hidden' },

  /* NAV */
  nav: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '20px 0', transition: 'all 0.3s ease' },
  navScrolled: { background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 0' },
  navInner: { maxWidth: 1200, margin: '0 auto', padding: '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo:    { display: 'flex', alignItems: 'center', gap: 10 },
  logoCup: { fontSize: 24 },
  logoName:{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, color: '#F56400' },
  navLinks:{ display: 'flex', alignItems: 'center', gap: 32 },
  navLink: { color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' },
  navCta:  { background: '#F56400', color: '#fff', padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none', transition: 'background 0.2s' },

  /* HERO */
  hero: { minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative', padding: '120px 40px 80px', overflow: 'hidden' },
  heroBg: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(245,100,0,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 20%, rgba(245,100,0,0.06) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  heroInner: { maxWidth: 680, position: 'relative', zIndex: 1 },
  heroTag:   { display: 'inline-block', border: '1px solid rgba(245,100,0,0.4)', color: '#F56400', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, marginBottom: 32, letterSpacing: 0.5 },
  heroTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(52px, 7vw, 96px)', lineHeight: 1.05, letterSpacing: 2, marginBottom: 24, color: '#fff' },
  heroAccent:{ color: '#F56400' },
  heroSub:   { fontSize: 18, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 40, maxWidth: 520 },
  heroCtas:  { display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 },
  ctaPrimary:{ background: '#F56400', color: '#fff', padding: '16px 32px', borderRadius: 10, fontSize: 16, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, transition: 'transform 0.2s, background 0.2s' },
  ctaArrow:  { transition: 'transform 0.2s' },
  ctaSecondary:{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 15, fontWeight: 500, display: 'inline-flex', alignItems: 'center', padding: '16px 0' },
  heroNote:  { fontSize: 13, color: 'rgba(255,255,255,0.3)' },

  /* HERO VISUAL */
  heroVisual: { position: 'absolute', right: '5%', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 16, zIndex: 1 },
  mockupCard: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '20px 24px', minWidth: 200,
    backdropFilter: 'blur(12px)',
  },
  mockupCardB: { marginLeft: 40 },
  mockupCardC: { marginLeft: 20 },
  mockupLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#F56400', textTransform: 'uppercase', marginBottom: 10 },
  mockupIcon:  { fontSize: 28, marginBottom: 8 },
  mockupText:  { fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 },

  /* STATS */
  stats: { borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'center', gap: 0 },
  stat:      { flex: 1, maxWidth: 240, padding: '40px 20px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.06)' },
  statValue: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, letterSpacing: 2, color: '#F56400', lineHeight: 1 },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8, fontWeight: 500 },

  /* SECTIONS */
  section:     { padding: '100px 40px' },
  darkSection: { background: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  sectionInner:{ maxWidth: 1100, margin: '0 auto' },
  pill:        { display: 'inline-block', background: 'rgba(245,100,0,0.12)', color: '#F56400', border: '1px solid rgba(245,100,0,0.25)', padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20 },
  sectionTitle:{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px, 4vw, 56px)', letterSpacing: 2, lineHeight: 1.1, marginBottom: 16, color: '#fff' },
  sectionSub:  { fontSize: 16, color: 'rgba(255,255,255,0.45)', marginBottom: 56, lineHeight: 1.7 },

  /* FEATURES */
  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, overflow: 'hidden', marginTop: 56 },
  featureCard: { background: '#080808', padding: '36px 32px', transition: 'background 0.2s' },
  featureIcon: { fontSize: 32, marginBottom: 16 },
  featureTitle:{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: '#fff' },
  featureDesc: { fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 },

  /* HOW IT WORKS */
  stepsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 40, marginTop: 56, position: 'relative' },
  step:      { position: 'relative' },
  stepNo:    { fontFamily: "'Bebas Neue', sans-serif", fontSize: 72, color: 'rgba(245,100,0,0.15)', lineHeight: 1, marginBottom: 16, letterSpacing: 3 },
  stepLine:  { display: 'none' },
  stepTitle: { fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 10 },
  stepDesc:  { fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 },

  /* PRICING */
  costTable:  { background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', maxWidth: 580, marginBottom: 64 },
  costHeader: { padding: '16px 24px', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  costRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 14 },
  costAction: { color: 'rgba(255,255,255,0.65)' },
  costVal:    { fontWeight: 700, fontSize: 15 },

  packages:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 780 },
  package:        { background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '32px 28px', position: 'relative' },
  packagePopular: { border: '1px solid rgba(245,100,0,0.5)', background: 'rgba(245,100,0,0.04)' },
  popularBadge:   { position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#F56400', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 14px', borderRadius: 20, letterSpacing: 1, whiteSpace: 'nowrap' },
  packageName:    { fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, marginBottom: 16, color: '#fff' },
  packageCredits: { display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 },
  packageNum:     { fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: '#F56400', lineHeight: 1, letterSpacing: 2 },
  packageCreditWord:{ fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  packagePrice:   { fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 4 },
  packagePer:     { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 4 },
  packageDesc:    { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 28 },
  packageBtn:     { display: 'block', textAlign: 'center', padding: '12px', background: 'rgba(255,255,255,0.06)', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)', transition: 'background 0.2s' },
  packageBtnPopular:{ background: '#F56400', border: '1px solid #F56400' },

  /* FAQ */
  faqList: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 56 },
  faqItem:  { background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '20px 24px', cursor: 'pointer', userSelect: 'none' },
  faqQ:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 600, color: '#fff' },
  faqChevron:{ transition: 'transform 0.2s', color: '#F56400', fontSize: 18 },
  faqA:     { marginTop: 14, fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8 },

  /* FINAL CTA */
  ctaSection: { padding: '120px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' },
  ctaInner:   { position: 'relative', zIndex: 1 },
  ctaBig:     { fontSize: 64, marginBottom: 24 },
  ctaTitle:   { fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(40px, 5vw, 72px)', letterSpacing: 2, lineHeight: 1.1, color: '#fff', marginBottom: 16 },
  ctaSub:     { fontSize: 18, color: 'rgba(255,255,255,0.4)', marginBottom: 48 },
  ctaPrimaryLg:{ display: 'inline-block', background: '#F56400', color: '#fff', padding: '18px 40px', borderRadius: 12, fontSize: 18, fontWeight: 700, textDecoration: 'none' },
  ctaNote:    { marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.25)' },

  /* FOOTER */
  footer:      { borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px' },
  footerInner: { maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 },
  footerLinks: { display: 'flex', gap: 28 },
  footerLink:  { color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: 13, fontWeight: 500 },
  footerNote:  { fontSize: 12, color: 'rgba(255,255,255,0.2)', maxWidth: 500, textAlign: 'right', lineHeight: 1.6 },
};

/* ─── CSS ANIMATIONS ────────────────────────────────────────────────────────── */
const CSS = `
  @keyframes floatA {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-12px); }
  }
  @keyframes floatB {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-18px); }
  }
  @keyframes floatC {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .float-a { animation: floatA 4s ease-in-out infinite; }
  .float-b { animation: floatB 5s ease-in-out infinite 0.5s; }
  .float-c { animation: floatC 3.5s ease-in-out infinite 1s; }
  .fade-up { animation: fadeUp 0.6s ease-out both; }
  
  a:hover { opacity: 0.85; }
  
  @media (max-width: 768px) {
    nav .navLinks { display: none; }
    .heroVisual { display: none; }
  }
`;