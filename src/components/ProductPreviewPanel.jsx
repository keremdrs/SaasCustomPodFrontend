import { useState } from 'react';

/* ─────────────────────────────────────────────────────────
 *  ProductPreviewPanel — Canlı Ürün Önizlemesi
 *  --------------------------------------------------------
 *  Template = PNG (baskı alanı önceden Photoshop/GIMP ile
 *  şeffaflaştırılmış). Hiçbir SVG parse / regex / API
 *  çağrısı yok — sadece iki <img>'ı CSS z-index ile üst
 *  üste bindiriyoruz:
 *
 *   ┌───────────────────────────┐  z-index: 2  (üst)
 *   │   PNG template            │  (baskı alanı transparan)
 *   │  ┌─────────────────┐      │
 *   │  │ Design snapshot │←──────── z-index: 1 (alt)
 *   │  │  (KonvaArea'dan)│      │  CSS yüzde pozisyonunda
 *   │  └─────────────────┘      │
 *   └───────────────────────────┘
 *
 *  Print area koordinatları (printArea prop) PNG'nin kendi
 *  piksel uzayında. Aspect ratio'su print_width/print_height
 *  ile aynı olursa Printify mockup'ı ile %100 uyumlu olur.
 *
 *  EXPORT bu panelden değil, KonvaDesignArea'dan üretilir.
 * ───────────────────────────────────────────────────────── */

export default function ProductPreviewPanel({
  templateUrl,        // PNG mockup (baskı alanı transparan)
  templateWidth,      // PNG'nin doğal genişliği (px) — opsiyonel
  templateHeight,     // PNG'nin doğal yüksekliği (px) — opsiyonel
  printArea,          // { x, y, w, h }  · PNG piksel koordinatlarında
  previewDesignUrl,   // KonvaDesignArea'dan gelen anlık snapshot
  productName,
  maxWidth = 360,
}) {
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [naturalDims, setNaturalDims] = useState(null);

  // Boyutlar — props varsa onları, yoksa <img>'in doğal boyutlarını kullan
  const W = templateWidth  || naturalDims?.w;
  const H = templateHeight || naturalDims?.h;

  /* ── PNG koordinatları → CSS yüzdesi ──────────────────── */
  const pct = (printArea && W && H)
    ? {
        x: (printArea.x / W) * 100,
        y: (printArea.y / H) * 100,
        w: (printArea.w / W) * 100,
        h: (printArea.h / H) * 100,
      }
    : null;

  const aspect = (W && H) ? `${W} / ${H}` : '1';

  return (
    <div style={{ width: '100%', maxWidth }}>

      <div style={s.header}>
        <span style={s.headerLabel}>Canlı Önizleme</span>
        {productName && <span style={s.productTag}>{productName}</span>}
      </div>

      <div style={{ ...s.stage, aspectRatio: aspect }}>

        {/* Şeffaf zemin desen — template'in transparan alanlarında görünür */}
        <div style={s.checker} />

        {/* 1. Tasarım — print area pozisyonunda (ALTTA, template'in altından gösterilir) */}
        {previewDesignUrl && pct && (
          <img
            src={previewDesignUrl}
            alt=""
            style={{
              position: 'absolute',
              left:   `${pct.x}%`,
              top:    `${pct.y}%`,
              width:  `${pct.w}%`,
              height: `${pct.h}%`,
              objectFit: 'fill',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}

        {/* 2. Template PNG — ÜSTTE (baskı alanı transparan olduğu için tasarım o delikten görünür) */}
        {templateUrl && (
          <img
            src={templateUrl}
            alt={productName || ''}
            onLoad={(e) => {
              setTemplateLoaded(true);
              setNaturalDims({ w: e.target.naturalWidth, h: e.target.naturalHeight });
            }}
            onError={() => setTemplateLoaded(false)}
            style={{
              position: 'absolute',
              inset: 0,
              width:  '100%',
              height: '100%',
              objectFit: 'contain',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        )}

        {/* Boş durum */}
        {!templateUrl && (
          <div style={s.empty}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>📦</div>
            <div>Ürün şablonu eklenmemiş</div>
            <div style={s.emptyHint}>
              Settings → Ürünler'den template ekleyin
            </div>
          </div>
        )}

        {/* Print area koordinatı yok uyarısı */}
        {templateUrl && templateLoaded && !pct && (
          <div style={s.warn}>
            ⚠ Print area koordinatları yok — tasarım gösterilemiyor
          </div>
        )}

      </div>

      <div style={s.footer}>
        <span style={s.footerHint}>
          ↻ Soldaki değişiklikler canlı yansır
        </span>
      </div>
    </div>
  );
}

/* ── Stil ────────────────────────────────────────────────── */
const s = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 8,
  },
  headerLabel: {
    fontFamily: 'var(--font-display)',
    fontSize: 13, fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: 0.2,
  },
  productTag: {
    fontSize: 11,
    padding: '2px 8px',
    background: 'var(--bg-hover)',
    color: 'var(--text-muted)',
    borderRadius: 20,
    border: '1px solid var(--border)',
  },
  stage: {
    position: 'relative',
    width: '100%',
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  checker: {
    position: 'absolute', inset: 0,
    backgroundImage:
      'linear-gradient(45deg, #1a1a1a 25%, transparent 25%), ' +
      'linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), ' +
      'linear-gradient(45deg, transparent 75%, #1a1a1a 75%), ' +
      'linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)',
    backgroundSize:    '16px 16px',
    backgroundPosition:'0 0, 0 8px, 8px -8px, -8px 0',
    opacity: 0.35,
    zIndex: 0,
  },
  empty: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-muted)', fontSize: 13,
    textAlign: 'center', padding: 20,
    zIndex: 3,
  },
  emptyHint: {
    fontSize: 11, color: 'var(--text-dim)', marginTop: 4,
  },
  warn: {
    position: 'absolute', bottom: 8, left: 8,
    fontSize: 11, padding: '4px 8px',
    background: 'var(--warning-bg)',
    color: 'var(--warning)',
    border: '1px solid var(--warning)',
    borderRadius: 'var(--radius-sm)',
    zIndex: 3,
  },
  footer: {
    marginTop: 6, textAlign: 'center',
  },
  footerHint: {
    fontSize: 11, color: 'var(--text-dim)',
  },
};