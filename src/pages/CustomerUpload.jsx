import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import '../index.css';

export default function CustomerUpload() {
  const { shopSlug } = useParams();
  const [shopOwner,    setShopOwner]    = useState(null);
  const [notFound,     setNotFound]     = useState(false);
  const [products,     setProducts]     = useState([]);
  const [selectedProd, setSelectedProd] = useState(null);
  const [orderNo,      setOrderNo]      = useState('');
  const [customerName, setCustomerName] = useState('');
  const [file,         setFile]         = useState(null);
  const [preview,      setPreview]      = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess,    setIsSuccess]    = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [orderStatus,  setOrderStatus]  = useState('idle'); // idle | checking | valid | invalid | duplicate
  const [orderMsg,     setOrderMsg]     = useState('');

  // Mağaza sahibini bul
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, shop_name, shop_slug')
        .eq('shop_slug', shopSlug)
        .maybeSingle();

      if (data) {
        setShopOwner(data);
        // Satıcının aktif ürünlerini çek
        const { data: prods } = await supabase
          .from('seller_products')
          .select('*')
          .eq('user_id', data.id)
          .eq('is_active', true)
          .order('sort_order');
        const prodList = prods || [];
        setProducts(prodList);
        if (prodList.length === 1) setSelectedProd(prodList[0]);
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

  const handleOrderBlur = async () => {
    const no = orderNo.trim();
    if (!no || !shopOwner) return;
    setOrderStatus('checking');
    setOrderMsg('Kontrol ediliyor...');

    try {
      // Sadece duplicate kontrolü — Etsy doğrulaması devre dışı
      const { data: dup } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', shopOwner.id)
        .eq('etsy_order_no', no)
        .maybeSingle();

      if (dup) {
        setOrderStatus('duplicate');
        setOrderMsg('Bu sipariş numarası zaten sisteme eklenmiş.');
        return;
      }

      // Etsy doğrulaması yok — direkt geçerli say
      setOrderStatus('valid');
      setOrderMsg('✅ Sipariş numarası alındı.');
    } catch {
      // Hata olsa bile engelleme — geçerli say
      setOrderStatus('valid');
      setOrderMsg('✅ Sipariş numarası alındı.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orderNo || !file || !customerName) { setErrorMsg('Lütfen tüm alanları doldurun.'); return; }
    if (orderStatus === 'duplicate') { setErrorMsg('Bu sipariş zaten eklendi.'); return; }
    if (orderStatus === 'invalid')   { setErrorMsg('Geçersiz sipariş numarası.'); return; }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Görseli Supabase Storage'a yükle
      const ext  = file.name.split('.').pop();
      const path = `${shopOwner.id}/${orderNo}_${Date.now()}.${ext}`;
      await supabase.storage.from('orders').upload(path, file);
      const { data: { publicUrl } } = supabase.storage.from('orders').getPublicUrl(path);

      // Siparişi oluştur
      // Ürün seçili değilse ilk aktif ürünü kullan
      const productToUse = selectedProd || products[0] || null;

      const { error: insertErr } = await supabase.from('orders').insert({
        user_id:          shopOwner.id,
        etsy_order_no:    orderNo.trim(),
        customer_name:    customerName,
        source_image_url: publicUrl,
        status:             'yeni',
        seller_product_id:  productToUse?.id || null,
        print_width:        productToUse?.print_width  || 2475,
        print_height:       productToUse?.print_height || 1155,
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
          Fotoğrafınız Alındı!
        </h2>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Teşekkürler <strong>{customerName}</strong>! Tasarımınız hazırlandığında
          Etsy mesajları üzerinden önizleme bağlantısı göndereceğiz.
        </p>
      </div>
    </div>
  );

  const borderColor = {
    idle:      'var(--border-light)',
    checking:  'var(--warning)',
    valid:     'var(--success)',
    invalid:   'var(--danger)',
    duplicate: 'var(--danger)',
  }[orderStatus];

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
            Etsy sipariş numaranızı girin ve fotoğrafınızı yükleyin.
          </p>
        </div>

        {errorMsg && <div className="alert alert-error" style={{ marginBottom: 16 }}>{errorMsg}</div>}

        {/* Ürün seçimi — birden fazla ürün varsa göster */}
        {products.length > 1 && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="label">Select Product</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {products.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProd(p)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: selectedProd?.id === p.id
                      ? '2px solid var(--brand)'
                      : '1px solid var(--border-light)',
                    background: selectedProd?.id === p.id ? 'var(--brand-light)' : 'var(--bg)',
                    color: selectedProd?.id === p.id ? 'var(--brand)' : 'var(--text)',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Sipariş no */}
          <div className="form-group">
            <label className="label">Etsy Sipariş Numarası</label>
            <input
              className="input"
              placeholder="Örn: 1234567890"
              value={orderNo}
              onChange={e => { setOrderNo(e.target.value); setOrderStatus('idle'); setOrderMsg(''); }}
              onBlur={handleOrderBlur}
              style={{ borderColor }}
            />
            {orderMsg && (
              <div className={`alert alert-${
                orderStatus === 'valid' ? 'success' :
                orderStatus === 'checking' ? 'warning' : 'error'
              }`} style={{ marginTop: 6, padding: '8px 12px' }}>
                {orderMsg}
              </div>
            )}
          </div>

          {/* İsim */}
          <div className="form-group">
            <label className="label">Adınız Soyadınız</label>
            <input
              className="input"
              placeholder="Örn: Jane Smith"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
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
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isSubmitting || orderStatus === 'duplicate' || orderStatus === 'invalid'}
            style={{ marginTop: 8, padding: '14px' }}
          >
            {isSubmitting ? '⏳ Yükleniyor...' : '🚀 Fotoğrafı Gönder'}
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