import { useState, useEffect, useRef } from 'react';
import KonvaDesignArea     from './KonvaDesignArea';
import { supabase } from '../lib/supabase';
import TemplateGallery   from './TemplateGallery';
import BackgroundGallery from './BackgroundGallery';


// FLUX PuLID destekli en-boy oranları (FLUX.1 multiples of 8 uyumlu)
const ASPECT_OPTIONS = [
  { id: '1:1',  label: '1:1',  width: 1344, height: 1344 }, // max 1344 (1536'ya yakın kare)
  { id: '4:3',  label: '4:3',  width: 1536, height: 1152 }, // 1536 max genişlik
  { id: '3:4',  label: '3:4',  width: 1152, height: 1536 }, // 1536 max yükseklik
  { id: '16:9', label: '16:9', width: 1536, height: 864  }, // 16:9 tam oran
  { id: '9:16', label: '9:16', width: 864,  height: 1536 },
  { id: '2:1',  label: '2:1',  width: 1536, height: 768  }, // kupa için ideal
  { id: '1:2',  label: '1:2',  width: 768,  height: 1536 },
];

// Ürünün print oranına göre en yakın aspect'i bul
function suggestAspect(printW, printH) {
  if (!printW || !printH) return '1:1';
  const ratio = printW / printH;
  if (ratio >= 1.85) return '2:1';
  if (ratio >= 1.55) return '16:9';
  if (ratio >= 1.20) return '4:3';
  if (ratio >= 0.85) return '1:1';
  if (ratio >= 0.65) return '3:4';
  if (ratio >= 0.50) return '9:16';
  return '1:2';
}



const API = 'https://saascustompod.onrender.com';

const CREDIT_COST = { standard: 2, premium: 5, mockup: 1 };

// Fallback: seller_products yoksa eski hardcoded config
const DEFAULT_PRODUCT = {
  id: '11oz', name: '11oz White Mug',
  blueprint_id: 635, print_provider_id: 99, variant_id: 72180,
  print_width: 2475, print_height: 1155,
};

export const UI = {
  IDLE:          'IDLE',
  PROCESSING:    'PROCESSING',
  READY:         'READY',
  CONFIRM_ORDER: 'CONFIRM_ORDER',
};

