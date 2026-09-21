-- ============================================================
-- OverDrive - Esquema de Base de Datos (MariaDB/MySQL)
-- Economía circular para músicos independientes
-- ============================================================

CREATE DATABASE IF NOT EXISTS overdrive
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE overdrive;

-- ============================================================
-- Tabla: USERS
-- Wallet Cap: máx 10 tokens | Bono inicial: 3 tokens
-- role: ENUM con 'usuario' y 'administrador'
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('usuario','administrador') NOT NULL DEFAULT 'usuario',
  tokens        SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  -- Tokens de conexión OAuth con Spotify (Modo Curador)
  spotify_access_token  VARCHAR(500) NULL,
  spotify_refresh_token VARCHAR(500) NULL,
  spotify_connected_at  TIMESTAMP NULL,
  -- Identidad de la cuenta de Spotify vinculada (/v1/me). Evita que una
  -- misma cuenta de Spotify se vincule a dos cuentas de OverDrive.
  spotify_user_id       VARCHAR(80)  NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Restricción del tope de billetera (Wallet Cap): máx 10 tokens
  CONSTRAINT chk_tokens_max CHECK (tokens <= 10),
  -- Una cuenta de Spotify solo puede estar vinculada a un usuario
  CONSTRAINT uq_users_spotify_id UNIQUE (spotify_user_id)
) ENGINE=InnoDB;

-- ============================================================
-- Tabla: PLAYLISTS
-- Regula la información de cada playlist (curador)
-- ============================================================
CREATE TABLE IF NOT EXISTS playlists (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL,
  spotify_id     VARCHAR(80)  NOT NULL,
  name           VARCHAR(200) NOT NULL,
  followers      INT UNSIGNED NOT NULL DEFAULT 0,
  spotify_url    VARCHAR(500) NOT NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_playlists_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_playlist_user_spotify UNIQUE (user_id, spotify_id)
) ENGINE=InnoDB;

-- ============================================================
-- Tabla: SUBMISSIONS
-- Registra el envío de propuestas musicales
-- status: ENUM pendiente/aprobada/rechazada
-- ============================================================
CREATE TABLE IF NOT EXISTS submissions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  artist_id     INT UNSIGNED NOT NULL,
  playlist_id   INT UNSIGNED NOT NULL,
  track_url     VARCHAR(500) NOT NULL,
  track_name    VARCHAR(200),
  status        ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  token_cost    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  handled_by    INT UNSIGNED NULL,
  -- 1 = la canción fue agregada a la playlist real de Spotify al aceptar
  spotify_synced TINYINT(1) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_submissions_artist   FOREIGN KEY (artist_id)
    REFERENCES users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_submissions_playlist FOREIGN KEY (playlist_id)
    REFERENCES playlists(id)    ON DELETE CASCADE,
  CONSTRAINT fk_submissions_handled FOREIGN KEY (handled_by)
    REFERENCES users(id)        ON DELETE SET NULL,
  -- Integridad: impedir envíos duplicados del mismo track a la misma playlist
  CONSTRAINT uq_track_playlist UNIQUE (track_url, playlist_id)
) ENGINE=InnoDB;

-- Índices para búsquedas frecuentes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_playlists_spotify ON playlists(spotify_id);

-- ============================================================
-- Usuario administrador por defecto
-- La contraseña se genera aleatoriamente por despliegue (ver el script de
-- provisión / docs locales). No es un secreto público.
-- ============================================================
INSERT INTO users (username, email, password_hash, role, tokens)
SELECT 'admin', 'admin@overdrive.app', '$2a$12$xawFLNM.Dd6VOolicX/dCuO0A1Fz/3bCRQIit/87/foPZgU1pbxwi', 'administrador', 10
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@overdrive.app');
