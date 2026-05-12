import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  Stage,
  Layer,
  Image as KImage,
  Rect,
  Group,
  Transformer,
} from 'react-konva';

/* ─────────────────────────────────────────────────────────
 *  KonvaDesignArea — Template Overlay + Print Area Clip
 *  --------------------------------------------------------
 *  Tek panel mimari:
 *   1. Beyaz zemin (sadece print area'da, JPEG export için)
 *   2. AI tasarım (print area'ya clip ile sınırlı)
 *   3. PNG template (baskı alanı transparan, üstte oturur)
 *   4. Transformer (en üstte, her zaman görünür)
 *
 *  Canvas oranı = PNG template'in doğal oranı.
 *  Export edilirken template gizlenir, sadece print area
 *  kırpılıp printWidth × printHeight piksele ölçeklenir.
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
      setImg(image);
      setLoaded(true);
      setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    };
    image.onerror = () => setLoaded(false);
    image.src = url;
  }, [url]);
  return { img, loaded, natural };
}

const KonvaDesignArea = forwardRef(function KonvaDesignArea({
  designUrl,
  templateUrl,
  templateWidth,    // PNG natural width (opsiyonel, props'tan)
  templateHeight,   // PNG natural height (opsiyonel)
  printArea,        // { x, y, w, h } — template PNG piksel uzayında
  printWidth,       // Printify variant gerçek baskı genişliği
  printHeight,      // Printify variant gerçek baskı yüksekliği
  containerWidth = 520,
}, ref) {

  /* ── Görselleri yükle ─────────────────────────────────── */
  const { img: templateImg, loaded: tplLoaded, natural: tplNatural } = useLoadImage(templateUrl);
  const { img: designImg,   loaded: designLoaded }                   = useLoadImage(designUrl);

  /* ── Template boyutları (props yoksa doğal boyut) ────── */
  const W = templateWidth  || tplNatural?.w || printWidth  || 1000;
  const H = templateHeight || tplNatural?.h || printHeight || 1000;

  /* ── Canvas boyutu (template oranını korur) ───────────── */
  const aspectRatio = W / H;
  const maxW = Math.min(containerWidth, (typeof window !== 'undefined' ? window.innerWidth : 800) - 60);
  let canvasW, canvasH;
  if (aspectRatio >= 1) {
    canvasW = maxW;
    canvasH = Math.round(maxW / aspectRatio);
  } else {
    canvasH = Math.min(maxW, 620);
    canvasW = Math.round(canvasH * aspectRatio);
  }

  /* ── Template px → canvas px ölçeği ───────────────────── */
  const scale = canvasW / W;

  /* ── Print area canvas koordinatlarında ───────────────── */
  const pa = printArea ? {
    x: printArea.x * scale,
    y: printArea.y * scale,
    w: printArea.w * scale,
    h: printArea.h * scale,
  } : {
    x: 0, y: 0, w: canvasW, h: canvasH,
  };

  /* ── Design pozisyon/boyut (canvas koord.) ────────────── */
  const [pos,      setPos]      = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [selected, setSelected] = useState(false);

  /* ── "Cover" yerleşim: print area'yı doldur ──────────── */
  const fitCover = useCallback(() => {
    if (!designImg || pa.w <= 0) return;
    const imgAR = designImg.naturalWidth / designImg.naturalHeight;
    const paAR  = pa.w / pa.h;
    let w, h;
    if (imgAR > paAR) {
      h = pa.h;
      w = h * imgAR;
    } else {
      w = pa.w;
      h = w / imgAR;
    }
    setPos({
      x: pa.x + (pa.w - w) / 2,
      y: pa.y + (pa.h - h) / 2,
      w, h,
    });
  }, [designImg, pa.x, pa.y, pa.w, pa.h]);

  useEffect(() => { fitCover(); }, [fitCover]);

  /* ── Konva refs ───────────────────────────────────────── */
  const stageRef    = useRef(null);
  const designRef   = useRef(null);
  const templateRef = useRef(null);
  const trRef       = useRef(null);

  /* ── Transformer'ı seçili tasarıma bağla ──────────────── */
  useEffect(() => {
    if (selected && trRef.current && designRef.current) {
      trRef.current.nodes([designRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  /* ── EXPORT: print area kırp, printWidth × printHeight'a ölçekle ── */
  const exportDesign = useCallback(() => {
    if (!stageRef.current) return null;

    // Transformer ve template'i gizle
    const trVis  = trRef.current?.visible();
    const tplVis = templateRef.current?.visible();
    if (trRef.current)       trRef.current.visible(false);
    if (templateRef.current) templateRef.current.visible(false);
    stageRef.current.batchDraw();

    const pixelRatio = printWidth / pa.w;
    const dataURL = stageRef.current.toDataURL({
      x: pa.x,
      y: pa.y,
      width:  pa.w,
      height: pa.h,
      pixelRatio,
      mimeType: 'image/jpeg',
      quality:  0.95,
    });
    // Sonuç: tam olarak printWidth × printHeight px

    if (trRef.current && trVis  !== false) trRef.current.visible(true);
    if (templateRef.current && tplVis !== false) templateRef.current.visible(true);
    stageRef.current.batchDraw();

    return dataURL;
  }, [printWidth, pa.x, pa.y, pa.w, pa.h]);

  /* ── Dışarıya API ─────────────────────────────────────── */
  useImperativeHandle(ref, () => ({
    exportDesign,
    reset: () => { fitCover(); setSelected(false); },
  }), [exportDesign, fitCover]);

  /* ── Drag sınırı: tasarımın en az 40px'i print area içinde kalsın ── */
  const HANDLE = 40;
  const dragBoundFunc = (newPos) => {
    if (!pos.w || !pos.h) return newPos;
    return {
      x: Math.max(pa.x + HANDLE - pos.w, Math.min(pa.x + pa.w - HANDLE, newPos.x)),
      y: Math.max(pa.y + HANDLE - pos.h, Math.min(pa.y + pa.h - HANDLE, newPos.y)),
    };
  };

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div style={{ width: canvasW }}>

      {/* Bilgi şeridi */}
      <div style={s.info}>
        <span>Baskı alanı: <strong>{printWidth}×{printHeight}px</strong></span>
        <span>Template: {tplLoaded ? '✅' : templateUrl ? '⏳' : '—'}</span>
        <span>Design: {designLoaded ? '✅' : '⏳'}</span>
      </div>

      {/* Canvas konteyneri — checkerboard pattern transparan alanlarda görünür */}
      <div style={s.canvasWrap}>
        <Stage
          ref={stageRef}
          width={canvasW}
          height={canvasH}
          onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelected(false); }}
          onTouchStart={(e) => { if (e.target === e.target.getStage()) setSelected(false); }}
          style={{ display: 'block' }}
        >
          <Layer>

            {/* 1. Beyaz zemin sadece print area'da
                (JPEG export'ta transparan yerine beyaz olsun + tasarım yokken
                 baskı alanı temiz görünür) */}
            <Rect
              x={pa.x} y={pa.y}
              width={pa.w} height={pa.h}
              fill="white"
              listening={false}
            />

            {/* 2. Tasarım — print area'ya clip */}
            <Group
              clipX={pa.x} clipY={pa.y}
              clipWidth={pa.w} clipHeight={pa.h}
            >
              {designImg && pos.w > 0 && (
                <KImage
                  ref={designRef}
                  image={designImg}
                  x={pos.x} y={pos.y}
                  width={pos.w} height={pos.h}
                  draggable
                  dragBoundFunc={dragBoundFunc}
                  onClick={() => setSelected(true)}
                  onTap={() => setSelected(true)}
                  onDragEnd={(e) => {
                    setPos((p) => ({ ...p, x: e.target.x(), y: e.target.y() }));
                  }}
                  onTransformEnd={() => {
                    const node = designRef.current;
                    if (!node) return;
                    setPos({
                      x: node.x(),
                      y: node.y(),
                      w: Math.max(40, node.width()  * node.scaleX()),
                      h: Math.max(40, node.height() * node.scaleY()),
                    });
                    node.scaleX(1); node.scaleY(1);
                  }}
                />
              )}
            </Group>

            {/* 3. Template PNG — üst katman */}
            {templateImg && (
              <KImage
                ref={templateRef}
                image={templateImg}
                x={0} y={0}
                width={canvasW} height={canvasH}
                listening={false}
              />
            )}

            {/* 3b. Template yoksa print area outline'ı (yardımcı görsel) */}
            {!templateImg && pa.w > 0 && (
              <Rect
                x={pa.x} y={pa.y}
                width={pa.w} height={pa.h}
                stroke="#F56400"
                strokeWidth={2}
                dash={[6, 4]}
                listening={false}
              />
            )}

            {/* 4. Transformer — en üstte, template'in üzerinde */}
            {selected && designImg && (
              <Transformer
                ref={trRef}
                keepRatio={true}
                rotateEnabled={false}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                anchorSize={10}
                anchorStroke="#F56400"
                anchorFill="#fff"
                borderStroke="#F56400"
                borderDash={[4, 3]}
                boundBoxFunc={(o, n) => (n.width < 40 || n.height < 40 ? o : n)}
              />
            )}

          </Layer>
        </Stage>
      </div>

      {/* Araç çubuğu */}
      <div style={s.toolbar}>
        <span style={s.hint}>
          {!designLoaded
            ? 'AI görseli bekleniyor...'
            : selected
              ? '↔ Sürükle · Köşelerden ölçekle · Boşluğa tıkla = bırak'
              : '🎨 Görsele tıkla → taşı ve ölçekle'}
        </span>
        {designLoaded && (
          <button
            type="button"
            style={s.btn}
            onClick={() => { fitCover(); setSelected(false); }}
          >
            ↺ Sıfırla
          </button>
        )}
      </div>

      {/* Yardım metni */}
      <div style={s.footnote}>
        {templateImg
          ? 'Tasarım sadece şeffaf baskı alanı içinde basılır. Şablon dışı görünür ama çıktıya gitmez.'
          : 'Turuncu kesik çerçeve = baskı alanı. Şablon yüklenmemiş.'}
      </div>
    </div>
  );
});

