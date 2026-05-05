-- ProjectManager frontend/flow compatibility migration
-- MariaDB safe additions only; does not drop or rename existing data.

ALTER TABLE `proyectos`
  ADD COLUMN IF NOT EXISTS `Categoria` varchar(100) DEFAULT NULL AFTER `Descripcion`;

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
  KEY `idx_qr_sessions_profesor` (`ProfesorID`),
  CONSTRAINT `fk_qrs_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_qrs_eventoproyecto`
    FOREIGN KEY (`EventoProyectoID`) REFERENCES `eventoproyectos` (`EventoProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_qrs_alumno`
    FOREIGN KEY (`AlumnoID`) REFERENCES `usuarios` (`UsuarioID`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_qrs_profesor`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
