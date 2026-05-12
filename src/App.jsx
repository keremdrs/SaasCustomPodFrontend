import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Landing         from './pages/Landing';
import Login           from './pages/Login';
import Register        from './pages/Register';
import Dashboard       from './pages/Dashboard';
import Settings        from './pages/Settings';
import Credits         from './pages/Credits';
import CustomerUpload  from './pages/CustomerUpload';
import CustomerApproval from './pages/CustomerApproval';

// Oturum gerektiren sayfalar için koruma
function RootRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div style={loadingStyle}>Loading...</div>;
  return user ? <Navigate to="/dashboard" replace /> : <Landing />;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={loadingStyle}>Yükleniyor...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

// Oturum açıksa login/register'a gitmesin
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={loadingStyle}>Yükleniyor...</div>;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

const loadingStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: '100vh', fontFamily: 'sans-serif', color: '#666'
};

function AppRoutes() {
  return (
    <Routes>
      {/* Landing */}

      {/* Public */}
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Müşteri sayfaları (oturumsuz) */}
      <Route path="/:shopSlug"        element={<CustomerUpload />} />
      <Route path="/onay/:orderId"    element={<CustomerApproval />} />

      {/* Korumalı */}
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/settings"  element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="/credits"   element={<PrivateRoute><Credits /></PrivateRoute>} />

      {/* Default */}
      <Route path="/" element={<RootRoute />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}