import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import OrdersTable    from '../components/OrdersTable';
import DesignWorkspace from '../components/DesignWorkspace';
import AdminTemplateManager  from '../components/AdminTemplateManager';
import '../index.css';
import AdminPromptTemplateManager from '../components/AdminPromptTemplateManager';
import { SITE_URL } from '../siteConfig';

const UI = {
  IDLE:          'IDLE',
  PROCESSING:    'PROCESSING',
  READY:         'READY',
  CONFIRM_ORDER: 'CONFIRM_ORDER',
  LINK_READY:    'LINK_READY',
};

// ── Google OAuth sonrası mağaza kurulum formu ─────────────
function OnboardingForm({ userId, onDone }) {
  const [shopName, setShopName] = useState('');
  const [shopSlug, setShopSlug] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSlug = (e) => setShopSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (shopSlug.length < 3) { setError('En az 3 karakter olmalı.'); return; }
    setLoading(true);
    setError('');

    const { data: existing } = await supabase
      .from('profiles').select('id').eq('shop_slug', shopSlug).maybeSingle();

    if (existing) { setError('Bu adres alınmış, başka dene.'); setLoading(false); return; }

    await supabase.from('profiles').update({ shop_name: shopName, shop_slug: shopSlug }).eq('id', userId);
    await onDone();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="form-group">
        <label className="label">Mağaza Adı</label>
        <input className="input" placeholder="Örn: Jane's Shop" value={shopName} onChange={e => setShopName(e.target.value)} required />
      </div>
      <div className="form-group">
        <label className="label">Mağaza Adresi</label>
        <input className="input" placeholder="janes-shop" value={shopSlug} onChange={handleSlug} required minLength={3} maxLength={40} />
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>www.snapmycase.com/{shopSlug || '...'}</span>
      </div>
      <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
        {loading ? 'Kaydediliyor...' : 'Mağazamı Kur →'}
      </button>
    </form>
  );
}

