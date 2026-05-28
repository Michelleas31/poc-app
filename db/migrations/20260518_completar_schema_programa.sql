-- Completa el esquema usado por frontend/backend sin borrar datos existentes.
-- Idempotente para MariaDB: se puede ejecutar varias veces.

-- USUARIOS / PERFIL
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS Semestre int(11) NULL AFTER Rol,
  ADD COLUMN IF NOT EXISTS Carrera varchar(150) NULL AFTER Semestre,
  ADD COLUMN IF NOT EXISTS Matricula varchar(50) NULL AFTER Carrera;

-- ENTREGAS: compatibilidad entre flujo viejo y flujo actual.
ALTER TABLE entregas
  ADD COLUMN IF NOT EXISTS ArchivoEntrega varchar(255) NULL AFTER FechaEntrega,
  ADD COLUMN IF NOT EXISTS ArchivoContenido longblob NULL AFTER ArchivoEntrega,
  ADD COLUMN IF NOT EXISTS Tipo varchar(50) NOT NULL DEFAULT 'documento' AFTER ArchivoContenido,
  ADD COLUMN IF NOT EXISTS Calificacion int(11) NULL AFTER Comentarios,
  ADD COLUMN IF NOT EXISTS HashSHA256 char(64) NULL AFTER TamanoBytes,
  ADD COLUMN IF NOT EXISTS RutaExterna varchar(500) NULL AFTER HashSHA256;

UPDATE entregas
SET ArchivoEntrega = COALESCE(ArchivoEntrega, CONCAT('entrega-', EntregaID)),
    ArchivoContenido = COALESCE(ArchivoContenido, Contenido)
WHERE ArchivoEntrega IS NULL
   OR ArchivoContenido IS NULL;

-- EVALUACIONES: columnas usadas por historiales, indicadores y flujo QR/evento.
ALTER TABLE evaluaciones
  ADD COLUMN IF NOT EXISTS EntregaID int(11) NULL AFTER EvaluacionID,
  ADD COLUMN IF NOT EXISTS EventoProyectoID int(11) NULL AFTER ProyectoID,
  ADD COLUMN IF NOT EXISTS AlumnoID int(11) NULL AFTER ProfesorID,
  ADD COLUMN IF NOT EXISTS PuntajeMax int(11) NOT NULL DEFAULT 0 AFTER PuntajeTotal,
  ADD COLUMN IF NOT EXISTS ComentarioGeneral text NULL AFTER Comentarios,
  ADD COLUMN IF NOT EXISTS Fecha datetime NOT NULL DEFAULT current_timestamp() AFTER ComentarioGeneral;

UPDATE evaluaciones
SET PuntajeMax = CASE WHEN COALESCE(PuntajeMax, 0) = 0 THEN COALESCE(PuntajeMaximo, 0) ELSE PuntajeMax END,
    ComentarioGeneral = COALESCE(ComentarioGeneral, Comentarios),
    Fecha = COALESCE(Fecha, CreatedAt);

UPDATE evaluaciones ev
JOIN proyectos p ON p.ProyectoID = ev.ProyectoID
SET ev.AlumnoID = COALESCE(ev.AlumnoID, p.AlumnoID)
WHERE ev.AlumnoID IS NULL;

-- HISTORIAL DE DESEMPENO: compatibilidad entre columnas nuevas y legacy.
ALTER TABLE historial_desempeno
  ADD COLUMN IF NOT EXISTS EvaluacionID int(11) NULL AFTER EventoID,
  ADD COLUMN IF NOT EXISTS PuntajeObtenido int(11) NOT NULL DEFAULT 0 AFTER EvaluacionID,
  ADD COLUMN IF NOT EXISTS PuntajeMaximo int(11) NOT NULL DEFAULT 0 AFTER PuntajeObtenido,
  ADD COLUMN IF NOT EXISTS Porcentaje decimal(5,2) NULL AFTER PuntajeTotal,
  ADD COLUMN IF NOT EXISTS Observaciones text NULL AFTER Estado,
  ADD COLUMN IF NOT EXISTS FechaRegistro datetime NOT NULL DEFAULT current_timestamp() AFTER Observaciones;

UPDATE historial_desempeno
SET PuntajeObtenido = CASE WHEN COALESCE(PuntajeObtenido, 0) = 0 THEN COALESCE(PuntajeTotal, 0) ELSE PuntajeObtenido END,
    Porcentaje = COALESCE(Porcentaje, PuntajeTotal),
    FechaRegistro = COALESCE(FechaRegistro, FechaEval);

