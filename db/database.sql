-- --------------------------------------------------------
-- Host:                         localhost
-- Versión del servidor:         MariaDB
-- Base de datos:                sistematesis
-- Proyecto:                     ProjectManager
-- Stack:                        Node.js + Express + MariaDB + HTML/CSS/JS
-- Flujo corregido:
-- Alumno crea proyecto
-- Profesor ofrece disponibilidad
-- Alumno elige profesor/día/hora/sala
-- Admin aprueba/rechaza
-- Se genera QR/token
-- Profesor valida QR
-- Profesor evalúa con rúbrica
-- Alumno ve resultado/ranking
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

CREATE DATABASE IF NOT EXISTS `sistematesis`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_uca1400_ai_ci;

USE `sistematesis`;

SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------
-- LIMPIEZA DE TABLAS VIEJAS / DUPLICADAS NO USADAS
-- --------------------------------------------------------
DROP TABLE IF EXISTS `auditlog`;
DROP TABLE IF EXISTS `comentariosentrega`;
DROP TABLE IF EXISTS `disponibilidadprofesor`;
DROP TABLE IF EXISTS `entregaversiones`;
DROP TABLE IF EXISTS `especialidades`;
DROP TABLE IF EXISTS `evaluacionesevento`;
DROP TABLE IF EXISTS `mensajeschat`;
DROP TABLE IF EXISTS `notificaciones`;
DROP TABLE IF EXISTS `plagioreportes`;
DROP TABLE IF EXISTS `plan_entregas`;
DROP TABLE IF EXISTS `profesorespecialidad`;
DROP TABLE IF EXISTS `proyectodocumentos`;

-- No se usa tabla citas separada.
-- La cita aprobada vive en eventoproyectos.
DROP TABLE IF EXISTS `citas`;

SET FOREIGN_KEY_CHECKS = 1;

