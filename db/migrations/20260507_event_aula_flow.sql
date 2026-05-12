USE sistematesis;

ALTER TABLE `usuarios`
  ADD COLUMN IF NOT EXISTS `Semestre` tinyint(2) DEFAULT NULL AFTER `Rol`;

ALTER TABLE `proyectos`
  ADD COLUMN IF NOT EXISTS `FechaExposicion` date DEFAULT NULL AFTER `ProfesorID`,
  ADD COLUMN IF NOT EXISTS `HoraExposicion` time DEFAULT NULL AFTER `FechaExposicion`,
  ADD COLUMN IF NOT EXISTS `Sala` varchar(100) DEFAULT NULL AFTER `HoraExposicion`;

UPDATE `usuarios`
SET `Semestre` = 1
WHERE `Rol` = 'Alumno'
  AND `Semestre` IS NULL;

CREATE TABLE IF NOT EXISTS `especialidades` (
  `EspecialidadID` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(120) NOT NULL,
  `Descripcion` text DEFAULT NULL,
  PRIMARY KEY (`EspecialidadID`),
  UNIQUE KEY `uq_especialidades_nombre` (`Nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `especialidades` (`EspecialidadID`, `Nombre`, `Descripcion`) VALUES
  (1, 'Inteligencia artificial', 'IA, analitica de datos y automatizacion'),
  (2, 'Desarrollo de software', 'Arquitectura, frontend, backend y pruebas'),
  (3, 'Gestion de proyectos', 'Planeacion, alcance, seguimiento y presentacion');

CREATE TABLE IF NOT EXISTS `profesorespecialidad` (
  `ProfesorEspecialidadID` int(11) NOT NULL AUTO_INCREMENT,
  `ProfesorID` int(11) NOT NULL,
  `EspecialidadID` int(11) NOT NULL,
  `Departamento` varchar(120) DEFAULT NULL,
  PRIMARY KEY (`ProfesorEspecialidadID`),
  UNIQUE KEY `uq_profesor_especialidad` (`ProfesorID`, `EspecialidadID`),
  KEY `idx_pe_profesor` (`ProfesorID`),
  KEY `idx_pe_especialidad` (`EspecialidadID`),
  CONSTRAINT `fk_pe_profesor`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pe_especialidad`
    FOREIGN KEY (`EspecialidadID`) REFERENCES `especialidades` (`EspecialidadID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `profesorespecialidad` (`ProfesorID`, `EspecialidadID`, `Departamento`) VALUES
  (2, 1, 'Ingenieria en Sistemas'),
  (2, 2, 'Ingenieria en Sistemas'),
  (5, 2, 'Tecnologias de Informacion'),
  (5, 3, 'Gestion Academica');

ALTER TABLE `eventoproyectos`
  ADD COLUMN IF NOT EXISTS `HorarioID` int(11) DEFAULT NULL AFTER `ProyectoID`;

CREATE UNIQUE INDEX IF NOT EXISTS `uq_ep_horario_unico`
  ON `eventoproyectos` (`HorarioID`);

CREATE INDEX IF NOT EXISTS `idx_ep_evento_estado_horario`
  ON `eventoproyectos` (`EventoID`, `Estado`, `HorarioID`);

CREATE INDEX IF NOT EXISTS `idx_horario_evento_aula_disponible`
  ON `horariosevento` (`EventoID`, `AulaID`, `Disponible`);

CREATE TABLE IF NOT EXISTS `evaluadoresaula` (
  `EvaluadorAulaID` int(11) NOT NULL AUTO_INCREMENT,
  `EventoID` int(11) NOT NULL,
  `AulaID` int(11) NOT NULL,
  `ProfesorID` int(11) NOT NULL,
  `EsModeradorExterno` tinyint(1) NOT NULL DEFAULT 0,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`EvaluadorAulaID`),
  UNIQUE KEY `uq_eval_aula_profesor` (`EventoID`, `AulaID`, `ProfesorID`),
  KEY `idx_eval_aula_evento` (`EventoID`, `AulaID`),
  KEY `idx_eval_aula_profesor` (`ProfesorID`),
  CONSTRAINT `fk_eval_aula_evento`
    FOREIGN KEY (`EventoID`) REFERENCES `eventos` (`EventoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_aula_aula`
    FOREIGN KEY (`AulaID`) REFERENCES `aulas` (`AulaID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_aula_profesor`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS `moderadoresaula` (
  `ModeradorID` int(11) NOT NULL AUTO_INCREMENT,
  `EventoID` int(11) NOT NULL,
  `AulaID` int(11) NOT NULL,
  `AlumnoID` int(11) NOT NULL,
  `Estado` enum('pendiente','aceptado','rechazado') NOT NULL DEFAULT 'pendiente',
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`ModeradorID`),
  UNIQUE KEY `uq_moderador_postulacion` (`EventoID`, `AulaID`, `AlumnoID`),
  KEY `idx_moderador_evento_aula_estado` (`EventoID`, `AulaID`, `Estado`),
  KEY `idx_moderador_alumno` (`AlumnoID`),
  CONSTRAINT `fk_mod_evento`
    FOREIGN KEY (`EventoID`) REFERENCES `eventos` (`EventoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_mod_aula`
    FOREIGN KEY (`AulaID`) REFERENCES `aulas` (`AulaID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_mod_alumno`
    FOREIGN KEY (`AlumnoID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS `evaluacionesevento` (
  `EvalEventoID` int(11) NOT NULL AUTO_INCREMENT,
  `EventoID` int(11) NOT NULL,
  `ProyectoID` int(11) NOT NULL,
  `ProfesorID` int(11) NOT NULL,
  `RubricaID` int(11) NOT NULL,
  `PuntajeTotal` decimal(7,2) NOT NULL DEFAULT 0,
  `Comentario` text DEFAULT NULL,
  `Fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`EvalEventoID`),
  UNIQUE KEY `uq_eval_evento_profesor_proyecto` (`EventoID`, `ProyectoID`, `ProfesorID`),
  KEY `idx_eval_evento_evento` (`EventoID`),
  KEY `idx_eval_evento_proyecto` (`ProyectoID`),
  KEY `idx_eval_evento_profesor` (`ProfesorID`),
  KEY `idx_eval_evento_rubrica` (`RubricaID`),
  CONSTRAINT `fk_eval_evento_evento`
    FOREIGN KEY (`EventoID`) REFERENCES `eventos` (`EventoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_evento_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_evento_profesor`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_evento_rubrica`
    FOREIGN KEY (`RubricaID`) REFERENCES `rubricas` (`RubricaID`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS `resultadosevento` (
  `ResultadoID` int(11) NOT NULL AUTO_INCREMENT,
  `EventoID` int(11) NOT NULL,
  `ProyectoID` int(11) NOT NULL,
  `PromedioFinal` decimal(5,2) NOT NULL DEFAULT 0,
  `Posicion` int(11) NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`ResultadoID`),
  UNIQUE KEY `uq_resultado_evento_proyecto` (`EventoID`, `ProyectoID`),
  KEY `idx_resultado_evento_posicion` (`EventoID`, `Posicion`),
  KEY `idx_resultado_proyecto` (`ProyectoID`),
  CONSTRAINT `fk_resultado_evento`
    FOREIGN KEY (`EventoID`) REFERENCES `eventos` (`EventoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_resultado_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
