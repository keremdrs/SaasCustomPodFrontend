// Credits.jsx - Faz 6'da (Paddle entegrasyonu) doldurulacak
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../index.css';

const PACKAGES = [
  { name: 'Starter',  credits: 20,  price: '$12', desc: '~10 standart AI üretimi' },
  { name: 'Growth',   credits: 60,  price: '$29', desc: '~30 standart AI üretimi', popular: true },
  { name: 'Pro',      credits: 150, price: '$59', desc: '~75 standart AI üretimi' },
];

export default function Credits() {
  const { profile } = useAuth();

  return (
    <div style={{ maxWidth: 700, margin: '60px auto', padding: '0 20px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>💳 Kredi Satın Al</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
        Mevcut bakiye: <strong style={{ color: 'var(--brand)', fontSize: 20 }}>{profile?.credits || 0}</strong> kredi
      </p>
      <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: 13 }}>
        Standard AI = 2 kredi &nbsp;|&nbsp; Premium AI (FLUX) = 5 kredi &nbsp;|&nbsp; Mockup = 1 kredi
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {PACKAGES.map(p => (
          <div
            key={p.name}
            className="card"
            style={{
              textAlign: 'center',
              border: p.popular ? '2px solid var(--brand)' : '1px solid var(--border)',
              position: 'relative',
            }}
          >
            {p.popular && (
              <div style={{
                position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--brand)', color: '#fff', fontSize: 11, fontWeight: 700,
                padding: '3px 12px', borderRadius: 20,
              }}>
                EN POPÜLER
              </div>
            )}
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              {p.name}
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--brand)', fontFamily: 'var(--font-display)' }}>
              {p.credits}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>kredi</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{p.price}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>{p.desc}</div>
            <button
              className="btn btn-primary btn-full"
              onClick={() => alert('Paddle entegrasyonu Faz 6\'da eklenecek.')}
            >
              Satın Al
            </button>
          </div>
        ))}
      </div>

      <Link to="/dashboard" style={{ color: 'var(--brand)', fontSize: 14 }}>← Dashboard'a dön</Link>
    </div>
  );
}
