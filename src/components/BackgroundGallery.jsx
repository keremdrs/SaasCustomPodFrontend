export default function BackgroundGallery({ backgrounds, selectedBackgroundId, onSelect }) {
  if (!backgrounds.length) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="label" style={{ marginBottom: 10 }}>Arka Plan (Opsiyonel)</div>
      <div style={styles.gallery}>

        {/* Yok seçeneği */}
        <div
          onClick={() => onSelect(null)}
          style={{
            ...styles.item,
            border: selectedBackgroundId === null
              ? '3px solid var(--brand)'
              : '2px solid var(--border)',
          }}
        >
          {/* Şeffaflık ızgarası */}
          <div style={styles.grid} />
          <span style={{ position: 'relative', fontSize: 16, color: 'var(--text-muted)' }}>✕</span>
          <div style={styles.label}>Yok</div>
        </div>

        {backgrounds.map(bg => (
          <div
            key={bg.id}
            onClick={() => onSelect(bg)}
            style={{
              ...styles.item,
              border: selectedBackgroundId === bg.id
                ? '3px solid var(--brand)'
                : '2px solid transparent',
            }}
          >
            <img src={bg.image_url} alt={bg.name} style={styles.img} />
            <div style={styles.label}>{bg.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  gallery: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    paddingBottom: 8,
  },
  item: {
    cursor: 'pointer',
    borderRadius: 10,
    overflow: 'hidden',
    height: 70,
    width: 70,
    flexShrink: 0,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.15s',
    background: 'var(--bg)',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(45deg, #333 25%, transparent 25%),
      linear-gradient(-45deg, #333 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #333 75%),
      linear-gradient(-45deg, transparent 75%, #333 75%)
    `,
    backgroundSize: '10px 10px',
    backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
    opacity: 0.4,
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  label: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    fontSize: 9,
    textAlign: 'center',
    padding: '3px 4px',
  },
};
