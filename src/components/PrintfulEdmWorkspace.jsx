import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/* ─────────────────────────────────────────────────────────
 *  PrintfulEdmWorkspace
 *  --------------------------------------------------------
 *  Printful Embedded Design Maker (EDM) entegrasyonu.
 *
 *  Akış:
 *  1. Nonce al (server → Printful API)
 *  2. embed.js yükle (CDN)
 *  3. PFDesignMaker instance oluştur (iframe)
 *  4. Kullanıcı tasarım yapar → "Kaydet" → template_id
 *  5. template_id ile mockup üret
 *  6. Mockup'ı müşteriye gönder (onay linki)
 *
 *  ⚠️ EDM enterprise erişim gerektirir:
 *  https://www.printful.com/enterprise/embedded-design-maker
 * ───────────────────────────────────────────────────────── */

const API = 'https://saascustompod.onrender.com';

const UI = {
  IDLE:      'IDLE',      // EDM açılmadı henüz
  LOADING:   'LOADING',   // nonce alınıyor / embed.js yükleniyor
  EDM:       'EDM',       // EDM iframe açık
  SAVING:    'SAVING',    // tasarım kaydediliyor
  MOCKUP:    'MOCKUP',    // mockup üretiliyor
  READY:     'READY',     // mockup hazır, gönderime hazır
};

