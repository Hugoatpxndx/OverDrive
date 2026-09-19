import React, { useEffect, useRef, useState } from 'react';
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
  const [users, setUsers] = useState([]);                   // listado del panel admin
  const [previewData, setPreviewData] = useState({});       // info de tracks (preview/géneros) por propuesta

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

  // Popup de confirmación (toast): { type: 'success'|'error', text }
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (text, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, type });
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const rol = user?.role || 'usuario';
  const isAdmin = rol === 'administrador';

  const showError = (msg) => {
    setError(msg);
    setMessage('');
    showToast(msg, 'error');
  };
  const showMessage = (msg) => {
    setMessage(msg);
    setError('');
    showToast(msg, 'success');
  };

  // ---------- Carga de datos ----------
  const loadAll = async () => {
    setLoading(true);
    try {
      const [plRes, incRes, subRes, usersRes] = await Promise.all([
        api.get('/api/playlists'),
        api.get('/api/submissions/curator').catch(() => ({ data: { submissions: [] } })),
        api.get('/api/submissions').catch(() => ({ data: { submissions: [] } })),
        api.get('/api/admin/users').catch(() => ({ data: { users: [] } }))
      ]);
      const allPl = plRes.data.playlists || [];
      setPlaylists(allPl.filter((p) => p.owner_id !== user?.id));
      setMyPlaylists(allPl.filter((p) => p.owner_id === user?.id));
      setIncoming(incRes.data.submissions || []);
      setMySubmissions(subRes.data.submissions || []);
      setUsers(usersRes.data.users || []);
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

  // Extrae el ID del track de una URL de Spotify (open.spotify.com/track/XXXX)
  const extractTrackId = (url) => {
    try {
      const match = url.match(/\/track\/([a-zA-Z0-9]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  // Carga la info del track (preview de 30s + géneros) para escucharla antes
  // de aceptar. Si ya está cargada, la oculta.
  const handlePreview = async (subId) => {
    if (previewData[subId]) {
      setPreviewData((prev) => {
        const next = { ...prev };
        delete next[subId];
        return next;
      });
      return;
    }
    const sub = incoming.find((x) => x.id === subId);
    const trackId = sub && extractTrackId(sub.track_url);
    if (!trackId) {
      showError('No se pudo identificar el track de Spotify');
      return;
    }
    try {
      const res = await api.get(`/api/spotify/track/${trackId}`);
      setPreviewData((prev) => ({ ...prev, [subId]: res.data }));
    } catch (err) {
      showError(err.response?.data?.error || 'No se pudo cargar la canción para escucharla');
    }
  };

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
              pattern="https?://open\.spotify\.com/track/[a-zA-Z0-9]+(\?[a-zA-Z0-9&=._%+-]*)?"
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
                    {s.spotify_synced === 1 && (
                      <span className="badge badge-sync">♫ Agregada a Spotify</span>
                    )}
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

          {/* Bandeja de entrada: propuestas PRIMERO (más fácil de revisar) */}
          <div className="bandeja-propuestas">
            <h2>Bandeja de entrada
              {pendingIncoming > 0 && (
                <span className="badge badge-pendiente">{pendingIncoming} pendiente(s)</span>
              )}
            </h2>
            {incoming.length > 0 ? (
              <ul className="lista">
                {incoming.map((s) => (
                  <li key={s.id} className="submission-item">
                    <div className="submission-head">
                      <a href={s.track_url} target="_blank" rel="noopener noreferrer">{s.track_name || s.track_url}</a>
                      <div className="submission-dest">
                        enviada por <strong>{s.artist}</strong> → <strong>{s.playlist_name}</strong>
                      </div>
                    </div>
                    <div className="submission-actions">
                      <span className={`badge badge-${s.status}`}>{s.status}</span>
                      {s.spotify_synced === 1 && (
                        <span className="badge badge-sync">♫ Agregada a Spotify</span>
                      )}
                      <button
                        type="button"
                        className="btn-preview"
                        onClick={() => handlePreview(s.id)}
                        disabled={s.status !== 'pendiente'}
                      >
                        {previewData[s.id] ? 'Ocultar' : '▶ Escuchar'}
                      </button>
                      {s.status === 'pendiente' && (
                        <button
                          className="btn-accept"
                          onClick={() => handleAccept(s.id)}
                        >
                          ✔ Aceptar (+1 token)
                        </button>
                      )}
                    </div>
                    {previewData[s.id] && (
                      <div className="track-preview">
                        {previewData[s.id].image && (
                          <img
                            src={previewData[s.id].image}
                            alt={previewData[s.id].name}
                            className="track-preview-img"
                          />
                        )}
                        <div className="track-preview-info">
                          <div className="track-preview-title">
                            {previewData[s.id].name} · {previewData[s.id].artists.join(', ')}
                          </div>
                          {previewData[s.id].genres.length > 0 && (
                            <div className="genre-list">
                              {previewData[s.id].genres.slice(0, 5).map((g) => (
                                <span className="badge badge-genre" key={g}>{g}</span>
                              ))}
                            </div>
                          )}
                          {previewData[s.id].preview_url ? (
                            <audio
                              controls
                              src={previewData[s.id].preview_url}
                              className="track-audio"
                            >
                              Tu navegador no puede reproducir el audio.
                            </audio>
                          ) : (
                            <p className="no-items">
                              Este track no tiene preview de 30 s disponible.
                            </p>
                          )}
                        </div>
                      </div>
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
              pattern="https?://open\.spotify\.com/playlist/[a-zA-Z0-9]+(\?[a-zA-Z0-9&=._%+-]*)?"
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
          <div className="admin-users">
            <h3>Usuarios registrados ({users.length})</h3>
            {users.length > 0 ? (
              <table className="tabla-admin">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge badge-${u.role === 'administrador' ? 'administrador' : 'usuario'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>{u.tokens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-items">No hay usuarios registrados.</p>
            )}
          </div>
        </section>
      )}

      </main>

      {toast && (
        <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
          <span className="toast-icon">{toast.type === 'success' ? '✓' : '⚠'}</span>
          <div className="toast-body">
            <strong>{toast.type === 'success' ? '¡Listo!' : 'Error'}</strong>
            <p>{toast.text}</p>
          </div>
          <span className="toast-timer" />
        </div>
      )}

      <footer className="footer">
        OverDrive · Plataforma de curaduría musical · {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default Dashboard;