export default function DesignWorkspace({
  activeOrder, templates, backgrounds,
  uiState, setUiState,
  finalImageUrl, setFinalImageUrl,
  mockups, setMockups,
  profile, userId,
  onSendForApproval, onRefreshProfile,
}) {
  const [sellerProducts,     setSellerProducts]     = useState([]);
  const [selectedProduct,    setSelectedProduct]    = useState(null);
  const [selectedTemplate,   setSelectedTemplate]   = useState(null);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [textureOffset,      setTextureOffset]      = useState({ x: 0.5, y: 0.5 });
  const [textureScale,       setTextureScale]       = useState(1);
  const [processingMsg,      setProcessingMsg]      = useState('');
  const [isMockupLoading,    setIsMockupLoading]    = useState(false);
  const [error,              setError]              = useState('');
  const [previousImages,     setPreviousImages]     = useState([]); // önceki AI görselleri
  const [selectedAspect, setSelectedAspect] = useState('1:1');
  // Drag
  const isDragging   = useRef(false);
  const dragStart    = useRef({ x: 0, y: 0 });
  const konvaEditorRef = useRef(null);
const fileInputRef   = useRef(null);
const [addingLayer,    setAddingLayer]    = useState(false);
const [cachedPrintB64, setCachedPrintB64] = useState(null);   // ← yeni


  // Önceki AI görsellerini yükle — order bazlı
  useEffect(() => {
    if (!activeOrder?.id) return;
    setPreviousImages([]);
    supabase
      .from('order_ai_images')
      .select('image_url, template, tier, created_at')
      .eq('order_id', activeOrder.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data?.length) {
          setPreviousImages(data.map(d => ({
            url:      d.image_url,
            template: d.template || 'Unknown',
            tier:     d.tier || 'standard',
          })));
        }
      });
  }, [activeOrder?.id]);

  // Satıcının ürünlerini yükle
  useEffect(() => {
    if (!userId) return;
    const loadProducts = async () => {
      // seller_products'ı çek
      const { data: products, error } = await supabase
        .from('seller_products')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('sort_order');

      if (error) { console.error('Products error:', error); return; }
      const list = products || [];

      // Her ürün için blueprint_templates'den template bilgisi çek
      const enriched = await Promise.all(list.map(async p => {
  // Aynı blueprint için tüm template'leri tek seferde çek (1 query)
      const { data: candidates } = await supabase
    .from('blueprint_templates')
    .select('template_url, svg_width, svg_height, provider_id, variant_id, print_width, print_height, print_area_x, print_area_y, print_area_w, print_area_h')
    .eq('blueprint_id', p.blueprint_id);

  // En iyi eşleşmeyi bul (variant > provider > genel)
  const tmpl =
    (candidates || []).find(t => t.provider_id === p.print_provider_id && t.variant_id === p.variant_id)
    || (candidates || []).find(t => t.provider_id === p.print_provider_id && t.variant_id == null)
    || (candidates || []).find(t => t.provider_id == null && t.variant_id == null)
    || (candidates || [])[0]
    || null;

  return {
    ...p,
    // ÖNEMLİ: blueprint_templates ÖNCELİKLİ — admin düzenlemesi anında yansır
    template_image_url: tmpl?.template_url   || p.template_image_url || null,
    svg_width:    tmpl?.svg_width    ?? p.svg_width    ?? null,
    svg_height:   tmpl?.svg_height   ?? p.svg_height   ?? null,
    print_area_x: tmpl?.print_area_x ?? p.print_area_x ?? null,
    print_area_y: tmpl?.print_area_y ?? p.print_area_y ?? null,
    print_area_w: tmpl?.print_area_w ?? p.print_area_w ?? null,
    print_area_h: tmpl?.print_area_h ?? p.print_area_h ?? null,
    // print_width/height yine seller_products önceliği (variant_id zaten orada)
    print_width:  p.print_width  || tmpl?.print_width  || null,
    print_height: p.print_height || tmpl?.print_height || null,
  };
}));

      setSellerProducts(enriched);
      if (activeOrder?.seller_product_id) {
        const match = enriched.find(p => p.id === activeOrder.seller_product_id);
        setSelectedProduct(match || enriched[0] || DEFAULT_PRODUCT);
      } else {
        setSelectedProduct(enriched[0] || DEFAULT_PRODUCT);
      }
    };
    loadProducts();
  }, [userId, activeOrder?.id]);

// Ürün değişince önerilen aspect'i auto-seç
useEffect(() => {
  if (selectedProduct?.print_width && selectedProduct?.print_height) {
    setSelectedAspect(
      suggestAspect(selectedProduct.print_width, selectedProduct.print_height)
    );
  }
}, [selectedProduct?.id]);


  if (!activeOrder) return null;

  const product = selectedProduct || DEFAULT_PRODUCT;
  // Template SVG'nin kendi oranı varsa onu kullan, yoksa print dimensions
  const svgW = product.svg_width;
  const svgH = product.svg_height;
  const aspectRatio = svgW && svgH
    ? svgW / svgH
    : product.print_width / product.print_height;

  // ── AI Üretimi ────────────────────────────────────────────
  const handleStartAI = async (tier) => {
    if (!selectedTemplate) { setError('Lütfen bir şablon seçin.'); return; }
    if (!selectedProduct)  { setError('Lütfen bir ürün seçin.'); return; }
    const cost = CREDIT_COST[tier];
    if (profile.credits < cost) {
      setError(`Yetersiz kredi. Bu işlem ${cost} kredi gerektiriyor. Mevcut: ${profile.credits}`);
      return;
    }
    setError('');
    setUiState(UI.PROCESSING);
    setProcessingMsg('AI görsel oluşturuyor... ⏳');

    try {
      const TIMEOUT = tier === 'premium' ? 180_000 : 120_000;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), TIMEOUT);

    const aspectCfg = ASPECT_OPTIONS.find(a => a.id === selectedAspect) || ASPECT_OPTIONS[0];