export default function PrintfulEdmWorkspace({
  order,         // aktif sipariş
  product,       // seller_products kaydı (fulfillment:'printful')
  userId,
  profile,
  onSendForApproval,
  onRefreshProfile,
  onClose,
}) {
  const [uiState,      setUiState]      = useState(UI.IDLE);
  const [error,        setError]        = useState('');
  const [templateId,   setTemplateId]   = useState(null);
  const [mockups,      setMockups]      = useState([]);
  const [designSaved,  setDesignSaved]  = useState(false);
  const [approvalLink, setApprovalLink] = useState('');

  const designMakerRef = useRef(null);
  const containerRef   = useRef(null);

  /* ── embed.js yükle (CDN) ─────────────────────────────── */
  const loadEmbedScript = () => new Promise((resolve, reject) => {
    if (window.PFDesignMaker) { resolve(); return; }
    const existing = document.getElementById('pf-embed-js');
    if (existing) { existing.addEventListener('load', resolve); return; }

    const script = document.createElement('script');
    script.id  = 'pf-embed-js';
    script.src = 'https://files.cdn.printful.com/embed/embed.js';
    script.onload  = resolve;
    script.onerror = () => reject(new Error('embed.js yüklenemedi'));
    document.head.appendChild(script);
  });

  /* ── Nonce al (server üzerinden) ─────────────────────── */
  const fetchNonce = async () => {
    const res  = await fetch(`${API}/api/printful/nonce`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id:  userId,
        order_id: order.id,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Nonce alınamadı');
    return data; // { nonce, template_id }
  };

  /* ── EDM'i aç ─────────────────────────────────────────── */
  const openEdm = useCallback(async () => {
    setError('');
    setUiState(UI.LOADING);

    try {
      // embed.js CDN'den yükle
      await loadEmbedScript();

      // Nonce al
      const { nonce, template_id } = await fetchNonce();
      if (template_id) setTemplateId(template_id); // mevcut tasarım varsa

      // PFDesignMaker instance oluştur
      const externalProductId = `order-${order.id}-${product.printful_product_id}`;

      setUiState(UI.EDM);

      // Bir tick bekle (DOM'un render edilmesi için)
      await new Promise(r => setTimeout(r, 100));

      designMakerRef.current = new window.PFDesignMaker({
        elemId:            'printful-edm-container',
        nonce,
        externalProductId,

        initProduct: {
          productId: product.printful_product_id,
          // Önceden seçili varyant
          preselectedVariants: product.printful_variant_id
            ? [product.printful_variant_id]
            : undefined,
        },

        // AI fotoğrafı EDM'e otomatik yükle
        applyImageFromUrl: order.source_image_url || undefined,

        // Tasarım değişikliği callback'i
        onDesignStatusUpdate: (data) => {
          console.log('[EDM] Design status:', data);
          if (data.template_id) {
            setTemplateId(data.template_id);
            if (data.hasPrintFiles) setDesignSaved(true);
          }
        },

        // Dil: Türkçe
        locale: 'tr_TR',

        style: {
          accentColor: '#F56400', // brand rengi
        },

        // Variant seçimini devre dışı bırak (zaten Settings'te seçildi)
        featureConfig: {
          disableVariantSelection: !!product.printful_variant_id,
        },
      });
    } catch (err) {
      setError(err.message);
      setUiState(UI.IDLE);
    }
  }, [order, product, userId]);

  /* ── Tasarımı kaydet ──────────────────────────────────── */
  const saveDesign = () => {
    if (!designMakerRef.current) return;
    setUiState(UI.SAVING);
    // EDM'e kaydet mesajı gönder
    designMakerRef.current.sendMessage({ action: 'saveDesign' });
    // onDesignStatusUpdate callback'inde template_id gelecek
    // 5 saniye içinde gelmezse uyar
    setTimeout(() => {
      if (!templateId) {
        setUiState(UI.EDM);
        setError('Tasarım kaydedilemedi. Lütfen EDM içinde kaydet butonunu deneyin.');
      }
    }, 5000);
  };

  /* ── Template_id gelince SAVING → EDM geçişi ─────────── */
  useEffect(() => {
    if (uiState === UI.SAVING && templateId && designSaved) {
      setUiState(UI.EDM);
    }
  }, [templateId, designSaved, uiState]);

  /* ── Mockup üret ──────────────────────────────────────── */
  const generateMockup = async () => {
    if (!templateId) { setError('Önce tasarımı kaydedin.'); return; }
    setError('');
    setUiState(UI.MOCKUP);
    try {
      const res  = await fetch(`${API}/api/printful/mockup-from-template`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:           userId,
          template_id:       templateId,
          catalog_product_id: product.printful_product_id,
          catalog_variant_id: product.printful_variant_id,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Mockup üretilemedi');

      const mockupUrls = data.mockups || [];
      if (!mockupUrls.length) throw new Error('Mockup görseli gelmedi');

      // Sipariş kaydını güncelle
      await supabase.from('orders').update({
        mockup_urls:  mockupUrls,
        status:       'onay_bekliyor',
        print_file_url: `printful-template:${templateId}`, // Printful template referansı
      }).eq('id', order.id);

      setMockups(mockupUrls);

      // Onay linki oluştur
      const { SITE_URL } = await import('../siteConfig').catch(() => ({ SITE_URL: window.location.origin }));
      setApprovalLink(`${SITE_URL}/onay/${order.id}`);

      setUiState(UI.READY);
    } catch (err) {
      setError('Mockup hatası: ' + err.message);
      setUiState(UI.EDM);
    }
  };

  /* ── Müşteriye gönder ─────────────────────────────────── */
  const handleSendForApproval = async () => {
    try {
      await onSendForApproval?.(null, mockups, templateId);
    } catch (err) {
      setError('Gönderim hatası: ' + err.message);
    }
  };

  /* ── EDM'i temizle ────────────────────────────────────── */
  const closeEdm = () => {
    if (designMakerRef.current?.destroy) designMakerRef.current.destroy();
    designMakerRef.current = null;
    setUiState(UI.IDLE);
  };

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Başlık */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
            ✨ Printful Design Maker
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {product.name} · Sipariş #{order.etsy_order_no}
          </div>
        </div>
        {uiState === UI.IDLE && (
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 12 }}>
            ← Geri
          </button>
        )}
      </div>

      {/* Hata */}
      {error && (
        <div className="alert alert-error">❌ {error}</div>
      )}

      {/* ─── IDLE: EDM henüz açılmadı ─── */}
      {uiState === UI.IDLE && (
        <div style={{ textAlign: 'center', padding: 48, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>
            Printful Design Maker
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>
            Müşterinin fotoğrafı Printful tasarım editörüne otomatik yüklenecek.
            <br />
            Tasarımı düzenleyip kaydedebilirsin.
          </p>
          {order.source_image_url && (
            <div style={{ marginBottom: 20 }}>
              <img src={order.source_image_url} alt="Müşteri fotoğrafı"
                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--border)' }} />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>Müşteri fotoğrafı</div>
            </div>
          )}
          <button className="btn btn-primary" style={{ fontSize: 14, padding: '12px 28px' }}
            onClick={openEdm}>
            ✨ Design Maker'ı Aç
          </button>
          {templateId && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--success)' }}>
              ✅ Kaydedilmiş tasarım mevcut (template #{templateId})
            </div>
          )}
        </div>
      )}

      {/* ─── LOADING ─── */}
      {uiState === UI.LOADING && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <div>Design Maker yükleniyor...</div>
        </div>
      )}

      {/* ─── EDM: iframe + araç çubuğu ─── */}
      {(uiState === UI.EDM || uiState === UI.SAVING) && (
        <div style={{ position: 'relative' }}>

          {/* EDM Container — iframe buraya montlanır */}
          <div
            id="printful-edm-container"
            ref={containerRef}
            style={{
              width:        '100%',
              height:       '70vh',
              minHeight:    500,
              border:       '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow:     'hidden',
              background:   '#fff',
            }}
          />

          {/* Yükleniyor overlay (SAVING state) */}
          {uiState === UI.SAVING && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--radius)',
            }}>
              <div style={{ color: '#fff', fontSize: 16 }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                Tasarım kaydediliyor...
              </div>
            </div>
          )}

          {/* Araç çubuğu */}
          <div style={{
            display: 'flex', gap: 10, justifyContent: 'space-between',
            marginTop: 12, flexWrap: 'wrap',
          }}>
            <button className="btn btn-secondary" onClick={closeEdm}>
              ✕ Editörü Kapat
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              {/* Tasarım değiştiyse kaydet butonu aktif */}
              <button
                className="btn btn-secondary"
                onClick={saveDesign}
                disabled={uiState === UI.SAVING}
                style={{ color: designSaved ? 'var(--success)' : 'var(--text)' }}
              >
                {designSaved ? '✅ Kaydedildi' : '💾 Tasarımı Kaydet'}
              </button>

              <button
                className="btn btn-primary"
                onClick={generateMockup}
                disabled={!templateId || !designSaved}
              >
                🖼️ Mockup Üret
              </button>
            </div>
          </div>

          {templateId && designSaved && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right', marginTop: 4 }}>
              Template ID: {templateId}
            </div>
          )}
        </div>
      )}

      {/* ─── MOCKUP: üretiliyor ─── */}
      {uiState === UI.MOCKUP && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <div>Mockup üretiliyor... (30-60 saniye)</div>
          <div style={{ fontSize: 11, marginTop: 8 }}>Printful sunucularında render ediliyor</div>
        </div>
      )}

      {/* ─── READY: mockup hazır ─── */}
      {uiState === UI.READY && (
        <>
          {/* Mockup önizleme */}
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            padding: '12px 0',
          }}>
            {mockups.map((url, i) => (
              <img key={i} src={url} alt={`Mockup ${i + 1}`}
                style={{ height: 200, borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} />
            ))}
          </div>

          {/* Onay linki */}
          {approvalLink && (
            <div style={{
              padding: '12px 16px',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                Müşteri Onay Linki
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, fontSize: 12, color: 'var(--brand)', wordBreak: 'break-all' }}>
                  {approvalLink}
                </code>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 11, flexShrink: 0 }}
                  onClick={() => { navigator.clipboard.writeText(approvalLink); }}
                >
                  📋 Kopyala
                </button>
              </div>
            </div>
          )}

          {/* Eylemler */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => { setUiState(UI.EDM); }}>
              ← Tasarıma Dön
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }}
              onClick={handleSendForApproval}>
              📤 Müşteriye Gönder
            </button>
          </div>

          {templateId && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
              Printful Template ID: {templateId} · Sipariş onaylanınca Printful'a gönderilecek
            </div>
          )}
        </>
      )}
    </div>
  );
}