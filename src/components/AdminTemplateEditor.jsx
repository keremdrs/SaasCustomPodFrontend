import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Image as KImage, Rect, Transformer } from 'react-konva';
import { supabase } from '../lib/supabase';

/* ─────────────────────────────────────────────────────────
 *  AdminTemplateEditor — Görsel Print Area Düzenleyici
 *  --------------------------------------------------------
 *  Var olan blueprint_template kaydını düzenler. PNG-first
 *  workflow:
 *
 *  - Template PNG (baskı alanı önceden Photoshop'ta saydam)
 *  - Print area koordinatlarını sürükle/boyutlandır
 *  - Print boyutu (gerçek baskı px) ile aspect ratio kilidi
 *    → Printify mockup'ı ile görsel uyum
 *  - Dosya boyutları otomatik tespit (PNG natural dims)
 *  - SVG için viewBox parse (geriye uyumluluk)
 * ───────────────────────────────────────────────────────── */

function useLoadImage(url) {
  const [img,    setImg]    = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [natural,setNatural]= useState(null);
  useEffect(() => {
    if (!url) { setImg(null); setLoaded(false); setNatural(null); return; }
    const image = new window.Image();
    image.crossOrigin = 'Anonymous';
    image.onload = () => {
      setImg(image); setLoaded(true);
      setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    };
    image.onerror = () => setLoaded(false);
    image.src = url;
  }, [url]);
  return { img, loaded, natural };
}