-- ESPECIALIDADES DE PROFESORES, requeridas por asignacion de evaluadores.
CREATE TABLE IF NOT EXISTS especialidades (
  EspecialidadID int(11) NOT NULL AUTO_INCREMENT,
  Nombre varchar(120) NOT NULL,
  CreatedAt datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (EspecialidadID),
  UNIQUE KEY uq_especialidades_nombre (Nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS profesorespecialidad (
  ProfesorEspecialidadID int(11) NOT NULL AUTO_INCREMENT,
  ProfesorID int(11) NOT NULL,
  EspecialidadID int(11) NULL,
  Departamento varchar(120) NULL,
  CreatedAt datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (ProfesorEspecialidadID),
  UNIQUE KEY uq_profesor_especialidad (ProfesorID, EspecialidadID, Departamento),
  KEY idx_profesp_profesor (ProfesorID),
  KEY idx_profesp_especialidad (EspecialidadID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO especialidades (EspecialidadID, Nombre) VALUES
  (1, 'Software'),
  (2, 'Base de datos'),
  (3, 'Inteligencia artificial'),
  (4, 'Sustentabilidad'),
  (5, 'Gestion de proyectos');

INSERT IGNORE INTO profesorespecialidad (ProfesorID, EspecialidadID, Departamento)
SELECT UsuarioID, 1, 'Sistemas'
FROM usuarios
WHERE Rol = 'Profesor';

-- MODERADORES: completa tablas antiguas que fueron creadas con ProfesorID.
ALTER TABLE evaluadoresaula
  ADD COLUMN IF NOT EXISTS EsModeradorExterno tinyint(1) NOT NULL DEFAULT 0 AFTER ProfesorID;

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

-- EVALUACIONES DE EVENTO / RESULTADOS: aliases de compatibilidad.
ALTER TABLE evaluacionesevento
  ADD COLUMN IF NOT EXISTS RubricaID int(11) NULL AFTER ProfesorID,
  ADD COLUMN IF NOT EXISTS Comentario text NULL AFTER Comentarios,
  ADD COLUMN IF NOT EXISTS Fecha datetime NOT NULL DEFAULT current_timestamp() AFTER FechaEvaluacion;

UPDATE evaluacionesevento
SET Comentario = COALESCE(Comentario, Comentarios),
    Fecha = COALESCE(Fecha, FechaEvaluacion);

ALTER TABLE resultadosevento
  ADD COLUMN IF NOT EXISTS PromedioFinal decimal(5,2) NOT NULL DEFAULT 0 AFTER ProyectoID;

UPDATE resultadosevento
SET PromedioFinal = CASE
  WHEN COALESCE(PromedioFinal, 0) = 0 THEN COALESCE(Porcentaje, PuntajeTotal, 0)
  ELSE PromedioFinal
END;

-- QR sessions para compatibilidad con versiones que usan tokens temporales.
CREATE TABLE IF NOT EXISTS qr_sessions (
  QRSessionID int(11) NOT NULL AUTO_INCREMENT,
  Token varchar(64) NOT NULL,
  ProyectoID int(11) NOT NULL,
  EventoProyectoID int(11) NOT NULL,
  AlumnoID int(11) NOT NULL,
  CreatedAt datetime NOT NULL DEFAULT current_timestamp(),
  ExpiresAt datetime NULL,
  UsedAt datetime NULL,
  ProfesorID int(11) NULL,
  PRIMARY KEY (QRSessionID),
  UNIQUE KEY uq_qr_sessions_token (Token),
  KEY idx_qr_sessions_token (Token),
  KEY idx_qr_sessions_expires (ExpiresAt),
  KEY idx_qr_sessions_proyecto (ProyectoID),
  KEY idx_qr_sessions_eventoproyecto (EventoProyectoID),
  KEY idx_qr_sessions_alumno (AlumnoID),
  KEY idx_qr_sessions_profesor (ProfesorID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Indices de uso frecuente. No fuerzan datos nuevos.
CREATE INDEX IF NOT EXISTS idx_eventoproyectos_evento_estado
  ON eventoproyectos (EventoID, Estado);

CREATE INDEX IF NOT EXISTS idx_eventoproyectos_proyecto_estado
  ON eventoproyectos (ProyectoID, Estado);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_proyecto
  ON evaluaciones (ProyectoID);

CREATE INDEX IF NOT EXISTS idx_evaluaciones_eventoproyecto
  ON evaluaciones (EventoProyectoID);

CREATE INDEX IF NOT EXISTS idx_historial_proyecto
  ON historial_desempeno (ProyectoID);
