import { supabase } from '../lib/supabase';

const STATUS_LABEL = {
  yeni:          'Yeni',
  revize:        'Revize',
  onay_bekliyor: 'Onay Bekliyor',
  onaylandi:     'Onaylandı',
  tamamlandi:    'Tamamlandı',
};

export default function OrdersTable({ orders, activeOrderId, onProcess, onRefresh, userId }) {
  if (!orders.length) return (
    <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
      Henüz sipariş yok. Müşteri sayfanı paylaşmaya başla!
    </div>
  );

  const handleCopyLink = (orderId) => {
    const link = `${window.location.origin}/onay/${orderId}`;
    navigator.clipboard.writeText(link);
    alert('🔗 Onay linki kopyalandı!');
  };

  const handleSendToPrintify = async (order) => {
    // Kargo bilgisi alınacak, şimdilik placeholder
    alert('Printify gönderimi Ayarlar sayfasındaki Printify token\'ı gerektiriyor.');
  };

  return (
    <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>
          📋 Sipariş Günlüğü
        </h4>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Sipariş No</th>
              <th>Müşteri</th>
              <th>Durum</th>
              <th>Tarih</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id} style={{
                background: activeOrderId === o.id ? 'rgba(245, 100, 0, 0.07)' : 'transparent'
              }}>
                <td style={{ fontWeight: 600 }}>#{o.etsy_order_no}</td>
                <td>{o.customer_name}</td>
                <td>
                  <span className={`badge badge-${o.status}`}>
                    {STATUS_LABEL[o.status] || o.status}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {new Date(o.created_at).toLocaleDateString('tr-TR')}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '5px 10px' }}
                      onClick={() => onProcess(o)}
                    >
                      {activeOrderId === o.id ? '📍 İşleniyor' : '🔍 İşle'}
                    </button>

                    {o.status === 'onay_bekliyor' && (
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '5px 10px', color: 'var(--info)' }}
                        onClick={() => handleCopyLink(o.id)}
                      >
                        🔗 Link
                      </button>
                    )}

                    {o.status === 'onaylandi' && (
                      <button
                        className="btn btn-success"
                        style={{ fontSize: 12, padding: '5px 10px' }}
                        onClick={() => handleSendToPrintify(o)}
                      >
                        🚀 Printify
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
