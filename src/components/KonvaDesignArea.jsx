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
 *  KonvaDesignArea — Multi-Layer Editor
 *  --------------------------------------------------------
 *  Katman mimarisi:
 *   - base: AI tasarımı (her zaman alt, silinemez)
 *   - layers[]: kullanıcının eklediği ekstra görseller
 *
 *  Aynı katmanlı Group içinde clip + isteğe bağlı wrap
 *  (kupa için yatay sarma).
 *
 *  Dışarı export: stage.toDataURL print area crop ile —
 *  tüm katmanlar tek frame'e composited gelir.
 *
 *  Dışarıya açılan imperative API:
 *   - exportDesign()  → dataURL (printWidth × printHeight)
 *   - addLayer(url)   → yeni görsel katmanı ekle
 *   - reset()         → her şeyi sıfırla
 * ───────────────────────────────────────────────────────── */

function useLoadImage(url) {
  const [img,     setImg]     = useState(null);
  const [loaded,  setLoaded]  = useState(false);
  const [natural, setNatural] = useState(null);
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

/* ── Tek bir layer'ın image'ini yükleyen küçük hook ────── */
function useLayerImages(layers) {
  const [imgMap,  setImgMap]  = useState({});
  const inFlight  = useRef(new Set());  // halen yüklenenler — duplicate başlatmayı engeller

  useEffect(() => {
    layers.forEach(layer => {
      if (!layer.url) return;
      if (imgMap[layer.id]) return;
      if (inFlight.current.has(layer.id)) return;

      inFlight.current.add(layer.id);
      const image = new window.Image();
      image.crossOrigin = 'Anonymous';

      const cleanup = () => { inFlight.current.delete(layer.id); };
      let done = false;

      image.onload = () => {
        if (done) return;
        done = true;
        cleanup();
        setImgMap(m => ({ ...m, [layer.id]: image }));
      };

      image.onerror = (e) => {
        if (done) return;
        done = true;
        cleanup();
        console.warn('[Layer image] load error:', layer.url, e);
        // crossOrigin'siz tekrar dene (export'a girmese de ekranda görünür)
        const fallback = new window.Image();
        fallback.onload = () => {
          if (done && !imgMap[layer.id]) {
            setImgMap(m => ({ ...m, [layer.id]: fallback }));
            console.warn('[Layer image] crossOrigin\'siz yüklendi — toDataURL taintleyebilir');
          }
        };
        fallback.src = layer.url;
      };

      // Timeout fallback — 15 saniyede ne onload ne onerror tetiklenmediyse vazgeç
      setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        console.warn('[Layer image] 15s timeout — yüklenemedi:', layer.url);
      }, 15000);

      image.src = layer.url;
    });
  }, [layers]);  // eslint-disable-line

  return imgMap;
}