export default KonvaDesignArea;

/* ── Stiller ─────────────────────────────────────────────── */
const s = {
  info: {
    display: 'flex', gap: 14, flexWrap: 'wrap',
    fontSize: 11, color: 'var(--text-muted)',
    marginBottom: 8,
  },
  canvasWrap: {
    // Checkerboard zemin — PNG template'in transparan alanlarında görünür
    backgroundImage:
      'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), ' +
      'linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), ' +
      'linear-gradient(45deg, transparent 75%, #f0f0f0 75%), ' +
      'linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
    backgroundColor:    '#ffffff',
    backgroundSize:     '14px 14px',
    backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
    border:             '1px solid var(--border)',
    borderRadius:       'var(--radius-sm)',
    overflow:           'hidden',
    boxShadow:          'var(--shadow-sm)',
    display:            'inline-block',
    lineHeight:         0,
  },
  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, padding: '6px 12px',
    background: 'var(--bg-hover)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
  },
  hint: { fontSize: 12, color: 'var(--text-muted)' },
  btn: {
    background:   'transparent',
    border:       '1px solid var(--border-light)',
    borderRadius: 6,
    color:        'var(--text-muted)',
    fontSize:     12,
    padding:      '4px 10px',
    cursor:       'pointer',
    fontFamily:   'var(--font-body)',
  },
  footnote: {
    marginTop: 6,
    fontSize: 11,
    color: 'var(--text-dim)',
    textAlign: 'center',
  },
};