export default function Dashboard() {
  const { user, profile: ctxProfile, signOut, refreshProfile, needsOnboarding } = useAuth();
  const [localProfile, setLocalProfile] = useState(null);
  const profile = ctxProfile || localProfile;

  const [orders,      setOrders]      = useState({ revize: [], yeni: [], onay_bekliyor: [], onaylandi: [], tamamlandi: [] });
  const [templates,   setTemplates]   = useState([]);
  const [backgrounds, setBackgrounds] = useState([]);

  const [activeOrder,    setActiveOrder]    = useState(null);
  const [uiState,        setUiState]        = useState(UI.IDLE);
  const [finalImageUrl,  setFinalImageUrl]  = useState(null);
  const [mockups,        setMockups]        = useState([]);
  const [approvalLink,   setApprovalLink]   = useState('');
  const [errorMsg,       setErrorMsg]       = useState('');
  
  const [showTemplateAdmin,        setShowTemplateAdmin]        = useState(false);
  const [showPromptTemplateAdmin,  setShowPromptTemplateAdmin]  = useState(false);

  // ── Veri yükle ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (!ctxProfile) {
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => { if (data) setLocalProfile(data); });
    }
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const cat = { revize: [], yeni: [], onay_bekliyor: [], onaylandi: [], tamamlandi: [] };
      (orderData || []).forEach(o => { if (cat[o.status]) cat[o.status].push(o); });
      setOrders(cat);

      const { data: tData } = await supabase.from('templates').select('*').eq('is_active', true).order('sort_order');
      setTemplates(tData || []);

      const { data: bData } = await supabase.from('backgrounds').select('*').eq('is_active', true).order('sort_order');
      setBackgrounds(bData || []);
    } catch {
      setErrorMsg('Veriler yüklenemedi.');
    }
  };

  // ── Sipariş işle ─────────────────────────────────────────
  const handleProcessOrder = (order) => {
    setActiveOrder(order);
    setFinalImageUrl(null);
    setMockups([]);
    setUiState(UI.IDLE);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Onaya gönder ─────────────────────────────────────────
// ── Onaya gönder ─────────────────────────────────────────
 // ── Onaya gönder ─────────────────────────────────────────
  const handleSendForApproval = async (printFileB64, mockupList) => {
    if (!activeOrder) return;

    try {
      // 1. Base64 verisini performanslı bir şekilde Blob'a çeviriyoruz
      const base64Response = await fetch(printFileB64);
      const blob = await base64Response.blob();

      const fileName = `${user.id}/${activeOrder.id}_${Date.now()}.png`;

      // 2. Supabase Storage'a yükleme
      const { error: uploadErr } = await supabase.storage
        .from('orders')
        .upload(fileName, blob, { 
          contentType: 'image/png', 
          upsert: true 
        });
        
      if (uploadErr) throw new Error('Dosya yüklenemedi: ' + uploadErr.message);

      const { data: { publicUrl } } = supabase.storage.from('orders').getPublicUrl(fileName);

      // 3. Sipariş durumunu güncelle
      const { error: updateErr } = await supabase.from('orders').update({
        status:         'onay_bekliyor',
        mockup_urls:    mockupList, // Artık boş gönderiyoruz
        print_file_url: publicUrl,
      }).eq('id', activeOrder.id);

      if (updateErr) throw updateErr;

      // 4. Linki oluştur ve UI durumunu değiştir
      const link = `${SITE_URL}/onay/${activeOrder.id}`;
      setApprovalLink(link);
      setUiState(UI.LINK_READY); // Burası Dashboard'daki onay linki ekranını açar
      fetchAll();

    } catch (err) {
      console.error("Gönderim Hatası:", err);
      setErrorMsg('Tasarım gönderilemedi: ' + err.message);
    }
  };

  if (needsOnboarding) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div className="card" style={{ maxWidth: 440, width: '100%', textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Mağazanı Kur</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32, lineHeight: 1.6 }}>
          Google ile giriş yaptın. Müşteri sayfanı oluşturmak için mağaza bilgilerini gir.
        </p>
        <OnboardingForm userId={user.id} onDone={refreshProfile} />
      </div>
    </div>
  );

  const allOrders = [
    ...orders.revize,
    ...orders.yeni,
    ...orders.onay_bekliyor,
    ...orders.onaylandi,
  ];

  return (
    <div style={s.root}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <span>🎨</span>
          <span style={s.logoText}>SnapMyCase</span>
        </div>

        <div style={s.creditBox}>
          <div style={s.creditLabel}>Kredi Bakiyesi</div>
          <div style={s.creditValue}>{profile.credits}</div>
          <Link to="/credits" style={s.creditBtn}>+ Kredi Satın Al</Link>
        </div>

        <nav style={s.nav}>
          <div style={s.navActive}>📋 Siparişler</div>
          <Link to="/settings" style={s.navLink}>⚙️ Ayarlar</Link>
          <Link to="/credits"  style={s.navLink}>💳 Krediler</Link>
        </nav>

        {profile.shop_slug && (
          <div style={s.shopBox}>
            <div style={s.shopLabel}>Müşteri Sayfanız</div>
            <div style={s.shopSlug}>/{profile.shop_slug}</div>
            <button
              style={s.copyBtn}
              onClick={() => {
               navigator.clipboard.writeText(`${SITE_URL}/${profile.shop_slug}`);
                alert('Link kopyalandı!');
              }}
            >
              🔗 Kopyala
            </button>
          </div>
        )}

        {profile?.is_super_admin && (
          <>
            <button
              onClick={() => setShowTemplateAdmin(true)}
              style={{ ...s.signOut, color: 'var(--brand)', borderColor: 'var(--brand)', marginBottom: 4 }}
            >
              🖨️ Blueprint Templates
            </button>
            <button
              onClick={() => setShowPromptTemplateAdmin(true)}
              style={{ ...s.signOut, color: 'var(--brand)', borderColor: 'var(--brand)', marginBottom: 4 }}
            >
              🎨 AI Stil Şablonları
            </button>
          </>
        )}
        <button onClick={signOut} style={s.signOut}>Çıkış Yap</button>
      </aside>

      {/* ── Ana içerik ── */}
      <main style={s.main}>
        <div style={s.stats}>
          {[
            { label: 'Revize',        count: orders.revize.length,        color: 'var(--danger)' },
            { label: 'Yeni',          count: orders.yeni.length,          color: 'var(--info)' },
            { label: 'Onay Bekliyor', count: orders.onay_bekliyor.length, color: 'var(--warning)' },
            { label: 'Onaylanan',     count: orders.onaylandi.length,      color: 'var(--success)' },
          ].map(st => (
            <div key={st.label} className="card" style={{ ...s.statCard, borderLeftColor: st.color }}>
              <div style={s.statLabel}>{st.label}</div>
              <div style={{ ...s.statCount, color: st.color }}>{st.count}</div>
            </div>
          ))}
        </div>

        {errorMsg && <div className="alert alert-error" style={{ marginBottom: 16 }}>{errorMsg}</div>}

        <OrdersTable
          orders={allOrders}
          activeOrderId={activeOrder?.id}
          onProcess={handleProcessOrder}
          onRefresh={fetchAll}
          userId={user.id}
        />

        {uiState === UI.IDLE && !activeOrder && (
          <div className="card" style={s.empty}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
            <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Tasarım Masası Boş</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              Yukarıdan bir siparişi işlemeye başlayın.
            </p>
          </div>
        )}

        {activeOrder && uiState !== UI.LINK_READY && (
          <DesignWorkspace
            activeOrder={activeOrder}
            templates={templates}
            backgrounds={backgrounds}
            uiState={uiState}
            setUiState={setUiState}
            finalImageUrl={finalImageUrl}
            setFinalImageUrl={setFinalImageUrl}
            mockups={mockups}
            setMockups={setMockups}
            profile={profile}
            userId={user.id}
            onSendForApproval={handleSendForApproval}
            onRefreshProfile={refreshProfile}
          />
        )}

        {uiState === UI.LINK_READY && (
          <div className="card" style={{ textAlign: 'center', marginTop: 20, padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Onay Linki Hazır!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
              Müşterine göndereceğin onay linki hazırlandı.
            </p>
            <div style={s.linkBox}>{approvalLink}</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button
                className="btn btn-secondary"
                onClick={() => { navigator.clipboard.writeText(approvalLink); alert('Kopyalandı!'); }}
              >
                🔗 Kopyala
              </button>
              <button
                className="btn btn-primary"
                onClick={() => { setActiveOrder(null); setUiState(UI.IDLE); fetchAll(); }}
              >
                Sıradaki Sipariş
              </button>
            </div>
          </div>
        )}
      </main>

      {showTemplateAdmin && (
        <AdminTemplateManager onClose={() => setShowTemplateAdmin(false)} />
      )}
      {showPromptTemplateAdmin && profile?.is_super_admin && (
        <AdminPromptTemplateManager
          onClose={() => { setShowPromptTemplateAdmin(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

const s = {
  root:       { display: 'flex', minHeight: '100vh', background: 'var(--bg)' },
  sidebar:    { width: 240, minHeight: '100vh', background: 'var(--bg-card)', borderRight: '1px solid var(--border)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 0, alignSelf: 'flex-start', height: '100vh', overflowY: 'auto' },
  logo:       { display: 'flex', alignItems: 'center', gap: 10, fontSize: 22 },
  logoText:   { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--brand)' },
  creditBox:  { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, textAlign: 'center' },
  creditLabel:{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 },
  creditValue:{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800, color: 'var(--brand)', lineHeight: 1, marginBottom: 12 },
  creditBtn:  { display: 'block', padding: 8, background: 'var(--brand)', color: '#fff', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontSize: 13, fontWeight: 600 },
  nav:        { display: 'flex', flexDirection: 'column', gap: 4 },
  navActive:  { padding: '10px 12px', fontSize: 14, fontWeight: 600, color: 'var(--text)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-hover)' },
  navLink:    { padding: '10px 12px', fontSize: 14, color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', display: 'block' },
  shopBox:    { background: 'var(--bg)', border: '1px dashed var(--border-light)', borderRadius: 'var(--radius)', padding: 12 },
  shopLabel:  { fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 },
  shopSlug:   { fontSize: 13, fontWeight: 600, color: 'var(--brand)', wordBreak: 'break-all', marginBottom: 8 },
  copyBtn:    { width: '100%', padding: 6, background: 'transparent', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' },
  signOut:    { marginTop: 'auto', padding: 10, background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' },
  main:       { flex: 1, padding: '32px', maxWidth: 1000 },
  stats:      { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 },
  statCard:   { borderLeft: '4px solid', padding: '16px 20px' },
  statLabel:  { fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 },
  statCount:  { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800 },
  empty:      { textAlign: 'center', padding: '60px 20px', marginTop: 20, border: '2px dashed var(--border)' },
  linkBox:    { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: 14, color: 'var(--brand)', fontFamily: 'monospace', wordBreak: 'break-all' },
};