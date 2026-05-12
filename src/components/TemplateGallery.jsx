export default function TemplateGallery({ templates, selectedTemplateId, onSelect, onFileUpload }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="label" style={{ marginBottom: 10 }}>Şablon Seçin</div>
      <div style={styles.gallery}>
        {templates.map(t => (
          <div
            key={t.id}
            onClick={() => onSelect(t)}
            style={{
              ...styles.item,
              border: selectedTemplateId === t.id
                ? '3px solid var(--brand)'
                : '2px solid var(--border)',
            }}
          >
            {t.thumbnail_url
              ? <img src={t.thumbnail_url} alt={t.name} style={styles.img} />
              : <div style={styles.placeholder}>{t.name[0]}</div>
            }
            <div style={styles.label}>{t.name}</div>
          </div>
        ))}

        {/* Özel yükleme */}
        <div style={{ ...styles.item, border: '2px dashed var(--border-light)', position: 'relative' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 22 }}>+</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>Özel</div>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={onFileUpload}
            style={styles.fileInput}
          />
        </div>
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
    height: 110,
    width: 80,
    flexShrink: 0,
    position: 'relative',
    transition: 'border-color 0.15s, transform 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  img: {
    height: '100%',
    width: '100%',
    objectFit: 'cover',
  },
  placeholder: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--text-muted)',
  },
  label: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.75)',
    color: '#fff',
    fontSize: 9,
    textAlign: 'center',
    padding: '3px 4px',
  },
  fileInput: {
    position: 'absolute',
    inset: 0,
    opacity: 0,
    cursor: 'pointer',
    width: '100%',
    height: '100%',
  },
};
