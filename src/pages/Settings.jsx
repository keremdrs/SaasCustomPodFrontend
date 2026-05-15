import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
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

  useEffect(() => {
    if (!user) return;
    init();
  }, [user]);

  const init = async () => {
    setPageLoading(true);

    // Profili çek
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

    // Başkası bu adresi almış mı?
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

    if (error) {
      setShopMsg('error:Kaydedilemedi: ' + error.message);
    } else {
      setShopMsg('success:Mağaza bilgileri güncellendi!');
      refreshProfile();
    }
    setShopSaving(false);
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
          <p style={s.subtitle}>Mağaza bilgilerinizi ve hesap detaylarınızı yönetin.</p>
        </div>

        {/* ── Mağaza Bilgileri ── */}
        <section className="card" style={s.section}>
          <h2 style={s.sectionTitle}>🏪 Mağaza Bilgileri</h2>
          <p style={s.sectionDesc}>
            Müşterilerinizin fotoğraf yüklerken göreceği mağaza adı ve siparişleri toplayacağınız özel link adresiniz.
          </p>
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
              <label className="label">Mağaza Adresi (Linkiniz)</label>
              <div style={{ display: 'flex' }}>
                <span style={s.slugPrefix}>{window.location.host}/</span>
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

        {/* ── Hesap Bilgileri ── */}
        <section className="card" style={s.section}>
          <h2 style={s.sectionTitle}>👤 Hesap Detayları</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row label="E-posta" value={profile?.email} />
            <Row label="Plan"    value={profile?.plan || 'Standart'} />
            <Row
              label="Kredi Bakiyesi"
              value={
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <strong style={{ color: 'var(--brand)', fontSize: 20 }}>{profile?.credits}</strong>
                  <Link to="/credits" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }}>
                    + Kredi Yükle
                  </Link>
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
      <span style={{ minWidth: 100 }}>{label}:</span>
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
};