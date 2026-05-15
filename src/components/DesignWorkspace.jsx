import { useState, useEffect, useRef } from 'react';
import KonvaDesignArea       from './KonvaDesignArea';
import { supabase }          from '../lib/supabase';
import TemplateGallery       from './TemplateGallery';

// ── FLUX en-boy oranları ─────────────────────────────────
const ASPECT_OPTIONS = [
  { id: '1:1',  label: '1:1 (Kare)',       width: 1344, height: 1344 },
  { id: '4:3',  label: '4:3 (Yatay)',      width: 1536, height: 1152 },
  { id: '3:4',  label: '3:4 (Dikey)',      width: 1152, height: 1536 },
  { id: '16:9', label: '16:9 (Geniş)',     width: 1536, height: 864  },
  { id: '9:16', label: '9:16 (Telefon)',   width: 864,  height: 1536 },
  { id: '2:1',  label: '2:1 (Panoramik)',  width: 1536, height: 768  },
  { id: '1:2',  label: '1:2 (Uzun)',       width: 768,  height: 1536 },
];

const API = 'https://saascustompod.onrender.com';
const CREDIT_COST = { standard: 2, premium: 5 };

export const UI = {
  IDLE:       'IDLE',
  PROCESSING: 'PROCESSING',
  READY:      'READY',
};