-- ══════════════════════════════════════════
-- USUARIOS
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `usuarios` (
  `UsuarioID`    int(11)      NOT NULL AUTO_INCREMENT,
  `Nombre`       varchar(100) NOT NULL,
  `Email`        varchar(100) NOT NULL,
  `Contraseña`   varchar(255) NOT NULL,
  `Rol`          varchar(20)  NOT NULL,
  `Activo`       tinyint(1)   NOT NULL DEFAULT 1,
  `FechaBaja`    datetime     DEFAULT NULL,
  `PasswordHash` varchar(255) DEFAULT NULL,
  `PasswordSalt` varchar(255) DEFAULT NULL,
  `CreatedAt`    datetime     NOT NULL DEFAULT current_timestamp(),
  `UpdatedAt`    datetime     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`UsuarioID`),
  UNIQUE KEY `Email` (`Email`),
  KEY `idx_usuarios_rol` (`Rol`),
  KEY `idx_usuarios_activo` (`Activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `usuarios`
  (`UsuarioID`, `Nombre`, `Email`, `Contraseña`, `Rol`, `Activo`, `FechaBaja`, `PasswordHash`, `PasswordSalt`, `CreatedAt`, `UpdatedAt`)
VALUES
  (1, 'Administrador', 'admin@tesis.com',     'admin123',     'Admin',    1, NULL, NULL, NULL, current_timestamp(), current_timestamp()),
  (2, 'Michelle',      'michelle@tesis.com',  'michelle123',  'Profesor', 1, NULL, NULL, NULL, current_timestamp(), current_timestamp()),
  (3, 'Yahir',         'yahir@tesis.com',     'yahir123',     'Alumno',   1, NULL, NULL, NULL, current_timestamp(), current_timestamp()),
  (4, 'Valentina',     'valentina@tesis.com', 'valentina123', 'Alumno',   1, NULL, NULL, NULL, current_timestamp(), current_timestamp()),
  (5, 'Emmanuel',      'emmanuel@tesis.com',  'emmanuel123',  'Profesor', 1, NULL, NULL, NULL, current_timestamp(), current_timestamp());

-- ══════════════════════════════════════════
-- AULAS
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `aulas` (
  `AulaID`    int(11)      NOT NULL AUTO_INCREMENT,
  `Nombre`    varchar(100) NOT NULL,
  `Capacidad` int(11)      DEFAULT NULL,
  PRIMARY KEY (`AulaID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `aulas` (`AulaID`, `Nombre`, `Capacidad`) VALUES
  (1, 'LIA', 20),
  (2, 'LAB 1', 25),
  (3, 'LAB 2', 25),
  (4, 'Auditorio', 80);

-- ══════════════════════════════════════════
-- RÚBRICAS
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `rubricas` (
  `RubricaID`   int(11)      NOT NULL AUTO_INCREMENT,
  `ProfesorID`  int(11)      NOT NULL,
  `Nombre`      varchar(150) NOT NULL,
  `Descripcion` text         DEFAULT NULL,
  `Activa`      tinyint(1)   NOT NULL DEFAULT 1,
  `CreatedAt`   datetime     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`RubricaID`),
  KEY `fk_rubrica_prof` (`ProfesorID`),
  CONSTRAINT `fk_rubrica_prof`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `rubricas`
  (`RubricaID`, `ProfesorID`, `Nombre`, `Descripcion`, `Activa`, `CreatedAt`)
VALUES
  (1, 1, 'Rúbrica Feria de Proyectos', 'Rúbrica base para evaluar proyectos en feria, hackatón o concurso institucional.', 1, current_timestamp());

-- ══════════════════════════════════════════
-- CRITERIOS DE RÚBRICA
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `criteriosrubrica` (
  `CriterioID`  int(11)      NOT NULL AUTO_INCREMENT,
  `RubricaID`   int(11)      NOT NULL,
  `Nombre`      varchar(150) NOT NULL,
  `Descripcion` text         DEFAULT NULL,
  `PuntosMax`   int(11)      NOT NULL DEFAULT 3,
  `Orden`       int(11)      NOT NULL DEFAULT 1,
  PRIMARY KEY (`CriterioID`),
  KEY `idx_criterio_rubrica` (`RubricaID`),
  CONSTRAINT `fk_criterio_rubrica`
    FOREIGN KEY (`RubricaID`) REFERENCES `rubricas` (`RubricaID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `criteriosrubrica`
  (`CriterioID`, `RubricaID`, `Nombre`, `Descripcion`, `PuntosMax`, `Orden`)
VALUES
  (1, 1, 'Participación en equipo', 'Evalúa colaboración, organización y aportación del equipo.', 3, 1),
  (2, 1, 'Originalidad', 'Evalúa qué tan propia, creativa y diferenciada es la propuesta.', 3, 2),
  (3, 1, 'Innovación', 'Evalúa el valor tecnológico, funcional o metodológico del proyecto.', 3, 3),
  (4, 1, 'Dominio del tema', 'Evalúa claridad, defensa técnica y dominio del proyecto.', 3, 4);

-- ══════════════════════════════════════════
-- NIVELES DE CRITERIO
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `nivelescriterio` (
  `NivelID`     int(11)      NOT NULL AUTO_INCREMENT,
  `CriterioID`  int(11)      NOT NULL,
  `Nombre`      varchar(100) NOT NULL,
  `Puntaje`     int(11)      NOT NULL DEFAULT 0,
  `Descripcion` text         NOT NULL,
  `Orden`       int(11)      NOT NULL DEFAULT 1,
  PRIMARY KEY (`NivelID`),
  KEY `idx_nivel_criterio` (`CriterioID`),
  UNIQUE KEY `uq_nivel_criterio_orden` (`CriterioID`, `Orden`),
  CONSTRAINT `fk_nivel_criterio`
    FOREIGN KEY (`CriterioID`) REFERENCES `criteriosrubrica` (`CriterioID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `nivelescriterio`
  (`CriterioID`, `Nombre`, `Puntaje`, `Descripcion`, `Orden`)
VALUES
  (1, 'Sobresaliente', 3, 'Participa activamente, aporta ideas clave y fortalece el trabajo colaborativo del equipo.', 1),
  (1, 'Bien',          2, 'Participa de forma constante y cumple con su parte dentro del equipo.', 2),
  (1, 'Suficiente',    1, 'Participa de manera limitada y requiere seguimiento para integrarse al equipo.', 3),
  (1, 'Insuficiente',  0, 'No participa de forma adecuada ni contribuye al trabajo del equipo.', 4),

  (2, 'Sobresaliente', 3, 'Presenta una propuesta altamente original, creativa y diferenciada.', 1),
  (2, 'Bien',          2, 'La propuesta muestra elementos originales y una idea clara.', 2),
  (2, 'Suficiente',    1, 'La propuesta tiene pocos elementos originales y se siente básica.', 3),
  (2, 'Insuficiente',  0, 'La propuesta carece de originalidad o replica ideas sin aporte propio.', 4),

  (3, 'Sobresaliente', 3, 'Integra soluciones innovadoras con alto valor funcional o tecnológico.', 1),
  (3, 'Bien',          2, 'Incluye elementos innovadores relevantes para el proyecto.', 2),
  (3, 'Suficiente',    1, 'Presenta innovación limitada o poco desarrollada.', 3),
  (3, 'Insuficiente',  0, 'No presenta innovación relevante en el proyecto.', 4),

  (4, 'Sobresaliente', 3, 'Explica y defiende el proyecto con dominio completo, claridad y sustento técnico.', 1),
  (4, 'Bien',          2, 'Explica adecuadamente el proyecto y responde la mayoría de las preguntas.', 2),
  (4, 'Suficiente',    1, 'Explica de forma parcial el proyecto y muestra dudas en conceptos clave.', 3),
  (4, 'Insuficiente',  0, 'No demuestra dominio suficiente del tema ni del proyecto presentado.', 4);

-- ══════════════════════════════════════════
-- EVENTOS
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `eventos` (
  `EventoID`    int(11)      NOT NULL AUTO_INCREMENT,
  `Nombre`      varchar(150) NOT NULL,
  `Descripcion` text         DEFAULT NULL,
  `Fecha`       date         NOT NULL,
  `HoraInicio`  time         NOT NULL,
  `HoraFin`     time         NOT NULL,
  `Estado`      enum('proximo','activo','finalizado','no_disponible') DEFAULT 'proximo',
  `RubricaID`   int(11)      DEFAULT NULL,
  `CreatedAt`   datetime     DEFAULT current_timestamp(),
  PRIMARY KEY (`EventoID`),
  KEY `idx_eventos_estado` (`Estado`),
  KEY `idx_eventos_rubrica` (`RubricaID`),
  CONSTRAINT `fk_evento_rubrica`
    FOREIGN KEY (`RubricaID`) REFERENCES `rubricas` (`RubricaID`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `eventos`
  (`EventoID`, `Nombre`, `Descripcion`, `Fecha`, `HoraInicio`, `HoraFin`, `Estado`, `RubricaID`, `CreatedAt`)
VALUES
  (1, 'Feria de Proyectos 2026', 'Evento institucional para presentar proyectos escolares.', '2026-05-20', '10:00:00', '15:00:00', 'activo', 1, current_timestamp()),
  (2, 'Hackathon Innovatec 2026', 'Competencia de innovación, programación y solución de problemas.', '2026-06-10', '09:00:00', '18:00:00', 'proximo', 1, current_timestamp());

-- ══════════════════════════════════════════
-- HORARIOS DE EVENTO
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `horariosevento` (
  `HorarioID`  int(11) NOT NULL AUTO_INCREMENT,
  `EventoID`   int(11) NOT NULL,
  `AulaID`     int(11) NOT NULL,
  `HoraInicio` time    NOT NULL,
  `HoraFin`    time    NOT NULL,
  `Disponible` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`HorarioID`),
  KEY `idx_horario_evento` (`EventoID`),
  KEY `idx_horario_aula` (`AulaID`),
  CONSTRAINT `fk_horario_evento`
    FOREIGN KEY (`EventoID`) REFERENCES `eventos` (`EventoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_horario_aula`
    FOREIGN KEY (`AulaID`) REFERENCES `aulas` (`AulaID`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `horariosevento`
  (`HorarioID`, `EventoID`, `AulaID`, `HoraInicio`, `HoraFin`, `Disponible`)
VALUES
  (1, 1, 1, '10:00:00', '10:15:00', 1),
  (2, 1, 1, '10:15:00', '10:30:00', 1),
  (3, 1, 2, '10:30:00', '10:45:00', 1),
  (4, 2, 3, '09:00:00', '09:30:00', 1),
  (5, 2, 4, '09:30:00', '10:00:00', 1);

-- ══════════════════════════════════════════
-- PROYECTOS
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `proyectos` (
  `ProyectoID`         int(11)      NOT NULL AUTO_INCREMENT,
  `Titulo`             varchar(200) NOT NULL,
  `Descripcion`        text         DEFAULT NULL,
  `Categoria`          varchar(100) DEFAULT NULL,
  `FechaInicio`        date         NOT NULL,
  `FechaFin`           date         DEFAULT NULL,
  `Estatus`            varchar(50)  NOT NULL DEFAULT 'Pendiente',
  `EstadoAprobacion`   enum('pendiente','aceptado','rechazado') NOT NULL DEFAULT 'pendiente',
  `ComentarioRevision` text         DEFAULT NULL,
  `FechaRevision`      datetime     DEFAULT NULL,
  `AlumnoID`           int(11)      NOT NULL,
  `ProfesorID`         int(11)      DEFAULT NULL,
  `Progreso`           int(11)      NOT NULL DEFAULT 0,
  `CreatedAt`          datetime     NOT NULL DEFAULT current_timestamp(),
  `UpdatedAt`          datetime     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `Activo`             tinyint(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`ProyectoID`),
  KEY `idx_proyectos_alumno` (`AlumnoID`),
  KEY `idx_proyectos_profesor` (`ProfesorID`),
  KEY `idx_proyectos_estatus` (`Estatus`),
  KEY `idx_proyectos_aprobacion` (`EstadoAprobacion`),
  KEY `idx_proyectos_activo` (`Activo`),
  CONSTRAINT `fk_proyectos_alumno`
    FOREIGN KEY (`AlumnoID`) REFERENCES `usuarios` (`UsuarioID`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_proyectos_profesor`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `proyectos`
  (`ProyectoID`, `Titulo`, `Descripcion`, `Categoria`, `FechaInicio`, `FechaFin`, `Estatus`, `EstadoAprobacion`, `ComentarioRevision`, `FechaRevision`, `AlumnoID`, `ProfesorID`, `Progreso`, `Activo`)
VALUES
  (1, 'Sistema de Gestión de Emergencias con IA',
   'Aplicación que usa inteligencia artificial para detectar y clasificar emergencias en tiempo real.',
   'Tecnología',
   '2026-05-01', '2026-05-20', 'Pendiente', 'pendiente', NULL, NULL, 3, NULL, 0, 1),

  (2, 'EcoTrack Feria de Proyectos',
   'Sistema para registrar indicadores ambientales, comparar resultados y generar reportes por evento.',
   'Medio ambiente',
   '2026-05-02', '2026-05-20', 'Pendiente', 'pendiente', NULL, NULL, 4, NULL, 0, 1);

-- ══════════════════════════════════════════
-- ETAPAS DEL PROYECTO
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `etapasproyecto` (
  `EtapaID`     int(11)      NOT NULL AUTO_INCREMENT,
  `ProyectoID`  int(11)      NOT NULL,
  `Nombre`      varchar(150) NOT NULL,
  `Descripcion` text         DEFAULT NULL,
  `Orden`       int(11)      NOT NULL DEFAULT 1,
  `FechaInicio` date         DEFAULT NULL,
  `FechaFin`    date         DEFAULT NULL,
  `Completada`  tinyint(1)   NOT NULL DEFAULT 0,
  `CreatedAt`   datetime     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`EtapaID`),
  KEY `idx_etapas_proyecto_orden` (`ProyectoID`, `Orden`),
  CONSTRAINT `fk_etapa_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `etapasproyecto`
  (`EtapaID`, `ProyectoID`, `Nombre`, `Descripcion`, `Orden`, `FechaInicio`, `FechaFin`, `Completada`)
VALUES
  (1, 1, 'Registro del proyecto', 'Proyecto registrado por el alumno.', 1, '2026-05-01', '2026-05-01', 1),
  (2, 1, 'Revisión de profesor', 'Profesor revisa y ofrece disponibilidad.', 2, NULL, NULL, 0),
  (3, 1, 'Aprobación admin', 'Admin valida el tema y la cita.', 3, NULL, NULL, 0),
  (4, 1, 'Evaluación', 'Evaluador escanea QR y califica con rúbrica.', 4, NULL, NULL, 0),

  (5, 2, 'Registro del proyecto', 'Proyecto registrado por el alumno.', 1, '2026-05-02', '2026-05-02', 1),
  (6, 2, 'Revisión de profesor', 'Profesor revisa y ofrece disponibilidad.', 2, NULL, NULL, 0),
  (7, 2, 'Aprobación admin', 'Admin valida el tema y la cita.', 3, NULL, NULL, 0),
  (8, 2, 'Evaluación', 'Evaluador escanea QR y califica con rúbrica.', 4, NULL, NULL, 0);

-- ══════════════════════════════════════════
-- PARTICIPANTES DEL PROYECTO
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `proyectoparticipantes` (
  `ParticipanteID` int(11) NOT NULL AUTO_INCREMENT,
  `ProyectoID`     int(11) NOT NULL,
  `UsuarioID`      int(11) NOT NULL,
  PRIMARY KEY (`ParticipanteID`),
  UNIQUE KEY `uq_participante_proyecto_usuario` (`ProyectoID`, `UsuarioID`),
  KEY `idx_participante_usuario` (`UsuarioID`),
  CONSTRAINT `fk_participante_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_participante_usuario`
    FOREIGN KEY (`UsuarioID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `proyectoparticipantes`
  (`ParticipanteID`, `ProyectoID`, `UsuarioID`)
VALUES
  (1, 1, 3),
  (2, 2, 4);

-- ══════════════════════════════════════════
-- DISPONIBILIDAD DEL PROFESOR
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `disponibilidad_profesor` (
  `DisponibilidadID` int(11)      NOT NULL AUTO_INCREMENT,
  `ProfesorID`       int(11)      NOT NULL,
  `ProyectoID`       int(11)      NOT NULL,
  `Fecha`            date         NOT NULL,
  `HoraInicio`       time         NOT NULL,
  `HoraFin`          time         NOT NULL,
  `Sala`             varchar(100) DEFAULT NULL,
  `Estado`           enum('disponible','reservada','cancelada') NOT NULL DEFAULT 'disponible',
  `CreatedAt`        datetime     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`DisponibilidadID`),
  KEY `idx_disp_prof` (`ProfesorID`),
  KEY `idx_disp_proy` (`ProyectoID`),
  KEY `idx_disp_estado` (`Estado`),
  CONSTRAINT `fk_disp_prof`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_disp_proy`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `disponibilidad_profesor`
  (`DisponibilidadID`, `ProfesorID`, `ProyectoID`, `Fecha`, `HoraInicio`, `HoraFin`, `Sala`, `Estado`)
VALUES
  (1, 2, 1, '2026-05-20', '10:00:00', '10:15:00', 'LIA', 'disponible'),
  (2, 5, 1, '2026-05-20', '10:15:00', '10:30:00', 'LAB 1', 'disponible'),
  (3, 2, 2, '2026-05-20', '10:30:00', '10:45:00', 'LAB 2', 'disponible');

-- ══════════════════════════════════════════
-- CITAS DE EVALUACIÓN (QR + FLUJO ADMIN)
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `citas_evaluacion` (
  `CitaID`           int(11)      NOT NULL AUTO_INCREMENT,
  `ProyectoID`       int(11)      NOT NULL,
  `AlumnoID`         int(11)      NOT NULL,
  `ProfesorID`       int(11)      NOT NULL,
  `DisponibilidadID` int(11)      DEFAULT NULL,
  `Fecha`            date         NOT NULL,
  `HoraInicio`       time         NOT NULL,
  `HoraFin`          time         NOT NULL,
  `Sala`             varchar(100) DEFAULT NULL,
  `Estado`           enum('pendiente_admin','aprobada','rechazada','evaluada') NOT NULL DEFAULT 'pendiente_admin',
  `CodigoQR`         varchar(100) NOT NULL,
  `ComentarioAdmin`  text         DEFAULT NULL,
  `FechaAprobacion`  datetime     DEFAULT NULL,
  `CreatedAt`        datetime     NOT NULL DEFAULT current_timestamp(),
  `UpdatedAt`        datetime     NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`CitaID`),
  UNIQUE KEY `uq_cita_qr` (`CodigoQR`),
  KEY `idx_cita_proyecto`       (`ProyectoID`),
  KEY `idx_cita_alumno`         (`AlumnoID`),
  KEY `idx_cita_profesor`       (`ProfesorID`),
  KEY `idx_cita_disponibilidad` (`DisponibilidadID`),
  CONSTRAINT `fk_cita_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cita_alumno`
    FOREIGN KEY (`AlumnoID`) REFERENCES `usuarios` (`UsuarioID`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_cita_profesor`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- ══════════════════════════════════════════
-- EVENTOPROYECTOS
-- ESTA TABLA FUNCIONA COMO CITA + QR + APROBACIÓN ADMIN
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `eventoproyectos` (
  `EventoProyectoID` int(11) NOT NULL AUTO_INCREMENT,
  `EventoID`         int(11) NOT NULL DEFAULT 1,
  `ProyectoID`       int(11) NOT NULL,
  `HorarioID`        int(11) DEFAULT NULL,

  `DisponibilidadID` int(11) DEFAULT NULL,
  `ProfesorID`       int(11) DEFAULT NULL,

  `FechaEvaluacion`  date DEFAULT NULL,
  `HoraInicio`       time DEFAULT NULL,
  `HoraFin`          time DEFAULT NULL,
  `Sala`             varchar(100) DEFAULT NULL,

  `Estado`           enum('pendiente','aceptado','rechazado') DEFAULT 'pendiente',
  `ComentarioAdmin`  text DEFAULT NULL,
  `FechaRevision`    datetime DEFAULT NULL,

  `QRCode`           varchar(255) DEFAULT NULL,
  `TokenQR`          varchar(255) DEFAULT NULL,

  `CreatedAt`        datetime DEFAULT current_timestamp(),
  `UpdatedAt`        datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),

  PRIMARY KEY (`EventoProyectoID`),
  UNIQUE KEY `uq_evento_proyecto_activo` (`EventoID`, `ProyectoID`),
  KEY `idx_ep_evento` (`EventoID`),
  KEY `idx_ep_proyecto` (`ProyectoID`),
  KEY `idx_ep_horario` (`HorarioID`),
  KEY `idx_ep_disponibilidad` (`DisponibilidadID`),
  KEY `idx_ep_profesor` (`ProfesorID`),
  KEY `idx_ep_estado` (`Estado`),
  KEY `idx_ep_token` (`TokenQR`),

  CONSTRAINT `fk_ep_evento`
    FOREIGN KEY (`EventoID`) REFERENCES `eventos` (`EventoID`)
    ON UPDATE CASCADE,

  CONSTRAINT `fk_ep_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT `fk_ep_horario`
    FOREIGN KEY (`HorarioID`) REFERENCES `horariosevento` (`HorarioID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT `fk_ep_disponibilidad`
    FOREIGN KEY (`DisponibilidadID`) REFERENCES `disponibilidad_profesor` (`DisponibilidadID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,

  CONSTRAINT `fk_ep_profesor`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- ══════════════════════════════════════════
-- SESIONES QR TEMPORALES
-- El alumno genera estos tokens al momento de presentar.
-- ══════════════════════════════════════════
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

-- ══════════════════════════════════════════
-- EVALUADORES POR PROYECTO-EVENTO
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `evaluadoresevento` (
  `EvaluadorID`      int(11) NOT NULL AUTO_INCREMENT,
  `EventoProyectoID` int(11) NOT NULL,
  `ProfesorID`       int(11) NOT NULL,
  PRIMARY KEY (`EvaluadorID`),
  UNIQUE KEY `uq_eval_evento_profesor` (`EventoProyectoID`, `ProfesorID`),
  KEY `idx_evalevento_profesor` (`ProfesorID`),
  CONSTRAINT `fk_evalevento_ep`
    FOREIGN KEY (`EventoProyectoID`) REFERENCES `eventoproyectos` (`EventoProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_evalevento_profesor`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- ══════════════════════════════════════════
-- ENTREGAS
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `entregas` (
  `EntregaID`        int(11)       NOT NULL AUTO_INCREMENT,
  `ProyectoID`       int(11)       NOT NULL,
  `AlumnoID`         int(11)       NOT NULL,
  `FechaEntrega`     datetime      NOT NULL DEFAULT current_timestamp(),
  `ArchivoEntrega`   varchar(255)  NOT NULL,
  `ArchivoContenido` longblob      DEFAULT NULL,
  `Tipo`             varchar(50)   NOT NULL DEFAULT 'documento',
  `Comentarios`      text          DEFAULT NULL,
  `Calificacion`     int(11)       DEFAULT NULL,
  `NumeroVersion`    int(11)       NOT NULL DEFAULT 1,
  `MimeType`         varchar(100)  DEFAULT NULL,
  `TamañoBytes`      bigint(20)    DEFAULT NULL,
  `HashSHA256`       char(64)      DEFAULT NULL,
  `RutaExterna`      varchar(500)  DEFAULT NULL,
  `CreatedAt`        datetime      NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`EntregaID`),
  KEY `idx_entregas_proyecto` (`ProyectoID`),
  KEY `idx_entregas_alumno` (`AlumnoID`),
  KEY `idx_entregas_fecha` (`FechaEntrega`),
  CONSTRAINT `fk_entregas_alumno`
    FOREIGN KEY (`AlumnoID`) REFERENCES `usuarios` (`UsuarioID`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_entregas_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- ══════════════════════════════════════════
-- DOCUMENTOS DEL PROYECTO
-- PDF / IMAGEN / DOCUMENTO / TEXTO ESCRITO EN APP
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `documentos_proyecto` (
  `DocumentoID`   int(11)       NOT NULL AUTO_INCREMENT,
  `ProyectoID`    int(11)       NOT NULL,
  `Titulo`        varchar(200)  DEFAULT NULL,
  `NombreArchivo` varchar(255)  NOT NULL,
  `Contenido`     longblob      DEFAULT NULL,
  `Tipo`          enum('archivo','texto') NOT NULL DEFAULT 'archivo',
  `MimeType`      varchar(100)  NOT NULL DEFAULT 'application/octet-stream',
  `TamanoBytes`   bigint(20)    DEFAULT NULL,
  `Descripcion`   varchar(500)  DEFAULT NULL,
  `SubidoPorID`   int(11)       DEFAULT NULL,
  `CreatedAt`     datetime      NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`DocumentoID`),
  KEY `idx_doc_proyecto` (`ProyectoID`),
  KEY `idx_doc_subidopor` (`SubidoPorID`),
  CONSTRAINT `fk_doc_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_doc_subidopor`
    FOREIGN KEY (`SubidoPorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

INSERT IGNORE INTO `documentos_proyecto`
  (`DocumentoID`, `ProyectoID`, `Titulo`, `NombreArchivo`, `Contenido`, `Tipo`, `MimeType`, `TamanoBytes`, `Descripcion`, `SubidoPorID`)
VALUES
  (1, 1, 'Descripción del proyecto', 'descripcion-proyecto.txt', NULL, 'texto', 'text/plain', NULL, 'Aplicación que usa IA para clasificar emergencias.', 3),
  (2, 2, 'Descripción del proyecto', 'descripcion-proyecto.txt', NULL, 'texto', 'text/plain', NULL, 'Sistema ambiental para feria de proyectos.', 4);

-- ══════════════════════════════════════════
-- EVALUACIONES
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `evaluaciones` (
  `EvaluacionID`      int(11)      NOT NULL AUTO_INCREMENT,
  `EntregaID`         int(11)      DEFAULT NULL,
  `ProyectoID`        int(11)      DEFAULT NULL,
  `EventoProyectoID`  int(11)      DEFAULT NULL,
  `RubricaID`         int(11)      NOT NULL,
  `ProfesorID`        int(11)      NOT NULL,
  `AlumnoID`          int(11)      DEFAULT NULL,
  `PuntajeTotal`      int(11)      NOT NULL DEFAULT 0,
  `PuntajeMaximo`     int(11)      NOT NULL DEFAULT 0,
  `Porcentaje`        decimal(5,2) DEFAULT NULL,
  `ComentarioGeneral` text         DEFAULT NULL,
  `Fecha`             datetime     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`EvaluacionID`),
  KEY `idx_eval_entrega` (`EntregaID`),
  KEY `idx_eval_proyecto` (`ProyectoID`),
  KEY `idx_eval_eventoproyecto` (`EventoProyectoID`),
  KEY `idx_eval_rubrica` (`RubricaID`),
  KEY `idx_eval_profesor` (`ProfesorID`),
  KEY `idx_eval_alumno` (`AlumnoID`),
  CONSTRAINT `fk_eval_entrega`
    FOREIGN KEY (`EntregaID`) REFERENCES `entregas` (`EntregaID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_eventoproyecto`
    FOREIGN KEY (`EventoProyectoID`) REFERENCES `eventoproyectos` (`EventoProyectoID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_rubrica`
    FOREIGN KEY (`RubricaID`) REFERENCES `rubricas` (`RubricaID`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_profesor`
    FOREIGN KEY (`ProfesorID`) REFERENCES `usuarios` (`UsuarioID`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_eval_alumno`
    FOREIGN KEY (`AlumnoID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- ══════════════════════════════════════════
-- DETALLE DE EVALUACIÓN
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `evaluaciondetalle` (
  `EvalDetalleID` int(11) NOT NULL AUTO_INCREMENT,
  `EvaluacionID`  int(11) NOT NULL,
  `CriterioID`    int(11) NOT NULL,
  `NivelID`       int(11) DEFAULT NULL,
  `Puntaje`       int(11) NOT NULL DEFAULT 0,
  `Comentario`    text    DEFAULT NULL,
  PRIMARY KEY (`EvalDetalleID`),
  KEY `idx_evaldetalle_eval` (`EvaluacionID`),
  KEY `idx_evaldetalle_criterio` (`CriterioID`),
  KEY `idx_evaldetalle_nivel` (`NivelID`),
  CONSTRAINT `fk_evaldetalle_eval`
    FOREIGN KEY (`EvaluacionID`) REFERENCES `evaluaciones` (`EvaluacionID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_evaldetalle_criterio`
    FOREIGN KEY (`CriterioID`) REFERENCES `criteriosrubrica` (`CriterioID`)
    ON UPDATE CASCADE,
  CONSTRAINT `fk_evaldetalle_nivel`
    FOREIGN KEY (`NivelID`) REFERENCES `nivelescriterio` (`NivelID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- ══════════════════════════════════════════
-- HISTORIAL DE DESEMPEÑO
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `historial_desempeno` (
  `HistorialID`     int(11)      NOT NULL AUTO_INCREMENT,
  `ProyectoID`      int(11)      NOT NULL,
  `EventoID`        int(11)      DEFAULT NULL,
  `EvaluacionID`    int(11)      DEFAULT NULL,
  `PuntajeObtenido` int(11)      NOT NULL DEFAULT 0,
  `PuntajeMaximo`   int(11)      NOT NULL DEFAULT 0,
  `Porcentaje`      decimal(5,2) DEFAULT NULL,
  `Observaciones`   text         DEFAULT NULL,
  `FechaRegistro`   datetime     NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`HistorialID`),
  KEY `idx_hist_proyecto` (`ProyectoID`),
  KEY `idx_hist_evento` (`EventoID`),
  KEY `idx_hist_eval` (`EvaluacionID`),
  CONSTRAINT `fk_hist_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_hist_evento`
    FOREIGN KEY (`EventoID`) REFERENCES `eventos` (`EventoID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_hist_eval`
    FOREIGN KEY (`EvaluacionID`) REFERENCES `evaluaciones` (`EvaluacionID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- ══════════════════════════════════════════
-- MIGRACIÓN IDPOTENTE PARA BASE EXISTENTE
-- ══════════════════════════════════════════

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

ALTER TABLE `evaluaciondetalle`
  ADD COLUMN IF NOT EXISTS `NivelID` int(11) DEFAULT NULL AFTER `CriterioID`;

ALTER TABLE `disponibilidad_profesor`
  MODIFY COLUMN `ProyectoID` int(11) DEFAULT NULL;

ALTER TABLE `disponibilidad_profesor`
  MODIFY COLUMN `Estado` enum('disponible','seleccionada','reservada','cancelada') NOT NULL DEFAULT 'disponible';

ALTER TABLE `disponibilidad_profesor`
  ADD COLUMN IF NOT EXISTS `UpdatedAt` datetime DEFAULT NULL AFTER `CreatedAt`;

UPDATE `criteriosrubrica`
SET `PuntosMax` = 3
WHERE `RubricaID` = 1;

UPDATE `eventos`
SET `RubricaID` = 1
WHERE `RubricaID` IS NULL;

-- ══════════════════════════════════════════
-- VISTAS ÚTILES PARA DEBUG / RANKING
-- ══════════════════════════════════════════

CREATE OR REPLACE VIEW `vw_ranking_proyectos` AS
SELECT
  p.ProyectoID,
  p.Titulo,
  p.Categoria,
  p.AlumnoID,
  a.Nombre AS Alumno,
  ep.EventoID,
  ev.Nombre AS Evento,
  e.EvaluacionID,
  e.PuntajeTotal,
  e.PuntajeMaximo,
  e.Porcentaje,
  e.Fecha,
  RANK() OVER (
    PARTITION BY ep.EventoID
    ORDER BY e.Porcentaje DESC, e.PuntajeTotal DESC, e.Fecha ASC
  ) AS Posicion
FROM proyectos p
INNER JOIN usuarios a
  ON a.UsuarioID = p.AlumnoID
LEFT JOIN eventoproyectos ep
  ON ep.ProyectoID = p.ProyectoID
LEFT JOIN eventos ev
  ON ev.EventoID = ep.EventoID
LEFT JOIN evaluaciones e
  ON e.ProyectoID = p.ProyectoID
WHERE p.Activo = 1
  AND e.EvaluacionID IS NOT NULL;

-- ══════════════════════════════════════════
-- DATOS DE PRUEBA PARA FLUJO COMPLETO
-- ══════════════════════════════════════════

-- Oferta ya seleccionable por alumno.
INSERT IGNORE INTO `eventoproyectos`
  (`EventoProyectoID`, `EventoID`, `ProyectoID`, `HorarioID`, `DisponibilidadID`, `ProfesorID`, `FechaEvaluacion`, `HoraInicio`, `HoraFin`, `Sala`, `Estado`, `ComentarioAdmin`, `FechaRevision`, `QRCode`, `TokenQR`)
VALUES
  (1, 1, 1, 1, NULL, 2, '2026-05-20', '10:00:00', '10:15:00', 'LIA', 'pendiente', NULL, NULL, NULL, NULL);

UPDATE `proyectos`
SET `ProfesorID` = 2,
    `Estatus` = 'Pendiente de aprobación admin',
    `EstadoAprobacion` = 'pendiente',
    `Progreso` = 40
WHERE `ProyectoID` = 1;

-- ══════════════════════════════════════════
-- RESTAURAR CONFIGURACIÓN
-- ══════════════════════════════════════════

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
