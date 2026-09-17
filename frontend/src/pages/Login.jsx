import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login({ identifier, password });
    if (result.success) {
      // Esperar un ciclo de render para que el estado `token` se propague
      // antes de navegar (evita que ProtectedRoute redirija de vuelta a login).
      setTimeout(() => navigate('/dashboard'), 0);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <aside className="auth-brand">
          <span className="logo-mark logo-mark--lg">OD</span>
          <h1>Conecta tu música con quienes la escuchan</h1>
          <p>
            OverDrive es la plataforma donde artistas y curadores intercambian
            visibilidad de forma justa mediante tokens.
          </p>
          <ul>
            <li>Importa tus playlists reales de Spotify</li>
            <li>Envía tu canción a curadores afines</li>
            <li>Acepta propuestas y gana tokens</li>
          </ul>
        </aside>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Bienvenido de vuelta</h2>
          <p className="auth-sub">Inicia sesión para continuar en OverDrive</p>
          {error && <p className="error-message">{error}</p>}
          <label className="field">
            Usuario o email
            <input
              type="text"
              placeholder="tu@email.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            Contraseña
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Cargando...' : 'Iniciar sesión'}
          </button>
          <p className="auth-alt">
            ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
