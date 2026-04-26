-- ✅ MIGRACIÓN v1.1 — 2026-04-26
-- Propósito : crear la tabla ProyectoDocumentos que faltaba en el esquema
--             original (database.sql no la incluía, causando error en todos
--             los endpoints de documentos).
-- Ejecutar  : mysql -u root -p sistematesis < migracion_documentos_revision.sql
-- Seguro    : usa IF NOT EXISTS / IF EXISTS para ser idempotente.

USE sistematesis;

-- ─────────────────────────────────────────────────────────────
-- TABLA: ProyectoDocumentos
-- Almacena los archivos subidos por alumnos y admins como BLOB.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ProyectoDocumentos` (
  `DocumentoID`   int(11)       NOT NULL AUTO_INCREMENT,
  `ProyectoID`    int(11)       NOT NULL,
  `NombreArchivo` varchar(255)  NOT NULL,
  `MimeType`      varchar(100)  DEFAULT NULL,
  `TamanoBytes`   bigint(20)    DEFAULT NULL,
  `Contenido`     longblob      NOT NULL,
  `Descripcion`   text          DEFAULT NULL,
  `SubidoPorID`   int(11)       DEFAULT NULL,
  `CreatedAt`     datetime      NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`DocumentoID`),
  KEY `idx_proydoc_proyecto` (`ProyectoID`),
  KEY `fk_proydoc_subido`    (`SubidoPorID`),
  CONSTRAINT `fk_proydoc_proyecto`
    FOREIGN KEY (`ProyectoID`)  REFERENCES `proyectos` (`ProyectoID`) ON DELETE CASCADE,
  CONSTRAINT `fk_proydoc_subido`
    FOREIGN KEY (`SubidoPorID`) REFERENCES `usuarios`  (`UsuarioID`)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- ─────────────────────────────────────────────────────────────
-- VERIFICACIÓN: la tabla Proyectos ya tiene las columnas de
-- revisión desde el esquema original. Las líneas siguientes
-- sólo las agregan si por alguna razón no existen (instalación
-- muy antigua). MariaDB >= 10.3 soporta ADD COLUMN IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'proyectos'
    AND COLUMN_NAME  = 'EstadoAprobacion'
);

-- Solo ejecuta el ALTER si la columna NO existe
SET @sql = IF(
  @col_exists = 0,
  "ALTER TABLE proyectos
     ADD COLUMN EstadoAprobacion   ENUM('pendiente','aceptado','rechazado') NOT NULL DEFAULT 'pendiente' AFTER Progreso,
     ADD COLUMN ComentarioRevision TEXT    DEFAULT NULL AFTER EstadoAprobacion,
     ADD COLUMN FechaRevision      DATETIME DEFAULT NULL AFTER ComentarioRevision",
  "SELECT 'columnas ya existen, nada que hacer' AS info"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
