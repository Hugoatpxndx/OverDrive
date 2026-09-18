-- ============================================================
-- Migración 002: Identidad de la cuenta de Spotify vinculada
-- Añade spotify_user_id (id de /v1/me) para impedir que la misma
-- cuenta de Spotify se vincule a dos cuentas de OverDrive.
--
-- IMPORTANTE: para Bases de Datos ya existentes (creadas con un
-- schema anterior a esta columna):
--   sudo mariadb -u root < backend/database/migrations/002_spotify_identity.sql
-- ============================================================

USE overdrive;

ALTER TABLE users
  ADD COLUMN spotify_user_id VARCHAR(80) NULL AFTER spotify_connected_at;

ALTER TABLE users
  ADD UNIQUE KEY uq_users_spotify_id (spotify_user_id);