// ============================================================
// Configuración y servicios para la API de Spotify (OAuth 2.0)
// Permite que el Curador conecte su cuenta y traiga sus playlists
// ============================================================
const axios = require('axios');
const https = require('https');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:4000/api/spotify/callback';

const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';

const REQUEST_TIMEOUT = Number(process.env.SPOTIFY_REQUEST_TIMEOUT || 15000);

// Permisos mínimos: leer las playlists propias (públicas y privadas)
const SCOPES = ['playlist-read-private', 'playlist-read-collaborative'].join(' ');

// Forza IPv4 (evita demoras de ENETUNREACH por IPv6 en redes con hipos)
const defaultConfig = {
  timeout: REQUEST_TIMEOUT,
  httpsAgent: new https.Agent({ family: 4 })
};

// Indica si el error es transitorio y se puede reintentar:
// sin respuesta (timeout/reset de red) o errores 429/5xx.
const isRetryable = (err) => {
  if (!err.response) return true;
  const status = err.response.status;
  return status === 429 || status >= 500;
};

// Reintenta una llamada ante errores transitorios de red (con backoff).
const withRetry = async (fn, attempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err)) throw err;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  throw lastError;
};

// Construye la URL de autorización de Spotify con el state de la petición
const buildAuthUrl = (state) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
    show_dialog: true
  });
  return `${AUTH_URL}?${params.toString()}`;
};

// Intercambia el code de autorización por tokens de acceso (access + refresh)
const exchangeCode = async (code) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI
  });
  const resp = await withRetry(() =>
    axios.post(TOKEN_URL, body.toString(), {
      ...defaultConfig,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
      }
    }), 2
  );
  return resp.data;
};

// Renueva el access token usando el refresh token
const refreshAccessToken = async (refreshToken) => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  const resp = await withRetry(() =>
    axios.post(TOKEN_URL, body.toString(), {
      ...defaultConfig,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
      }
    }), 2
  );
  return resp.data;
};

// Obtiene las playlists del usuario autenticado en Spotify.
// Nota: la respuesta de /me/playlists NO incluye el campo followers,
// por lo que hay que consultar cada playlist por separado.
const getMyPlaylists = async (accessToken) => {
  const resp = await withRetry(() =>
    axios.get(`${API_URL}/me/playlists`, {
      ...defaultConfig,
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { limit: 50 }
    })
  );
  return resp.data.items;
};

// Obtiene los seguidores reales de una playlist concreta
const getPlaylistFollowers = async (accessToken, playlistId) => {
  const resp = await withRetry(() =>
    axios.get(`${API_URL}/playlists/${playlistId}`, {
      ...defaultConfig,
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { fields: 'followers' }
    }), 2
  );
  return resp.data.followers?.total || 0;
};

module.exports = {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getMyPlaylists,
  getPlaylistFollowers
};