const res = await fetch(`${API}/api/generate-v2`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userFaceUrl:         activeOrder.source_image_url,
    templateFixedPrompt: selectedTemplate.fixed_prompt,
    qualityTier:         tier,
    width:               aspectCfg.width,
    height:              aspectCfg.height,
  }),
  signal: controller.signal,
});
      clearTimeout(tid);

      if (!res.ok) throw new Error(`Sunucu hatası: ${res.status}`);
      const data = await res.json();
      if (!data.finalImageUrl) throw new Error(data.error || 'Görsel gelmedi');

      // AI başarılı → Storage'a kalıcı olarak kaydet
      setProcessingMsg('Görsel kaydediliyor... ⏳');
      let permanentUrl = data.finalImageUrl;
      try {
        const fileName = `ai/${userId}/${activeOrder.etsy_order_no}_${Date.now()}.jpg`;
        // URL ise fetch edip blob'a çevir
        const blob = await fetch(data.finalImageUrl).then(r => r.blob()).catch(() => null);
        if (blob) {
          const { error: upErr } = await supabase.storage
            .from('orders')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('orders').getPublicUrl(fileName);
            permanentUrl = publicUrl;
          }
        }
      } catch { /* Storage hatası olsa da devam et, Replicate URL kullan */ }

      // AI başarılı → kredi düş
      await supabase.rpc('deduct_credits', {
        p_user_id:    userId,
        p_amount:     cost,
        p_type:       `ai_${tier}`,
        p_description:`${selectedTemplate.name} — ${activeOrder.etsy_order_no}`,
        p_order_id:   activeOrder.id,
      });
      await onRefreshProfile();

      // order_ai_images tablosuna kaydet (tüm üretimler saklanır)
      await supabase.from('order_ai_images').insert({
        order_id:  activeOrder.id,
        user_id:   userId,
        image_url: permanentUrl,
        template:  selectedTemplate.name,
        tier,
      });

      // Siparişi güncelle (son üretimi göster)
      await supabase.from('orders').update({
        ai_image_url:      permanentUrl,
        ai_tier:           tier,
        ai_template:       selectedTemplate.name,
        seller_product_id: product.id,
        print_width:       product.print_width,
        print_height:      product.print_height,
      }).eq('id', activeOrder.id);

      setFinalImageUrl(permanentUrl);
      // Önceki görseller listesini güncelle
      setPreviousImages(prev => [
        { url: permanentUrl, template: selectedTemplate.name, tier },
        ...prev.filter(p => p.url !== permanentUrl),
      ]);
      setTextureOffset({ x: 0.5, y: 0.5 });
      setTextureScale(1);
      setCachedPrintB64(null); 
      setUiState(UI.READY);
      setProcessingMsg('');
    } catch (err) {
      setError('AI hatası: ' + err.message);
      setUiState(UI.IDLE);
    }
  };


  const handleAddLayerFile = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';   // aynı dosyayı tekrar seçilebilir hale getir
  if (!file) return;

  // Boyut kontrolü (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    setError('Görsel 10MB\'tan büyük olamaz.');
    return;
  }
  if (!file.type.startsWith('image/')) {
    setError('Sadece görsel dosyaları kabul edilir.');
    return;
  }

  setAddingLayer(true);
  setError('');

  try {
    // Supabase storage'a yükle
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `layers/${userId}/${activeOrder.id}_${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('orders')
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
    if (upErr) throw upErr;

    const { data: { publicUrl } } = supabase.storage
      .from('orders').getPublicUrl(path);

    // Konva editörüne yeni katman olarak ekle
    if (konvaEditorRef.current?.addLayer) {
      await konvaEditorRef.current.addLayer(publicUrl);
    }
  } catch (err) {
    setError('Görsel eklenemedi: ' + err.message);
  } finally {
    setAddingLayer(false);
  }
};



  // ── Baskı dosyası üret — Konva stage'den export ─────────────
 const generatePrintFile = () => new Promise((resolve, reject) => {
  const api = konvaEditorRef.current;
  if (api && typeof api.exportDesign === 'function') {
    try {
      const dataURL = api.exportDesign();
      if (dataURL && dataURL.startsWith('data:')) return resolve(dataURL);
    } catch (e) {
      console.warn('Konva export hatası:', e);
    }
  }
  reject(new Error('Tasarım editörü hazır değil. Lütfen görseli editörde konumlandırın.'));
});

    // ── Mockup oluştur ────────────────────────────────────────
  const handleConfirm = async () => {
  if (profile.credits < CREDIT_COST.mockup) {
    setError(`Mockup oluşturmak ${CREDIT_COST.mockup} kredi gerektiriyor.`);
    return;
  }
  setError('');

  // ÖNCE export — editor hâlâ mount'tayken
  let b64;
  try {
    b64 = await generatePrintFile();
    setCachedPrintB64(b64);   // Approval gönderimi için sakla
  } catch (err) {
    setError('Tasarım dosyası alınamadı: ' + err.message);
    return;
  }

  // ŞİMDİ state değiştir — editor unmount olsa da b64 elimizde
  setUiState(UI.CONFIRM_ORDER);
  setIsMockupLoading(true);

  try {
    const res = await fetch(`${API}/api/generate-mockup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image:             b64,
        productId:         product.id,
        user_id:           userId,
        seller_product_id: product.id !== '11oz' && product.id !== '15oz' ? product.id : null,
      }),
    });
    const data = await res.json();
    if (!data.mockups?.length) throw new Error(data.error || 'Mockup oluşturulamadı');

    // Başarılı → kredi düş
    await supabase.rpc('deduct_credits', {
      p_user_id:    userId,
      p_amount:     CREDIT_COST.mockup,
      p_type:       'mockup',
      p_description:`Mockup — ${activeOrder.etsy_order_no}`,
      p_order_id:   activeOrder.id,
    });
    await onRefreshProfile();
    setMockups(data.mockups);
  } catch (err) {
    setError('Mockup hatası: ' + err.message);
    setUiState(UI.READY);
  }
  setIsMockupLoading(false);
};

