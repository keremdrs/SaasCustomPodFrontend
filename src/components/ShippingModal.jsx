import { useState } from 'react';
import { supabase } from '../lib/supabase';

const API = 'https://saascustompod.onrender.com';

const EMPTY_SHIPPING = {
  firstName: '', lastName: '', email: '', phone: '',
  country: 'US', region: '', address1: '', address2: '', city: '', zip: '',
};

export default function ShippingModal({ order, userId, onClose, onSuccess }) {
  const [shipping,          setShipping]          = useState(EMPTY_SHIPPING);
  const [isFetchingEtsy,    setIsFetchingEtsy]    = useState(false);
  const [isSending,         setIsSending]         = useState(false);
  const [etsyMsg,           setEtsyMsg]           = useState('');
  const [error,             setError]             = useState('');

  const set = (k) => (e) => setShipping(s => ({ ...s, [k]: e.target.value }));

  // ── Etsy'den adres çek ──────────────────────────────────
  const fetchFromEtsy = async () => {
    setIsFetchingEtsy(true);
    setEtsyMsg('');
    try {
      const res  = await fetch(`${API}/api/etsy/order/${order.etsy_order_no}?user_id=${userId}`);
      const data = await res.json();
      if (data.valid && data.shipping) {
        setShipping(s => ({ ...s, ...data.shipping }));
        setEtsyMsg('success');
      } else {
        setEtsyMsg('error:' + (data.error || 'Adres getirilemedi.'));
      }
    } catch {
      setEtsyMsg('error:Etsy API\'ye bağlanılamadı.');
    }
    setIsFetchingEtsy(false);
  };

  // ── Printify'a gönder ───────────────────────────────────
  const handleSend = async () => {
    const required = ['firstName', 'lastName', 'address1', 'city', 'zip', 'country'];
    const missing  = required.filter(k => !shipping[k].trim());
    if (missing.length) { setError('Lütfen tüm zorunlu alanları doldurun.'); return; }

    setIsSending(true);
    setError('');

    try {
      const res = await fetch(`${API}/api/create-draft-order`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image:             order.print_file_url,
          productId:         order.product_id || '11oz',
          shipping:          { ...shipping, address: shipping.address1 },
          user_id:           userId,
          seller_product_id: order.seller_product_id || null,
        }),
      });

      if (!res.ok) throw new Error(`Sunucu hatası: ${res.status}`);

      // Siparişi tamamlandı olarak işaretle
      await supabase
        .from('orders')
        .update({ status: 'tamamlandi' })
        .eq('id', order.id);

      onSuccess();
    } catch (err) {
      setError('Printify hatası: ' + err.message);
    }
    setIsSending(false);
  };

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && !isSending && onClose()}>
      <div style={styles.modal}>

        <div style={styles.header}>
          <h3 style={styles.title}>📦 Printify Kargo Bilgileri</h3>
          <button onClick={onClose} disabled={isSending} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.body}>

          {/* Etsy'den getir */}
          <button
            className="btn btn-primary btn-full"
            onClick={fetchFromEtsy}
            disabled={isFetchingEtsy || isSending}
            style={{ marginBottom: 8 }}
          >
            {isFetchingEtsy ? '⏳ Etsy\'den çekiliyor...' : '🔄 Adresi Etsy\'den Otomatik Getir'}
          </button>

          {etsyMsg === 'success' && (
            <div className="alert alert-success" style={{ marginBottom: 12 }}>
              ✅ Adres başarıyla getirildi!
            </div>
          )}
          {etsyMsg.startsWith('error:') && (
            <div className="alert alert-error" style={{ marginBottom: 12 }}>
              ❌ {etsyMsg.slice(6)}
            </div>
          )}

          <div style={styles.divider}>— veya manuel girin —</div>

          {/* Kişisel bilgiler */}
          <div style={styles.sectionTitle}>Kişisel Bilgiler</div>
          <div style={styles.row}>
            <Field label="Ad *"    value={shipping.firstName} onChange={set('firstName')} />
            <Field label="Soyad *" value={shipping.lastName}  onChange={set('lastName')} />
          </div>
          <div style={styles.row}>
            <Field label="E-posta" value={shipping.email} onChange={set('email')} type="email" />
            <Field label="Telefon" value={shipping.phone} onChange={set('phone')} />
          </div>

          {/* Adres */}
          <div style={styles.sectionTitle}>Teslimat Adresi</div>
          <div style={styles.row}>
            <Field label="Ülke * (ISO)" value={shipping.country} onChange={set('country')} />
            <Field label="Eyalet"       value={shipping.region}  onChange={set('region')} />
          </div>
          <Field label="Adres 1 *" value={shipping.address1} onChange={set('address1')} />
          <Field label="Adres 2"   value={shipping.address2} onChange={set('address2')} />
          <div style={styles.row}>
            <Field label="Şehir *"       value={shipping.city} onChange={set('city')} />
            <Field label="Posta Kodu *"  value={shipping.zip}  onChange={set('zip')} />
          </div>

          {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSending}
            style={{ flex: 1 }}
          >
            İptal
          </button>
          <button
            className="btn btn-success"
            onClick={handleSend}
            disabled={isSending}
            style={{ flex: 2 }}
          >
            {isSending ? '⏳ Gönderiliyor...' : "✅ Printify'a Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div className="form-group" style={{ marginBottom: 10, flex: 1 }}>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20,
  },
  modal: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: 520,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 16,
    fontWeight: 700,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 18,
    cursor: 'pointer',
    padding: '4px 8px',
  },
  body: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    gap: 10,
  },
  divider: {
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--text-dim)',
    margin: '12px 0 16px',
  },
  sectionTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--brand)',
    marginBottom: 10,
    marginTop: 4,
  },
  row: {
    display: 'flex',
    gap: 10,
  },
};