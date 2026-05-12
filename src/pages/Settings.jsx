import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import ProductsManager from '../components/ProductsManager';
import '../index.css';

export default function Settings() {
  const { user, profile: ctxProfile, refreshProfile } = useAuth();

  const [pageLoading,  setPageLoading]  = useState(true);
  const [localProfile, setLocalProfile] = useState(null);
  const profile = ctxProfile || localProfile;

  // Mağaza
  const [shopName,   setShopName]   = useState('');
  const [shopSlug,   setShopSlug]   = useState('');
  const [shopSaving, setShopSaving] = useState(false);
  const [shopMsg,    setShopMsg]    = useState('');

  // Printify
  const [printifyToken,   setPrintifyToken]   = useState('');
  const [printifyShopId,  setPrintifyShopId]  = useState('');
  const [printifyShops,   setPrintifyShops]   = useState([]);
  const [printifySaving,  setPrintifySaving]  = useState(false);
  const [printifyMsg,     setPrintifyMsg]     = useState('');
  const [printifyLoading, setPrintifyLoading] = useState(false);

  // Etsy
  const [etsyToken,    setEtsyToken]    = useState('');
  const [etsyShopId,   setEtsyShopId]   = useState('');
  const [etsySaving,   setEtsySaving]   = useState(false);
  const [etsyMsg,      setEtsyMsg]      = useState('');
  const [etsyLoading,  setEtsyLoading]  = useState(false);

  useEffect(() => {
    if (!user) return;
    init();


  }, [user]);

  const init = async () => {
    setPageLoading(true);

    // Profile direkt çek
    let p = ctxProfile;
    if (!p) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      p = data;
      setLocalProfile(data);
    }

    if (p) {
      setShopName(p.shop_name || '');
      setShopSlug(p.shop_slug || '');
    }

    // Printify token
    const { data: pt } = await supabase
      .from('printify_tokens')
      .select('access_token, printify_shop_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (pt) {
      setPrintifyToken(pt.access_token || '');
      setPrintifyShopId(pt.printify_shop_id || '');
    }

    // Etsy token
    const { data: et } = await supabase
      .from('etsy_tokens')
      .select('access_token, etsy_shop_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (et) {
      setEtsyToken(et.access_token || '');
      setEtsyShopId(et.etsy_shop_id || '');
    }

    setPageLoading(false);
  };

  // ── Mağaza kaydet ────────────────────────────────────────
  const handleShopSave = async (e) => {
    e.preventDefault();
    setShopSaving(true);
    setShopMsg('');

    if (shopSlug.length < 3) {
      setShopMsg('error:Mağaza adresi en az 3 karakter olmalı.');
      setShopSaving(false);
      return;
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('shop_slug', shopSlug)
      .neq('id', user.id)
      .maybeSingle();

    if (existing) {
      setShopMsg('error:Bu mağaza adresi başkası tarafından alınmış.');
      setShopSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ shop_name: shopName, shop_slug: shopSlug })
      .eq('id', user.id);

    if (error) setShopMsg('error:Kaydedilemedi: ' + error.message);
    else {
      setShopMsg('success:Mağaza bilgileri güncellendi!');
      refreshProfile();
    }
    setShopSaving(false);
  };

  // ── Printify mağazalarını getir ──────────────────────────
  const handleFetchPrintifyShops = async () => {
    if (!printifyToken.trim()) { setPrintifyMsg('error:Lütfen token girin.'); return; }
    setPrintifyLoading(true);
    setPrintifyMsg('');
    try {
      // Doğrudan Printify CORS engeli — backend üzerinden çek
      const res  = await fetch(
        `https://saascustompod.onrender.com/api/printify/shops?token=${encodeURIComponent(printifyToken)}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data)) throw new Error('Beklenmeyen yanıt');
      setPrintifyShops(data);
      if (data.length === 1) setPrintifyShopId(String(data[0].id));
      setPrintifyMsg('success:Mağazalar yüklendi, birini seçin.');
    } catch {
      setPrintifyMsg('error:Token geçersiz veya Printify\'e bağlanılamadı.');
    }
    setPrintifyLoading(false);
  };

  // ── Printify kaydet ──────────────────────────────────────
  const handlePrintifySave = async () => {
    if (!printifyToken || !printifyShopId) {
      setPrintifyMsg('error:Token ve mağaza seçimi zorunlu.');
      return;
    }
    setPrintifySaving(true);
    const { error } = await supabase
      .from('printify_tokens')
      .upsert(
        { user_id: user.id, access_token: printifyToken, printify_shop_id: printifyShopId },
        { onConflict: 'user_id' }
      );
    if (error) setPrintifyMsg('error:Kaydedilemedi: ' + error.message);
    else setPrintifyMsg('success:Printify bağlantısı kaydedildi!');
    setPrintifySaving(false);
  };

  // ── Printify bağlantıyı kes ──────────────────────────────
  const handlePrintifyDisconnect = async () => {
    if (!confirm('Printify bağlantısını kesmek istediğinize emin misiniz?')) return;
    await supabase.from('printify_tokens').delete().eq('user_id', user.id);
    setPrintifyToken('');
    setPrintifyShopId('');
    setPrintifyShops([]);
    setPrintifyMsg('success:Bağlantı kesildi.');
  };

  // ── Etsy token blur — Shop ID otomatik çek ─────────────────
  const handleEtsyTokenBlur = async () => {
    if (!etsyToken.trim()) return;
    setEtsyMsg('');
    try {
      const res  = await fetch(
        `https://saascustompod.onrender.com/api/etsy/me?token=${encodeURIComponent(etsyToken)}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.shop_id) {
        setEtsyShopId(String(data.shop_id));
        setEtsyMsg('success:Mağaza bulundu: ' + data.login_name);
      }
    } catch (err) {
      setEtsyMsg('error:Shop ID çekilemedi: ' + err.message);
    }
  };

  // ── Etsy token kaydet ───────────────────────────────────────
  const handleEtsySave = async () => {
    if (!etsyToken.trim() || !etsyShopId.trim()) {
      setEtsyMsg('error:Token ve Shop ID zorunludur.');
      return;
    }
    setEtsySaving(true);
    setEtsyMsg('');
    const { error } = await supabase
      .from('etsy_tokens')
      .upsert({
        user_id:      user.id,
        access_token:  etsyToken.trim(),
        refresh_token: 'personal',
        expires_at:    9999999999999,
        etsy_shop_id:  etsyShopId.trim(),
      }, { onConflict: 'user_id' });

    if (error) setEtsyMsg('error:Kaydedilemedi: ' + error.message);
    else setEtsyMsg('success:Etsy bağlantısı kaydedildi!');
    setEtsySaving(false);
  };

  // ── Etsy bağlantıyı kes ──────────────────────────────────
  const handleEtsyDisconnect = async () => {
    if (!confirm('Etsy bağlantısını kesmek istediğinize emin misiniz?')) return;
    await supabase.from('etsy_tokens').delete().eq('user_id', user.id);
    setEtsyToken('');
    setEtsyShopId('');
    setEtsyMsg('success:Bağlantı kesildi.');
  };

  // ── Render ───────────────────────────────────────────────
  if (pageLoading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <div className="spinner" />
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Ayarlar yükleniyor...</p>
    </div>
  );

  return (
    <div style={s.page}>
      <div style={s.inner}>

        <div style={s.header}>
          <Link to="/dashboard" style={s.back}>← Dashboard</Link>
          <h1 style={s.title}>⚙️ Ayarlar</h1>
          <p style={s.subtitle}>Mağaza bilgilerinizi ve entegrasyonlarınızı yönetin.</p>
        </div>

        {/* ── Mağaza Bilgileri ── */}
        <section className="card" style={s.section}>
          <h2 style={s.sectionTitle}>🏪 Mağaza Bilgileri</h2>
          <p style={s.sectionDesc}>Müşteri sayfanızda görünecek bilgiler.</p>
          <form onSubmit={handleShopSave} style={s.form}>
            <div className="form-group">
              <label className="label">Mağaza Adı</label>
              <input
                className="input"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder="Örn: Jane's Shop"
                required
              />
            </div>
            <div className="form-group">
              <label className="label">Mağaza Adresi</label>
              <div style={{ display: 'flex' }}>
                <span style={s.slugPrefix}>{window.location.origin}/</span>
                <input
                  className="input"
                  style={{ borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', borderLeft: 'none' }}
                  value={shopSlug}
                  onChange={e => setShopSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="janes-shop"
                  minLength={3}
                  maxLength={40}
                  required
                />
              </div>
            </div>
            <StatusMsg msg={shopMsg} />
            <button type="submit" className="btn btn-primary" disabled={shopSaving} style={{ alignSelf: 'flex-start' }}>
              {shopSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </form>
        </section>

        {/* ── Printify ── */}
        <section className="card" style={s.section}>
          <h2 style={s.sectionTitle}>📦 Printify Entegrasyonu</h2>
          <p style={s.sectionDesc}>
            Kargo siparişleri Printify hesabınız üzerinden gönderilir.{' '}
            <a href="https://printify.com/app/account/api" target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>
              API token'ı buradan alın →
            </a>
          </p>
          <div style={s.form}>
            <div className="form-group">
              <label className="label">Printify API Token</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  type="password"
                  value={printifyToken}
                  onChange={e => { setPrintifyToken(e.target.value); setPrintifyShops([]); }}
                  placeholder="eyJhbGci..."
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleFetchPrintifyShops}
                  disabled={printifyLoading}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {printifyLoading ? '⏳' : '🔍 Mağazaları Getir'}
                </button>
              </div>
            </div>

            {printifyShops.length > 0 && (
              <div className="form-group">
                <label className="label">Printify Mağazası Seçin</label>
                <select
                  className="input"
                  value={printifyShopId}
                  onChange={e => setPrintifyShopId(e.target.value)}
                >
                  <option value="">-- Seçin --</option>
                  {printifyShops.map(shop => (
                    <option key={shop.id} value={shop.id}>
                      {shop.title} (ID: {shop.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {printifyShopId && !printifyShops.length && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Kayıtlı mağaza ID: <strong style={{ color: 'var(--success)' }}>{printifyShopId}</strong>
              </div>
            )}

            <StatusMsg msg={printifyMsg} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePrintifySave}
                disabled={printifySaving || !printifyToken || !printifyShopId}
              >
                {printifySaving ? 'Kaydediliyor...' : '💾 Kaydet'}
              </button>
              {printifyToken && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handlePrintifyDisconnect}
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                >
                  Bağlantıyı Kes
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Products ── */}
        <section className="card" style={s.section}>
          <h2 style={s.sectionTitle}>🖨️ Ürün Konfigürasyonları</h2>
          <p style={s.sectionDesc}>
            Müşterilerinize sunmak istediğiniz Printify ürünlerini buradan ekleyin.
            Her ürün için blueprint, provider ve variant seçmeniz yeterli.
          </p>
          <ProductsManager userId={user.id} printifyToken={printifyToken} />
        </section>

        {/* ── Etsy ── */}
        <section className="card" style={s.section}>
          <h2 style={s.sectionTitle}>🛍️ Etsy Entegrasyonu</h2>
          <div className="alert alert-warning">
            <strong>⏳ Yakında</strong> — Etsy entegrasyonu şu an devre dışı.
            Sipariş numarası doğrulaması olmadan siparişler alınmaya devam eder.
            Kargo adresleri ShippingModal'dan manuel girilir.
            <br /><br />
            Etsy Commercial Access onayı alındıktan sonra bu özellik aktif edilecek.
          </div>
        </section>

        {/* ── Hesap ── */}
        <section className="card" style={s.section}>
          <h2 style={s.sectionTitle}>👤 Hesap</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Row label="E-posta" value={profile?.email} />
            <Row label="Plan"    value={profile?.plan} />
            <Row
              label="Kredi"
              value={
                <span>
                  <strong style={{ color: 'var(--brand)', fontSize: 18 }}>{profile?.credits}</strong>
                  {' '}<Link to="/credits" style={{ color: 'var(--brand)', fontSize: 13 }}>+ Kredi satın al</Link>
                </span>
              }
            />
          </div>
        </section>

      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ fontSize: 14, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ minWidth: 80 }}>{label}:</span>
      <strong style={{ color: 'var(--text)' }}>{value}</strong>
    </div>
  );
}

function StatusMsg({ msg }) {
  if (!msg) return null;
  const isError = msg.startsWith('error:');
  const text    = msg.slice(msg.indexOf(':') + 1);
  return (
    <div className={`alert ${isError ? 'alert-error' : 'alert-success'}`}>
      {isError ? '❌ ' : '✅ '}{text}
    </div>
  );
}

const s = {
  page:    { minHeight: '100vh', background: 'var(--bg)', padding: '40px 20px' },
  inner:   { maxWidth: 640, margin: '0 auto' },
  header:  { marginBottom: 32 },
  back:    { color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, display: 'inline-block', marginBottom: 12 },
  title:   { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 },
  subtitle:{ color: 'var(--text-muted)', fontSize: 15 },
  section:      { marginBottom: 20, padding: 28 },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 },
  sectionDesc:  { fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 },
  form:    { display: 'flex', flexDirection: 'column', gap: 16 },
  slugPrefix: {
    padding: '11px 12px',
    background: 'var(--bg-hover)',
    border: '1px solid var(--border-light)',
    borderRight: 'none',
    borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
    fontSize: 12,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  connectedBox:  { padding: 20, background: 'var(--success-bg)', borderRadius: 'var(--radius)', border: '1px solid rgba(34,197,94,0.3)' },
  connectedBadge:{ fontSize: 15, fontWeight: 700, color: 'var(--success)' },
};