const handleDownloadPrintFile = () => {
  if (!cachedPrintB64) { setError('Baskı dosyası hazır değil.'); return; }
  const a = document.createElement('a');
  a.href     = cachedPrintB64;
 a.download = `baski_${activeOrder?.etsy_order_no || 'tasarim'}_${product?.print_width ?? ''}x${product?.print_height ?? ''}.jpg`;
  a.click();
};


  // ── Müşteriye gönder ──────────────────────────────────────
  const handleSendToCustomer = async () => {
  try {
    // Cache'den oku (handleConfirm'de zaten üretildi)
    // Yoksa son çare olarak yeniden üret (editor hâlâ mount'taysa)
    const b64 = cachedPrintB64 || await generatePrintFile();
    if (!b64) throw new Error('Baskı dosyası bulunamadı.');
    await onSendForApproval(b64, mockups);
  } catch (err) {
    setError('Gönderim hatası: ' + err.message);
  }
};



  // ── Özel dosya yükleme ────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setFinalImageUrl(reader.result); setUiState(UI.READY); };
    reader.readAsDataURL(file);
  };

  // ────────────────────────────────────────────────────────────
  return (
    <div className="card" style={{ marginTop: 20 }}>

      {/* Sipariş başlığı */}
      <div style={s.orderHeader}>
        <div>
          <div style={s.orderTitle}>Active Order: #{activeOrder.etsy_order_no}</div>
          <div style={s.orderSub}>{activeOrder.customer_name}</div>
        </div>
        <img src={activeOrder.source_image_url} alt="Customer" style={s.avatar} />
      </div>

      {/* Revize notu */}
      {activeOrder.customer_note && activeOrder.status === 'revize' && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <strong>⚠️ Customer Note:</strong> "{activeOrder.customer_note}"
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── IDLE ── */}
      {uiState === UI.IDLE && (
        <>
         {sellerProducts && sellerProducts.length > 1 && (
  <div style={{ marginBottom: 16 }}>
    <div className="label" style={{ marginBottom: 8 }}>
      Hangi ürün için tasarım?
    </div>
    <div style={{
      display: 'flex', gap: 10, overflowX: 'auto',
      paddingBottom: 4, scrollbarWidth: 'thin',
    }}>
      {sellerProducts.map(p => {
        const isActive = selectedProduct?.id === p.id;
        return (
          <button
            key={p.id}
            onClick={() => setSelectedProduct(p)}
            type="button"
            style={{
              flex: '0 0 auto',
              minWidth: 130,
              padding: '10px 14px',
              background: isActive ? 'var(--brand)' : 'var(--bg-card)',
              color:      isActive ? '#fff' : 'var(--text)',
              border: isActive
                ? '2px solid var(--brand)'
                : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              textAlign: 'left',
              transition: 'all 0.15s',
              boxShadow: isActive ? 'var(--shadow)' : 'none',
            }}
          >
            <div style={{
              fontSize: 13, fontWeight: 700,
              marginBottom: 2,
            }}>
              {p.name}
            </div>
            <div style={{
              fontSize: 11,
              opacity: isActive ? 0.85 : 0.6,
            }}>
              {p.print_width}×{p.print_height}px
              {p.variant_id && ` · var ${p.variant_id}`}
            </div>
          </button>
        );
      })}
    </div>
    {selectedProduct && (
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
        Aşağıdaki AI stilini seçtikten sonra bu ürün için tasarım üretilecek.
      </div>
    )}
  </div>
)}

          {/* Önceki AI görselleri */}
          {previousImages.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="label" style={{ marginBottom: 8 }}>
                🖼️ Previously Generated Designs
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {previousImages.map((img, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      border: finalImageUrl === img.url && uiState === UI.READY
                        ? '3px solid var(--brand)'
                        : '2px solid var(--border)',
                      borderRadius: 10,
                      overflow: 'hidden',
                      width: 100,
                      height: 100,
                      flexShrink: 0,
                    }}
                    onClick={() => {
                      setFinalImageUrl(img.url);
                      setTextureOffset({ x: 0.5, y: 0.5 });
                      setTextureScale(1);
                      setUiState(UI.READY);
                    }}
                  >
                    <img
                      src={img.url}
                      alt={`Previous ${i+1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'rgba(0,0,0,0.75)', color: '#fff',
                      fontSize: 9, padding: '3px 5px', textAlign: 'center',
                    }}>
                      {img.template} · {img.tier}
                    </div>
                    <div style={{
                      position: 'absolute', top: 4, right: 4,
                      background: 'var(--brand)', color: '#fff',
                      fontSize: 9, padding: '2px 5px', borderRadius: 4, fontWeight: 700,
                    }}>
                      REUSE
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                Click to reuse a previous design without spending credits.
              </div>
            </div>
          )}


          {/* Ürün Seçici — birden fazla ürün varsa göster */}


{/* Tek ürün varsa, sadece bilgi göster */}
{sellerProducts && sellerProducts.length === 1 && selectedProduct && (
  <div style={{
    marginBottom: 16,
    padding: '8px 12px',
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12,
    color: 'var(--text-muted)',
  }}>
    🖨️ Tasarım hedefi: <strong style={{ color: 'var(--text)' }}>{selectedProduct.name}</strong>
    {' · '}{selectedProduct.print_width}×{selectedProduct.print_height}px
  </div>
)}

{/* Hiç ürün yoksa uyarı */}
{(!sellerProducts || sellerProducts.length === 0) && (
  <div className="alert alert-warning" style={{ marginBottom: 16 }}>
    ⚠️ Henüz ürün eklenmemiş. Settings → Ürünler'den en az bir ürün eklemen gerekiyor.
  </div>
)}

          <TemplateGallery
            templates={templates}
            selectedTemplateId={selectedTemplate?.id}
            onSelect={setSelectedTemplate}
            onFileUpload={handleFileUpload}
          />

          <BackgroundGallery
            backgrounds={backgrounds}
            selectedBackgroundId={selectedBackground?.id || null}
            onSelect={setSelectedBackground}
          />

          {selectedTemplate && (
  <>
    {/* En-Boy Oranı Seçici (Premium için) */}
    <div style={{ marginTop: 14 }}>
      <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>📐 Premium FLUX en-boy oranı</span>
        <span style={{
          fontSize: 10, color: 'var(--text-dim)',
          background: 'var(--bg-hover)', padding: '2px 6px',
          borderRadius: 10, fontWeight: 500,
        }}>
          sadece Premium
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ASPECT_OPTIONS.map(a => {
          const isActive = selectedAspect === a.id;
          const isRecommended = selectedProduct
            ? suggestAspect(selectedProduct.print_width, selectedProduct.print_height) === a.id
            : false;

          // Mini ikon — orantılı dikdörtgen
          const iconAspect = a.width / a.height;
          const iconW = iconAspect >= 1 ? 22 : 22 * iconAspect;
          const iconH = iconAspect >= 1 ? 22 / iconAspect : 22;

          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedAspect(a.id)}
              style={{
                position: 'relative',
                minWidth: 64,
                padding: '8px 10px',
                background: isActive ? 'var(--brand)' : 'var(--bg-card)',
                color: isActive ? '#fff' : 'var(--text)',
                border: isActive
                  ? '2px solid var(--brand)'
                  : isRecommended
                    ? '2px solid var(--success)'
                    : '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: iconW, height: iconH,
                background: isActive ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)',
                borderRadius: 2,
                transition: 'background 0.15s',
              }} />
              <span>{a.label}</span>
              {isRecommended && !isActive && (
                <div style={{
                  position: 'absolute', top: -6, right: -6,
                  background: 'var(--success)', color: '#000',
                  fontSize: 8, fontWeight: 700,
                  padding: '2px 5px', borderRadius: 4,
                  letterSpacing: 0.3,
                }}>
                  ÖNERİ
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Açıklama satırı */}
      {(() => {
        const cfg = ASPECT_OPTIONS.find(a => a.id === selectedAspect);
        const recommended = selectedProduct
          ? suggestAspect(selectedProduct.print_width, selectedProduct.print_height)
          : null;
        const mismatch = recommended && recommended !== selectedAspect;
        return (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.5 }}>
            FLUX <strong>{cfg.width}×{cfg.height}</strong> piksel üretir.
            Editörde print area'ya göre kırpılır.
            {mismatch && selectedProduct && (
              <span style={{ color: 'var(--warning)' }}>
                {' '}· Bu ürün için <strong>{recommended}</strong> oranı daha uyumlu
                ({selectedProduct.print_width}×{selectedProduct.print_height}px).
              </span>
            )}
          </div>
        );
      })()}
    </div>

    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
      <button
        className="btn"
        style={{ flex: 1, background: '#374151', color: '#fff' }}
        onClick={() => handleStartAI('standard')}
        disabled={profile.credits < CREDIT_COST.standard}
      >
        ⚡ Standard — {CREDIT_COST.standard} credits
      </button>
      <button
        className="btn"
        style={{ flex: 1, background: '#7c3aed', color: '#fff' }}
        onClick={() => handleStartAI('premium')}
        disabled={profile.credits < CREDIT_COST.premium}
      >
        🎨 Premium FLUX {selectedAspect} — {CREDIT_COST.premium} credits
      </button>
    </div>
  </>
)}
        </>
      )}

      {/* ── PROCESSING ── */}
      {uiState === UI.PROCESSING && (
        <div style={s.center}>
          <div className="spinner" style={{ marginBottom: 20 }} />
          <p style={{ color: 'var(--text-muted)' }}>{processingMsg}</p>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
            Premium model may take 2-3 minutes. Don't close this page.
          </p>
        </div>
      )}

      {/* ── READY: 2D Tasarım Alanı ── */}
     {/* ── READY: Yan Yana Editor + Önizleme ── */}
{/* ── READY: Tek panel — template Konva üstünde ── */}
{uiState === UI.READY && finalImageUrl && (
  <>
    {/* Ürün bilgisi */}
    {selectedProduct && (
      <div style={s.productBadge}>
        🖨️ <strong>{selectedProduct.name}</strong>
        <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8 }}>
          {selectedProduct.print_width}×{selectedProduct.print_height}px
        </span>
      </div>
    )}


    {/* Editör araç çubuğu */}
<div style={{
  display: 'flex', justifyContent: 'center', gap: 8,
  marginBottom: 10, flexWrap: 'wrap',
}}>
  <button
    type="button"
    className="btn btn-secondary"
    style={{ fontSize: 12, padding: '6px 14px' }}
    disabled={addingLayer}
    onClick={() => fileInputRef.current?.click()}
  >
    {addingLayer ? '⏳ Yükleniyor...' : '➕ Görsel Ekle'}
  </button>

  <input
    ref={fileInputRef}
    type="file"
    accept="image/png,image/jpeg,image/webp"
    style={{ display: 'none' }}
    onChange={handleAddLayerFile}
  />
</div>


    

    {/* Tek editör — PNG template üst katman */}
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
      <KonvaDesignArea
        ref={konvaEditorRef}
        designUrl={finalImageUrl}
        templateUrl={product.template_image_url}
        templateWidth={product.svg_width  || product.print_width}
        templateHeight={product.svg_height || product.print_height}
        printArea={product.print_area_x != null ? {
          x: product.print_area_x,
          y: product.print_area_y,
          w: product.print_area_w,
          h: product.print_area_h,
        } : null}
        printWidth={product.print_width}
        printHeight={product.print_height}
        containerWidth={Math.min(560, window.innerWidth - 60)}
      />
    </div>

    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
  <button className="btn btn-secondary" onClick={() => { setCachedPrintB64(null); setUiState(UI.IDLE); }}>
    ← Regenerate
  </button>
  <button
    className="btn btn-secondary"
    title={`${product?.print_width}×${product?.print_height}px baskı dosyasını indir`}
    style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
    onClick={async () => {
      try {
        const b64 = await generatePrintFile();
        const a = document.createElement('a');
        a.href     = b64;
        a.download = `baski_${activeOrder?.etsy_order_no || 'tasarim'}_${product?.print_width ?? ''}x${product?.print_height ?? ''}.jpg`;
        a.click();
      } catch (err) {
        setError('İndirme hatası: ' + err.message);
      }
    }}
  >
    ⬇ İndir
  </button>
  <button
    className="btn btn-primary"
    style={{ flex: 1 }}
    onClick={handleConfirm}
    disabled={profile.credits < CREDIT_COST.mockup}
  >
    Generate Mockup ({CREDIT_COST.mockup} credit)
  </button>
</div>
  </>
)}

      {/* ── CONFIRM ORDER ── */}
      {uiState === UI.CONFIRM_ORDER && (
        <div style={s.center}>
          {isMockupLoading ? (
            <>
              <div className="spinner" style={{ marginBottom: 16 }} />
              <p style={{ color: 'var(--text-muted)' }}>Generating mockups...</p>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
                {mockups.map((url, i) => (
                  <img
                    key={i} src={url} alt={`Mockup ${i+1}`}
                    style={{ maxHeight: 300, borderRadius: 10, boxShadow: 'var(--shadow)', maxWidth: '100%' }}
                  />
                ))}
              </div>
             <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
  <button className="btn btn-secondary" onClick={() => setUiState(UI.READY)}>
    ← Back
  </button>
  <button
    className="btn btn-secondary"
    onClick={handleDownloadPrintFile}
    disabled={!cachedPrintB64}
    title={`${product?.print_width}×${product?.print_height}px — Printify baskı dosyası`}
    style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
  >
    ⬇ Baskı Dosyası İndir
  </button>
  <button className="btn btn-primary" onClick={handleSendToCustomer}>
    📤 Send for Customer Approval
  </button>
</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  orderHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px', background: 'var(--info-bg)',
    borderRadius: 'var(--radius-sm)', marginBottom: 20,
    border: '1px solid rgba(59,130,246,0.3)',
  },
  orderTitle:   { fontWeight: 700, color: 'var(--info)', fontFamily: 'var(--font-display)', fontSize: 16 },
  orderSub:     { fontSize: 13, color: 'var(--text-muted)', marginTop: 2 },
  avatar:       { width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--info)' },
  center:       { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' },
  productBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', background: 'var(--bg)',
    border: '1px solid var(--border)', borderRadius: 20,
    fontSize: 13, fontWeight: 600, marginBottom: 16,
  },
};