import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../index.css';

export default function CustomerApproval() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [revizeNotu, setRevizeNotu] = useState('');
  const [showRevize, setShowRevize] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Siparişi getir
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('orders')
          // profiles tablosundan shop_name'i de alıyoruz ki sayfada satıcının dükkan adı görünsün
          .select('id, etsy_order_no, status, print_file_url, customer_name, profiles(shop_name)')
          .eq('id', orderId)
          .single();
          
        if (fetchErr) throw fetchErr;
        setOrder(data);
      } catch (err) {
        setError('Sipariş bulunamadı veya bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId]);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await supabase.from('orders').update({ status: 'onaylandi' }).eq('id', orderId);
      setOrder({ ...order, status: 'onaylandi' });
    } catch (err) {
      alert('Bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevize = async () => {
    if (!revizeNotu.trim()) {
      alert('Lütfen revize isteğinizi yazın.');
      return;
    }
    setIsSubmitting(true);
    try {
      await supabase.from('orders').update({ 
        status: 'revize',
        customer_note: revizeNotu 
      }).eq('id', orderId);
      setOrder({ ...order, status: 'revize' });
    } catch (err) {
      alert('Bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div style={styles.center}><div className="spinner" /></div>;
  if (error || !order) return <div style={styles.center}><div className="card">{error}</div></div>;

  // ── DURUM: ONAYLANDI ──
  if (order.status === 'onaylandi') {
    return (
      <div style={styles.page}>
        <div className="card" style={styles.card}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={styles.title}>Tasarım Onaylandı!</h2>
          <p style={styles.text}>
            Teşekkürler {order.customer_name}! <strong>#{order.etsy_order_no}</strong> numaralı siparişinizin tasarımı başarıyla onaylandı ve üretime geçilecek.
          </p>
        </div>
      </div>
    );
  }

  // ── DURUM: REVİZE İSTENDİ ──
  if (order.status === 'revize') {
    return (
      <div style={styles.page}>
        <div className="card" style={styles.card}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✏️</div>
          <h2 style={styles.title}>Revize Talebi Alındı</h2>
          <p style={styles.text}>
            Tasarım ekibimiz belirttiğiniz notlar doğrultusunda tasarımınızı güncelleyip size tekrar onaya sunacaktır.
          </p>
        </div>
      </div>
    );
  }

  // ── DURUM: ONAY BEKLİYOR ──
  return (
    <div style={styles.page}>
      <div className="card" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={styles.title}>{order.profiles?.shop_name || 'Tasarım Onayı'}</h2>
        <p style={styles.text}>
          Merhaba {order.customer_name}, <strong>#{order.etsy_order_no}</strong> numaralı siparişiniz için hazırladığımız tasarım aşağıdadır.
        </p>

        {/* Tasarım Önizlemesi */}
        <div style={{ margin: '20px 0', border: '1px solid var(--border-light)', borderRadius: 8, padding: 8, background: '#fcfcfc' }}>
          {order.print_file_url ? (
            <img src={order.print_file_url} alt="Tasarım Önizlemesi" style={{ width: '100%', borderRadius: 4, display: 'block' }} />
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>Tasarım dosyası yüklenemedi.</p>
          )}
        </div>

        {/* Aksiyon Butonları */}
        {!showRevize ? (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowRevize(true)}
              disabled={isSubmitting}
            >
              ✏️ Revize İste
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              {isSubmitting ? '⏳ İşleniyor...' : '✅ Tasarımı Onayla'}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 20, textAlign: 'left', animation: 'fadeIn 0.3s ease-in-out' }}>
            <label className="label">Değiştirilmesini İstediğiniz Yerler:</label>
            <textarea 
              className="input" 
              rows="4" 
              placeholder="Lütfen tasarımda nelerin değişmesini istediğinizi yazın..."
              value={revizeNotu}
              onChange={e => setRevizeNotu(e.target.value)}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowRevize(false)}>İptal</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRevize} disabled={isSubmitting}>
                {isSubmitting ? '⏳ Gönderiliyor...' : 'Talebi Gönder'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', padding: '40px 20px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' },
  card: { maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: 40 },
  title: { fontFamily: 'var(--font-display)', marginBottom: 12, color: 'var(--text)' },
  text: { color: 'var(--text-muted)', lineHeight: 1.6, fontSize: 14 },
};