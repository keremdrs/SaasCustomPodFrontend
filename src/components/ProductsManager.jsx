import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const API = 'https://saascustompod.onrender.com';

export default function ProductsManager({ userId, printifyToken, printfulToken, printfulStoreId }) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [msg,      setMsg]      = useState('');

  // ── Aktif sekme ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('printify'); // 'printify' | 'printful'

  // ── Printify katalog state'leri ──────────────────────────
  const [blueprints,       setBlueprints]       = useState([]);
  const [providers,        setProviders]        = useState([]);
  const [variants,         setVariants]         = useState([]);
  const [bpLoading,        setBpLoading]        = useState(false);
  const [pvLoading,        setPvLoading]        = useState(false);
  const [vrLoading,        setVrLoading]        = useState(false);
  const [variantDimensions,setVariantDimensions]= useState({});
  const [templateImageUrl, setTemplateImageUrl] = useState('');

  // ── Printify form ────────────────────────────────────────
  const [form, setForm] = useState({
    name: '', blueprint_id: '', print_provider_id: '', variant_id: '',
    print_width: 2475, print_height: 1155, template_image_url: '',
    svg_width: null, svg_height: null,
    print_area_x: null, print_area_y: null, print_area_w: null, print_area_h: null,
  });
  const [saving, setSaving] = useState(false);

  // ── Printful katalog state'leri ──────────────────────────
  const [pfSearch,     setPfSearch]     = useState('');
  const [pfProducts,   setPfProducts]   = useState([]);
  const [pfLoading,    setPfLoading]    = useState(false);
  const [pfSelected,   setPfSelected]   = useState(null);
  const [pfVariants,   setPfVariants]   = useState([]);
  const [pfPlacements, setPfPlacements] = useState([]);
  const [pfVrLoading,  setPfVrLoading]  = useState(false);

  // ── Printful form ────────────────────────────────────────
  const [pfForm, setPfForm] = useState({
    name: '', printful_product_id: '', printful_variant_id: '',
    printful_placement: '', print_width: 0, print_height: 0,
  });
  const [pfSaving, setPfSaving] = useState(false);
  const [pfMsg,    setPfMsg]    = useState('');

  // ────────────────────────────────────────────────────────
  useEffect(() => { fetchProducts(); }, [userId]);

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

  // ── Printify: Blueprint listesi yükle ───────────────────
  const loadBlueprints = async () => {
    if (blueprints.length) return;
    setBpLoading(true);
    try {
      const tokenParam = printifyToken ? `?token=${encodeURIComponent(printifyToken)}` : '';
      const res  = await fetch(`${API}/api/printify/blueprints${tokenParam}`);
      const data = await res.json();
      setBlueprints(Array.isArray(data) ? data : []);
    } catch { setMsg('error:Blueprint listesi yüklenemedi.'); }
    setBpLoading(false);
  };

  const handleBlueprintChange = async (bpId) => {
    setForm(f => ({ ...f, blueprint_id: bpId, print_provider_id: '', variant_id: '' }));
    setProviders([]); setVariants([]); setTemplateImageUrl('');
    if (!bpId) return;
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
        setMsg('');
      }
    } catch { /* devam et */ }
    setPvLoading(true);
    try {
      const tokenParam = printifyToken ? `&token=${encodeURIComponent(printifyToken)}` : '';
      const res  = await fetch(`${API}/api/printify/blueprints/${bpId}/providers?_=1${tokenParam}`);
      const data = await res.json();
      setProviders(Array.isArray(data) ? data : []);
    } catch { setMsg('error:Provider listesi yüklenemedi.'); }
    setPvLoading(false);
  };

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
      setVariants(data?.variants || []);
      if (data.variant_dimensions) setVariantDimensions(data.variant_dimensions);
      if (data.print_width && data.print_height) {
        setForm(f => ({ ...f, print_width: data.print_width, print_height: data.print_height, variant_id: '' }));
        setMsg('success:Varyant boyutları yüklendi. Varyant seçince güncellenir.');
      } else { setMsg(''); }
    } catch { setMsg('error:Variant listesi yüklenemedi.'); }
    setVrLoading(false);
  };

  const handleVariantChange = async (vid) => {
    const dims = variantDimensions[vid];
    setForm(f => ({
      ...f, variant_id: vid,
      print_width:  dims?.print_width  || f.print_width,
      print_height: dims?.print_height || f.print_height,
    }));
    if (dims) setMsg(`success:Boyut güncellendi: ${dims.print_width}×${dims.print_height}px`);
    if (!vid || !form.blueprint_id) return;
    try {
      const params = new URLSearchParams({ provider_id: form.print_provider_id, variant_id: vid });
      const res  = await fetch(`${API}/api/templates/blueprint/${form.blueprint_id}?${params}`);
      const data = await res.json();
      if (data?.template_url) {
        setTemplateImageUrl(data.template_url);
        setForm(f => ({ ...f, template_image_url: data.template_url }));
        if (!dims) setMsg('success:Bu variant için template yüklendi.');
      } else {
        setTemplateImageUrl('');
        setForm(f => ({ ...f, template_image_url: '' }));
        if (!dims) setMsg("warning:Bu variant için kayıtlı template yok. Admin'den yükleyin.");
      }
    } catch { /* sessizce geç */ }
  };

  const handleSave = async () => {
    if (!form.name || !form.blueprint_id || !form.print_provider_id || !form.variant_id) {
      setMsg('error:Tüm alanları doldurun.'); return;
    }
    setSaving(true); setMsg('');
    const { error } = await supabase.from('seller_products').insert({
      user_id: userId, name: form.name,
      blueprint_id: parseInt(form.blueprint_id),
      print_provider_id: parseInt(form.print_provider_id),
      variant_id: parseInt(form.variant_id),
      print_width: form.print_width, print_height: form.print_height,
      template_image_url: form.template_image_url || null,
      svg_width: form.svg_width, svg_height: form.svg_height,
      print_area_x: form.print_area_x, print_area_y: form.print_area_y,
      print_area_w: form.print_area_w, print_area_h: form.print_area_h,
      is_active: true, sort_order: products.length, fulfillment: 'printify',
    });
    if (error) { setMsg('error:Kaydedilemedi: ' + error.message); }
    else {
      setMsg('success:Ürün eklendi!'); setShowForm(false);
      setForm({ name:'', blueprint_id:'', print_provider_id:'', variant_id:'', print_width:2475, print_height:1155, template_image_url:'', svg_width:null, svg_height:null, print_area_x:null, print_area_y:null, print_area_w:null, print_area_h:null });
      setProviders([]); setVariants([]); fetchProducts();
    }
    setSaving(false);
  };

  // ── Printful: Katalog ara ────────────────────────────────
  const handlePfSearch = async () => {
    if (!printfulToken) { setPfMsg('error:Settings sayfasından Printful bağlayın.'); return; }
    setPfLoading(true); setPfMsg(''); setPfSelected(null); setPfVariants([]);
    try {
      const params = new URLSearchParams({ token: printfulToken });
      if (pfSearch.trim()) params.set('search', pfSearch.trim());
      const res  = await fetch(`${API}/api/printful/catalog?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPfProducts(Array.isArray(data) ? data : []);
      if (!data.length) setPfMsg('warning:Ürün bulunamadı, farklı arama deneyin.');
    } catch (err) { setPfMsg('error:' + err.message); }
    setPfLoading(false);
  };

  const handlePfProductSelect = async (product) => {
    setPfSelected(product); setPfVariants([]); setPfPlacements([]); setPfVrLoading(true); setPfMsg('');
    try {
      const token = encodeURIComponent(printfulToken);
      const [vrRes, dtRes] = await Promise.all([
        fetch(`${API}/api/printful/catalog/${product.id}/variants?token=${token}`),
        fetch(`${API}/api/printful/catalog/${product.id}?token=${token}`),
      ]);
      const vrData = await vrRes.json();
      const dtData = await dtRes.json();
      setPfVariants(Array.isArray(vrData) ? vrData : []);
      const placements = dtData?.placements || [];
      setPfPlacements(placements);
      const firstPlacement = placements[0]?.placement_id || '';
      setPfForm(f => ({
        ...f, name: product.name || '',
        printful_product_id: String(product.id),
        printful_variant_id: '', printful_placement: firstPlacement,
        print_width: 0, print_height: 0,
      }));
    } catch (err) { setPfMsg('error:Ürün detayı yüklenemedi: ' + err.message); }
    setPfVrLoading(false);
  };

  const handlePfVariantChange = (variantId) => {
    const variant = pfVariants.find(v => String(v.id) === String(variantId));
    const dims = variant?.placements?.find(p => p.placement_id === pfForm.printful_placement);
    setPfForm(f => ({
      ...f, printful_variant_id: variantId,
      print_width:  dims?.width  || variant?.print_file_width  || 0,
      print_height: dims?.height || variant?.print_file_height || 0,
    }));
  };

  const handlePfSave = async () => {
    if (!pfForm.name || !pfForm.printful_product_id || !pfForm.printful_variant_id || !pfForm.printful_placement) {
      setPfMsg('error:Tüm alanları doldurun.'); return;
    }
    setPfSaving(true); setPfMsg('');
    const { error } = await supabase.from('seller_products').insert({
      user_id: userId, name: pfForm.name, fulfillment: 'printful',
      printful_product_id: parseInt(pfForm.printful_product_id),
      printful_variant_id: parseInt(pfForm.printful_variant_id),
      printful_placement:  pfForm.printful_placement,
      print_width:  pfForm.print_width  || null,
      print_height: pfForm.print_height || null,
      blueprint_id: null, print_provider_id: null, variant_id: null,
      is_active: true, sort_order: products.length,
    });
    if (error) { setPfMsg('error:Kaydedilemedi: ' + error.message); }
    else {
      setPfMsg('success:Printful ürünü eklendi! ✅');
      fetchProducts(); setPfSelected(null); setPfProducts([]);
      setPfForm({ name:'', printful_product_id:'', printful_variant_id:'', printful_placement:'', print_width:0, print_height:0 });
    }
    setPfSaving(false);
  };

  // ── Sil / Toggle ─────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return;
    await supabase.from('seller_products').delete().eq('id', id);
    fetchProducts();
  };

  const handleToggle = async (id, currentState) => {
    await supabase.from('seller_products').update({ is_active: !currentState }).eq('id', id);
    fetchProducts();
  };

  // ────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Ürün Listesi ── */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Yükleniyor...</div>
      ) : products.length === 0 ? (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          Henüz ürün eklenmemiş. Aşağıdan Printify veya Printful ürünü ekleyin.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
          {products.map(p => (
            <div key={p.id} style={st.productRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                  {p.fulfillment === 'printful' ? (
                    <span style={{ color: '#00a881' }}>
                      🖨️ Printful · {p.printful_placement} · {p.print_width}×{p.print_height}px
                    </span>
                  ) : (
                    <span>
                      Blueprint: {p.blueprint_id} · Provider: {p.print_provider_id} · Variant: {p.variant_id} · {p.print_width}×{p.print_height}px
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                  background: p.is_active ? 'var(--success-bg)' : 'var(--bg-hover)',
                  color:      p.is_active ? 'var(--success)' : 'var(--text-dim)',
                }}>
                  {p.is_active ? 'Aktif' : 'Pasif'}
                </span>
                <button onClick={() => handleToggle(p.id, p.is_active)}
                  className="btn btn-secondary" style={{ fontSize:11, padding:'4px 8px' }}>
                  {p.is_active ? 'Pasife Al' : 'Aktife Al'}
                </button>
                <button onClick={() => handleDelete(p.id)}
                  className="btn btn-secondary" style={{ fontSize:11, padding:'4px 8px', color:'var(--danger)' }}>
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Mesaj ── */}
      {msg && (
        <div className={`alert ${msg.startsWith('error:') ? 'alert-error' : msg.startsWith('warning:') ? 'alert-warning' : 'alert-success'}`}
             style={{ marginBottom: 16 }}>
          {msg.replace(/^(error:|warning:|success:)/, '')}
        </div>
      )}

      {/* ── Yeni Ürün Ekle Butonu ── */}
      {!showForm ? (
        <button
          className="btn btn-primary"
          onClick={() => { setShowForm(true); loadBlueprints(); setMsg(''); setPfMsg(''); }}
        >
          + Yeni Ürün Ekle
        </button>
      ) : (
        <div style={st.formWrap}>

          {/* Sekme butonları */}
          <div style={{ display:'flex', gap:8, marginBottom:20, borderBottom:'1px solid var(--border)', paddingBottom:14 }}>
            {[
              { key: 'printify', label: '🖨️ Printify Ürünü' },
              { key: 'printful', label: '✨ Printful Ürünü' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`btn ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 13, padding: '7px 16px' }}
                onClick={() => { setActiveTab(tab.key); setMsg(''); setPfMsg(''); }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════
              PRİNTİFY FORMU
          ═══════════════════════════════════════ */}
          {activeTab === 'printify' && (
            <>
              <h4 style={{ marginBottom:16, fontFamily:'var(--font-display)', fontSize:15 }}>
                🖨️ Printify Ürünü Ekle
              </h4>

              {/* Ürün adı */}
              <div className="form-group">
                <label className="label">Ürün Adı *</label>
                <input className="input"
                  placeholder='Örn: "11oz White Mug"'
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Blueprint */}
              <div className="form-group">
                <label className="label">Printify Ürün (Blueprint) *</label>
                {bpLoading ? <div style={{ fontSize:13, color:'var(--text-muted)' }}>Yükleniyor...</div> : (
                  <select className="input" value={form.blueprint_id}
                    onChange={e => handleBlueprintChange(e.target.value)}>
                    <option value="">-- Blueprint Seçin --</option>
                    {blueprints.map(bp => (
                      <option key={bp.id} value={bp.id}>{bp.title} (ID: {bp.id})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Provider */}
              {form.blueprint_id && (
                <div className="form-group">
                  <label className="label">Baskı Sağlayıcı (Provider) *</label>
                  {pvLoading ? <div style={{ fontSize:13, color:'var(--text-muted)' }}>Yükleniyor...</div> : (
                    <select className="input" value={form.print_provider_id}
                      onChange={e => handleProviderChange(e.target.value)}>
                      <option value="">-- Provider Seçin --</option>
                      {providers.map(pv => (
                        <option key={pv.id} value={pv.id}>{pv.title} (ID: {pv.id})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Variant */}
              {form.print_provider_id && (
                <div className="form-group">
                  <label className="label">Varyant (Renk/Boyut) *</label>
                  {vrLoading ? <div style={{ fontSize:13, color:'var(--text-muted)' }}>Yükleniyor...</div> : (
                    <select className="input" value={form.variant_id}
                      onChange={e => handleVariantChange(e.target.value)}>
                      <option value="">-- Varyant Seçin --</option>
                      {variants.map(v => (
                        <option key={v.id} value={v.id}>{v.title} (ID: {v.id})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Print boyutları */}
              {form.variant_id && (
                <div style={{ display:'flex', gap:10 }}>
                  <div className="form-group" style={{ flex:1 }}>
                    <label className="label">Baskı Genişliği (px)</label>
                    <input className="input" type="number" value={form.print_width}
                      onChange={e => setForm(f => ({ ...f, print_width: parseInt(e.target.value) }))} />
                  </div>
                  <div className="form-group" style={{ flex:1 }}>
                    <label className="label">Baskı Yüksekliği (px)</label>
                    <input className="input" type="number" value={form.print_height}
                      onChange={e => setForm(f => ({ ...f, print_height: parseInt(e.target.value) }))} />
                  </div>
                </div>
              )}

              {/* Template yükleme */}
              {form.blueprint_id && (
                <div className="form-group">
                  <label className="label">Ürün Tasarım Şablonu (PNG/SVG)</label>
                  {form.template_image_url && (
                    <div style={{ marginBottom:10, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', background:'#f5f5f5', maxHeight:120, display:'flex', alignItems:'center', justifyContent:'center', padding:8 }}>
                      <img src={form.template_image_url} alt="Template" style={{ maxHeight:104, maxWidth:'100%', objectFit:'contain' }} />
                    </div>
                  )}
                  <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                    <label style={{ flex:1, padding:'10px 14px', background:'var(--bg-hover)', border:'1px dashed var(--border-light)', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:13, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:8 }}>
                      📁 Template Yükle (PNG/SVG)
                      <input type="file" accept=".svg,.png,.jpg,image/*" style={{ display:'none' }}
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setMsg('success:Yükleniyor...');
                          try {
                            if (file.name.endsWith('.svg') || file.type === 'image/svg+xml') {
                              const text = await file.text();
                              const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
                              const svgEl = doc.querySelector('svg');
                              const printRect = doc.getElementById('print-area') || doc.querySelector('rect');
                              if (printRect && svgEl) {
                                const viewBox = svgEl.getAttribute('viewBox')?.split(' ');
                                setForm(f => ({
                                  ...f,
                                  svg_width:    parseFloat(viewBox ? viewBox[2] : svgEl.getAttribute('width')),
                                  svg_height:   parseFloat(viewBox ? viewBox[3] : svgEl.getAttribute('height')),
                                  print_area_x: parseFloat(printRect.getAttribute('x')),
                                  print_area_y: parseFloat(printRect.getAttribute('y')),
                                  print_area_w: parseFloat(printRect.getAttribute('width')),
                                  print_area_h: parseFloat(printRect.getAttribute('height')),
                                }));
                                setMsg('success:SVG Koordinatları otomatik algılandı!');
                              }
                            }
                            const ext  = file.name.split('.').pop();
                            const path = `templates/${userId}/${Date.now()}.${ext}`;
                            const { error: upErr } = await supabase.storage.from('templates').upload(path, file, { upsert:true });
                            if (upErr) throw upErr;
                            const { data: { publicUrl } } = supabase.storage.from('templates').getPublicUrl(path);
                            setForm(f => ({ ...f, template_image_url: publicUrl }));
                            setTemplateImageUrl(publicUrl);
                            if (!msg.startsWith('success:SVG')) setMsg('success:Template yüklendi.');
                          } catch (err) { setMsg('error:Yükleme hatası: ' + err.message); }
                        }} />
                    </label>
                  </div>
                  <input className="input" placeholder="Veya direkt URL girin..."
                    value={form.template_image_url}
                    onChange={e => { setForm(f => ({ ...f, template_image_url: e.target.value })); setTemplateImageUrl(e.target.value); }} />
                </div>
              )}

              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <button className="btn btn-secondary" onClick={() => { setShowForm(false); setMsg(''); }}>İptal</button>
                <button className="btn btn-primary" onClick={handleSave}
                  disabled={saving || !form.name || !form.blueprint_id || !form.print_provider_id || !form.variant_id}>
                  {saving ? 'Kaydediliyor...' : '💾 Ürünü Kaydet'}
                </button>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════
              PRINTFUL FORMU
          ═══════════════════════════════════════ */}
          {activeTab === 'printful' && (
            <>
              <h4 style={{ marginBottom:16, fontFamily:'var(--font-display)', fontSize:15 }}>
                ✨ Printful Ürünü Ekle
              </h4>

              {!printfulToken && (
                <div className="alert alert-warning" style={{ marginBottom:12 }}>
                  ⚠ Settings sayfasından önce Printful'u bağlayın.
                </div>
              )}

              {/* Katalog arama */}
              <div className="form-group">
                <label className="label">Ürün Ara</label>
                <div style={{ display:'flex', gap:8 }}>
                  <input className="input" value={pfSearch}
                    onChange={e => setPfSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePfSearch()}
                    placeholder="Örn: mug, t-shirt, hoodie..." />
                  <button type="button" className="btn btn-secondary"
                    onClick={handlePfSearch} disabled={pfLoading || !printfulToken}
                    style={{ whiteSpace:'nowrap' }}>
                    {pfLoading ? '⏳' : '🔍 Ara'}
                  </button>
                </div>
              </div>

              {/* Ürün listesi */}
              {pfProducts.length > 0 && !pfSelected && (
                <div style={{ maxHeight:240, overflowY:'auto', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginBottom:12 }}>
                  {pfProducts.map(p => (
                    <div key={p.id} onClick={() => handlePfProductSelect(p)}
                      style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', cursor:'pointer', display:'flex', gap:12, alignItems:'center', transition:'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      {p.thumbnail_url && (
                        <img src={p.thumbnail_url} alt="" style={{ width:44, height:44, objectFit:'cover', borderRadius:6, flexShrink:0 }} />
                      )}
                      <div>
                        <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                        <div style={{ fontSize:11, color:'var(--text-dim)' }}>ID: {p.id}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Seçili ürün + detay formu */}
              {pfSelected && (
                <>
                  <div style={{ padding:'8px 12px', marginBottom:12, background:'var(--bg-hover)', border:'1px solid var(--brand)', borderRadius:'var(--radius-sm)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>✅ {pfSelected.name}</span>
                    <button type="button"
                      style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)' }}
                      onClick={() => { setPfSelected(null); setPfProducts([]); }}>
                      ✕ Değiştir
                    </button>
                  </div>

                  {pfVrLoading ? (
                    <div style={{ textAlign:'center', padding:20, color:'var(--text-muted)' }}>⏳ Yükleniyor...</div>
                  ) : (
                    <>
                      {/* Görünen ad */}
                      <div className="form-group">
                        <label className="label">Görünen Ad</label>
                        <input className="input" value={pfForm.name}
                          onChange={e => setPfForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Örn: Klasik Kupa 11oz" />
                      </div>

                      {/* Placement */}
                      {pfPlacements.length > 0 && (
                        <div className="form-group">
                          <label className="label">Baskı Alanı (Placement)</label>
                          <select className="input" value={pfForm.printful_placement}
                            onChange={e => setPfForm(f => ({ ...f, printful_placement: e.target.value }))}>
                            {pfPlacements.map(pl => (
                              <option key={pl.placement_id} value={pl.placement_id}>
                                {pl.display_name || pl.placement_id}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Varyant */}
                      {pfVariants.length > 0 && (
                        <div className="form-group">
                          <label className="label">Varyant</label>
                          <select className="input" value={pfForm.printful_variant_id}
                            onChange={e => handlePfVariantChange(e.target.value)}>
                            <option value="">-- Seçin --</option>
                            {pfVariants.map(v => (
                              <option key={v.id} value={v.id}>
                                {v.name || v.size}{v.color ? ` / ${v.color}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Print boyutları */}
                      {pfForm.printful_variant_id && (
                        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>
                          Baskı boyutu:{' '}
                          <strong style={{ color: pfForm.print_width ? 'var(--success)' : 'var(--warning)' }}>
                            {pfForm.print_width ? `${pfForm.print_width}×${pfForm.print_height}px` : 'API\'den alınamadı — elle girin'}
                          </strong>
                          {!pfForm.print_width && (
                            <div style={{ display:'flex', gap:8, marginTop:6 }}>
                              <input className="input" type="number" placeholder="Genişlik (px)" style={{ width:140 }}
                                onChange={e => setPfForm(f => ({ ...f, print_width: parseInt(e.target.value) || 0 }))} />
                              <input className="input" type="number" placeholder="Yükseklik (px)" style={{ width:140 }}
                                onChange={e => setPfForm(f => ({ ...f, print_height: parseInt(e.target.value) || 0 }))} />
                            </div>
                          )}
                        </div>
                      )}

                      {pfMsg && (
                        <div className={`alert ${pfMsg.startsWith('error:') ? 'alert-error' : pfMsg.startsWith('warning:') ? 'alert-warning' : 'alert-success'}`}
                             style={{ marginTop:10 }}>
                          {pfMsg.replace(/^(error:|warning:|success:)/, '')}
                        </div>
                      )}

                      <div style={{ display:'flex', gap:8, marginTop:14 }}>
                        <button type="button" className="btn btn-secondary"
                          onClick={() => { setShowForm(false); setPfSelected(null); setPfProducts([]); }}>
                          İptal
                        </button>
                        <button type="button" className="btn btn-primary"
                          onClick={handlePfSave} disabled={pfSaving}>
                          {pfSaving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Arama yapılmadıysa iptal butonu */}
              {!pfSelected && (
                <div style={{ marginTop:8 }}>
                  {pfMsg && (
                    <div className={`alert ${pfMsg.startsWith('error:') ? 'alert-error' : pfMsg.startsWith('warning:') ? 'alert-warning' : 'alert-success'}`}
                         style={{ marginBottom:10 }}>
                      {pfMsg.replace(/^(error:|warning:|success:)/, '')}
                    </div>
                  )}
                  <button className="btn btn-secondary"
                    onClick={() => { setShowForm(false); setMsg(''); setPfMsg(''); }}>
                    İptal
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      )}
    </div>
  );
}

const st = {
  productRow: {
    display:'flex', alignItems:'center', gap:12,
    padding:'12px 16px',
    background:'var(--bg)',
    border:'1px solid var(--border)',
    borderRadius:'var(--radius-sm)',
  },
  formWrap: {
    background:'var(--bg)',
    border:'1px solid var(--border)',
    borderRadius:'var(--radius)',
    padding:20,
    display:'flex',
    flexDirection:'column',
    gap:14,
  },
};