import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './components/Dashboard.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Componente para proteger rutas (solo usuarios autenticados)
const ProtectedRoute = ({ children }) => {
  const { token, initialized } = useAuth();
  // Mientras no se haya restaurado la sesión desde localStorage (primer
  // render o vuelta del OAuth de Spotify), no redirigir todavía: evita
  // el "bounce" a /login cuando el token ya existe pero aún no se propaga.
  if (!initialized) {
    return null;
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App = () => {
  const { initFromStorage } = useAuth();
  const navigate = useNavigate();

  // Inicializar sesión desde localStorage al montar
  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </div>
  );
};

export default App;
