import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const Dashboard = () => {
  const { user, modo, toggleModo, logout } = useAuth();
  const [trackUrl, setTrackUrl] = useState('');
  const [playlistId, setPlaylistId] = useState('');
  const [message, setMessage] = useState('');

  // Rol del usuario desde el contexto (leído del JWT)
  const rol = user?.role || 'usuario';
  const isAdmin = rol === 'administrador';

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>OverDrive Dashboard</h1>
        <div className="user-info">
          <span>Usuario: {user?.username}</span>
          <span className={`badge badge-${rol}`}>Rol: {rol}</span>
          <span className="badge">Tokens: {user?.tokens}</span>
        </div>
      </header>

      {/* Alternar modo Artista / Curador */}
      <section className="modo-selector">
        <h2>Modo de trabajo</h2>
        <div className="modo-toggle">
          <button
            className={`modo-btn ${modo === 'artista' ? 'active' : ''}`}
            onClick={() => modo !== 'artista' && toggleModo()}
          >
            🎤 Artista
          </button>
          <button
            className={`modo-btn ${modo === 'curador' ? 'active' : ''}`}
            onClick={() => modo !== 'curador' && toggleModo()}
          >
            🎧 Curador
          </button>
        </div>
        <p className="modo-desc">
          {modo === 'artista'
            ? 'Estás en modo Artista: gasta 1 token para enviar tu canción.'
            : 'Estás en modo Curador: gana 1 token al aceptar propuestas.'}
        </p>
      </section>

      {/* Vista de Artista */}
      {modo === 'artista' && (
        <section className="enviar-cancion">
          <h2>Envía tu canción</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            setMessage(`Enviando "${trackUrl}" a playlist #${playlistId}`);
          }}>
            <input
              type="url"
              placeholder="URL de tu track de Spotify (open.spotify.com/track/...)"
              value={trackUrl}
              onChange={(e) => setTrackUrl(e.target.value)}
              required
              pattern="https?://open\.spotify\.com/track/.+"
            />
            <input
              type="number"
              placeholder="ID de playlist"
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              required
            />
            <button type="submit" disabled={!user?.tokens}>
              Enviar (cuesta 1 token)
            </button>
          </form>
          {message && <p className="message">{message}</p>}
        </section>
      )}

      {/* Vista de Curador */}
      {modo === 'curador' && (
        <section className="bandeja-entrada">
          <h2>Bandeja de entrada del Curador</h2>
          <p>
            Recibe propuestas de artistas y gana 1 token por cada canción que aceptes.
          </p>
          <div className="no-items">
            Aquí aparecerán los envíos de propuestas cuando los artistas las compartan.
          </div>
        </section>
      )}

      {/* Panel exclusivo de administrador */}
      {isAdmin && (
        <section className="admin-panel">
          <h2>Panel de Administración</h2>
          <p>Acceso exclusivo para administradores del sistema.</p>
        </section>
      )}

      <button onClick={logout} className="btn-logout">
        Cerrar sesión
      </button>
    </div>
  );
};

export default Dashboard;
