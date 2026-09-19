-- ============================================================
-- OverDrive - Migración 003: Sincronización real con Spotify
-- Registra en cada propuesta aceptada si la canción fue agregada
-- a la playlist real de Spotify del curador.
-- ============================================================
USE overdrive;

ALTER TABLE submissions
  ADD COLUMN spotify_synced TINYINT(1) NOT NULL DEFAULT 0 AFTER handled_by;