const KonvaDesignArea = forwardRef(function KonvaDesignArea({
  designUrl,
  templateUrl,
  templateWidth,
  templateHeight,
  printArea,
  printWidth,
  printHeight,
  containerWidth = 520,
}, ref) {

  /* ── Base AI image yükle ──────────────────────────────── */
  const { img: templateImg, loaded: tplLoaded, natural: tplNatural } = useLoadImage(templateUrl);
  const { img: baseImg,     loaded: baseLoaded }                    = useLoadImage(designUrl);

  /* ── Template boyutları ───────────────────────────────── */
  const W = templateWidth  || tplNatural?.w || printWidth  || 1000;
  const H = templateHeight || tplNatural?.h || printHeight || 1000;

  /* ── Canvas oran/boyut ─────────────────────────────────── */
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
  const scale = canvasW / W;

  /* ── Print area canvas koord ──────────────────────────── */
  const pa = printArea ? {
    x: printArea.x * scale,
    y: printArea.y * scale,
    w: printArea.w * scale,
    h: printArea.h * scale,
  } : { x: 0, y: 0, w: canvasW, h: canvasH };

  /* ── Base layer state (AI design pozisyonu) ────────────── */
  const [basePos, setBasePos] = useState({ x: 0, y: 0, w: 0, h: 0 });

  /* ── Extra layers ──────────────────────────────────────── */
  // Layer schema:
  // { id, url, x, y, width, height, rotation, visible }
  const [layers, setLayers] = useState([]);

  /* ── Selection ─────────────────────────────────────────── */
  const [selectedId, setSelectedId] = useState(null);  // 'base' | layer.id | null

  /* ── Wrap mode ─────────────────────────────────────────── */
  const [wrapMode, setWrapMode] = useState(false);

  /* ── Layer image cache ─────────────────────────────────── */
  const layerImgs = useLayerImages(layers);

  /* ── Refs ──────────────────────────────────────────────── */
  const stageRef    = useRef(null);
  const baseRef     = useRef(null);
  const layerRefs   = useRef({});
  const templateRef = useRef(null);
  const trRef       = useRef(null);

  /* ── Base AI image "cover" yerleşim ───────────────────── */
  const fitBaseCover = useCallback(() => {
    if (!baseImg || pa.w <= 0) return;
    const imgAR = baseImg.naturalWidth / baseImg.naturalHeight;
    const paAR  = pa.w / pa.h;
    let w, h;
    if (imgAR > paAR) {
      h = pa.h;
      w = h * imgAR;
    } else {
      w = pa.w;
      h = w / imgAR;
    }
    setBasePos({
      x: pa.x + (pa.w - w) / 2,
      y: pa.y + (pa.h - h) / 2,
      w, h,
    });
  }, [baseImg, pa.x, pa.y, pa.w, pa.h]);

  useEffect(() => { fitBaseCover(); }, [fitBaseCover]);

  /* ── Transformer'ı seçili node'a bağla ─────────────────── */
  useEffect(() => {
    if (!trRef.current) return;

    let node = null;
    if (selectedId === 'base') node = baseRef.current;
    else if (selectedId)        node = layerRefs.current[selectedId];

    if (node) {
      trRef.current.nodes([node]);
    } else {
      trRef.current.nodes([]);
    }
    trRef.current.getLayer()?.batchDraw();
  }, [selectedId, layers.length]);

  /* ── Klavye: Esc=deselect, Delete=remove ───────────────── */
  useEffect(() => {
    const handleKey = (e) => {
      // Input'a focus iken çalışmasın
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'Escape') setSelectedId(null);
      if (e.key === 'Delete' && selectedId && selectedId !== 'base') {
        deleteLayer(selectedId);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId]);  // eslint-disable-line

  /* ── EXPORT ───────────────────────────────────────────── */
  const exportDesign = useCallback(() => {
    if (!stageRef.current) return null;

    const trVis  = trRef.current?.visible();
    const tplVis = templateRef.current?.visible();
    if (trRef.current)       trRef.current.visible(false);
    if (templateRef.current) templateRef.current.visible(false);
    stageRef.current.batchDraw();

    const pixelRatio = printWidth / pa.w;
    const dataURL = stageRef.current.toDataURL({
      x: pa.x, y: pa.y,
      width:  pa.w, height: pa.h,
      pixelRatio,
      mimeType: 'image/jpeg',
      quality:  0.95,
    });

    if (trRef.current       && trVis  !== false) trRef.current.visible(true);
    if (templateRef.current && tplVis !== false) templateRef.current.visible(true);
    stageRef.current.batchDraw();

    return dataURL;
  }, [printWidth, pa.x, pa.y, pa.w, pa.h]);

  /* ── Layer yönetimi ───────────────────────────────────── */

  const addLayer = useCallback(async (url) => {
  if (!url) return null;

  // Boyutları öğrenmek için image yükle — timeout fallback'li
  const dims = await new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    let resolved = false;

    const resolveOnce = (w, h, reason) => {
      if (resolved) return;
      resolved = true;
      if (reason) console.warn('[addLayer] image probe:', reason, url);
      resolve({ w, h });
    };

    img.onload  = () => resolveOnce(img.naturalWidth, img.naturalHeight);
    img.onerror = () => resolveOnce(400, 400, 'onerror');
    setTimeout(() => resolveOnce(400, 400, '10s timeout'), 10000);

    img.src = url;
  });

  // Print area'nın %35'i kadar genişlikle başla, oranı koru
  const startW = pa.w * 0.35;
  const ar = dims.w / dims.h || 1;
  const startH = startW / ar;

    const newLayer = {
      id: `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url,
      x: pa.x + (pa.w - startW) / 2,
      y: pa.y + (pa.h - startH) / 2,
      width:    startW,
      height:   startH,
      rotation: 0,
      visible:  true,
    };

    setLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
    return newLayer.id;
  }, [pa.x, pa.y, pa.w, pa.h]);

  const updateLayer = (id, patch) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  const deleteLayer = (id) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
    delete layerRefs.current[id];
  };

  const moveLayer = (id, direction) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === 'up'
        ? Math.min(prev.length - 1, idx + 1)
        : Math.max(0, idx - 1);
      if (newIdx === idx) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const toggleVisibility = (id) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  /* ── Dışarıya API ─────────────────────────────────────── */
  useImperativeHandle(ref, () => ({
    exportDesign,
    addLayer,
    reset: () => {
      fitBaseCover();
      setLayers([]);
      setSelectedId(null);
      setWrapMode(false);
    },
  }), [exportDesign, addLayer, fitBaseCover]);

  /* ── Drag bound ───────────────────────────────────────── */
  const HANDLE = 40;
  const dragBoundFunc = (newPos, nodeW, nodeH) => {
    const yBound = Math.max(
      pa.y + HANDLE - nodeH,
      Math.min(pa.y + pa.h - HANDLE, newPos.y)
    );
    if (wrapMode) {
      return {
        x: Math.max(pa.x - nodeW, Math.min(pa.x + pa.w, newPos.x)),
        y: yBound,
      };
    }
    return {
      x: Math.max(pa.x + HANDLE - nodeW, Math.min(pa.x + pa.w - HANDLE, newPos.x)),
      y: yBound,
    };
  };

  /* ── Layer render helper ──────────────────────────────── */

  // Base AI image
  const renderBase = () => {
    if (!baseImg || basePos.w <= 0) return null;
    return (
      <>
        {/* Wrap ghost'lar */}
        {wrapMode && (
          <>
            <KImage
              image={baseImg}
              x={basePos.x - pa.w} y={basePos.y}
              width={basePos.w} height={basePos.h}
              listening={false}
            />
            <KImage
              image={baseImg}
              x={basePos.x + pa.w} y={basePos.y}
              width={basePos.w} height={basePos.h}
              listening={false}
            />
          </>
        )}
        <KImage
          ref={baseRef}
          image={baseImg}
          x={basePos.x} y={basePos.y}
          width={basePos.w} height={basePos.h}
          draggable
          dragBoundFunc={(p) => dragBoundFunc(p, basePos.w, basePos.h)}
          onClick={() => setSelectedId('base')}
          onTap={() => setSelectedId('base')}
          onDragEnd={(e) => setBasePos(p => ({ ...p, x: e.target.x(), y: e.target.y() }))}
          onTransformEnd={() => {
            const node = baseRef.current;
            if (!node) return;
            setBasePos({
              x: node.x(), y: node.y(),
              w: Math.max(40, node.width()  * node.scaleX()),
              h: Math.max(40, node.height() * node.scaleY()),
            });
            node.scaleX(1); node.scaleY(1);
          }}
        />
      </>
    );
  };

  // Extra layer
  const renderLayer = (layer) => {
    const img = layerImgs[layer.id];
    if (!img || !layer.visible) return null;

    return (
      <Group key={layer.id}>
        {wrapMode && (
          <>
            <KImage
              image={img}
              x={layer.x - pa.w} y={layer.y}
              width={layer.width} height={layer.height}
              rotation={layer.rotation}
              listening={false}
            />
            <KImage
              image={img}
              x={layer.x + pa.w} y={layer.y}
              width={layer.width} height={layer.height}
              rotation={layer.rotation}
              listening={false}
            />
          </>
        )}
        <KImage
          ref={node => {
            if (node) layerRefs.current[layer.id] = node;
            else delete layerRefs.current[layer.id];
          }}
          image={img}
          x={layer.x} y={layer.y}
          width={layer.width} height={layer.height}
          rotation={layer.rotation}
          draggable
          dragBoundFunc={(p) => dragBoundFunc(p, layer.width, layer.height)}
          onClick={() => setSelectedId(layer.id)}
          onTap={() => setSelectedId(layer.id)}
          onDragEnd={(e) => updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })}
          onTransformEnd={() => {
            const node = layerRefs.current[layer.id];
            if (!node) return;
            updateLayer(layer.id, {
              x: node.x(),
              y: node.y(),
              width:    Math.max(20, node.width()  * node.scaleX()),
              height:   Math.max(20, node.height() * node.scaleY()),
              rotation: node.rotation(),
            });
            node.scaleX(1); node.scaleY(1);
          }}
        />
      </Group>
    );
  };

  /* ── Render ───────────────────────────────────────────── */
  const isBaseSelected = selectedId === 'base';
  const selectedLayer  = selectedId && selectedId !== 'base'
    ? layers.find(l => l.id === selectedId)
    : null;

  return (
    <div style={{ width: canvasW }}>

      {/* Bilgi şeridi */}
      <div style={s.info}>
        <span>Baskı: <strong>{printWidth}×{printHeight}px</strong></span>
        <span>Katman: <strong>{layers.length + 1}</strong></span>
        <span>{baseLoaded ? '✅' : '⏳'} AI</span>
        {tplLoaded && <span>✅ Şablon</span>}
      </div>

      {/* Canvas */}
      <div style={s.canvasWrap}>
        <Stage
          ref={stageRef}
          width={canvasW}
          height={canvasH}
          onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
          onTouchStart={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
          style={{ display: 'block' }}
        >
          <Layer>
            {/* Beyaz print zemini */}
            <Rect
              x={pa.x} y={pa.y}
              width={pa.w} height={pa.h}
              fill="white"
              listening={false}
            />

            {/* Tüm katmanlar — alt'tan üst'e, clip ile */}
            <Group
              clipX={pa.x} clipY={pa.y}
              clipWidth={pa.w} clipHeight={pa.h}
            >
              {renderBase()}
              {layers.map(renderLayer)}
            </Group>

            {/* Template PNG — üst katman */}
            {templateImg && (
              <KImage
                ref={templateRef}
                image={templateImg}
                x={0} y={0}
                width={canvasW} height={canvasH}
                listening={false}
              />
            )}

            {/* Template yoksa print area outline */}
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

            {/* Transformer */}
            {(isBaseSelected || selectedLayer) && (
              <Transformer
                ref={trRef}
                keepRatio={true}
                rotateEnabled={!isBaseSelected}   // Base'de rotation kapalı, ekstra layer'larda açık
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                anchorSize={10}
                anchorStroke="#F56400"
                anchorFill="#fff"
                borderStroke="#F56400"
                borderDash={[4, 3]}
                boundBoxFunc={(o, n) => (n.width < 20 || n.height < 20 ? o : n)}
              />
            )}
          </Layer>
        </Stage>
      </div>

      {/* Araç çubuğu */}
      <div style={s.toolbar}>
        <span style={s.hint}>
          {wrapMode
            ? '🔁 Yatay sarma açık — taşan kısım karşı taraftan görünür'
            : selectedId
              ? '↔ Sürükle · Köşelerden ölçekle' + (selectedLayer ? ' · ⟳ Üst handle ile döndür' : '') + ' · Esc = bırak · Del = sil'
              : '🎨 Görsele tıkla → taşı · "+ Görsel Ekle" ile katman ekle'}
        </span>

        <div style={{ display: 'flex', gap: 6 }}>
          {baseLoaded && (
            <button
              type="button"
              onClick={() => setWrapMode(w => !w)}
              title="Yatay sarma (kupa için)"
              style={{
                ...s.btn,
                background:  wrapMode ? 'var(--brand)' : 'transparent',
                color:       wrapMode ? '#fff' : 'var(--text-muted)',
                borderColor: wrapMode ? 'var(--brand)' : 'var(--border-light)',
                fontWeight:  wrapMode ? 700 : 400,
              }}
            >
              🔁 Sarma
            </button>
          )}
          {baseLoaded && (
            <button
              type="button"
              style={s.btn}
              onClick={() => { fitBaseCover(); setSelectedId(null); }}
              title="AI tasarımı print area'ya sığdır"
            >
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {/* Katman paneli */}
      {(layers.length > 0 || baseLoaded) && (
        <div style={s.layerPanel}>
          <div style={s.layerPanelTitle}>Katmanlar (alttan üste)</div>
          <div style={s.layerList}>

            {/* AI Base */}
            {baseLoaded && (
              <LayerCard
                isSelected={isBaseSelected}
                onSelect={() => setSelectedId('base')}
                label="AI Tasarım"
                sublabel="Temel"
                imageUrl={designUrl}
                badge="🤖"
                isBase
              />
            )}

            {/* Ekstra katmanlar */}
            {layers.map((layer, i) => (
              <LayerCard
                key={layer.id}
                isSelected={selectedId === layer.id}
                onSelect={() => setSelectedId(layer.id)}
                onMoveUp={i < layers.length - 1 ? () => moveLayer(layer.id, 'up') : null}
                onMoveDown={i > 0 ? () => moveLayer(layer.id, 'down') : null}
                onToggleVisible={() => toggleVisibility(layer.id)}
                onDelete={() => deleteLayer(layer.id)}
                label={`Görsel ${i + 1}`}
                sublabel={`${Math.round(layer.width)}×${Math.round(layer.height)}`}
                imageUrl={layer.url}
                visible={layer.visible}
                badge={layer.visible ? '👁️' : '🙈'}
              />
            ))}
          </div>
        </div>
      )}

      <div style={s.footnote}>
        {wrapMode
          ? 'Yatay sarma aktif — taşan kısım karşı taraftan görünür ve baskıya da yansır.'
          : 'Tasarım sadece şeffaf baskı alanı içinde basılır. Şablon dışı görünür ama çıktıya gitmez.'}
      </div>
    </div>
  );
});

export default KonvaDesignArea;

/* ─────────────────────────────────────────────────────────
 *  Layer Card — panel'deki her bir katmanın UI'i
 * ───────────────────────────────────────────────────────── */
function LayerCard({
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onToggleVisible,
  onDelete,
  label,
  sublabel,
  imageUrl,
  badge,
  visible = true,
  isBase = false,
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        ...s.layerCard,
        borderColor: isSelected ? 'var(--brand)' : 'var(--border)',
        background:  isSelected ? 'rgba(245,100,0,0.08)' : 'var(--bg)',
        opacity:     visible ? 1 : 0.5,
      }}
    >
      <div style={s.layerThumb}>
        {imageUrl
          ? <img src={imageUrl} alt={label} style={s.layerThumbImg} />
          : <div style={s.layerThumbEmpty}>?</div>
        }
        {badge && <div style={s.layerBadge}>{badge}</div>}
      </div>
      <div style={s.layerInfo}>
        <div style={s.layerLabel}>
          {label}
          {isBase && <span style={s.baseTag}>BASE</span>}
        </div>
        <div style={s.layerSub}>{sublabel}</div>
      </div>
      {!isBase && (
        <div style={s.layerActions} onClick={(e) => e.stopPropagation()}>
          {onMoveUp && (
            <button onClick={onMoveUp} style={s.layerBtn} title="Üste taşı">▲</button>
          )}
          {onMoveDown && (
            <button onClick={onMoveDown} style={s.layerBtn} title="Alta taşı">▼</button>
          )}
          {onToggleVisible && (
            <button onClick={onToggleVisible} style={s.layerBtn} title="Görünürlük">
              {visible ? '👁️' : '🙈'}
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              style={{ ...s.layerBtn, color: 'var(--danger)' }}
              title="Sil"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Stiller ─────────────────────────────────────────────── */
const s = {
  info: {
    display: 'flex', gap: 14, flexWrap: 'wrap',
    fontSize: 11, color: 'var(--text-muted)',
    marginBottom: 8,
  },
  canvasWrap: {
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
    flexWrap: 'wrap', gap: 6,
  },
  hint: { fontSize: 11, color: 'var(--text-muted)', flex: 1, minWidth: 200 },
  btn: {
    background:   'transparent',
    border:       '1px solid var(--border-light)',
    borderRadius: 6,
    color:        'var(--text-muted)',
    fontSize:     11,
    padding:      '4px 10px',
    cursor:       'pointer',
    fontFamily:   'var(--font-body)',
  },

  layerPanel: {
    marginTop: 12,
    padding:   10,
    background:   'var(--bg-card)',
    border:       '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
  },
  layerPanelTitle: {
    fontSize: 11, fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8,
  },
  layerList: {
    display: 'flex', gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
  },
  layerCard: {
    flex: '0 0 auto',
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 8px',
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    minWidth: 180,
  },
  layerThumb: {
    position: 'relative',
    width: 36, height: 36,
    borderRadius: 4,
    overflow: 'hidden',
    background: '#f5f5f5',
    flexShrink: 0,
  },
  layerThumbImg: {
    width: '100%', height: '100%', objectFit: 'cover',
  },
  layerThumbEmpty: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-muted)', fontSize: 14,
  },
  layerBadge: {
    position: 'absolute', top: -2, right: -2,
    fontSize: 10,
    background: 'var(--bg-card)',
    borderRadius: 4,
    padding: '0 3px',
  },
  layerInfo: {
    flex: 1, minWidth: 0,
  },
  layerLabel: {
    fontSize: 12, fontWeight: 600,
    color: 'var(--text)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  baseTag: {
    fontSize: 8, fontWeight: 700,
    color: 'var(--brand)',
    background: 'rgba(245,100,0,0.15)',
    padding: '1px 4px',
    borderRadius: 3,
    letterSpacing: 0.3,
  },
  layerSub: {
    fontSize: 10, color: 'var(--text-dim)',
    marginTop: 1,
  },
  layerActions: {
    display: 'flex', gap: 2,
    flexShrink: 0,
  },
  layerBtn: {
    background: 'transparent',
    border: '1px solid var(--border-light)',
    borderRadius: 4,
    color: 'var(--text-muted)',
    fontSize: 11,
    padding: '2px 5px',
    cursor: 'pointer',
    lineHeight: 1,
  },

  footnote: {
    marginTop: 6,
    fontSize: 11,
    color: 'var(--text-dim)',
    textAlign: 'center',
  },
};