export default function AdminTemplateEditor({ template, onClose, onSaved }) {

  /* ── Form state ────────────────────────────────────────── */
  const initW = template.svg_width  || template.print_width  || 1000;
  const initH = template.svg_height || template.print_height || 1000;

  const [form, setForm] = useState({
    blueprint_name: template.blueprint_name || '',
    provider_name:  template.provider_name  || '',
    template_url:   template.template_url,
    svg_width:      initW,
    svg_height:     initH,
    print_area_x:   template.print_area_x ?? Math.round(initW * 0.2),
    print_area_y:   template.print_area_y ?? Math.round(initH * 0.2),
    print_area_w:   template.print_area_w ?? Math.round(initW * 0.6),
    print_area_h:   template.print_area_h ?? Math.round(initH * 0.6),
    print_width:    template.print_width  || 2475,
    print_height:   template.print_height || 1155,
  });

  const [saving,     setSaving]     = useState(false);
  const [reuploading,setReuploading]= useState(false);
  const [msg,        setMsg]        = useState('');
  const [selected,   setSelected]   = useState(true);
  const [lockRatio,  setLockRatio]  = useState(true);   // aspect ratio kilidi

  /* ── Aspect ratio: print_width / print_height ──────────── */
  const printRatio = useMemo(() => {
    return form.print_height > 0 ? form.print_width / form.print_height : 1;
  }, [form.print_width, form.print_height]);

  /* ── Print area'nın mevcut oranı ──────────────────────── */
  const paRatio = form.print_area_h > 0 ? form.print_area_w / form.print_area_h : 1;
  const ratioMismatch = Math.abs(paRatio - printRatio) > 0.01;

  /* ── Canvas boyutu (oranı koru, max 480) ──────────────── */
  const MAX_CANVAS = 480;
  const tplAspect  = form.svg_width / form.svg_height;
  let canvasW, canvasH;
  if (tplAspect >= 1) {
    canvasW = MAX_CANVAS;
    canvasH = Math.round(MAX_CANVAS / tplAspect);
  } else {
    canvasH = MAX_CANVAS;
    canvasW = Math.round(MAX_CANVAS * tplAspect);
  }
  const scale = canvasW / form.svg_width;

  /* ── Print area: SVG koord → canvas koord ──────────────── */
  const paCanvas = {
    x: form.print_area_x * scale,
    y: form.print_area_y * scale,
    w: form.print_area_w * scale,
    h: form.print_area_h * scale,
  };

  /* ── Template image yükle (boyutları otomatik al) ─────── */
  const { img: templateImg, loaded, natural } = useLoadImage(form.template_url);

  // Eğer kayıtta boyut yoksa ve yeni image yüklendiyse, otomatik doldur
  useEffect(() => {
    if (natural && (!template.svg_width || !template.svg_height)) {
      setForm(f => {
        if (f.svg_width === initW && f.svg_height === initH) {
          // Henüz değişmedi, doğal boyutları uygula
          return { ...f, svg_width: natural.w, svg_height: natural.h };
        }
        return f;
      });
    }
  }, [natural]);  // eslint-disable-line

  /* ── Konva refs ───────────────────────────────────────── */
  const stageRef = useRef(null);
  const rectRef  = useRef(null);
  const trRef    = useRef(null);

  /* ── Transformer'ı bağla ──────────────────────────────── */
  useEffect(() => {
    if (selected && trRef.current && rectRef.current && loaded) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected, loaded]);

  /* ── Rect → form ──────────────────────────────────────── */
  const updateFromRect = useCallback((cx, cy, cw, ch) => {
    setForm(f => ({
      ...f,
      print_area_x: Math.max(0, Math.round(cx / scale)),
      print_area_y: Math.max(0, Math.round(cy / scale)),
      print_area_w: Math.max(1, Math.round(cw / scale)),
      print_area_h: Math.max(1, Math.round(ch / scale)),
    }));
  }, [scale]);

  /* ── Sayı input ───────────────────────────────────────── */
  const numInput = (key) => (e) => {
    const raw = e.target.value;
    if (raw === '' || raw === '-') { setForm(f => ({ ...f, [key]: 0 })); return; }
    const v = parseFloat(raw);
    if (!isNaN(v)) setForm(f => ({ ...f, [key]: v }));
  };

  /* ── Drag bounds ──────────────────────────────────────── */
  const dragBoundFunc = (pos) => ({
    x: Math.max(0, Math.min(canvasW - paCanvas.w, pos.x)),
    y: Math.max(0, Math.min(canvasH - paCanvas.h, pos.y)),
  });

  /* ── Resize bounds (aspect ratio kilidi varsa zorla) ─── */
  const boundBoxFunc = (oldBox, newBox) => {
    if (newBox.width < 10 || newBox.height < 10) return oldBox;

    let box = { ...newBox };

    // Aspect ratio kilidi: yeni width'i baz alıp height'ı hesapla
    if (lockRatio && printRatio > 0) {
      const wChange = Math.abs(newBox.width  - oldBox.width);
      const hChange = Math.abs(newBox.height - oldBox.height);
      if (wChange >= hChange) {
        // Width değişti, height'ı orana göre ayarla
        box.height = box.width / printRatio;
      } else {
        // Height değişti, width'i orana göre ayarla
        box.width = box.height * printRatio;
      }
    }

    // Sınırları aş kontrolü
    if (box.x < 0 || box.y < 0) return oldBox;
    if (box.x + box.width  > canvasW + 0.5) return oldBox;
    if (box.y + box.height > canvasH + 0.5) return oldBox;
    return box;
  };

  /* ── Hızlı: Print oranına snap et (mevcut alanı düzelt) ─ */
  const snapToRatio = () => {
    if (printRatio <= 0) return;
    setForm(f => {
      // Mevcut alanı baz al, en uzun kenarı koru
      const curW = f.print_area_w;
      const curH = f.print_area_h;
      const targetByW = { w: curW, h: Math.round(curW / printRatio) };
      const targetByH = { w: Math.round(curH * printRatio), h: curH };
      // SVG sınırına sığanı seç
      const fitW = targetByW.h <= (f.svg_height - f.print_area_y) ? targetByW : null;
      const fitH = targetByH.w <= (f.svg_width  - f.print_area_x) ? targetByH : null;
      const pick = fitW || fitH || targetByW;
      return { ...f, print_area_w: pick.w, print_area_h: pick.h };
    });
    setMsg('success:Print area oranı baskı boyutuna hizalandı.');
  };

  /* ── Tüm template'i kapsayacak şekilde aç ─────────────── */
  const fitToTemplate = () => {
    setForm(f => ({
      ...f,
      print_area_x: 0, print_area_y: 0,
      print_area_w: f.svg_width, print_area_h: f.svg_height,
    }));
  };

  /* ── Print oranlı, merkezi %60 ────────────────────────── */
  const centerCrop = () => {
    setForm(f => {
      const ratio = f.print_height > 0 ? f.print_width / f.print_height : 1;
      let w, h;
      if (f.svg_width / f.svg_height > ratio) {
        h = Math.round(f.svg_height * 0.6);
        w = Math.round(h * ratio);
      } else {
        w = Math.round(f.svg_width * 0.6);
        h = Math.round(w / ratio);
      }
      return {
        ...f,
        print_area_w: w, print_area_h: h,
        print_area_x: Math.round((f.svg_width  - w) / 2),
        print_area_y: Math.round((f.svg_height - h) / 2),
      };
    });
  };

  /* ── Template dosyası yeniden yükle ───────────────────── */
  const handleReupload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setReuploading(true);
    setMsg('');
    try {
      const ext  = file.name.split('.').pop().toLowerCase();
      const path = `blueprints/${template.blueprint_id}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('templates').upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('templates').getPublicUrl(path);

      // Boyutları otomatik tespit
      let newW = form.svg_width, newH = form.svg_height;

      if (ext === 'svg') {
        // SVG: viewBox'tan parse
        try {
          const text = await file.text();
          const vbMatch = text.match(/viewBox="[\d.\s]*?([\d.]+)\s+([\d.]+)"/);
          if (vbMatch) { newW = parseFloat(vbMatch[1]); newH = parseFloat(vbMatch[2]); }
        } catch {}
      } else {
        // PNG/JPG: Image() ile doğal boyutları oku
        await new Promise((resolve) => {
          const url = URL.createObjectURL(file);
          const img = new window.Image();
          img.onload  = () => { newW = img.naturalWidth; newH = img.naturalHeight; URL.revokeObjectURL(url); resolve(); };
          img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          img.src = url;
        });
      }

      // Boyut değiştiyse print area'yı orantılı ölçekle
      const ratioW = newW / form.svg_width;
      const ratioH = newH / form.svg_height;
      setForm(f => ({
        ...f,
        template_url: publicUrl,
        svg_width:    newW,
        svg_height:   newH,
        print_area_x: Math.round(f.print_area_x * ratioW),
        print_area_y: Math.round(f.print_area_y * ratioH),
        print_area_w: Math.round(f.print_area_w * ratioW),
        print_area_h: Math.round(f.print_area_h * ratioH),
      }));
      setMsg(`success:Template yenilendi (${newW}×${newH}). Print area orantılı ölçeklendi.`);
    } catch (err) {
      setMsg('error:' + err.message);
    }
    setReuploading(false);
  };

  /* ── Kaydet ───────────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const { error } = await supabase
        .from('blueprint_templates')
        .update({
          blueprint_name: form.blueprint_name || null,
          provider_name:  form.provider_name  || null,
          template_url:   form.template_url,
          svg_width:      form.svg_width  || null,
          svg_height:     form.svg_height || null,
          print_area_x:   form.print_area_x,
          print_area_y:   form.print_area_y,
          print_area_w:   form.print_area_w,
          print_area_h:   form.print_area_h,
          print_width:    form.print_width,
          print_height:   form.print_height,
        })
        .eq('id', template.id);

      if (error) throw error;
      setMsg('success:✅ Değişiklikler kaydedildi.');
      onSaved?.();
      setTimeout(() => onClose?.(), 700);
    } catch (err) {
      setMsg('error:' + err.message);
    }
    setSaving(false);
  };

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <h3 style={s.title}>✏️ Template Düzenle</h3>
            <div style={s.subtitle}>
              Blueprint {template.blueprint_id}{form.blueprint_name && ` · ${form.blueprint_name}`}
            </div>
          </div>
          <button onClick={onClose} style={s.closeBtn} disabled={saving}>✕</button>
        </div>

        <div style={s.body}>
          <div style={s.layout}>

            {/* SOL: Görsel düzenleyici */}
            <div style={s.leftPane}>
              <div style={s.paneTitleRow}>
                <span style={s.paneTitle}>Print Area</span>
                <label style={s.lockToggle}>
                  <input
                    type="checkbox"
                    checked={lockRatio}
                    onChange={e => setLockRatio(e.target.checked)}
                  />
                  <span>Oranı kilitle ({form.print_width}:{form.print_height})</span>
                </label>
              </div>

              <div style={s.canvasWrap}>
                {!loaded && form.template_url && (
                  <div style={s.canvasOverlay}>⏳ Template yükleniyor...</div>
                )}
                {!form.template_url && (
                  <div style={s.canvasOverlay}>⚠ Template dosyası yok</div>
                )}

                <Stage
                  ref={stageRef}
                  width={canvasW}
                  height={canvasH}
                  onMouseDown={e => { if (e.target === e.target.getStage()) setSelected(false); }}
                  style={s.stage}
                >
                  <Layer>
                    {/* Şeffaf zemin desen — PNG'nin transparan alanlarında görünür */}
                    <Rect x={0} y={0} width={canvasW} height={canvasH} fill="#1a1a1a" listening={false} />

                    {/* Template image */}
                    {templateImg && (
                      <KImage
                        image={templateImg}
                        x={0} y={0}
                        width={canvasW} height={canvasH}
                        listening={false}
                      />
                    )}

                    {/* Dim layer — print area dışı */}
                    {paCanvas.w > 0 && (
                      <>
                        <Rect x={0} y={0} width={canvasW} height={paCanvas.y}
                          fill="rgba(0,0,0,0.55)" listening={false} />
                        <Rect x={0} y={paCanvas.y + paCanvas.h}
                          width={canvasW} height={canvasH - paCanvas.y - paCanvas.h}
                          fill="rgba(0,0,0,0.55)" listening={false} />
                        <Rect x={0} y={paCanvas.y}
                          width={paCanvas.x} height={paCanvas.h}
                          fill="rgba(0,0,0,0.55)" listening={false} />
                        <Rect x={paCanvas.x + paCanvas.w} y={paCanvas.y}
                          width={canvasW - paCanvas.x - paCanvas.w} height={paCanvas.h}
                          fill="rgba(0,0,0,0.55)" listening={false} />
                      </>
                    )}

                    {/* Print area rectangle */}
                    <Rect
                      ref={rectRef}
                      x={paCanvas.x} y={paCanvas.y}
                      width={paCanvas.w} height={paCanvas.h}
                      stroke={ratioMismatch && !lockRatio ? '#FFB95C' : '#F56400'}
                      strokeWidth={2}
                      dash={[6, 4]}
                      fill="rgba(245,100,0,0.12)"
                      draggable
                      dragBoundFunc={dragBoundFunc}
                      onClick={() => setSelected(true)}
                      onTap={() => setSelected(true)}
                      onDragEnd={(e) => updateFromRect(
                        e.target.x(), e.target.y(),
                        paCanvas.w, paCanvas.h,
                      )}
                      onTransformEnd={() => {
                        const n = rectRef.current;
                        if (!n) return;
                        updateFromRect(
                          n.x(), n.y(),
                          Math.max(10, n.width()  * n.scaleX()),
                          Math.max(10, n.height() * n.scaleY()),
                        );
                        n.scaleX(1); n.scaleY(1);
                      }}
                    />

                    {selected && (
                      <Transformer
                        ref={trRef}
                        rotateEnabled={false}
                        keepRatio={lockRatio}
                        enabledAnchors={lockRatio
                          ? ['top-left','top-right','bottom-left','bottom-right']
                          : ['top-left','top-right','bottom-left','bottom-right',
                             'middle-left','middle-right','top-center','bottom-center']
                        }
                        anchorSize={9}
                        anchorStroke="#F56400"
                        anchorFill="#fff"
                        borderStroke="#F56400"
                        borderDash={[4, 3]}
                        boundBoxFunc={boundBoxFunc}
                      />
                    )}
                  </Layer>
                </Stage>
              </div>

              <div style={s.canvasFooter}>
                <span style={s.hint}>
                  {lockRatio
                    ? '🔒 Köşelerden ölçekle, oran sabit · İçinden sürükle'
                    : '↔ Tüm köşelerden serbest ölçekle · İçinden sürükle'}
                </span>
              </div>

              {/* Uyumluluk uyarısı */}
              {ratioMismatch && !lockRatio && (
                <div style={s.ratioWarn}>
                  <span>⚠ Print area oranı baskı boyutuyla eşleşmiyor</span>
                  <button
                    type="button"
                    onClick={snapToRatio}
                    style={s.snapBtn}
                  >
                    Düzelt →
                  </button>
                </div>
              )}

              <div style={s.quickActions}>
                <button type="button" className="btn btn-secondary" style={s.quickBtn} onClick={fitToTemplate}>
                  ⇱⇲ Tüm template
                </button>
                <button type="button" className="btn btn-secondary" style={s.quickBtn} onClick={centerCrop}>
                  ⊡ Ortala %60 (oranlı)
                </button>
                <button type="button" className="btn btn-secondary" style={s.quickBtn} onClick={snapToRatio} disabled={!ratioMismatch}>
                  ⟲ Orana hizala
                </button>
              </div>
            </div>

            {/* SAĞ: Form alanları */}
            <div style={s.rightPane}>

              {/* Print area koordinatları */}
              <div style={s.section}>
                <div style={s.sectionTitle}>Koordinatlar (template px)</div>
                <div style={s.grid4}>
                  {[
                    ['X', 'print_area_x'],
                    ['Y', 'print_area_y'],
                    ['W', 'print_area_w'],
                    ['H', 'print_area_h'],
                  ].map(([label, key]) => (
                    <div key={key}>
                      <div style={s.miniLabel}>{label}</div>
                      <input
                        className="input"
                        style={s.miniInput}
                        type="number"
                        value={form[key]}
                        onChange={numInput(key)}
                      />
                    </div>
                  ))}
                </div>
                <div style={s.smallNote}>
                  Şu anki oran: <strong>{paRatio.toFixed(3)}:1</strong>
                  {' · Hedef: '}
                  <strong style={{ color: ratioMismatch ? 'var(--warning)' : 'var(--success)' }}>
                    {printRatio.toFixed(3)}:1
                  </strong>
                </div>
              </div>

              {/* Template image dimensions */}
              <div style={s.section}>
                <div style={s.sectionTitle}>Template Boyutu (PNG px)</div>
                <div style={s.grid2}>
                  <div>
                    <div style={s.miniLabel}>Width</div>
                    <input className="input" style={s.miniInput} type="number"
                      value={form.svg_width} onChange={numInput('svg_width')} />
                  </div>
                  <div>
                    <div style={s.miniLabel}>Height</div>
                    <input className="input" style={s.miniInput} type="number"
                      value={form.svg_height} onChange={numInput('svg_height')} />
                  </div>
                </div>
                {natural && (natural.w !== form.svg_width || natural.h !== form.svg_height) && (
                  <button
                    type="button"
                    style={s.linkBtn}
                    onClick={() => setForm(f => ({ ...f, svg_width: natural.w, svg_height: natural.h }))}
                  >
                    Doğal boyutlara dön: {natural.w}×{natural.h}
                  </button>
                )}
              </div>

              {/* Baskı boyutu */}
              <div style={s.section}>
                <div style={s.sectionTitle}>Baskı Boyutu (Printify px)</div>
                <div style={s.grid2}>
                  <div>
                    <div style={s.miniLabel}>Print W</div>
                    <input className="input" style={s.miniInput} type="number"
                      value={form.print_width} onChange={numInput('print_width')} />
                  </div>
                  <div>
                    <div style={s.miniLabel}>Print H</div>
                    <input className="input" style={s.miniInput} type="number"
                      value={form.print_height} onChange={numInput('print_height')} />
                  </div>
                </div>
                <div style={s.smallNote}>
                  Printify'a giden dosyanın gerçek piksel boyutu. Editör canvas'ı bu orana göre üretiliyor.
                </div>
              </div>

              {/* Etiketler */}
              <div style={s.section}>
                <div style={s.sectionTitle}>Etiketler</div>
                <div className="form-group">
                  <label className="label">Blueprint adı</label>
                  <input
                    className="input"
                    value={form.blueprint_name}
                    onChange={e => setForm(f => ({ ...f, blueprint_name: e.target.value }))}
                    placeholder="Örn: iPhone 15 Pro Case"
                  />
                </div>
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label className="label">Provider</label>
                  <input
                    className="input"
                    value={form.provider_name}
                    onChange={e => setForm(f => ({ ...f, provider_name: e.target.value }))}
                    placeholder="Örn: MWW On Demand"
                  />
                </div>
              </div>

              {/* Yeniden yükle */}
              <div style={s.section}>
                <div style={s.sectionTitle}>Template Dosyası</div>
                <label style={{
                  ...s.uploadBtn,
                  background: reuploading ? 'var(--bg-hover)' : 'var(--bg)',
                  cursor:     reuploading ? 'not-allowed' : 'pointer',
                }}>
                  {reuploading ? '⏳ Yükleniyor...' : '🔄 Yeni PNG Yükle'}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg"
                    style={{ display: 'none' }}
                    disabled={reuploading}
                    onChange={handleReupload}
                  />
                </label>
                <div style={s.smallNote}>
                  PNG'de baskı alanı şeffaf (alpha=0) olmalı.
                  Yeniden yükleyince print area orantılı ölçeklenir.
                </div>
              </div>
            </div>
          </div>

          {/* Mesaj */}
          {msg && (
            <div className={`alert ${msg.startsWith('error:') ? 'alert-error' : 'alert-success'}`} style={{ marginTop: 16 }}>
              {msg.slice(msg.indexOf(':') + 1)}
            </div>
          )}

          {/* Footer */}
          <div style={s.actions}>
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
              İptal
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stiller ─────────────────────────────────────────────── */
const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.88)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000, padding: 20,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background:   'var(--bg-card)',
    border:       '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    width:        '100%',
    maxWidth:     960,
    maxHeight:    '92vh',
    display:      'flex',
    flexDirection:'column',
    boxShadow:    '0 24px 64px rgba(0,0,0,0.75)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '18px 24px', borderBottom: '1px solid var(--border)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 17, fontWeight: 700,
    color: 'var(--text)',
  },
  subtitle: {
    fontSize: 12, color: 'var(--text-muted)', marginTop: 4,
  },
  closeBtn: {
    background: 'transparent', border: 'none',
    color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer',
    padding: 0, lineHeight: 1,
  },
  body:    { padding: 20, overflowY: 'auto', flex: 1 },
  layout:  { display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' },
  leftPane:  { flex: '1 1 480px', minWidth: 320 },
  rightPane: { flex: '1 1 280px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 18 },
  paneTitleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  paneTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 13, fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockToggle: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer',
    userSelect: 'none',
  },
  canvasWrap: {
    position: 'relative',
    background: '#1a1a1a',
    backgroundImage:
      'linear-gradient(45deg, #2a2a2a 25%, transparent 25%), ' +
      'linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), ' +
      'linear-gradient(45deg, transparent 75%, #2a2a2a 75%), ' +
      'linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)',
    backgroundSize: '14px 14px',
    backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    display: 'inline-block',
  },
  canvasOverlay: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-muted)', fontSize: 13,
    background: 'rgba(0,0,0,0.6)', zIndex: 10,
  },
  stage:        { display: 'block' },
  canvasFooter: { marginTop: 6 },
  hint:         { fontSize: 11, color: 'var(--text-dim)' },
  ratioWarn: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, padding: '6px 10px',
    background: 'var(--warning-bg)',
    border: '1px solid var(--warning)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 11, color: 'var(--warning)',
  },
  snapBtn: {
    background: 'var(--warning)', color: '#000',
    border: 'none', borderRadius: 4,
    padding: '3px 8px', fontSize: 11, fontWeight: 600,
    cursor: 'pointer',
  },
  quickActions: { display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  quickBtn:     { fontSize: 11, padding: '5px 10px' },
  section: {
    paddingBottom: 14,
    borderBottom: '1px solid var(--border)',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: 700,
    color: 'var(--brand)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  grid4: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  miniLabel: {
    fontSize: 10, color: 'var(--text-dim)',
    marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  miniInput: { fontSize: 12, padding: '7px 9px', fontFamily: 'var(--font-body)' },
  smallNote: { fontSize: 11, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 },
  linkBtn: {
    background: 'transparent', border: 'none',
    color: 'var(--brand)', fontSize: 11, cursor: 'pointer',
    marginTop: 6, padding: 0, textDecoration: 'underline',
  },
  uploadBtn: {
    display: 'block', padding: '10px 14px',
    color: 'var(--text)',
    border: '1px dashed var(--border-light)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 12, fontWeight: 600, textAlign: 'center',
  },
  actions: {
    display: 'flex', gap: 10, justifyContent: 'flex-end',
    marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)',
  },
};