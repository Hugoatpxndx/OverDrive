import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    // Mismo criterio que el backend: mayúscula + minúscula + número
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
    if (password.length < 8 || !passwordRegex.test(password)) {
      setError('Contraseña: mínimo 8 caracteres, con mayúscula, minúscula y número');
      return;
    }

    const result = await register({ username, email, password });
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="auth-page">
      <ThemeToggle className="theme-toggle--corner" />
      <div className="auth-card">
        <aside className="auth-brand">
          <span className="logo-mark logo-mark--lg">OD</span>
          <h1>Crea tu cuenta y empieza a girar</h1>
          <p>
            Únete a la economía circular de la música: conecta tu Spotify,
            gestiona tus playlists y colabora con artistas.
          </p>
          <ul>
            <li>Registro gratuito en segundos</li>
            <li>Contraseñas protegidas con bcrypt</li>
            <li>Autenticación segura con JWT</li>
          </ul>
        </aside>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Crear cuenta</h2>
          <p className="auth-sub">Completa tus datos para comenzar</p>
          {error && <p className="error-message">{error}</p>}
          <label className="field">
            Nombre de usuario
            <input
              type="text"
              placeholder="3-20 caracteres (letras, números, _)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              title="Solo letras, números y guiones bajos"
            />
          </label>
          <label className="field">
            Email
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            Contraseña
            <input
              type="password"
              placeholder="Mín. 8 caracteres, mayúscula y número"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <label className="field">
            Confirmar contraseña
            <input
              type="password"
              placeholder="Repite la contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Registrarse'}
          </button>
          <p className="auth-alt">
            ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;
