-- Migración 005: agregar comment, permitir reenvíos y cancelación
-- Ejecutar solo en BD existentes (el schema.sql ya incluye estos cambios)

-- Agregar columna comment
ALTER TABLE submissions ADD COLUMN comment VARCHAR(500) NULL AFTER track_name;

-- Quitar constraint UNIQUE que impedía reenvíos
ALTER TABLE submissions DROP CONSTRAINT uq_track_playlist;

-- Agregar estado 'cancelada' al ENUM
ALTER TABLE submissions MODIFY COLUMN status ENUM('pendiente','aprobada','rechazada','cancelada') NOT NULL DEFAULT 'pendiente';
