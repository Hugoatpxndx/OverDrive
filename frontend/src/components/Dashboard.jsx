import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from './ThemeToggle.jsx';

const Dashboard = () => {
  const { user, modo, toggleModo, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Datos del sistema
  const [playlists, setPlaylists] = useState([]);          // disponibles (artista)
  const [myPlaylists, setMyPlaylists] = useState([]);      // propias (curador)
  const [incoming, setIncoming] = useState([]);            // propuestas recibidas (curador)
  const [mySubmissions, setMySubmissions] = useState([]);  // propuestas enviadas (artista)

  // Formularios
  const [trackUrl, setTrackUrl] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [plName, setPlName] = useState('');
  const [plUrl, setPlUrl] = useState('');
  const [plFollowers, setPlFollowers] = useState('');

  // Estado visual
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [spotifyStatus, setSpotifyStatus] = useState(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyLoading, setSpotifyLoading] = useState(false);

  const rol = user?.role || 'usuario';
  const isAdmin = rol === 'administrador';

  const showError = (msg) => {
    setError(msg);
    setMessage('');
  };
  const showMessage = (msg) => {
    setMessage(msg);
    setError('');
  };

  // ---------- Carga de datos ----------
  const loadAll = async () => {
    setLoading(true);
    try {
      const [plRes, incRes, subRes] = await Promise.all([
        api.get('/api/playlists'),
        api.get('/api/submissions/curator').catch(() => ({ data: { submissions: [] } })),
        api.get('/api/submissions').catch(() => ({ data: { submissions: [] } }))
      ]);
      const allPl = plRes.data.playlists || [];
      setPlaylists(allPl.filter((p) => p.owner_id !== user?.id));
      setMyPlaylists(allPl.filter((p) => p.owner_id === user?.id));
      setIncoming(incRes.data.submissions || []);
      setMySubmissions(subRes.data.submissions || []);
    } catch (err) {
      setError('No se pudieron cargar las playlists');
    } finally {
      setLoading(false);
    }
  };

  // Carga el estado de conexión de Spotify por separado (independiente del resto)
  const loadStatus = async () => {
    try {
      const res = await api.get('/api/spotify/status');
      setSpotifyConnected(res.data.connected);
    } catch {
      setSpotifyConnected(false);
    }
  };

  useEffect(() => {
    const status = searchParams.get('spotify');
    if (status === 'connected')
      setSpotifyStatus('connected');
    if (status === 'error')
      setSpotifyStatus('error');
    if (status === 'linked')
      setSpotifyStatus('linked');
    if (status) setSearchParams({}, { replace: true });

    loadStatus();
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Modo Artista: enviar canción ----------
  const handleSubmitTrack = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await api.post('/api/submissions', {
        trackUrl,
        playlistId: parseInt(selectedPlaylist, 10)
      });
      showMessage(`${res.data.message} (te quedan ${res.data.tokensRestantes} tokens)`);
      setTrackUrl('');
      loadAll();
    } catch (err) {
      showError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error al enviar');
    }
  };

  // ---------- Modo Curador: conectar Spotify ----------
  const handleConnectSpotify = async () => {
    setSpotifyLoading(true);
    setError('');
    try {
      const res = await api.get('/api/spotify/auth-url');
      window.location.href = res.data.authUrl;
    } catch (err) {
      showError(err.response?.data?.error || 'Error al conectarse con Spotify');
      setSpotifyLoading(false);
    }
  };

  const handleImportPlaylists = async () => {
    setSpotifyLoading(true);
    setError('');
    try {
      const res = await api.get('/api/spotify/playlists');
      showMessage(`Se importaron ${res.data.count} playlists de tu cuenta de Spotify`);
      loadAll();
    } catch (err) {
      showError(err.response?.data?.error || 'No se pudieron importar las playlists');
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleDisconnectSpotify = async () => {
    setError('');
    try {
      await api.post('/api/spotify/disconnect');
      setSpotifyConnected(false);
      showMessage('Cuenta de Spotify desconectada');
    } catch (err) {
      showError(err.response?.data?.error || 'Error al desconectar');
    }
  };

  // ---------- Modo Curador: crear playlist manual ----------
  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.post('/api/playlists', {
        name: plName,
        spotifyUrl: plUrl,
        followers: plFollowers ? parseInt(plFollowers, 10) : 0
      });
      showMessage('Playlist registrada exitosamente');
      setPlName('');
      setPlUrl('');
      setPlFollowers('');
      loadAll();
    } catch (err) {
      showError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Error al registrar');
    }
  };

  // ---------- Modo Curador: aceptar propuesta ----------
  const handleAccept = async (id) => {
    setError('');
    setMessage('');
    try {
      const res = await api.post(`/api/submissions/${id}/accept`);
      showMessage(`${res.data.message}`);
      loadAll();
    } catch (err) {
      showError(err.response?.data?.error || 'Error al aceptar');
    }
  };

  const pendingIncoming = incoming.filter((s) => s.status === 'pendiente').length;

  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="brand-row">
          <span className="logo-mark">OD</span>
          <span className="brand-name">
            Over<span>Drive</span>
          </span>
        </div>
        <div className="user-chip">
          <div className="user-meta">
            <span className="user-name">{user?.username}</span>
            <span className={`user-role badge badge-${rol}`}>{rol}</span>
          </div>
          <span className="badge">Tokens: {user?.tokens}</span>
          <ThemeToggle />
          <button onClick={logout} className="btn-logout">
            Cerrar sesión
          </button>
        </div>
      </nav>

      <main className="dashboard">
        <div className="page-head">
          <h1>Hola, {user?.username} 👋</h1>
          <p>Gestiona tus playlists, envía canciones y administra tus tokens.</p>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-icon">🪙</span>
            <span className="stat-value">{user?.tokens ?? 0}</span>
            <span className="stat-label">Tokens</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎧</span>
            <span className="stat-value">{myPlaylists.length}</span>
            <span className="stat-label">Mis playlists</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">📥</span>
            <span className="stat-value">{pendingIncoming}</span>
            <span className="stat-label">Propuestas pendientes</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎤</span>
            <span className="stat-value">{mySubmissions.length}</span>
            <span className="stat-label">Mis envíos</span>
          </div>
        </div>

      {spotifyStatus === 'connected' && (
        <div className="message">✅ Cuenta de Spotify conectada. ¡Ya puedes importar tus playlists!</div>
      )}
      {spotifyStatus === 'error' && (
        <div className="error-message">No se pudo conectar con Spotify. Revisa la Redirect URI en el Dashboard de Spotify.</div>
      )}
      {spotifyStatus === 'linked' && (
        <div className="error-message">⚠️ Esta cuenta de Spotify ya está vinculada a otra cuenta de OverDrive. Desconéctala primero en la otra cuenta, o usa otra cuenta de Spotify.</div>
      )}

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
            ? 'Estás en modo Artista: gasta 1 token para enviar tu canción a una playlist.'
            : 'Estás en modo Curador: gana 1 token al aceptar propuestas.'}
        </p>
      </section>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="message">{message}</div>}
      {loading && <p className="modo-desc">Cargando...</p>}

      {/* Vista de Artista */}
      {modo === 'artista' && (
        <section className="enviar-cancion">
          <h2>Envía tu canción</h2>
          <form onSubmit={handleSubmitTrack}>
            <select
              value={selectedPlaylist}
              onChange={(e) => setSelectedPlaylist(e.target.value)}
              required
            >
              <option value="">-- Selecciona una playlist --</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (por {p.owner}, {p.followers} seguidores)
                </option>
              ))}
            </select>
            <input
              type="url"
              placeholder="URL de tu track de Spotify (open.spotify.com/track/...)"
              value={trackUrl}
              onChange={(e) => setTrackUrl(e.target.value)}
              required
              pattern="https?://open\.spotify\.com/track/[a-zA-Z0-9]+"
            />
            <button type="submit" disabled={!user?.tokens}>
              Enviar (cuesta 1 token)
            </button>
          </form>

          {mySubmissions.length > 0 && (
            <div className="mis-envios">
              <h3>Mis envíos</h3>
              <ul className="lista">
                {mySubmissions.map((s) => (
                  <li key={s.id}>
                    <a href={s.track_url} target="_blank" rel="noopener noreferrer">{s.track_name || s.track_url}</a>
                    {' → '}{s.playlist_name}
                    <span className={`badge badge-${s.status}`}>{s.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Vista de Curador */}
      {modo === 'curador' && (
        <section className="bandeja-entrada">
          <h2>Mis playlists (Modo Curador)</h2>

          <div className="spotify-connect">
            {spotifyConnected ? (
              <>
                <span className="badge badge-aprobada">✅ Cuenta de Spotify conectada</span>
                <button onClick={handleImportPlaylists} disabled={spotifyLoading}>
                  {spotifyLoading ? 'Importando...' : '🔄 Actualizar playlists'}
                </button>
                <button onClick={handleDisconnectSpotify} className="btn-danger">
                  Desconectar Spotify
                </button>
              </>
            ) : (
              <button onClick={handleConnectSpotify} disabled={spotifyLoading}>
                {spotifyLoading ? 'Conectando...' : '🔗 Conectar cuenta de Spotify'}
              </button>
            )}
          </div>

          {myPlaylists.length > 0 ? (
            <ul className="lista">
              {myPlaylists.map((p) => (
                <li key={p.id}>
                  <a href={p.spotify_url} target="_blank" rel="noopener noreferrer">{p.name}</a>
                  {' · '}{p.followers} seguidores
                </li>
              ))}
            </ul>
          ) : (
            <div className="no-items">
              Aún no tienes playlists. Conecta tu cuenta de Spotify para importarlas, o regístrala abajo.
            </div>
          )}

          <form className="crear-playlist" onSubmit={handleCreatePlaylist}>
            <h3>Registrar playlist manualmente</h3>
            <input
              placeholder="Nombre de la playlist"
              value={plName}
              onChange={(e) => setPlName(e.target.value)}
              required
            />
            <input
              type="url"
              placeholder="URL de la playlist (open.spotify.com/playlist/...)"
              value={plUrl}
              onChange={(e) => setPlUrl(e.target.value)}
              required
              pattern="https?://open\.spotify\.com/playlist/[a-zA-Z0-9]+"
            />
            <input
              type="number"
              placeholder="Seguidores (opcional)"
              value={plFollowers}
              onChange={(e) => setPlFollowers(e.target.value)}
              min="0"
            />
            <button type="submit">Guardar playlist</button>
          </form>

          <div className="bandeja-propuestas">
            <h2>Bandeja de entrada</h2>
            {incoming.length > 0 ? (
              <ul className="lista">
                {incoming.map((s) => (
                  <li key={s.id}>
                    <a href={s.track_url} target="_blank" rel="noopener noreferrer">{s.track_name || s.track_url}</a>
                    {' por '}{s.artist}
                    {' → '}{s.playlist_name}
                    <span className={`badge badge-${s.status}`}>{s.status}</span>
                    {s.status === 'pendiente' && (
                      <button
                        className="btn-accept"
                        onClick={() => handleAccept(s.id)}
                      >
                        ✔ Aceptar (+1 token)
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="no-items">
                Recibe propuestas de artistas y gana 1 token por cada canción que aceptes.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Panel exclusivo de administrador */}
      {isAdmin && (
        <section className="admin-panel">
          <h2>Panel de Administración</h2>
          <p>Acceso exclusivo para administradores del sistema.</p>
          <p className="modo-desc">
            Como administrador puedes probar el flujo completo: crea una playlist con tu cuenta
            de Spotify y acepta propuestas para ver el intercambio de tokens.
          </p>
        </section>
      )}

      </main>

      <footer className="footer">
        OverDrive · Plataforma de curaduría musical · {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default Dashboard;