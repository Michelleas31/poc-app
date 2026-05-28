-- Compatibilidad para bases existentes creadas antes del flujo de aulas/moderadores.

ALTER TABLE moderadoresaula
  ADD COLUMN IF NOT EXISTS AlumnoID int(11) NULL AFTER AulaID,
  ADD COLUMN IF NOT EXISTS Estado enum('pendiente','aceptado','rechazado') NOT NULL DEFAULT 'pendiente' AFTER AlumnoID;

UPDATE moderadoresaula
SET AlumnoID = COALESCE(AlumnoID, ProfesorID)
WHERE AlumnoID IS NULL;

ALTER TABLE moderadoresaula
  MODIFY AlumnoID int(11) NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_moderador_postulacion
  ON moderadoresaula (EventoID, AulaID, AlumnoID);

CREATE INDEX IF NOT EXISTS idx_moderador_evento_aula_estado
  ON moderadoresaula (EventoID, AulaID, Estado);

CREATE INDEX IF NOT EXISTS idx_moderador_alumno
  ON moderadoresaula (AlumnoID);
