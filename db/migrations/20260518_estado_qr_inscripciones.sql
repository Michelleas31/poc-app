-- Sincroniza el flujo real de inscripciones/citas/QR.
-- eventoproyectos es la fuente canonica de estado de inscripcion y QR.

UPDATE eventoproyectos
SET Estado = 'aceptado'
WHERE Estado IN ('aprobado', 'aprobada');

UPDATE eventoproyectos
SET Estado = 'rechazado'
WHERE Estado = 'rechazada';

UPDATE eventoproyectos
SET QRCode = NULL,
    TokenQR = NULL
WHERE Estado <> 'aceptado';

UPDATE eventoproyectos ep
JOIN (
  SELECT ProyectoID, MIN(EventoProyectoID) AS AceptadaID
  FROM eventoproyectos
  WHERE Estado = 'aceptado'
  GROUP BY ProyectoID
) aceptada ON aceptada.ProyectoID = ep.ProyectoID
SET ep.Estado = 'rechazado',
    ep.ComentarioAdmin = COALESCE(ep.ComentarioAdmin, 'Cerrada automaticamente: el proyecto ya tiene una inscripcion aceptada.'),
    ep.FechaRevision = COALESCE(ep.FechaRevision, NOW()),
    ep.QRCode = NULL,
    ep.TokenQR = NULL
WHERE ep.Estado = 'pendiente'
  AND ep.EventoProyectoID <> aceptada.AceptadaID;

UPDATE eventoproyectos
SET TokenQR = QRCode
WHERE Estado = 'aceptado'
  AND TokenQR IS NULL
  AND QRCode IS NOT NULL;

UPDATE proyectos p
LEFT JOIN (
  SELECT
    ProyectoID,
    CASE
      WHEN SUM(CASE WHEN Estado = 'aceptado' THEN 1 ELSE 0 END) > 0 THEN 'aceptado'
      WHEN SUM(CASE WHEN Estado = 'pendiente' THEN 1 ELSE 0 END) > 0 THEN 'pendiente'
      WHEN SUM(CASE WHEN Estado = 'rechazado' THEN 1 ELSE 0 END) > 0 THEN 'rechazado'
      ELSE 'pendiente'
    END AS EstadoReal
  FROM eventoproyectos
  GROUP BY ProyectoID
) ep ON ep.ProyectoID = p.ProyectoID
LEFT JOIN (
  SELECT ep1.ProyectoID, ep1.ProfesorID
  FROM eventoproyectos ep1
  JOIN (
    SELECT ProyectoID, MAX(EventoProyectoID) AS EventoProyectoID
    FROM eventoproyectos
    WHERE Estado = 'aceptado'
      AND ProfesorID IS NOT NULL
    GROUP BY ProyectoID
  ) elegido ON elegido.EventoProyectoID = ep1.EventoProyectoID
) prof ON prof.ProyectoID = p.ProyectoID
SET p.EstadoAprobacion = COALESCE(ep.EstadoReal, p.EstadoAprobacion, 'pendiente'),
    p.Estatus = CASE COALESCE(ep.EstadoReal, p.EstadoAprobacion, 'pendiente')
      WHEN 'aceptado' THEN 'aprobado'
      WHEN 'rechazado' THEN 'rechazado'
      ELSE 'Pendiente de aprobación admin'
    END,
    p.ProfesorID = COALESCE(prof.ProfesorID, p.ProfesorID)
WHERE p.Activo = 1
  AND ep.EstadoReal IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ep_evento_proyecto_activo
  ON eventoproyectos (EventoID, ProyectoID);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ep_qrcode
  ON eventoproyectos (QRCode);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ep_tokenqr
  ON eventoproyectos (TokenQR);

ALTER TABLE eventoproyectos
  ADD COLUMN IF NOT EXISTS InscripcionActivaProyectoID int(11)
  GENERATED ALWAYS AS (
    CASE
      WHEN Estado IN ('pendiente','aceptado') THEN ProyectoID
      ELSE NULL
    END
  ) VIRTUAL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ep_proyecto_activo
  ON eventoproyectos (InscripcionActivaProyectoID);
