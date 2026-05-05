-- Migracion idempotente para flujo UI/UX ProjectManager
-- Compatible con MariaDB. No elimina tablas ni columnas existentes.

ALTER TABLE `proyectos`
  ADD COLUMN IF NOT EXISTS `Categoria` varchar(100) DEFAULT NULL AFTER `Descripcion`;

ALTER TABLE `proyectos`
  ADD COLUMN IF NOT EXISTS `EstadoAprobacion` enum('pendiente','aceptado','rechazado') NOT NULL DEFAULT 'pendiente' AFTER `Estatus`;

ALTER TABLE `proyectos`
  ADD COLUMN IF NOT EXISTS `ComentarioRevision` text DEFAULT NULL AFTER `EstadoAprobacion`;

ALTER TABLE `proyectos`
  ADD COLUMN IF NOT EXISTS `FechaRevision` datetime DEFAULT NULL AFTER `ComentarioRevision`;

ALTER TABLE `eventos`
  ADD COLUMN IF NOT EXISTS `RubricaID` int(11) DEFAULT NULL;

ALTER TABLE `eventoproyectos`
  ADD COLUMN IF NOT EXISTS `DisponibilidadID` int(11) DEFAULT NULL AFTER `HorarioID`;

ALTER TABLE `eventoproyectos`
  ADD COLUMN IF NOT EXISTS `ProfesorID` int(11) DEFAULT NULL AFTER `DisponibilidadID`;

ALTER TABLE `eventoproyectos`
  ADD COLUMN IF NOT EXISTS `FechaEvaluacion` date DEFAULT NULL AFTER `ProfesorID`;

ALTER TABLE `eventoproyectos`
  ADD COLUMN IF NOT EXISTS `HoraInicio` time DEFAULT NULL AFTER `FechaEvaluacion`;

ALTER TABLE `eventoproyectos`
  ADD COLUMN IF NOT EXISTS `HoraFin` time DEFAULT NULL AFTER `HoraInicio`;

ALTER TABLE `eventoproyectos`
  ADD COLUMN IF NOT EXISTS `Sala` varchar(100) DEFAULT NULL AFTER `HoraFin`;

ALTER TABLE `eventoproyectos`
  ADD COLUMN IF NOT EXISTS `ComentarioAdmin` text DEFAULT NULL AFTER `Estado`;

ALTER TABLE `eventoproyectos`
  ADD COLUMN IF NOT EXISTS `FechaRevision` datetime DEFAULT NULL AFTER `ComentarioAdmin`;

ALTER TABLE `eventoproyectos`
  ADD COLUMN IF NOT EXISTS `TokenQR` varchar(255) DEFAULT NULL AFTER `QRCode`;

ALTER TABLE `evaluaciones`
  MODIFY COLUMN `EntregaID` int(11) DEFAULT NULL;

ALTER TABLE `evaluaciones`
  MODIFY COLUMN `AlumnoID` int(11) DEFAULT NULL;

ALTER TABLE `evaluaciones`
  ADD COLUMN IF NOT EXISTS `ProyectoID` int(11) DEFAULT NULL AFTER `EntregaID`;

ALTER TABLE `evaluaciones`
  ADD COLUMN IF NOT EXISTS `EventoProyectoID` int(11) DEFAULT NULL AFTER `ProyectoID`;

ALTER TABLE `evaluaciones`
  ADD COLUMN IF NOT EXISTS `PuntajeMaximo` int(11) NOT NULL DEFAULT 0 AFTER `PuntajeTotal`;

ALTER TABLE `evaluaciones`
  ADD COLUMN IF NOT EXISTS `Porcentaje` decimal(5,2) DEFAULT NULL AFTER `PuntajeMaximo`;

ALTER TABLE `evaluaciones`
  ADD COLUMN IF NOT EXISTS `ComentarioGeneral` text DEFAULT NULL AFTER `Porcentaje`;

ALTER TABLE `evaluaciondetalle`
  ADD COLUMN IF NOT EXISTS `NivelID` int(11) DEFAULT NULL AFTER `CriterioID`;

CREATE TABLE IF NOT EXISTS `qr_sessions` (
  `QRSessionID`      int(11) NOT NULL AUTO_INCREMENT,
  `Token`            varchar(32) NOT NULL,
  `ProyectoID`       int(11) NOT NULL,
  `EventoProyectoID` int(11) NOT NULL,
  `AlumnoID`         int(11) NOT NULL,
  `CreatedAt`        datetime NOT NULL DEFAULT current_timestamp(),
  `ExpiresAt`        datetime NOT NULL,
  `UsedAt`           datetime DEFAULT NULL,
  `ProfesorID`       int(11) DEFAULT NULL,
  PRIMARY KEY (`QRSessionID`),
  UNIQUE KEY `uq_qr_sessions_token` (`Token`),
  KEY `idx_qr_sessions_token` (`Token`),
  KEY `idx_qr_sessions_expires` (`ExpiresAt`),
  KEY `idx_qr_sessions_proyecto` (`ProyectoID`),
  KEY `idx_qr_sessions_eventoproyecto` (`EventoProyectoID`),
  KEY `idx_qr_sessions_alumno` (`AlumnoID`),
  KEY `idx_qr_sessions_profesor` (`ProfesorID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

UPDATE `eventos`
SET `RubricaID` = 1
WHERE `RubricaID` IS NULL
  AND EXISTS (SELECT 1 FROM `rubricas` WHERE `RubricaID` = 1);
