import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../index.css';

export default function CustomerApproval() {
  const { orderId } = useParams();
  const [order,     setOrder]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [errorMsg,  setErrorMsg]  = useState('');

  const [isApproving,     setIsApproving]     = useState(false);
  const [isApproved,      setIsApproved]      = useState(false);
  const [showRejectForm,  setShowRejectForm]  = useState(false);
  const [rejectNote,      setRejectNote]      = useState('');
  const [isRejecting,     setIsRejecting]     = useState(false);
  const [isRejected,      setIsRejected]      = useState(false);

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setErrorMsg('Sipariş bulunamadı.');
        else {
          setOrder(data);
          if (data.status === 'onaylandi' || data.status === 'tamamlandi') setIsApproved(true);
        }
        setLoading(false);
      });
  }, [orderId]);

  const handleApprove = async () => {
    setIsApproving(true);
    await supabase.from('orders').update({ status: 'onaylandi' }).eq('id', orderId);
    setIsApproved(true);
    setIsApproving(false);
  };

  const handleReject = async () => {
    if (!rejectNote.trim()) { alert('Lütfen neyi değiştirmek istediğinizi yazın.'); return; }
    setIsRejecting(true);
    await supabase.from('orders').update({
      status: 'revize',
      customer_note: rejectNote,
    }).eq('id', orderId);
    setIsRejected(true);
    setIsRejecting(false);
  };

  if (loading) return (
    <div style={styles.page}>
      <div className="spinner" />
    </div>
  );

  if (errorMsg) return (
    <div style={styles.page}>
      <div className="alert alert-error" style={{ maxWidth: 400 }}>❌ {errorMsg}</div>
    </div>
  );

  if (isApproved) return (
    <div style={styles.page}>
      <div className="card" style={styles.resultCard}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={styles.resultTitle}>Tasarım Onaylandı!</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Harika! Ürününüzü hemen baskıya gönderiyoruz. Kargonuz yola çıktığında
          Etsy üzerinden bilgilendirileceksiniz. Bizi tercih ettiğiniz için teşekkürler!
        </p>
      </div>
    </div>
  );

  if (isRejected) return (
    <div style={styles.page}>
      <div className="card" style={{ ...styles.resultCard, borderColor: 'var(--warning)' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🛠️</div>
        <h2 style={{ ...styles.resultTitle, color: 'var(--warning)' }}>Talebiniz Alındı!</h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
          İstediğiniz değişiklikleri tasarım ekibimize ilettik. En kısa sürede
          yeni bir önizleme bağlantısı göndereceğiz.
        </p>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={{ maxWidth: 720, width: '100%' }}>

        {/* Başlık */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎨</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 6 }}>
            Tasarım Onayı
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Merhaba <strong>{order?.customer_name}</strong>,
            #{order?.etsy_order_no} siparişinize ait tasarımınız hazır!
          </p>
        </div>

        <div className="card">
          {/* Mockuplar */}
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 16, color: 'var(--info)' }}>
            📸 Yaşam Alanı Görünümleri
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
            {order?.mockup_urls?.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Mockup ${i+1}`}
                style={{ width: '100%', maxWidth: 320, borderRadius: 10, boxShadow: 'var(--shadow)' }}
              />
            ))}
          </div>

          {/* Bilgi kutusu */}
          <div className="alert alert-info" style={{ marginBottom: 20 }}>
            <strong>💡 Dikkat:</strong> Gördüğünüz görseller basılacak ürünün dijital provasıdır.
          </div>

          {/* Onayla */}
          <button
            className="btn btn-success btn-full"
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
            style={{ padding: '16px', fontSize: 16, marginBottom: 12 }}
          >
            {isApproving ? '⏳ İşleniyor...' : '✅ TASARIMI ONAYLIYORUM, BASIMA GEÇİLSİN'}
          </button>

          {/* Reddet */}
          {!showRejectForm ? (
            <button
              className="btn btn-full"
              onClick={() => setShowRejectForm(true)}
              disabled={isApproving}
              style={{ padding: '14px', background: 'transparent', border: '2px solid var(--danger)', color: 'var(--danger)', fontWeight: 700 }}
            >
              ❌ Beğenmedim, Değişiklik İste
            </button>
          ) : (
            <div className="alert alert-warning" style={{ marginTop: 4 }}>
              <h4 style={{ marginBottom: 10, color: 'var(--warning)' }}>Neyi değiştirmemizi istersiniz?</h4>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Örn: Yüzüm çok büyük, biraz küçültür müsünüz?"
                style={{
                  width: '100%', height: 80, padding: 10,
                  background: 'var(--bg)', border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                  fontFamily: 'var(--font-body)', fontSize: 14, resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowRejectForm(false)}
                >
                  İptal
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: 2 }}
                  onClick={handleReject}
                  disabled={isRejecting}
                >
                  {isRejecting ? 'İletiliyor...' : 'Talebi Gönder'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    background: 'var(--bg)',
  },
  resultCard: {
    maxWidth: 480,
    textAlign: 'center',
    padding: '60px 40px',
    border: '2px solid var(--success)',
  },
  resultTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 24,
    color: 'var(--success)',
    marginBottom: 12,
  },
};