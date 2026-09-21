-- ============================================================
-- Migración 004 · Verificación de email
--
-- Añade el control de verificación de correo (email_verified) y el
-- código de 6 dígitos (simula el correo que se enviaría por SMTP).
--
-- Backfill: las cuentas creadas ANTES de esta migración se consideran
-- verificadas para no romper los flujos de cuentas demo existentes.
-- ============================================================

ALTER TABLE users
  ADD COLUMN email_verified    TINYINT(1) NOT NULL DEFAULT 0 AFTER tokens,
  ADD COLUMN verification_code VARCHAR(6)  NULL AFTER email_verified;

-- Las cuentas preexistentes ya estaban en uso; dejarlas verificadas.
UPDATE users SET email_verified = 1 WHERE email_verified = 0;