export default function DesignWorkspace({
  activeOrder, templates, backgrounds,
  uiState, setUiState,
  finalImageUrl, setFinalImageUrl,
  profile, userId,
  onSendForApproval, onRefreshProfile,
}) {
  // ── Bütün State Tanımlamaları ──
  const [selectedTemplate,   setSelectedTemplate]   = useState(null);
  const [processingMsg,      setProcessingMsg]      = useState('');
  const [error,              setError]              = useState('');
  const [previousImages,     setPreviousImages]     = useState([]);
  const [selectedAspect,     setSelectedAspect]     = useState('1:1');
  
  const [addingLayer,        setAddingLayer]        = useState(false);
  const [isUpscaling,        setUpscaling]          = useState(false);
  const [isSending,          setIsSending]          = useState(false);

  const konvaEditorRef = useRef(null);
  const fileInputRef   = useRef(null);

  const currentAspectCfg = ASPECT_OPTIONS.find(a => a.id === selectedAspect) || ASPECT_OPTIONS[0];

  // ── Önceki AI görsellerini çek ───────────────────────────
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

  if (!activeOrder) return null;

  // ── AI Üretimi (PNG formatında kaydeder) ──────────────────────────────────
  const handleStartAI = async (tier) => {
    if (!selectedTemplate) { setError('Lütfen bir şablon seçin.'); return; }
    
    const cost = CREDIT_COST[tier];
    if (profile.credits < cost) {
      setError(`Yetersiz kredi. Mevcut: ${profile.credits}`);
      return;
    }
    setError('');
    setUiState(UI.PROCESSING);
    setProcessingMsg('AI görsel oluşturuyor... ⏳');

    try {
      const TIMEOUT    = tier === 'premium' ? 180_000 : 120_000;
      const controller = new AbortController();
      const tid        = setTimeout(() => controller.abort(), TIMEOUT);

      const res = await fetch(`${API}/api/generate-v2`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userFaceUrl:         activeOrder.source_image_url,
          templateFixedPrompt: selectedTemplate.fixed_prompt,
          qualityTier:         tier,
          width:               currentAspectCfg.width,
          height:              currentAspectCfg.height,
        }),
        signal: controller.signal,
      });
      clearTimeout(tid);

      if (!res.ok) throw new Error(`Sunucu hatası: ${res.status}`);
      const data = await res.json();
      if (!data.finalImageUrl) throw new Error(data.error || 'Görsel gelmedi');

      setProcessingMsg('Görsel kaydediliyor... ⏳');
      let permanentUrl = data.finalImageUrl;
      
      try {
        const fileName = `ai/${userId}/${activeOrder.etsy_order_no}_${Date.now()}.png`;
        const blob = await fetch(data.finalImageUrl).then(r => r.blob()).catch(() => null);
        if (blob) {
          const { error: upErr } = await supabase.storage
            .from('orders')
            .upload(fileName, blob, { contentType: 'image/png', upsert: true });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('orders').getPublicUrl(fileName);
            permanentUrl = publicUrl;
          }
        }
      } catch { /* sessizce devam et */ }

      await supabase.rpc('deduct_credits', {
        p_user_id:    userId,
        p_amount:     cost,
        p_type:       `ai_${tier}`,
        p_description:`${selectedTemplate.name} — #${activeOrder.etsy_order_no}`,
        p_order_id:   activeOrder.id,
      });
      await onRefreshProfile();

      await supabase.from('order_ai_images').insert({
        order_id:  activeOrder.id,
        user_id:   userId,
        image_url: permanentUrl,
        template:  selectedTemplate.name,
        tier,
      });

      await supabase.from('orders').update({
        ai_image_url: permanentUrl,
        ai_tier:      tier,
        ai_template:  selectedTemplate.name,
      }).eq('id', activeOrder.id);

      setFinalImageUrl(permanentUrl);
      setPreviousImages(prev => [
        { url: permanentUrl, template: selectedTemplate.name, tier },
        ...prev.filter(p => p.url !== permanentUrl),
      ]);
      
      setUiState(UI.READY);
      setProcessingMsg('');
    } catch (err) {
      setError('AI hatası: ' + err.message);
      setUiState(UI.IDLE);
    }
  };

  // ── Çözünürlük Yükseltme (Upscale - Galeri ve DB Güncelleme Ekli) ──────────
  const handleUpscale = async () => {
    if (profile.credits < 1) {
      setError('Upscale işlemi için en az 1 krediniz olmalıdır.');
      return;
    }
    setError('');
    setUpscaling(true);
    setUiState(UI.PROCESSING);
    setProcessingMsg('Görsel yüksek çözünürlüğe (4K) yükseltiliyor... 🪄⏳');

    const oldUrl = finalImageUrl; // Eski URL'yi sakla

    try {
      const res = await fetch(`${API}/api/upscale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: oldUrl }),
      });
      
      const data = await res.json().catch(() => ({})); 
      if (!res.ok) throw new Error(data.error || `Sunucu Hatası: ${res.status}`);
      if (!data.upscaledUrl) throw new Error('Upscale başarısız oldu.');

      setProcessingMsg('Yüksek çözünürlüklü dosya kaydediliyor... ⏳');
      let permanentUrl = data.upscaledUrl;

      try {
        const fileName = `ai/${userId}/upscaled_${activeOrder.etsy_order_no}_${Date.now()}.png`;
        const blob = await fetch(data.upscaledUrl).then(r => r.blob()).catch(() => null);
        if (blob) {
          const { error: upErr } = await supabase.storage
            .from('orders')
            .upload(fileName, blob, { contentType: 'image/png', upsert: true });
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('orders').getPublicUrl(fileName);
            permanentUrl = publicUrl;
          }
        }
      } catch { /* sessizce devam et */ }

      // 1. Kredi Düş
      await supabase.rpc('deduct_credits', {
        p_user_id:    userId,
        p_amount:     1,
        p_type:       'upscale',
        p_description:`Upscale — #${activeOrder.etsy_order_no}`,
        p_order_id:   activeOrder.id,
      });
      await onRefreshProfile();

      // 2. Üretim Geçmişindeki (Galerideki) görseli yeni haliyle GÜNCELLE
      await supabase
        .from('order_ai_images')
        .update({ image_url: permanentUrl })
        .eq('image_url', oldUrl);

      // 3. Siparişin ana görselini GÜNCELLE
      await supabase
        .from('orders')
        .update({ ai_image_url: permanentUrl })
        .eq('id', activeOrder.id);

      // 4. Yerel galeri state'ini anlık güncelle
      setPreviousImages(prev => prev.map(img => 
        img.url === oldUrl ? { ...img, url: permanentUrl } : img
      ));

      setFinalImageUrl(permanentUrl);
      setUiState(UI.READY);
      setProcessingMsg('');
    } catch (err) {
      setError('Upscale hatası: ' + err.message);
      setUiState(UI.READY);
    } finally {
      setUpscaling(false);
    }
  };

  // ── Ekstra Görsel Katmanı (Layer) Ekleme ──────────────────
  const handleAddLayerFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('Görsel 10MB\'tan büyük olamaz.'); return; }
    
    setAddingLayer(true);
    setError('');
    
    try {
      const ext  = file.name.split('.').pop().toLowerCase();
      const path = `layers/${userId}/${activeOrder.id}_${Date.now()}.${ext}`;
      
      const { error: upErr } = await supabase.storage.from('orders').upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      
      const { data: { publicUrl } } = supabase.storage.from('orders').getPublicUrl(path);
      
      if (konvaEditorRef.current?.addLayer) {
        await konvaEditorRef.current.addLayer(publicUrl);
      }
    } catch (err) {
      setError('Görsel eklenemedi: ' + err.message);
    } finally {
      setAddingLayer(false);
    }
  };

  // ── Baskı dosyasını al ve Onaya Gönder ────────────────────
  const handleSendToCustomer = async () => {
    setIsSending(true);
    setError('');
    try {
      const api = konvaEditorRef.current;
      if (!api || typeof api.exportDesign !== 'function') throw new Error('Editör hazır değil.');
      
      const b64 = api.exportDesign();
      if (!b64) throw new Error('Baskı dosyası oluşturulamadı.');

      await onSendForApproval(b64, []);
    } catch (err) {
      setError('Gönderim hatası: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setFinalImageUrl(reader.result); setUiState(UI.READY); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={s.orderHeader}>
        <div>
          <div style={s.orderTitle}>Etsy Sipariş No: #{activeOrder.etsy_order_no}</div>
          <div style={s.orderSub}>{activeOrder.customer_name}</div>
        </div>
        <img src={activeOrder.source_image_url} alt="Customer" style={s.avatar} />
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom:16 }}>{error}</div>}

      {uiState === UI.IDLE && (
        <>
          {previousImages.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div className="label" style={{ marginBottom:8 }}>🖼️ Önceki Üretimler</div>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {previousImages.map((img, i) => (
                  <div key={i}
                    style={{ position:'relative', cursor:'pointer', border: '2px solid var(--border)', borderRadius:10, overflow:'hidden', width:100, height:100 }}
                    onClick={() => { setFinalImageUrl(img.url); setUiState(UI.READY); }}>
                    <img src={img.url} alt={`Prev ${i+1}`} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    <div style={{ position:'absolute', bottom:0, width:'100%', background:'rgba(0,0,0,0.7)', color:'#fff', fontSize:9, textAlign:'center' }}>Kullan</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <TemplateGallery templates={templates} selectedTemplateId={selectedTemplate?.id} onSelect={setSelectedTemplate} onFileUpload={handleFileUpload} />
          {selectedTemplate && (
            <div style={{ marginTop: 24, padding: 16, border: '1px solid var(--border-light)', borderRadius: 'var(--radius)' }}>
              <label className="label" style={{ marginBottom: 10, display: 'block', fontSize: 13 }}>📏 Görsel Boyutu</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {ASPECT_OPTIONS.map(aspect => (
                  <button key={aspect.id} onClick={() => setSelectedAspect(aspect.id)} style={{ padding: '8px 14px', background: selectedAspect === aspect.id ? 'var(--brand)' : 'var(--bg-card)', color: selectedAspect === aspect.id ? '#fff' : 'var(--text)', border: `1px solid ${selectedAspect === aspect.id ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 13 }}>{aspect.label}</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn" style={{ flex:1, background:'#374151', color:'#fff' }} onClick={() => handleStartAI('standard')} disabled={profile.credits < CREDIT_COST.standard}>⚡ Standart ({CREDIT_COST.standard})</button>
                <button className="btn" style={{ flex:1, background:'#7c3aed', color:'#fff' }} onClick={() => handleStartAI('premium')} disabled={profile.credits < CREDIT_COST.premium}>🎨 Premium ({CREDIT_COST.premium})</button>
              </div>
            </div>
          )}
        </>
      )}

      {uiState === UI.PROCESSING && <div style={s.center}><div className="spinner" style={{ marginBottom:20 }} /><p>{processingMsg}</p></div>}

      {uiState === UI.READY && finalImageUrl && (
        <>
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginBottom:16 }}>
            <button type="button" className="btn" style={{ background: '#10b981', color: 'white' }} disabled={isUpscaling} onClick={handleUpscale}>{isUpscaling ? '🪄 Yükseltiliyor...' : '🪄 4K Upscale (1 Kredi)'}</button>
            <button type="button" className="btn btn-secondary" disabled={addingLayer} onClick={() => fileInputRef.current?.click()}>{addingLayer ? '⏳ Yükleniyor...' : '➕ Görsel Ekle'}</button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleAddLayerFile} />
          </div>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
            <KonvaDesignArea ref={konvaEditorRef} designUrl={finalImageUrl} containerWidth={Math.min(600, window.innerWidth - 60)} />
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-secondary" onClick={() => setUiState(UI.IDLE)}>← Geri</button>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={handleSendToCustomer} disabled={isSending || isUpscaling}>{isSending ? '⏳ Gönderiliyor...' : '📤 Onaya Gönder'}</button>
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  orderHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'var(--info-bg)', borderRadius:'var(--radius-sm)', marginBottom:20, border:'1px solid rgba(59,130,246,0.3)' },
  orderTitle:  { fontWeight:700, color:'var(--info)', fontSize:16 },
  orderSub:    { fontSize:13, color:'var(--text-muted)' },
  avatar:      { width:44, height:44, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--info)' },
  center:      { display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 20px' },
};