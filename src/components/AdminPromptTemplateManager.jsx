import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/* ─────────────────────────────────────────────────────────
 *  AdminPromptTemplateManager — AI Stil Şablonları
 *  --------------------------------------------------------
 *  `templates` tablosunu yönetir. Bu tablo TemplateGallery'de
 *  kullanıcıya gösterilen AI prompt şablonlarını içerir
 *  (anime, cartoon, oil painting vb.).
 *
 *  Schema: id · name · fixed_prompt · thumbnail_url ·
 *           is_active · sort_order
 *
 *  Sadece is_super_admin profili olan kullanıcılar açabilir.
 *  Yetkilendirme çağıran tarafta (Dashboard) yapılır.
 * ───────────────────────────────────────────────────────── */

export default function AdminPromptTemplateManager({ onClose }) {

  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [msg,       setMsg]       = useState('');

  /* ── Edit/New state ───────────────────────────────────── */
  const [editing,   setEditing]   = useState(null);  // null | template | { new: true }
  const [form, setForm] = useState({
    name: '', fixed_prompt: '', thumbnail_url: '',
    is_active: true, sort_order: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);

  /* ── Yükle ───────────────────────────────────────────── */
  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true });
    setTemplates(data || []);
    setLoading(false);
  };

  /* ── Form aç ──────────────────────────────────────────── */
  const startEdit = (t) => {
    setEditing(t);
    setForm({
      name:          t.name || '',
      fixed_prompt:  t.fixed_prompt || '',
      thumbnail_url: t.thumbnail_url || '',
      is_active:     t.is_active ?? true,
      sort_order:    t.sort_order ?? 0,
    });
    setMsg('');
  };

  const startNew = () => {
    setEditing({ new: true });
    setForm({
      name: '', fixed_prompt: '', thumbnail_url: '',
      is_active: true,
      sort_order: templates.length,
    });
    setMsg('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ name: '', fixed_prompt: '', thumbnail_url: '', is_active: true, sort_order: 0 });
    setMsg('');
  };

  /* ── Thumbnail upload ─────────────────────────────────── */
  const handleThumbUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setMsg('');
    try {
      const ext  = file.name.split('.').pop().toLowerCase();
      const safe = (form.name || 'thumb').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      const path = `prompt-thumbs/${safe}_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('templates')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('templates').getPublicUrl(path);

      setForm(f => ({ ...f, thumbnail_url: publicUrl }));
      setMsg('success:Thumbnail yüklendi.');
    } catch (err) {
      setMsg('error:' + err.message);
    }
    setUploading(false);
  };

  /* ── Kaydet ───────────────────────────────────────────── */
  const handleSave = async () => {
    if (!form.name.trim()) {
      setMsg('error:Şablon adı zorunlu.');
      return;
    }
    if (!form.fixed_prompt.trim()) {
      setMsg('error:Prompt zorunlu.');
      return;
    }

    setSaving(true);
    setMsg('');

    const payload = {
      name:          form.name.trim(),
      fixed_prompt:  form.fixed_prompt.trim(),
      thumbnail_url: form.thumbnail_url || null,
      is_active:     form.is_active,
      sort_order:    Number.isFinite(form.sort_order) ? form.sort_order : 0,
    };

    try {
      if (editing?.new) {
        const { error } = await supabase.from('templates').insert(payload);
        if (error) throw error;
        setMsg('success:✅ Şablon eklendi.');
      } else {
        const { error } = await supabase
          .from('templates').update(payload).eq('id', editing.id);
        if (error) throw error;
        setMsg('success:✅ Güncellendi.');
      }
      await loadTemplates();
      setTimeout(cancelEdit, 700);
    } catch (err) {
      setMsg('error:' + err.message);
    }
    setSaving(false);
  };

  /* ── Sil ─────────────────────────────────────────────── */
  const handleDelete = async (t) => {
    if (!window.confirm(`"${t.name}" şablonunu silmek istediğine emin misin?\n\nBu şablonu kullanan eski sipariş kayıtları etkilenmez.`)) return;
    setMsg('');
    const { error } = await supabase.from('templates').delete().eq('id', t.id);
    if (error) { setMsg('error:' + error.message); return; }
    await loadTemplates();
  };

  /* ── Aktif/pasif toggle ──────────────────────────────── */
  const handleToggleActive = async (t) => {
    const { error } = await supabase
      .from('templates')
      .update({ is_active: !t.is_active })
      .eq('id', t.id);
    if (error) { setMsg('error:' + error.message); return; }
    await loadTemplates();
  };

  /* ── Sıra değiştir ───────────────────────────────────── */
  const moveItem = async (t, direction) => {
    const idx = templates.findIndex(x => x.id === t.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= templates.length) return;
    const other = templates[swapIdx];

    // İki kaydın sort_order'larını yer değiştir
    await supabase.from('templates').update({ sort_order: other.sort_order }).eq('id', t.id);
    await supabase.from('templates').update({ sort_order: t.sort_order }).eq('id', other.id);
    await loadTemplates();
  };

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <h2 style={s.title}>🎨 AI Stil Şablonları</h2>
            <div style={s.subtitle}>
              TemplateGallery'de kullanıcıya gösterilen AI prompt şablonları
            </div>
          </div>
          <button onClick={onClose} style={s.closeBtn} disabled={saving}>✕</button>
        </div>

        <div style={s.body}>

          {/* ─── LİSTE GÖRÜNÜMÜ ─── */}
          {!editing && (
            <>
              <div style={s.listHeader}>
                <span style={s.listCount}>
                  {loading ? 'Yükleniyor...' : `${templates.length} şablon`}
                </span>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 13, padding: '6px 14px' }}
                  onClick={startNew}
                >
                  ➕ Yeni Şablon
                </button>
              </div>

              {!loading && templates.length === 0 && (
                <div style={s.empty}>
                  Henüz şablon yok. <strong>➕ Yeni Şablon</strong> ile başla.
                </div>
              )}

              <div style={s.rows}>
                {templates.map((t, i) => (
                  <div key={t.id} style={{
                    ...s.row,
                    opacity: t.is_active ? 1 : 0.55,
                  }}>
                    {/* Thumbnail */}
                    {t.thumbnail_url
                      ? <img src={t.thumbnail_url} alt={t.name} style={s.thumb} />
                      : <div style={s.thumbPlaceholder}>{t.name[0]?.toUpperCase() || '?'}</div>
                    }

                    {/* Bilgi */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.rowName}>
                        {t.name}
                        {!t.is_active && <span style={s.inactiveBadge}>pasif</span>}
                      </div>
                      <div style={s.rowPrompt} title={t.fixed_prompt}>
                        {t.fixed_prompt?.slice(0, 90) || <em>prompt yok</em>}
                        {t.fixed_prompt?.length > 90 && '...'}
                      </div>
                      <div style={s.rowMeta}>
                        Sıra: <strong>{t.sort_order ?? 0}</strong>
                        {' · '}
                        {t.fixed_prompt && <span>{t.fixed_prompt.length} karakter</span>}
                      </div>
                    </div>

                    {/* Hızlı eylemler */}
                    <div style={s.rowActions}>
                      <div style={s.moveBtns}>
                        <button
                          onClick={() => moveItem(t, 'up')}
                          disabled={i === 0}
                          style={{ ...s.iconBtn, opacity: i === 0 ? 0.3 : 1 }}
                          title="Yukarı"
                        >▲</button>
                        <button
                          onClick={() => moveItem(t, 'down')}
                          disabled={i === templates.length - 1}
                          style={{ ...s.iconBtn, opacity: i === templates.length - 1 ? 0.3 : 1 }}
                          title="Aşağı"
                        >▼</button>
                      </div>
                      <button
                        onClick={() => handleToggleActive(t)}
                        style={s.iconBtn}
                        title={t.is_active ? 'Pasif yap' : 'Aktif yap'}
                      >
                        {t.is_active ? '👁️' : '🔒'}
                      </button>
                      <button
                        onClick={() => startEdit(t)}
                        style={s.iconBtn}
                        title="Düzenle"
                      >✏️</button>
                      <button
                        onClick={() => handleDelete(t)}
                        style={{ ...s.iconBtn, color: 'var(--danger)' }}
                        title="Sil"
                      >🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ─── EDIT/NEW FORMU ─── */}
          {editing && (
            <>
              <div style={s.editHeader}>
                <span style={s.editTitle}>
                  {editing.new ? '➕ Yeni Şablon' : `✏️ Düzenle: ${editing.name}`}
                </span>
              </div>

              <div style={s.formGrid}>

                {/* SOL: Thumbnail */}
                <div style={s.thumbSection}>
                  <div style={s.thumbWrap}>
                    {form.thumbnail_url
                      ? <img src={form.thumbnail_url} alt="" style={s.thumbBig} />
                      : <div style={s.thumbBigEmpty}>📷</div>
                    }
                  </div>
                  <label style={{
                    ...s.uploadBtn,
                    background: uploading ? 'var(--bg-hover)' : 'var(--bg)',
                    cursor:     uploading ? 'not-allowed' : 'pointer',
                  }}>
                    {uploading
                      ? '⏳ Yükleniyor'
                      : (form.thumbnail_url ? '🔄 Değiştir' : '📁 Thumbnail Yükle')}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={uploading}
                      onChange={handleThumbUpload}
                    />
                  </label>
                  {form.thumbnail_url && (
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, thumbnail_url: '' }))}
                      style={s.removeThumbBtn}
                    >
                      ✕ Thumbnail'i kaldır
                    </button>
                  )}
                </div>

                {/* SAĞ: Form alanları */}
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div className="form-group">
                    <label className="label">Şablon Adı *</label>
                    <input
                      className="input"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Örn: Anime, Pop Art, Disney 3D"
                    />
                  </div>

                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="label">
                      AI Prompt *
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400, marginLeft: 6 }}>
                        ({form.fixed_prompt.length} karakter)
                      </span>
                    </label>
                    <textarea
                      className="input"
                      value={form.fixed_prompt}
                      onChange={e => setForm(f => ({ ...f, fixed_prompt: e.target.value }))}
                      placeholder="Örn: anime style portrait, vibrant colors, detailed eyes, soft lighting, studio ghibli aesthetic"
                      rows={6}
                      style={{ resize: 'vertical', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}
                    />
                    <div style={s.promptHint}>
                      Bu prompt InstantID/FLUX'a doğrudan gönderilir. Müşteri fotoğrafıyla birleşir, ek değişken yok.
                    </div>
                  </div>

                  <div style={s.grid2}>
                    <div className="form-group">
                      <label className="label">Sıra (sort_order)</label>
                      <input
                        className="input"
                        type="number"
                        value={form.sort_order}
                        onChange={e => setForm(f => ({
                          ...f,
                          sort_order: e.target.value === '' ? 0 : parseInt(e.target.value) || 0,
                        }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="label" style={{ visibility: 'hidden' }}>x</label>
                      <label style={s.activeToggle}>
                        <input
                          type="checkbox"
                          checked={form.is_active}
                          onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                        />
                        <span>Aktif (kullanıcılara görünür)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {msg && (
                <div className={`alert ${msg.startsWith('error:') ? 'alert-error' : 'alert-success'}`}
                     style={{ marginTop: 16 }}>
                  {msg.slice(msg.indexOf(':') + 1)}
                </div>
              )}

              <div style={s.actions}>
                <button className="btn btn-secondary" onClick={cancelEdit} disabled={saving}>
                  İptal
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? '⏳ Kaydediliyor...' : '💾 Kaydet'}
                </button>
              </div>
            </>
          )}

          {/* Liste modunda mesaj */}
          {!editing && msg && (
            <div className={`alert ${msg.startsWith('error:') ? 'alert-error' : 'alert-success'}`}
                 style={{ marginTop: 14 }}>
              {msg.slice(msg.indexOf(':') + 1)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Stiller ─────────────────────────────────────────────── */
const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 20,
    backdropFilter: 'blur(3px)',
  },
  modal: {
    background:    'var(--bg-card)',
    border:        '1px solid var(--border)',
    borderRadius:  'var(--radius-lg)',
    width:         '100%',
    maxWidth:      720,
    maxHeight:     '90vh',
    display:       'flex',
    flexDirection: 'column',
    boxShadow:     '0 24px 64px rgba(0,0,0,0.7)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '18px 24px', borderBottom: '1px solid var(--border)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 17, fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  subtitle: {
    fontSize: 11, color: 'var(--text-muted)', marginTop: 4,
  },
  closeBtn: {
    background: 'transparent', border: 'none',
    color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer',
    padding: 0, lineHeight: 1,
  },
  body: {
    padding: 20, overflowY: 'auto', flex: 1,
  },
  listHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14, paddingBottom: 12,
    borderBottom: '1px solid var(--border)',
  },
  listCount: {
    fontSize: 12, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  empty: {
    padding: '30px 20px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: 13,
    background: 'var(--bg-hover)',
    borderRadius: 'var(--radius-sm)',
  },
  rows: {
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    transition: 'background 0.15s',
  },
  thumb: {
    width: 52, height: 52,
    objectFit: 'cover',
    borderRadius: 6,
    background: '#f5f5f5',
    border: '1px solid var(--border)',
    flexShrink: 0,
  },
  thumbPlaceholder: {
    width: 52, height: 52,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6,
    background: 'var(--bg-hover)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    fontSize: 22, fontWeight: 700,
    flexShrink: 0,
  },
  rowName: {
    fontWeight: 600, fontSize: 14,
    color: 'var(--text)',
    display: 'flex', alignItems: 'center', gap: 8,
    marginBottom: 3,
  },
  inactiveBadge: {
    fontSize: 10, fontWeight: 600,
    padding: '2px 6px',
    background: 'var(--bg-hover)',
    color: 'var(--text-dim)',
    borderRadius: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowPrompt: {
    fontSize: 11, color: 'var(--text-muted)',
    lineHeight: 1.4,
    overflow: 'hidden', textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 380,
  },
  rowMeta: {
    fontSize: 10, color: 'var(--text-dim)',
    marginTop: 3,
  },
  rowActions: {
    display: 'flex', alignItems: 'center', gap: 4,
    flexShrink: 0,
  },
  moveBtns: {
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  iconBtn: {
    background: 'transparent',
    border: '1px solid var(--border-light)',
    borderRadius: 5,
    color: 'var(--text-muted)',
    fontSize: 13,
    padding: '4px 8px',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    lineHeight: 1,
  },
  editHeader: {
    paddingBottom: 12, marginBottom: 16,
    borderBottom: '1px solid var(--border)',
  },
  editTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 14, fontWeight: 600,
    color: 'var(--brand)',
  },
  formGrid: {
    display: 'flex', gap: 20,
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  thumbSection: {
    flex: '0 0 160px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  thumbWrap: {
    width: 160, height: 160,
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
    background: 'var(--bg-hover)',
  },
  thumbBig: {
    width: '100%', height: '100%',
    objectFit: 'cover',
  },
  thumbBigEmpty: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 36, color: 'var(--text-dim)',
  },
  uploadBtn: {
    display:      'block',
    padding:      '8px 12px',
    color:        'var(--text)',
    border:       '1px dashed var(--border-light)',
    borderRadius: 'var(--radius-sm)',
    fontSize:     11, fontWeight: 600,
    textAlign:    'center',
  },
  removeThumbBtn: {
    background: 'transparent', border: 'none',
    color: 'var(--danger)', fontSize: 11, cursor: 'pointer',
    padding: 4,
    textAlign: 'center',
  },
  promptHint: {
    fontSize: 11, color: 'var(--text-dim)',
    marginTop: 6, lineHeight: 1.5,
  },
  grid2: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
    marginTop: 12,
  },
  activeToggle: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 13, color: 'var(--text)',
    cursor: 'pointer', userSelect: 'none',
  },
  actions: {
    display: 'flex', gap: 10, justifyContent: 'flex-end',
    marginTop: 20, paddingTop: 16,
    borderTop: '1px solid var(--border)',
  },
};