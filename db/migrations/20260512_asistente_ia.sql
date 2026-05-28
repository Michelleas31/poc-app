USE `sistematesis`;

CREATE TABLE IF NOT EXISTS `ia_interacciones` (
  `InteraccionID` int(11) NOT NULL AUTO_INCREMENT,
  `UsuarioID` int(11) NOT NULL,
  `ProyectoID` int(11) DEFAULT NULL,
  `Tipo` enum(
    'ideas_proyecto',
    'mejorar_descripcion',
    'generar_objetivos',
    'generar_justificacion',
    'guardar_documento',
    'validar_evento',
    'mejorar_rubrica'
  ) NOT NULL,
  `Entrada` longtext NOT NULL,
  `Respuesta` longtext NOT NULL,
  `ModeloUsado` varchar(150) DEFAULT NULL,
  `Proveedor` varchar(100) DEFAULT NULL,
  `CreatedAt` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`InteraccionID`),
  KEY `idx_ia_usuario` (`UsuarioID`),
  KEY `idx_ia_proyecto` (`ProyectoID`),
  KEY `idx_ia_tipo` (`Tipo`),
  KEY `idx_ia_created` (`CreatedAt`),
  CONSTRAINT `fk_ia_usuario`
    FOREIGN KEY (`UsuarioID`) REFERENCES `usuarios` (`UsuarioID`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_ia_proyecto`
    FOREIGN KEY (`ProyectoID`) REFERENCES `proyectos` (`ProyectoID`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

ALTER TABLE `documentos_proyecto`
  ADD COLUMN IF NOT EXISTS `ContenidoTexto` longtext DEFAULT NULL AFTER `Contenido`;
