import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Mug3D from './Mug3D';

const API = 'https://case-designer-api.onrender.com';

export default function Preview3DPanel({
  finalImageUrl,
  selectedBackground,
  textureOffset,
  setTextureOffset,
  textureScale,
  setTextureScale,
  selectedProduct,
  onConfirm,       // () => void  — "Tasarımı Onayla" butonuna basıldığında
  onBack,          // () => void  — geri butonunda
  credits,
  mockupCost = 1,
}) {
  const isDragging = useRef(false);
  const dragStart  = useRef({ x: 0, y: 0 });

  const getPos = (e) => e.touches
    ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
    : { x: e.clientX, y: e.clientY };

  const handleDragStart = (e) => {
    isDragging.current = true;
    dragStart.current  = getPos(e);
  };

  const handleDragMove = (e) => {
    if (!isDragging.current) return;
    const pos = getPos(e);
    const dX  = (pos.x - dragStart.current.x) * 0.002;
    const dY  = (pos.y - dragStart.current.y) * 0.002;
    setTextureOffset(prev => ({
      x: Math.min(1, Math.max(0, prev.x + dX)),
      y: Math.min(1, Math.max(0, prev.y + dY)),
    }));
    dragStart.current = pos;
  };

  const handleDragEnd = () => { isDragging.current = false; };

  return (
    <div style={styles.wrapper}>

      {/* 3D Canvas */}
      <div style={styles.canvas}>
        <Canvas shadows camera={{ position: [0, 1.5, 5], fov: 40 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} castShadow />
          <OrbitControls enablePan={false} />
          <Mug3D
            imageUrl={finalImageUrl}
            backgroundUrl={selectedBackground?.image_url || null}
            offsetX={textureOffset.x}
            offsetY={textureOffset.y}
            scale={textureScale}
            productId={selectedProduct?.id || '11oz'}
          />
        </Canvas>
      </div>

      {/* 2D Konum Ayarı */}
      <div style={styles.section}>
        <div className="label" style={{ marginBottom: 8 }}>
          Görseli sürükleyerek konumlandırın
        </div>
        <div
          onMouseDown={handleDragStart}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          style={{
            ...styles.designArea,
            backgroundImage: selectedBackground?.image_url
              ? `url(${selectedBackground.image_url})`
              : `linear-gradient(45deg, #222 25%, transparent 25%),
                 linear-gradient(-45deg, #222 25%, transparent 25%),
                 linear-gradient(45deg, transparent 75%, #222 75%),
                 linear-gradient(-45deg, transparent 75%, #222 75%)`,
            backgroundSize:     selectedBackground?.image_url ? 'cover' : '20px 20px',
            backgroundPosition: selectedBackground?.image_url ? 'center' : '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        >
          {finalImageUrl && (
            <img
              src={finalImageUrl}
              alt=""
              draggable="false"
              style={{
                position: 'absolute',
                left:      `${textureOffset.x * 100}%`,
                top:       `${textureOffset.y * 100}%`,
                transform: `translate(-50%, -50%) scale(${textureScale})`,
                height:    '100%',
                width:     'auto',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          )}
        </div>
      </div>

      {/* Ölçek */}
      <div style={styles.section}>
        <div className="label" style={{ marginBottom: 6 }}>
          Ölçek: {textureScale.toFixed(2)}×
        </div>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.01"
          value={textureScale}
          onChange={e => setTextureScale(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Butonlar */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Yeniden Üret
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={onConfirm}
          disabled={credits < mockupCost}
        >
          Tasarımı Onayla → Mockup Oluştur ({mockupCost} kredi)
        </button>
      </div>

      {credits < mockupCost && (
        <div className="alert alert-error" style={{ marginTop: 10 }}>
          Mockup oluşturmak için {mockupCost} kredi gerekiyor.
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  canvas: {
    width: '100%',
    height: 400,
    background: '#141414',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  section: {
    width: '100%',
  },
  designArea: {
    width: '100%',
    minHeight: 260,
    border: '2px solid var(--border-light)',
    borderRadius: 'var(--radius)',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
  },
};
