-- --------------------------------------------------------
-- Host:                         localhost
-- Versión del servidor:         11.7.2-MariaDB - mariadb.org binary distribution
-- SO del servidor:              Win64
-- HeidiSQL Versión:             12.10.0.7000
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Volcando estructura de base de datos para sistematesis
CREATE DATABASE IF NOT EXISTS `sistematesis` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci */;
USE `sistematesis`;

-- Volcando estructura para tabla sistematesis.auditlog
CREATE TABLE IF NOT EXISTS `auditlog` (
  `LogID` int(11) NOT NULL AUTO_INCREMENT,
  `UsuarioID` int(11) DEFAULT NULL,
  `Accion` varchar(100) NOT NULL,
  `Entidad` varchar(80) NOT NULL,
  `EntidadID` int(11) DEFAULT NULL,
  `Detalle` text DEFAULT NULL,
  `Fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `Equipo` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`LogID`),
  KEY `fk_log_usuario` (`UsuarioID`),
  KEY `idx_audit_entidad_fecha` (`Entidad`,`Fecha`),
  CONSTRAINT `fk_log_usuario` FOREIGN KEY (`UsuarioID`) REFERENCES `usuarios` (`UsuarioID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.auditlog: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.aulas
CREATE TABLE IF NOT EXISTS `aulas` (
  `AulaID` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Capacidad` int(11) DEFAULT NULL,
  PRIMARY KEY (`AulaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.aulas: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.citas
CREATE TABLE IF NOT EXISTS `citas` (
  `CitaID` int(11) NOT NULL AUTO_INCREMENT,
  `ProfesorID` int(11) NOT NULL,
  `AlumnoID` int(11) NOT NULL,
  `FechaCita` datetime NOT NULL,
  `Descripcion` text NOT NULL,
  `Estado` enum('pendiente','confirmada','cancelada') NOT NULL DEFAULT 'pendiente',
  `DuracionMin` int(11) NOT NULL DEFAULT 60,
  `LinkVirtual` varchar(500) DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`CitaID`),
  KEY `idx_citas_prof_fecha` (`ProfesorID`,`FechaCita`),
  KEY `idx_citas_alum_fecha` (`AlumnoID`,`FechaCita`),
  KEY `idx_citas_estado` (`Estado`),
  CONSTRAINT `fk_citas_alumno` FOREIGN KEY (`AlumnoID`) REFERENCES `usuarios` (`UsuarioID`),
  CONSTRAINT `fk_citas_profesor` FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.citas: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.comentariosentrega
CREATE TABLE IF NOT EXISTS `comentariosentrega` (
  `ComentarioID` int(11) NOT NULL AUTO_INCREMENT,
  `EntregaID` int(11) NOT NULL,
  `AutorID` int(11) NOT NULL,
  `Texto` text NOT NULL,
  `Fecha` datetime NOT NULL DEFAULT current_timestamp(),
  `Pagina` int(11) DEFAULT NULL,
  `Anchor` varchar(200) DEFAULT NULL,
  `Resuelto` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`ComentarioID`),
  KEY `fk_coment_autor` (`AutorID`),
  KEY `idx_coment_entrega_fecha` (`EntregaID`,`Fecha`),
  CONSTRAINT `fk_coment_autor` FOREIGN KEY (`AutorID`) REFERENCES `usuarios` (`UsuarioID`),
  CONSTRAINT `fk_coment_entrega` FOREIGN KEY (`EntregaID`) REFERENCES `entregas` (`EntregaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.comentariosentrega: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.criteriosrubrica
CREATE TABLE IF NOT EXISTS `criteriosrubrica` (
  `CriterioID` int(11) NOT NULL AUTO_INCREMENT,
  `RubricaID` int(11) NOT NULL,
  `Nombre` varchar(150) NOT NULL,
  `Descripcion` text DEFAULT NULL,
  `PuntosMax` int(11) NOT NULL,
  `Orden` int(11) NOT NULL DEFAULT 1,
  PRIMARY KEY (`CriterioID`),
  KEY `fk_criterio_rubrica` (`RubricaID`),
  CONSTRAINT `fk_criterio_rubrica` FOREIGN KEY (`RubricaID`) REFERENCES `rubricas` (`RubricaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.criteriosrubrica: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.disponibilidadprofesor
CREATE TABLE IF NOT EXISTS `disponibilidadprofesor` (
  `DisponibilidadID` int(11) NOT NULL AUTO_INCREMENT,
  `ProfesorID` int(11) NOT NULL,
  `Fecha` date NOT NULL,
  `HoraInicio` time NOT NULL,
  `HoraFin` time NOT NULL,
  `Activo` tinyint(1) NOT NULL DEFAULT 1,
  `Comentario` varchar(255) DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`DisponibilidadID`),
  KEY `idx_disp_profesor_fecha` (`ProfesorID`,`Fecha`),
  CONSTRAINT `fk_disp_profesor` FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.disponibilidadprofesor: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.entregas
CREATE TABLE IF NOT EXISTS `entregas` (
  `EntregaID` int(11) NOT NULL AUTO_INCREMENT,
  `ProyectoID` int(11) NOT NULL,
  `AlumnoID` int(11) NOT NULL,
  `FechaEntrega` datetime NOT NULL,
  `ArchivoEntrega` varchar(255) NOT NULL,
  `ArchivoContenido` longblob NOT NULL,
  `Tipo` varchar(50) NOT NULL,
  `Comentarios` text DEFAULT NULL,
  `Calificacion` int(11) DEFAULT NULL,
  `NumeroVersion` int(11) NOT NULL DEFAULT 1,
  `MimeType` varchar(100) DEFAULT NULL,
  `TamañoBytes` bigint(20) DEFAULT NULL,
  `HashSHA256` char(64) DEFAULT NULL,
  `RutaExterna` varchar(500) DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`EntregaID`),
  KEY `idx_entregas_proyecto` (`ProyectoID`),
  KEY `idx_entregas_alumno` (`AlumnoID`),
  KEY `idx_entregas_fecha` (`FechaEntrega`),
  CONSTRAINT `fk_entregas_alumno` FOREIGN KEY (`AlumnoID`) REFERENCES `usuarios` (`UsuarioID`),
  CONSTRAINT `fk_entregas_proyecto` FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.entregas: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.entregaversiones
CREATE TABLE IF NOT EXISTS `entregaversiones` (
  `VersionID` int(11) NOT NULL AUTO_INCREMENT,
  `EntregaID` int(11) NOT NULL,
  `NumeroVersion` int(11) NOT NULL,
  `ArchivoEntrega` varchar(255) NOT NULL,
  `ArchivoContenido` longblob NOT NULL,
  `MimeType` varchar(100) DEFAULT NULL,
  `TamañoBytes` bigint(20) DEFAULT NULL,
  `HashSHA256` char(64) DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`VersionID`),
  UNIQUE KEY `uq_entrega_version` (`EntregaID`,`NumeroVersion`),
  CONSTRAINT `fk_version_entrega` FOREIGN KEY (`EntregaID`) REFERENCES `entregas` (`EntregaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.entregaversiones: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.especialidades
CREATE TABLE IF NOT EXISTS `especialidades` (
  `EspecialidadID` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`EspecialidadID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.especialidades: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.etapasproyecto
CREATE TABLE IF NOT EXISTS `etapasproyecto` (
  `EtapaID` int(11) NOT NULL AUTO_INCREMENT,
  `ProyectoID` int(11) NOT NULL,
  `Nombre` varchar(150) NOT NULL,
  `Descripcion` text DEFAULT NULL,
  `Orden` int(11) NOT NULL DEFAULT 1,
  `FechaInicio` date DEFAULT NULL,
  `FechaFin` date DEFAULT NULL,
  `Completada` tinyint(1) NOT NULL DEFAULT 0,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`EtapaID`),
  KEY `idx_etapas_proyecto_orden` (`ProyectoID`,`Orden`),
  CONSTRAINT `fk_etapa_proyecto` FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.etapasproyecto: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.evaluaciondetalle
CREATE TABLE IF NOT EXISTS `evaluaciondetalle` (
  `EvalDetalleID` int(11) NOT NULL AUTO_INCREMENT,
  `EvaluacionID` int(11) NOT NULL,
  `CriterioID` int(11) NOT NULL,
  `Puntaje` int(11) NOT NULL,
  `Comentario` text DEFAULT NULL,
  PRIMARY KEY (`EvalDetalleID`),
  KEY `fk_evaldetalle_eval` (`EvaluacionID`),
  KEY `fk_evaldetalle_criterio` (`CriterioID`),
  CONSTRAINT `fk_evaldetalle_criterio` FOREIGN KEY (`CriterioID`) REFERENCES `criteriosrubrica` (`CriterioID`),
  CONSTRAINT `fk_evaldetalle_eval` FOREIGN KEY (`EvaluacionID`) REFERENCES `evaluaciones` (`EvaluacionID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.evaluaciondetalle: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.evaluaciones
CREATE TABLE IF NOT EXISTS `evaluaciones` (
  `EvaluacionID` int(11) NOT NULL AUTO_INCREMENT,
  `EntregaID` int(11) NOT NULL,
  `RubricaID` int(11) NOT NULL,
  `ProfesorID` int(11) NOT NULL,
  `AlumnoID` int(11) NOT NULL,
  `PuntajeTotal` int(11) NOT NULL DEFAULT 0,
  `ComentarioGeneral` text DEFAULT NULL,
  `Fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`EvaluacionID`),
  KEY `fk_eval_entrega` (`EntregaID`),
  KEY `fk_eval_rubrica` (`RubricaID`),
  KEY `fk_eval_prof` (`ProfesorID`),
  KEY `fk_eval_alum` (`AlumnoID`),
  CONSTRAINT `fk_eval_alum` FOREIGN KEY (`AlumnoID`) REFERENCES `usuarios` (`UsuarioID`),
  CONSTRAINT `fk_eval_entrega` FOREIGN KEY (`EntregaID`) REFERENCES `entregas` (`EntregaID`),
  CONSTRAINT `fk_eval_prof` FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`),
  CONSTRAINT `fk_eval_rubrica` FOREIGN KEY (`RubricaID`) REFERENCES `rubricas` (`RubricaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.evaluaciones: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.evaluadoresevento
CREATE TABLE IF NOT EXISTS `evaluadoresevento` (
  `EvaluadorID` int(11) NOT NULL AUTO_INCREMENT,
  `EventoProyectoID` int(11) NOT NULL,
  `ProfesorID` int(11) NOT NULL,
  PRIMARY KEY (`EvaluadorID`),
  KEY `EventoProyectoID` (`EventoProyectoID`),
  KEY `ProfesorID` (`ProfesorID`),
  CONSTRAINT `evaluadoresevento_ibfk_1` FOREIGN KEY (`EventoProyectoID`) REFERENCES `eventoproyectos` (`EventoProyectoID`),
  CONSTRAINT `evaluadoresevento_ibfk_2` FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.evaluadoresevento: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.eventoproyectos
CREATE TABLE IF NOT EXISTS `eventoproyectos` (
  `EventoProyectoID` int(11) NOT NULL AUTO_INCREMENT,
  `EventoID` int(11) NOT NULL,
  `ProyectoID` int(11) NOT NULL,
  `Estado` enum('pendiente','aceptado','rechazado') DEFAULT 'pendiente',
  `QRCode` varchar(255) DEFAULT NULL,
  `CreatedAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`EventoProyectoID`),
  KEY `EventoID` (`EventoID`),
  KEY `ProyectoID` (`ProyectoID`),
  CONSTRAINT `eventoproyectos_ibfk_1` FOREIGN KEY (`EventoID`) REFERENCES `eventos` (`EventoID`),
  CONSTRAINT `eventoproyectos_ibfk_2` FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.eventoproyectos: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.eventos
CREATE TABLE IF NOT EXISTS `eventos` (
  `EventoID` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(150) NOT NULL,
  `Descripcion` text DEFAULT NULL,
  `Fecha` date NOT NULL,
  `HoraInicio` time NOT NULL,
  `HoraFin` time NOT NULL,
  `Estado` enum('proximo','activo','finalizado','no_disponible') DEFAULT 'proximo',
  `CreatedAt` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`EventoID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.eventos: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.horariosevento
CREATE TABLE IF NOT EXISTS `horariosevento` (
  `HorarioID` int(11) NOT NULL AUTO_INCREMENT,
  `EventoID` int(11) NOT NULL,
  `AulaID` int(11) NOT NULL,
  `HoraInicio` time NOT NULL,
  `HoraFin` time NOT NULL,
  `Disponible` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`HorarioID`),
  KEY `EventoID` (`EventoID`),
  KEY `AulaID` (`AulaID`),
  CONSTRAINT `horariosevento_ibfk_1` FOREIGN KEY (`EventoID`) REFERENCES `eventos` (`EventoID`),
  CONSTRAINT `horariosevento_ibfk_2` FOREIGN KEY (`AulaID`) REFERENCES `aulas` (`AulaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.horariosevento: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.mensajeschat
CREATE TABLE IF NOT EXISTS `mensajeschat` (
  `MensajeID` int(11) NOT NULL AUTO_INCREMENT,
  `ProyectoID` int(11) NOT NULL,
  `EmisorID` int(11) NOT NULL,
  `Texto` text NOT NULL,
  `Leido` tinyint(1) NOT NULL DEFAULT 0,
  `Fecha` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`MensajeID`),
  KEY `fk_chat_emisor` (`EmisorID`),
  KEY `idx_chat_proyecto_fecha` (`ProyectoID`,`Fecha`),
  CONSTRAINT `fk_chat_emisor` FOREIGN KEY (`EmisorID`) REFERENCES `usuarios` (`UsuarioID`),
  CONSTRAINT `fk_chat_proyecto` FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.mensajeschat: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.notificaciones
CREATE TABLE IF NOT EXISTS `notificaciones` (
  `NotificacionID` int(11) NOT NULL AUTO_INCREMENT,
  `UsuarioID` int(11) NOT NULL,
  `Titulo` varchar(150) NOT NULL,
  `Mensaje` text NOT NULL,
  `Tipo` varchar(50) DEFAULT NULL,
  `ReferenciaID` int(11) DEFAULT NULL,
  `FechaCreacion` datetime NOT NULL DEFAULT current_timestamp(),
  `Leida` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`NotificacionID`),
  KEY `idx_notif_usuario_leida` (`UsuarioID`,`Leida`),
  CONSTRAINT `fk_notif_usuario` FOREIGN KEY (`UsuarioID`) REFERENCES `usuarios` (`UsuarioID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.notificaciones: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.plagioreportes
CREATE TABLE IF NOT EXISTS `plagioreportes` (
  `ReporteID` int(11) NOT NULL AUTO_INCREMENT,
  `EntregaID` int(11) NOT NULL,
  `Proveedor` varchar(80) NOT NULL,
  `PorcentajeSimilitud` decimal(5,2) DEFAULT NULL,
  `URLReporte` varchar(500) DEFAULT NULL,
  `Estado` enum('pendiente','procesando','finalizado','error') NOT NULL DEFAULT 'pendiente',
  `FechaAnalisis` datetime NOT NULL DEFAULT current_timestamp(),
  `DetalleError` text DEFAULT NULL,
  PRIMARY KEY (`ReporteID`),
  KEY `idx_plagio_entrega_estado` (`EntregaID`,`Estado`),
  CONSTRAINT `fk_plagio_entrega` FOREIGN KEY (`EntregaID`) REFERENCES `entregas` (`EntregaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.plagioreportes: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.plan_entregas
CREATE TABLE IF NOT EXISTS `plan_entregas` (
  `PlanID` int(11) NOT NULL AUTO_INCREMENT,
  `ProyectoID` int(11) NOT NULL,
  `TotalEntregas` int(11) NOT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`PlanID`),
  KEY `fk_plan_proyecto` (`ProyectoID`),
  CONSTRAINT `fk_plan_proyecto` FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.plan_entregas: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.profesorespecialidad
CREATE TABLE IF NOT EXISTS `profesorespecialidad` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `ProfesorID` int(11) NOT NULL,
  `EspecialidadID` int(11) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `ProfesorID` (`ProfesorID`),
  KEY `EspecialidadID` (`EspecialidadID`),
  CONSTRAINT `profesorespecialidad_ibfk_1` FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`),
  CONSTRAINT `profesorespecialidad_ibfk_2` FOREIGN KEY (`EspecialidadID`) REFERENCES `especialidades` (`EspecialidadID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.profesorespecialidad: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.proyectoparticipantes
CREATE TABLE IF NOT EXISTS `proyectoparticipantes` (
  `ParticipanteID` int(11) NOT NULL AUTO_INCREMENT,
  `ProyectoID` int(11) NOT NULL,
  `UsuarioID` int(11) NOT NULL,
  PRIMARY KEY (`ParticipanteID`),
  KEY `ProyectoID` (`ProyectoID`),
  KEY `UsuarioID` (`UsuarioID`),
  CONSTRAINT `proyectoparticipantes_ibfk_1` FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`),
  CONSTRAINT `proyectoparticipantes_ibfk_2` FOREIGN KEY (`UsuarioID`) REFERENCES `usuarios` (`UsuarioID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.proyectoparticipantes: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.proyectos
CREATE TABLE IF NOT EXISTS `proyectos` (
  `ProyectoID` int(11) NOT NULL AUTO_INCREMENT,
  `Titulo` varchar(200) NOT NULL,
  `Descripcion` text DEFAULT NULL,
  `FechaInicio` date NOT NULL,
  `FechaFin` date DEFAULT NULL,
  `Estatus` varchar(50) NOT NULL DEFAULT 'Pendiente',
  `AlumnoID` int(11) NOT NULL,
  `ProfesorID` int(11) DEFAULT NULL,
  `Progreso` int(11) NOT NULL DEFAULT 0,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  `UpdatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `Activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`ProyectoID`),
  KEY `idx_proyectos_alumno` (`AlumnoID`),
  KEY `idx_proyectos_profesor` (`ProfesorID`),
  KEY `idx_proyectos_estatus` (`Estatus`),
  KEY `idx_proyectos_activo` (`Activo`),
  CONSTRAINT `fk_proyectos_alumno` FOREIGN KEY (`AlumnoID`) REFERENCES `usuarios` (`UsuarioID`),
  CONSTRAINT `fk_proyectos_profesor` FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.proyectos: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.rubricas
CREATE TABLE IF NOT EXISTS `rubricas` (
  `RubricaID` int(11) NOT NULL AUTO_INCREMENT,
  `ProfesorID` int(11) NOT NULL,
  `Nombre` varchar(150) NOT NULL,
  `Descripcion` text DEFAULT NULL,
  `Activa` tinyint(1) NOT NULL DEFAULT 1,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`RubricaID`),
  KEY `fk_rubrica_prof` (`ProfesorID`),
  CONSTRAINT `fk_rubrica_prof` FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.rubricas: ~0 rows (aproximadamente)

-- Volcando estructura para tabla sistematesis.usuarios
CREATE TABLE IF NOT EXISTS `usuarios` (
  `UsuarioID` int(11) NOT NULL AUTO_INCREMENT,
  `Nombre` varchar(100) NOT NULL,
  `Email` varchar(100) NOT NULL,
  `Contraseña` varchar(255) NOT NULL,
  `Rol` varchar(20) NOT NULL,
  `Activo` tinyint(1) NOT NULL DEFAULT 1,
  `FechaBaja` datetime DEFAULT NULL,
  `PasswordHash` varchar(255) DEFAULT NULL,
  `PasswordSalt` varchar(255) DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  `UpdatedAt` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`UsuarioID`),
  UNIQUE KEY `Email` (`Email`),
  KEY `idx_usuarios_rol` (`Rol`),
  KEY `idx_usuarios_activo` (`Activo`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Volcando datos para la tabla sistematesis.usuarios: ~1 rows (aproximadamente)
INSERT INTO `usuarios` (`UsuarioID`, `Nombre`, `Email`, `Contraseña`, `Rol`, `Activo`, `FechaBaja`, `PasswordHash`, `PasswordSalt`, `CreatedAt`, `UpdatedAt`) VALUES
	(1, 'Administrador', 'admin@tesis.com', 'admin123', 'Admin', 1, NULL, NULL, NULL, '2026-03-12 08:15:01', '2026-03-12 08:15:01');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
