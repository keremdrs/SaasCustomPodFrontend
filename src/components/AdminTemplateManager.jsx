import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AdminTemplateEditor from './AdminTemplateEditor';
const API = 'https://saascustompod.onrender.com';

export default function AdminTemplateManager({ onClose }) {
  const { user } = useAuth();
  const [printifyToken, setPrintifyToken] = useState(null);
  const [templates,     setTemplates]     = useState([]);

  // Katalog seçim state'leri
  const [blueprints, setBlueprints] = useState([]);
  const [providers,  setProviders]  = useState([]);
  const [variants,   setVariants]   = useState([]);

  const [selectedBp,  setSelectedBp]  = useState(null); // { id, title }
  const [selectedPv,  setSelectedPv]  = useState(null); // { id, title }
  const [selectedVar, setSelectedVar] = useState(null); // { id, title, placeholders }

  const [bpLoading,  setBpLoading]  = useState(false);
  const [pvLoading,  setPvLoading]  = useState(false);
  const [vrLoading,  setVrLoading]  = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [msg,        setMsg]        = useState('');
  const [printArea,  setPrintArea]  = useState({ x: '', y: '', w: '', h: '' });
  const [editingTemplate, setEditingTemplate] = useState(null);
  const tokenParam = printifyToken
    ? `?token=${encodeURIComponent(printifyToken)}`
    : '';
  const tokenAppend = printifyToken
    ? `&token=${encodeURIComponent(printifyToken)}`
    : '';

  useEffect(() => {
    loadTemplates();
    // Token'ı Supabase'den çek
    if (user) {
      supabase
        .from('printify_tokens')
        .select('access_token')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.access_token) setPrintifyToken(data.access_token);
        });
    }
  }, [user]);

  // printifyToken gelince blueprint'leri yükle
  useEffect(() => {
    if (printifyToken) loadBlueprints();
  }, [printifyToken]);

  const loadTemplates = async () => {
  const { data } = await supabase
    .from('blueprint_templates')
    .select('*')
    .order('blueprint_id', { ascending: true })
    .order('provider_id', { ascending: true, nullsFirst: true })
    .order('variant_id',  { ascending: true, nullsFirst: true });
  setTemplates(data || []);
};

  // ── Blueprint listesi ────────────────────────────────────
  const loadBlueprints = async () => {
    setBpLoading(true);
    try {
      const res  = await fetch(`${API}/api/printify/blueprints${tokenParam}`);
      const data = await res.json();
      setBlueprints(Array.isArray(data) ? data : []);
    } catch { setMsg('error:Blueprint listesi yüklenemedi.'); }
    setBpLoading(false);
  };

  // ── Provider listesi ─────────────────────────────────────
  const handleBlueprintSelect = async (bp) => {
    setSelectedBp(bp);
    setSelectedPv(null);
    setSelectedVar(null);
    setProviders([]);
    setVariants([]);
    setMsg('');
    setPvLoading(true);
    try {
      const res  = await fetch(`${API}/api/printify/blueprints/${bp.id}/providers${tokenParam}`);
      const data = await res.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch { setMsg('error:Provider listesi yüklenemedi.'); }
    setPvLoading(false);
  };

  // ── Variant listesi ──────────────────────────────────────
  const handleProviderSelect = async (pv) => {
    setSelectedPv(pv);
    setSelectedVar(null);
    setVariants([]);
    setVrLoading(true);
    try {
      const res  = await fetch(
        `${API}/api/printify/blueprints/${selectedBp.id}/providers/${pv.id}/variants${tokenParam}`
      );
      // NOT: tokenParam zaten ?token=... formatında
      const data = await res.json();
      setVariants(data?.variants || []);
    } catch { setMsg('error:Variant listesi yüklenemedi.'); }
    setVrLoading(false);
  };

  // ── Template yükle ───────────────────────────────────────
 const handleTemplateUpload = async (e) => {
  const file = e.target.files[0];
  if (!file || !selectedBp) {
    setMsg('error:Blueprint ve dosya seçimi gerekli.');
    return;
  }
  setUploading(true);
  setMsg('');

  try {
    const ext  = file.name.split('.').pop().toLowerCase();

    // Storage path — variant'a göre ayrı, eskisini override etmesin diye timestamp ekli
    const pvSeg  = selectedPv?.id  || 'all';
    const varSeg = selectedVar?.id || 'any';
    const path   = `blueprints/${selectedBp.id}_${pvSeg}_${varSeg}_${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('templates')
      .upload(path, file, { upsert: true });
    if (upErr) throw upErr;

    const { data: { publicUrl } } = supabase.storage
      .from('templates')
      .getPublicUrl(path);

    // Boyutları otomatik tespit (PNG/JPG/SVG)
    let svgWidth = null, svgHeight = null;

    if (ext === 'svg') {
      try {
        const text = await file.text();
        const vbMatch = text.match(/viewBox="[\d.\s]*?([\d.]+)\s+([\d.]+)"/);
        if (vbMatch) {
          svgWidth  = parseFloat(vbMatch[1]);
          svgHeight = parseFloat(vbMatch[2]);
        }
        const translateMatch = text.match(/translate\(([\d.]+)[,\s]+([\d.]+)\)/);
        const rectMatch = text.match(/id="[^"]*(?:path|area|print)[^"]*"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/i)
          || text.match(/width="([\d.]+)"[^>]*height="([\d.]+)"[^>]*id="[^"]*(?:path|area|print)[^"]*"/i);
        if (translateMatch && rectMatch) {
          const px = parseFloat(translateMatch[1]);
          const py = parseFloat(translateMatch[2]);
          const pw = parseFloat(rectMatch[1]);
          const ph = parseFloat(rectMatch[2]);
          setPrintArea({ x: px.toFixed(1), y: py.toFixed(1), w: pw.toFixed(1), h: ph.toFixed(1) });
        }
      } catch {}
    } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
      await new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload  = () => {
          svgWidth  = img.naturalWidth;
          svgHeight = img.naturalHeight;
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        img.src = url;
      });
    }

    // Variant bilgilerini hazırla
    const variantInfo = selectedVar ? {
      variant_id:    selectedVar.id,
      variant_title: selectedVar.title,
      print_width:   selectedVar.placeholders?.[0]?.width,
      print_height:  selectedVar.placeholders?.[0]?.height,
    } : {
      variant_id:    null,
      variant_title: null,
    };

    const record = {
      blueprint_id:   selectedBp.id,
      blueprint_name: selectedBp.title,
      provider_id:    selectedPv?.id    || null,
      provider_name:  selectedPv?.title || null,
      template_url:   publicUrl,
      ...variantInfo,
      svg_width:      svgWidth,
      svg_height:     svgHeight,
      print_area_x:   printArea.x ? parseFloat(printArea.x) : null,
      print_area_y:   printArea.y ? parseFloat(printArea.y) : null,
      print_area_w:   printArea.w ? parseFloat(printArea.w) : null,
      print_area_h:   printArea.h ? parseFloat(printArea.h) : null,
    };

    // Önce variant kombinasyonuna göre mevcut kaydı ara
    let lookup = supabase
      .from('blueprint_templates')
      .select('id')
      .eq('blueprint_id', selectedBp.id);

    lookup = selectedPv?.id
      ? lookup.eq('provider_id', selectedPv.id)
      : lookup.is('provider_id', null);

    lookup = selectedVar?.id
      ? lookup.eq('variant_id', selectedVar.id)
      : lookup.is('variant_id', null);

    const { data: existing } = await lookup.maybeSingle();

    let dbErr;
    if (existing) {
      // Güncelle (aynı variant için yeniden yükleme)
      const { error } = await supabase
        .from('blueprint_templates')
        .update(record)
        .eq('id', existing.id);
      dbErr = error;
    } else {
      // Yeni variant kaydı
      const { error } = await supabase
        .from('blueprint_templates')
        .insert(record);
      dbErr = error;
    }
    if (dbErr) throw dbErr;

    const variantLabel = selectedVar?.title || 'tüm varyantlar';
    setMsg(`success:✅ Template kaydedildi! ${selectedBp.title} → ${variantLabel}`);
    loadTemplates();
  } catch (err) {
    setMsg('error:' + err.message);
  }
  setUploading(false);
};

  const handleDelete = async (t) => {
    if (!confirm('Sil?')) return;
    await supabase.from('blueprint_templates').delete().eq('id', t.id);
    loadTemplates();
  };

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.header}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>
            🎨 Blueprint Template Kütüphanesi
          </h3>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        <div style={s.body}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            Printify'dan indirdiğin SVG template'leri blueprint bazlı buraya yükle.
            Satıcılar o blueprint'i seçince template otomatik gelir.
          </p>

          {!printifyToken && (
            <div className="alert alert-warning" style={{ marginBottom: 16 }}>
              ⚠️ Printify token bulunamadı. Settings'ten Printify hesabını bağla.
            </div>
          )}

          <div style={s.steps}>

            {/* Step 1: Blueprint seç */}
            <div style={s.step}>
              <div style={s.stepTitle}>1. Ürün Seçin (Blueprint)</div>
              {bpLoading ? (
                <div style={s.loading}>Yükleniyor...</div>
              ) : !printifyToken ? (
                <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Token bekleniyor...</div>
              ) : (
                <select
                  className="input"
                  value={selectedBp?.id || ''}
                  onChange={e => {
                    const bp = blueprints.find(b => b.id === parseInt(e.target.value));
                    if (bp) handleBlueprintSelect(bp);
                  }}
                >
                  <option value="">-- Blueprint Seçin --</option>
                  {blueprints.map(bp => (
                    <option key={bp.id} value={bp.id}>
                      {bp.title} (ID: {bp.id})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Step 2: Provider seç */}
            {selectedBp && (
              <div style={s.step}>
                <div style={s.stepTitle}>2. Baskı Sağlayıcı (Provider)</div>
                {pvLoading ? (
                  <div style={s.loading}>Yükleniyor...</div>
                ) : (
                  <select
                    className="input"
                    value={selectedPv?.id || ''}
                    onChange={e => {
                      const pv = providers.find(p => p.id === parseInt(e.target.value));
                      if (pv) handleProviderSelect(pv);
                    }}
                  >
                    <option value="">-- Provider Seçin --</option>
                    {providers.map(pv => (
                      <option key={pv.id} value={pv.id}>
                        {pv.title} (ID: {pv.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Step 3: Variant seç (referans için) */}
            {selectedPv && (
              <div style={s.step}>
                <div style={s.stepTitle}>3. Varyant (opsiyonel — boyut referansı için)</div>
                {vrLoading ? (
                  <div style={s.loading}>Yükleniyor...</div>
                ) : (
                  <select
                    className="input"
                    value={selectedVar?.id || ''}
                    onChange={e => {
                      const v = variants.find(x => x.id === parseInt(e.target.value));
                      setSelectedVar(v || null);
                    }}
                  >
                    <option value="">-- Varyant Seçin (opsiyonel) --</option>
                    {variants.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.title} — {v.placeholders?.[0]?.width}×{v.placeholders?.[0]?.height}px
                      </option>
                    ))}
                  </select>
                )}
                {selectedVar && (
                  <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>
                    Print area: {selectedVar.placeholders?.[0]?.width}×{selectedVar.placeholders?.[0]?.height}px
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Template yükle */}
            {selectedBp && (
              <div style={s.step}>
                <div style={s.stepTitle}>4. SVG Template Yükle</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10, lineHeight: 1.6 }}>
  PNG mockup yükle (baskı alanı şeffaf olmalı — Photoshop'ta o alanı sil/alpha=0 yap).
  Yükledikten sonra <strong style={{ color: 'var(--brand)' }}>✏️ Düzenle</strong> ile baskı alanını görsel olarak ayarla.
</div>
                {/* Print area koordinatları */}
                <div style={{ marginBottom: 10 }}>
                  <div className="label" style={{ marginBottom: 6 }}>
                    Print Area Koordinatları (SVG'den otomatik alınır, düzenleyebilirsin)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                    {[['X', 'x'], ['Y', 'y'], ['Genişlik (W)', 'w'], ['Yükseklik (H)', 'h']].map(([label, key]) => (
                      <div key={key}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>{label}</div>
                        <input
                          className="input"
                          style={{ fontSize: 12, padding: '6px 8px' }}
                          placeholder="0"
                          value={printArea[key]}
                          onChange={e => setPrintArea(p => ({ ...p, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <label style={{
                  display: 'block', padding: 14,
                  background: uploading ? 'var(--bg-hover)' : 'var(--brand)',
                  color: '#fff', borderRadius: 'var(--radius-sm)',
                  fontWeight: 600, fontSize: 14, textAlign: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                }}>
                  {uploading ? '⏳ Yükleniyor...' : `📁 Template Yükle — Blueprint ${selectedBp.id}`}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg"
                    style={{ display: 'none' }}
                    disabled={uploading}
                    onChange={handleTemplateUpload}
                  />
                </label>
              </div>
            )}

            {msg && (
              <div className={`alert ${msg.startsWith('error:') ? 'alert-error' : 'alert-success'}`}>
                {msg.slice(msg.indexOf(':') + 1)}
              </div>
            )}
          </div>

          {/* Mevcut template'ler */}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, fontFamily: 'var(--font-display)' }}>
              Kayıtlı Template'ler ({templates.length})
            </div>
            {templates.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Henüz template eklenmemiş.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {templates.map(t => (
                  <div key={t.id} style={s.row}>
                    <img
                      src={t.template_url}
                      alt={t.blueprint_name}
                      style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 6, background: '#f5f5f5', border: '1px solid var(--border)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        Blueprint {t.blueprint_id} — {t.blueprint_name || 'İsimsiz'}
                      </div>
                     <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      {t.provider_name && `${t.provider_name} · `}
                      {t.variant_title
                        ? <span style={{ color: 'var(--brand)', fontWeight: 600 }}> · {t.variant_title}</span>
                        : <span style={{ color: 'var(--text-dim)' }}> · tüm varyantlar</span>
                      }
                      {t.print_width && `${t.print_width}×${t.print_height}px`}
                      {t.print_area_w && ` · Print: ${t.print_area_w}×${t.print_area_h}`}
                      {t.print_area_x != null && ` @ (${t.print_area_x},${t.print_area_y})`}
                    </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => setEditingTemplate(t)}
                          className="btn btn-secondary"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          title="Print area'yı görsel olarak düzenle"
                        >
                          ✏️ Düzenle
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="btn btn-secondary"
                          style={{ fontSize: 11, color: 'var(--danger)', padding: '4px 10px' }}
                        >
                          Sil
                        </button>
                      </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Görsel Editor Modal */}
      {editingTemplate && (
        <AdminTemplateEditor
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => loadTemplates()}
        />
      )}
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 20,
  },
  modal: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    width: '100%', maxWidth: 580,
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '18px 24px', borderBottom: '1px solid var(--border)',
  },
  closeBtn: {
    background: 'transparent', border: 'none',
    color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer',
  },
  body:    { padding: 24, overflowY: 'auto', flex: 1 },
  steps:   { display: 'flex', flexDirection: 'column', gap: 16 },
  step:    { display: 'flex', flexDirection: 'column', gap: 8 },
  stepTitle:{ fontSize: 13, fontWeight: 700, color: 'var(--brand)' },
  loading: { fontSize: 13, color: 'var(--text-muted)' },
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
  },
};