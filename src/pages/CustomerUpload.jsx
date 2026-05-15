import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../index.css';

export default function CustomerUpload() {
  const { shopSlug } = useParams();
  const [shopOwner,    setShopOwner]    = useState(null);
  const [notFound,     setNotFound]     = useState(false);
  
  const [customerName, setCustomerName] = useState('');
  const [etsyOrderNo,  setEtsyOrderNo]  = useState(''); // Etsy sipariş numarası state'i eklendi
  const [file,         setFile]         = useState(null);
  const [preview,      setPreview]      = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess,    setIsSuccess]    = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');

  // Mağaza sahibini (SaaS Kullanıcısını) bul
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, shop_name, shop_slug')
        .eq('shop_slug', shopSlug)
        .maybeSingle();

      if (data) {
        setShopOwner(data);
      } else {
        setNotFound(true);
      }
    };
    init();
  }, [shopSlug]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !customerName || !etsyOrderNo) { 
      setErrorMsg('Lütfen adınızı, sipariş numaranızı girin ve bir fotoğraf yükleyin.'); 
      return; 
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Görseli Supabase Storage'a yükle
      const ext  = file.name.split('.').pop();
      // Dosya adını etsy sipariş numarası ile ilişkilendir
      const path = `${shopOwner.id}/${etsyOrderNo}_${Date.now()}.${ext}`;
      
      const { error: uploadErr } = await supabase.storage.from('orders').upload(path, file);
      if (uploadErr) throw new Error('Fotoğraf yüklenemedi: ' + uploadErr.message);
      
      const { data: { publicUrl } } = supabase.storage.from('orders').getPublicUrl(path);

      // Siparişi "yeni" statüsüyle ve Etsy sipariş numarasıyla oluştur
      const { error: insertErr } = await supabase.from('orders').insert({
        user_id:          shopOwner.id,     // SaaS kullanıcısının (Satıcının) ID'si
        etsy_order_no:    etsyOrderNo,      // Müşterinin girdiği Etsy numarası
        customer_name:    customerName,
        source_image_url: publicUrl,
        status:           'yeni',
        // Varsayılan yüksek çözünürlüklü çalışma alanı boyutları
        print_width:      3000,
        print_height:     3000,
      });

      if (insertErr) throw insertErr;
      setIsSuccess(true);

    } catch (err) {
      setErrorMsg('Bir hata oluştu: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  if (notFound) return (
    <div style={styles.page}>
      <div className="card" style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2 style={{ fontFamily: 'var(--font-display)' }}>Mağaza Bulunamadı</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
          "{shopSlug}" adresiyle bir mağaza bulunamadı.
        </p>
      </div>
    </div>
  );

  if (!shopOwner) return (
    <div style={styles.page}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
        <div className="spinner" />
      </div>
    </div>
  );

  if (isSuccess) return (
    <div style={styles.page}>
      <div className="card" style={{ textAlign: 'center', padding: 60, maxWidth: 500, margin: '0 auto' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--success)', marginBottom: 12 }}>
          Tasarım İsteğiniz Alındı!
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Teşekkürler <strong>{customerName}</strong>! Yüklediğiniz görsel kullanılarak <strong>#{etsyOrderNo}</strong> numaralı siparişinize özel tasarım hazırlanacaktır. <br/><br/>
          Tasarım bittiğinde onaylamanız için size bir bağlantı gönderilecektir.
        </p>
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Başlık */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎨</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 6 }}>
            {shopOwner.shop_name}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Siparişinizde kullanılmasını istediğiniz fotoğrafı yükleyin.
          </p>
        </div>

        {errorMsg && <div className="alert alert-error" style={{ marginBottom: 16 }}>{errorMsg}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* İsim */}
          <div className="form-group">
            <label className="label">Adınız Soyadınız</label>
            <input
              className="input"
              placeholder="Örn: Jane Smith"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              required
            />
          </div>

          {/* Etsy Sipariş No */}
          <div className="form-group">
            <label className="label">Etsy Sipariş Numarası</label>
            <input
              className="input"
              placeholder="Örn: 123456789"
              value={etsyOrderNo}
              onChange={e => setEtsyOrderNo(e.target.value.replace(/\D/g, ''))} // Sadece rakam kabul et
              required
            />
            <small style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4, display: 'block' }}>
              Etsy sipariş onay e-postanızdaki numarayı giriniz.
            </small>
          </div>

          {/* Fotoğraf yükleme */}
          <div className="form-group">
            <label className="label">Fotoğrafınız</label>
            <div style={styles.dropzone}>
              {preview
                ? <img src={preview} alt="Önizleme" style={styles.preview} />
                : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                    <div style={{ fontSize: 14 }}>Tıklayarak fotoğraf seçin</div>
                    <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-dim)' }}>
                      JPG, PNG veya HEIC
                    </div>
                  </div>
                )
              }
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={styles.fileInput}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isSubmitting}
            style={{ marginTop: 8, padding: '14px' }}
          >
            {isSubmitting ? '⏳ Yükleniyor...' : '🚀 Gönder ve Tasarıma Başla'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '40px 20px',
    background: 'var(--bg)',
  },
  dropzone: {
    border: '2px dashed var(--border-light)',
    borderRadius: 'var(--radius)',
    padding: '30px 20px',
    textAlign: 'center',
    background: 'var(--bg)',
    position: 'relative',
    cursor: 'pointer',
    minHeight: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    maxHeight: 200,
    borderRadius: 8,
    objectFit: 'contain',
  },
  fileInput: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
};