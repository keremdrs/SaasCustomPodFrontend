import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const API = 'https://saascustompod.onrender.com';

export default function ProductsManager({ userId, printifyToken }) {
  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [msg,        setMsg]        = useState('');

  // Printify katalog state'leri
  const [blueprints,   setBlueprints]   = useState([]);
  const [providers,    setProviders]    = useState([]);
  const [variants,     setVariants]     = useState([]);
  const [bpLoading,    setBpLoading]    = useState(false);
  const [pvLoading,    setPvLoading]    = useState(false);
  const [vrLoading,        setVrLoading]        = useState(false);
  const [variantDimensions,  setVariantDimensions]  = useState({});
  const [templateImageUrl,   setTemplateImageUrl]   = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '', blueprint_id: '', print_provider_id: '', variant_id: '',
    print_width: 2475, print_height: 1155, template_image_url: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [userId]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('seller_products')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order');
    setProducts(data || []);
    setLoading(false);
  };

  // ── Blueprint listesi yükle ──────────────────────────────
  const loadBlueprints = async () => {
    if (blueprints.length) return; // zaten yüklü
    setBpLoading(true);
    try {
      const tokenParam = printifyToken ? `?token=${encodeURIComponent(printifyToken)}` : '';
      const res  = await fetch(`${API}/api/printify/blueprints${tokenParam}`);
      const data = await res.json();
      setBlueprints(Array.isArray(data) ? data : []);
    } catch { setMsg('error:Blueprint listesi yüklenemedi.'); }
    setBpLoading(false);
  };

  // ── Provider listesi yükle ───────────────────────────────
  const handleBlueprintChange = async (bpId) => {
    setForm(f => ({ ...f, blueprint_id: bpId, print_provider_id: '', variant_id: '' }));
    setProviders([]);
    setVariants([]);
    setTemplateImageUrl('');
    if (!bpId) return;

    // Sadece kendi template kütüphanemizden çek — Printify'a istek atmıyoruz
    try {
      const res  = await fetch(`${API}/api/templates/blueprint/${bpId}`);
      const data = await res.json();
      if (data.template_url) {
        setTemplateImageUrl(data.template_url);
        setForm(f => ({ ...f, template_image_url: data.template_url }));
        setMsg('success:Template bulundu ve otomatik yüklendi!');
      } else {
        setTemplateImageUrl('');
        setForm(f => ({ ...f, template_image_url: '' }));
        setMsg(''); // Template yok — print area guide gösterilecek
      }
    } catch { /* Devam et */ }
    setPvLoading(true);
    try {
      const tokenParam = printifyToken ? `&token=${encodeURIComponent(printifyToken)}` : '';
      const res  = await fetch(`${API}/api/printify/blueprints/${bpId}/providers?_=1${tokenParam}`);
      const data = await res.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch { setMsg('error:Provider listesi yüklenemedi.'); }
    setPvLoading(false);
  };

  // ── Variant listesi yükle ────────────────────────────────
  const handleProviderChange = async (pvId) => {
    setForm(f => ({ ...f, print_provider_id: pvId, variant_id: '' }));
    setVariants([]);
    if (!pvId || !form.blueprint_id) return;
    setVrLoading(true);
    try {
      const tokenParam = printifyToken ? `&token=${encodeURIComponent(printifyToken)}` : '';
      const res  = await fetch(
        `${API}/api/printify/blueprints/${form.blueprint_id}/providers/${pvId}/variants?_=1${tokenParam}`
      );
      const data = await res.json();

      // Varyant listesi
      const varList = data?.variants || [];
      setVariants(varList);

      // Her varyantın boyutlarını sakla
      if (data.variant_dimensions) {
        setVariantDimensions(data.variant_dimensions);
      }

      // İlk varyantın boyutunu varsayılan olarak göster
      if (data.print_width && data.print_height) {
        setForm(f => ({
          ...f,
          print_width:  data.print_width,
          print_height: data.print_height,
          variant_id:   '',  // variant seçimini sıfırla
        }));
        setMsg('success:Varyant boyutları yüklendi. Varyant seçince güncellenir.');
      } else {
        setMsg('');
      }
    } catch { setMsg('error:Variant listesi yüklenemedi.'); }
    setVrLoading(false);
  };


  // ── Variant seçimi: dimensions + template'i variant'a göre çek ─────
const handleVariantChange = async (vid) => {
  const dims = variantDimensions[vid];
  setForm(f => ({
    ...f,
    variant_id:   vid,
    print_width:  dims?.print_width  || f.print_width,
    print_height: dims?.print_height || f.print_height,
  }));
  if (dims) setMsg(`success:Boyut güncellendi: ${dims.print_width}×${dims.print_height}px`);

  // Variant'a özel template'i çek
  if (!vid || !form.blueprint_id) return;
  try {
    const params = new URLSearchParams({
      provider_id: form.print_provider_id,
      variant_id:  vid,
    });
    const res  = await fetch(`${API}/api/templates/blueprint/${form.blueprint_id}?${params}`);
    const data = await res.json();

    if (data?.template_url) {
      setTemplateImageUrl(data.template_url);
      setForm(f => ({ ...f, template_image_url: data.template_url }));
      // Mesaj zaten boyut güncelleme mesajıyla doluysa onu ezmeyelim
      if (!dims) setMsg('success:Bu variant için template yüklendi.');
    } else {
      // Variant'a özel template yok
      setTemplateImageUrl('');
      setForm(f => ({ ...f, template_image_url: '' }));
      if (!dims) setMsg('warning:Bu variant için kayıtlı template yok. Admin\'den yükleyin.');
    }
  } catch { /* sessizce geç */ }
};

  // ── Ürün kaydet ──────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name || !form.blueprint_id || !form.print_provider_id || !form.variant_id) {
      setMsg('error:Tüm alanları doldurun.');
      return;
    }
    setSaving(true);
    setMsg('');
    const { error } = await supabase.from('seller_products').insert({
  user_id:            userId,
  name:               form.name,
  blueprint_id:       parseInt(form.blueprint_id),
  print_provider_id:  parseInt(form.print_provider_id),
  variant_id:         parseInt(form.variant_id),
  print_width:        form.print_width,
  print_height:       form.print_height,
  template_image_url: form.template_image_url || null,
  sort_order:         products.length,
  is_active:          true,         // ← eklendi
});
    if (error) {
      setMsg('error:Kaydedilemedi: ' + error.message);
    } else {
      setMsg('success:Ürün eklendi!');
      setShowForm(false);
      setForm({ name: '', blueprint_id: '', print_provider_id: '', variant_id: '', print_width: 2475, print_height: 1155 });
      setProviders([]);
      setVariants([]);
      fetchProducts();
    }
    setSaving(false);
  };

  // ── Ürün sil ─────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    await supabase.from('seller_products').delete().eq('id', id);
    fetchProducts();
  };

  // ── Toggle aktif/pasif ───────────────────────────────────
  const handleToggle = async (id, currentState) => {
    await supabase.from('seller_products').update({ is_active: !currentState }).eq('id', id);
    fetchProducts();
  };

  return (
    <div>
      {/* Ürün listesi */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Yükleniyor...</div>
      ) : products.length === 0 ? (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          Henüz ürün eklenmemiş. Printify'daki ürünlerinizi ekleyin.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {products.map(p => (
            <div key={p.id} style={styles.productRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                  Blueprint: {p.blueprint_id} · Provider: {p.print_provider_id} · Variant: {p.variant_id}
                  · {p.print_width}×{p.print_height}px
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                  background: p.is_active ? 'var(--success-bg)' : 'var(--bg-hover)',
                  color: p.is_active ? 'var(--success)' : 'var(--text-dim)',
                }}>
                  {p.is_active ? 'Aktif' : 'Pasif'}
                </span>
                <button
                  onClick={() => handleToggle(p.id, p.is_active)}
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  {p.is_active ? 'Pasife Al' : 'Aktife Al'}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="btn btn-secondary"
                  style={{ fontSize: 11, padding: '4px 8px', color: 'var(--danger)' }}
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mesaj */}
      {msg && (
        <div className={`alert ${msg.startsWith('error:') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 16 }}>
          {msg.startsWith('error:') ? '❌ ' : '✅ '}{msg.slice(msg.indexOf(':') + 1)}
        </div>
      )}

      {/* Yeni ürün ekle butonu */}
      {!showForm ? (
        <button
          className="btn btn-primary"
          onClick={() => { setShowForm(true); loadBlueprints(); setMsg(''); }}
        >
          + Yeni Ürün Ekle
        </button>
      ) : (
        <div style={styles.form}>
          <h4 style={{ marginBottom: 16, fontFamily: 'var(--font-display)' }}>Yeni Ürün Ekle</h4>

          {/* Ürün adı */}
          <div className="form-group">
            <label className="label">Ürün Adı *</label>
            <input
              className="input"
              placeholder='Örn: "11oz White Mug", "iPhone 15 Pro Case"'
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Blueprint seçimi */}
          <div className="form-group">
            <label className="label">Printify Ürün (Blueprint) *</label>
            {bpLoading ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Yükleniyor...</div>
            ) : (
              <select
                className="input"
                value={form.blueprint_id}
                onChange={e => handleBlueprintChange(e.target.value)}
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

          {/* Provider seçimi */}
          {form.blueprint_id && (
            <div className="form-group">
              <label className="label">Baskı Sağlayıcı (Provider) *</label>
              {pvLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Yükleniyor...</div>
              ) : (
                <select
                  className="input"
                  value={form.print_provider_id}
                  onChange={e => handleProviderChange(e.target.value)}
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

          {/* Variant seçimi */}
          {form.print_provider_id && (
            <div className="form-group">
              <label className="label">Varyant (Renk/Boyut) *</label>
              {vrLoading ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Yükleniyor...</div>
              ) : (
                <select
                  className="input"
                  value={form.variant_id}
                  onChange={e => handleVariantChange(e.target.value)}
                >
                  <option value="">-- Varyant Seçin --</option>
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.title} (ID: {v.id})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Print boyutları */}
          {form.variant_id && (
            <div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="label">
                    Baskı Genişliği (px)
                    {msg.startsWith('success:Print') && (
                      <span style={{ color: 'var(--success)', fontSize: 11, marginLeft: 6 }}>✓ otomatik</span>
                    )}
                  </label>
                  <input
                    className="input"
                    type="number"
                    value={form.print_width}
                    onChange={e => setForm(f => ({ ...f, print_width: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="label">
                    Baskı Yüksekliği (px)
                    {msg.startsWith('success:Print') && (
                      <span style={{ color: 'var(--success)', fontSize: 11, marginLeft: 6 }}>✓ otomatik</span>
                    )}
                  </label>
                  <input
                    className="input"
                    type="number"
                    value={form.print_height}
                    onChange={e => setForm(f => ({ ...f, print_height: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                Boyutlar Printify API'sinden otomatik alınır. Yanlışsa manuel düzeltebilirsiniz.
              </div>
            </div>
          )}

          {/* Template SVG/görsel yükleme */}
          {form.blueprint_id && (
            <div className="form-group">
              <label className="label">
                Ürün Tasarım Şablonu (SVG)
              </label>

              {/* Önizleme */}
              {form.template_image_url && (
                <div style={{ marginBottom: 10, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: '#f5f5f5', maxHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                  <img
                    src={form.template_image_url}
                    alt="Template"
                    style={{ maxHeight: 104, maxWidth: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}

              {/* SVG dosyası yükle */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <label style={{
                  flex: 1, padding: '10px 14px', background: 'var(--bg-hover)',
                  border: '1px dashed var(--border-light)', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  📁 Printify SVG Template Yükle
                  <input
                    type="file"
                    accept=".svg,image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setMsg('success:Yükleniyor...');
                      try {
                        const ext  = file.name.split('.').pop();
                        const path = `templates/${userId}/${Date.now()}.${ext}`;
                        const { error: upErr } = await supabase.storage
                          .from('templates')
                          .upload(path, file, { upsert: true });
                        if (upErr) throw upErr;
                        const { data: { publicUrl } } = supabase.storage.from('templates').getPublicUrl(path);
                        setForm(f => ({ ...f, template_image_url: publicUrl }));
                        setTemplateImageUrl(publicUrl);
                        setMsg('success:Şablon yüklendi!');
                      } catch (err) {
                        setMsg('error:Yükleme hatası: ' + err.message);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Manuel URL */}
              <input
                className="input"
                placeholder="Veya direkt URL girin..."
                value={form.template_image_url}
                onChange={e => {
                  setForm(f => ({ ...f, template_image_url: e.target.value }));
                  setTemplateImageUrl(e.target.value);
                }}
              />

              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                <strong>Nasıl alınır:</strong> Printify Editor → F12 → Network → SVG filtrele → 
                template dosyasını indir → buraya yükle.
                <br />Template olmadan sistem print area sınırlarını gösterir.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => { setShowForm(false); setMsg(''); }}>
              İptal
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !form.name || !form.blueprint_id || !form.print_provider_id || !form.variant_id}
            >
              {saving ? 'Kaydediliyor...' : '💾 Ürünü Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  productRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
  },
  form: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
};