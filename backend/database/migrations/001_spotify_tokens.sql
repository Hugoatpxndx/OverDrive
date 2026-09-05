-- ============================================================
-- Migración 001: Integración con Spotify API
-- Añade columnas para guardar los tokens OAuth del Curador.
--
-- IMPORTANTE: ejecuta este archivo ÚNICAMENTE si ya tenías la BD
-- creada con el schema.sql anterior (tabla users existe sin columnas Spotify).
--   sudo mariadb -u root < backend/database/migrations/001_spotify_tokens.sql
-- ============================================================

USE overdrive;

ALTER TABLE users
  ADD COLUMN spotify_access_token  VARCHAR(500) NULL AFTER tokens,
  ADD COLUMN spotify_refresh_token VARCHAR(500) NULL AFTER spotify_access_token,
  ADD COLUMN spotify_connected_at  TIMESTAMP NULL AFTER spotify_refresh_token;