import {
  useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef,
} from 'react';
import { Stage, Layer, Image as KImage, Rect, Group, Transformer } from 'react-konva';

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
      // Görselin gerçek çözünürlüğünü yakalıyoruz
      setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    };
    image.onerror = () => setLoaded(false);
    image.src = url;
  }, [url]);
  
  return { img, loaded, natural };
}

function useLayerImages(layers) {
  const [imgMap,  setImgMap]  = useState({});
  const inFlight  = useRef(new Set()); 
  useEffect(() => {
    layers.forEach(layer => {
      if (!layer.url || imgMap[layer.id] || inFlight.current.has(layer.id)) return;
      inFlight.current.add(layer.id);
      const image = new window.Image();
      image.crossOrigin = 'Anonymous';
      const cleanup = () => { inFlight.current.delete(layer.id); };
      image.onload = () => { cleanup(); setImgMap(m => ({ ...m, [layer.id]: image })); };
      image.onerror = () => { cleanup(); };
      image.src = layer.url;
    });
  }, [layers]); // eslint-disable-line
  return imgMap;
}

const KonvaDesignArea = forwardRef(function KonvaDesignArea({
  designUrl,
  containerWidth = 520,
}, ref) {

  const { img: baseImg, loaded: baseLoaded, natural } = useLoadImage(designUrl);

  // 1. SİHİRLİ KISIM: Dışarıdan gelen boyutları yok sayıp görselin GERÇEK boyutunu kullanıyoruz
  const actualW = natural?.w || 1024;
  const actualH = natural?.h || 1024;

  const aspectRatio = actualW / actualH;
  const maxW = Math.min(containerWidth, (typeof window !== 'undefined' ? window.innerWidth : 800) - 60);
  
  let canvasW, canvasH;
  if (aspectRatio >= 1) {
    canvasW = maxW;
    canvasH = Math.round(maxW / aspectRatio);
  } else {
    canvasH = Math.min(maxW, 620);
    canvasW = Math.round(canvasH * aspectRatio);
  }
  
  const pa = { x: 0, y: 0, w: canvasW, h: canvasH };

  const [basePos, setBasePos] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [layers, setLayers] = useState([]);
  const [selectedId, setSelectedId] = useState(null); 
  const layerImgs = useLayerImages(layers);

  const stageRef  = useRef(null);
  const baseRef   = useRef(null);
  const layerRefs = useRef({});
  const trRef     = useRef(null);

  // 2. SİHİRLİ KISIM: Tuval ve resim oranları BİREBİR aynı olduğu için kesme yapmadan tam oturtuyoruz.
  const fitBaseCover = useCallback(() => {
    if (!baseImg || pa.w <= 0) return;
    setBasePos({ x: pa.x, y: pa.y, w: pa.w, h: pa.h });
  }, [baseImg, pa.w, pa.h, pa.x, pa.y]);

  useEffect(() => { fitBaseCover(); }, [fitBaseCover]);

  useEffect(() => {
    if (!trRef.current) return;
    let node = null;
    if (selectedId === 'base') node = baseRef.current;
    else if (selectedId)       node = layerRefs.current[selectedId];
    trRef.current.nodes(node ? [node] : []);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedId, layers.length]);

  useEffect(() => {
    const handleKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'Escape') setSelectedId(null);
      if (e.key === 'Delete' && selectedId && selectedId !== 'base') deleteLayer(selectedId);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId]); // eslint-disable-line

  const exportDesign = useCallback(() => {
    if (!stageRef.current) return null;
    const trVis = trRef.current?.visible();
    if (trRef.current) trRef.current.visible(false);
    
    stageRef.current.batchDraw();
    
    // 3. SİHİRLİ KISIM: Çıktı alınırken resim Upscale edildiyse o devasa çözünürlük üzerinden pixelRatio hesaplıyoruz.
    const pixelRatio = actualW / pa.w;
    
    const dataURL = stageRef.current.toDataURL({
      x: pa.x, y: pa.y, width: pa.w, height: pa.h,
      pixelRatio, mimeType: 'image/png' // KAYIPSIZ PNG FORMU
    });
    
    if (trRef.current && trVis !== false) trRef.current.visible(true);
    stageRef.current.batchDraw();
    
    return dataURL;
  }, [actualW, pa.w, pa.h, pa.x, pa.y]);

  const addLayer = useCallback(async (url) => {
    if (!url) return null;
    const dims = await new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = 'Anonymous';
      img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 400, h: 400 });
      img.src = url;
    });

    const startW = pa.w * 0.35;
    const ar = dims.w / dims.h || 1;
    const startH = startW / ar;

    const newLayer = {
      id: `layer_${Date.now()}`, url,
      x: pa.x + (pa.w - startW) / 2, y: pa.y + (pa.h - startH) / 2,
      width: startW, height: startH, rotation: 0, visible: true,
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
    return newLayer.id;
  }, [pa.w, pa.h, pa.x, pa.y]);

  const updateLayer = (id, patch) => setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  const deleteLayer = (id) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
    delete layerRefs.current[id];
  };

  useImperativeHandle(ref, () => ({
    exportDesign, addLayer,
    reset: () => { fitBaseCover(); setLayers([]); setSelectedId(null); },
  }), [exportDesign, addLayer, fitBaseCover]);

  return (
    <div style={{ width: canvasW }}>
      <div style={s.info}>
        <span>Baskı Çözünürlüğü: <strong style={{color: 'var(--success)'}}>{actualW} × {actualH} px</strong></span>
        <span>Katman Sayısı: <strong>{layers.length + 1}</strong></span>
      </div>

      <div style={s.canvasWrap}>
        <Stage
          ref={stageRef} width={canvasW} height={canvasH}
          onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
          onTouchStart={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}
          style={{ display: 'block' }}
        >
          <Layer>
            <Rect x={pa.x} y={pa.y} width={pa.w} height={pa.h} fill="white" listening={false} />
            <Group clipX={pa.x} clipY={pa.y} clipWidth={pa.w} clipHeight={pa.h}>
              
              {baseImg && basePos.w > 0 && (
                <KImage
                  ref={baseRef} image={baseImg}
                  x={basePos.x} y={basePos.y} width={basePos.w} height={basePos.h}
                  draggable
                  onClick={() => setSelectedId('base')}
                  onTap={() => setSelectedId('base')}
                  onDragEnd={(e) => setBasePos(p => ({ ...p, x: e.target.x(), y: e.target.y() }))}
                  onTransformEnd={() => {
                    const node = baseRef.current;
                    setBasePos({ x: node.x(), y: node.y(), w: Math.max(40, node.width() * node.scaleX()), h: Math.max(40, node.height() * node.scaleY()) });
                    node.scaleX(1); node.scaleY(1);
                  }}
                />
              )}

              {layers.map(layer => {
                const img = layerImgs[layer.id];
                if (!img || !layer.visible) return null;
                return (
                  <KImage
                    key={layer.id}
                    ref={node => { if (node) layerRefs.current[layer.id] = node; }}
                    image={img}
                    x={layer.x} y={layer.y} width={layer.width} height={layer.height} rotation={layer.rotation}
                    draggable
                    onClick={() => setSelectedId(layer.id)}
                    onTap={() => setSelectedId(layer.id)}
                    onDragEnd={(e) => updateLayer(layer.id, { x: e.target.x(), y: e.target.y() })}
                    onTransformEnd={() => {
                      const node = layerRefs.current[layer.id];
                      updateLayer(layer.id, {
                        x: node.x(), y: node.y(), rotation: node.rotation(),
                        width: Math.max(20, node.width() * node.scaleX()), height: Math.max(20, node.height() * node.scaleY()),
                      });
                      node.scaleX(1); node.scaleY(1);
                    }}
                  />
                );
              })}
            </Group>

            {(selectedId === 'base' || selectedId) && (
              <Transformer
                ref={trRef} keepRatio={true}
                rotateEnabled={selectedId !== 'base'}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                anchorSize={10} anchorStroke="#F56400" anchorFill="#fff" borderStroke="#F56400" borderDash={[4, 3]}
                boundBoxFunc={(o, n) => (n.width < 20 || n.height < 20 ? o : n)}
              />
            )}
          </Layer>
        </Stage>
      </div>

      <div style={s.toolbar}>
        <span style={s.hint}>
          {selectedId ? '↔ Sürükle · Köşelerden ölçekle · Esc = Seçimi Bırak · Del = Sil' : '🎨 Bir görsele tıklayarak düzenleyin.'}
        </span>
      </div>
    </div>
  );
});

export default KonvaDesignArea;

const s = {
  info: { display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 },
  canvasWrap: {
    backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
    backgroundColor: '#ffffff', backgroundSize: '14px 14px', backgroundPosition: '0 0, 0 7px, 7px -7px, -7px 0',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)', display: 'inline-block', lineHeight: 0,
  },
  toolbar: { display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '6px 12px', background: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' },
  hint: { fontSize: 11, color: 'var(--text-muted)' }
};