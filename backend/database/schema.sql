CREATE DATABASE IF NOT EXISTS overdrive CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE overdrive;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('usuario','administrador') NOT NULL DEFAULT 'usuario',
  tokens SMALLINT UNSIGNED NOT NULL DEFAULT 3,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_code VARCHAR(6) NULL,
  spotify_access_token VARCHAR(500) NULL,
  spotify_refresh_token VARCHAR(500) NULL,
  spotify_connected_at TIMESTAMP NULL,
  spotify_user_id VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_tokens_max CHECK (tokens <= 10),
  CONSTRAINT uq_users_spotify_id UNIQUE (spotify_user_id),
  INDEX idx_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS playlists (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  spotify_id VARCHAR(80) NOT NULL,
  name VARCHAR(200) NOT NULL,
  followers INT UNSIGNED NOT NULL DEFAULT 0,
  spotify_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_playlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_playlist_user_spotify UNIQUE (user_id, spotify_id),
  INDEX idx_playlists_spotify (spotify_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS submissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  artist_id INT UNSIGNED NOT NULL,
  playlist_id INT UNSIGNED NOT NULL,
  track_url VARCHAR(500) NOT NULL,
  track_name VARCHAR(200),
  comment VARCHAR(500) NULL,
  status ENUM('pendiente','aprobada','rechazada','cancelada') NOT NULL DEFAULT 'pendiente',
  token_cost SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  handled_by INT UNSIGNED NULL,
  spotify_synced TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_submissions_artist FOREIGN KEY (artist_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_playlist FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_handled FOREIGN KEY (handled_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_submissions_status (status)
) ENGINE=InnoDB;

INSERT INTO users (username, email, password_hash, role, tokens, email_verified)
SELECT 'admin', 'admin@overdrive.app', '$2a$12$xawFLNM.Dd6VOolicX/dCuO0A1Fz/3bCRQIit/87/foPZgU1pbxwi', 'administrador', 10, 1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@overdrive.app');