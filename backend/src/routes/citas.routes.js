const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../services/database");

const dbP = db.promise();

const SELECT_CITAS = `
  SELECT
    ep.EventoProyectoID AS CitaID,
    ep.EventoProyectoID,
    ep.ProyectoID,
    p.AlumnoID,
    COALESCE(ep.ProfesorID, p.ProfesorID) AS ProfesorID,
    ep.HorarioID,
    ep.EventoID,
    COALESCE(ep.FechaEvaluacion, ev.Fecha) AS Fecha,
    COALESCE(ep.HoraInicio, h.HoraInicio) AS HoraInicio,
    COALESCE(ep.HoraFin, h.HoraFin) AS HoraFin,
    COALESCE(ep.Sala, a.Nombre) AS Sala,
    CASE ep.Estado
      WHEN 'aceptado' THEN 'aprobada'
      WHEN 'rechazado' THEN 'rechazada'
      ELSE 'pendiente_admin'
    END AS Estado,
    ep.Estado AS EstadoInscripcion,
    COALESCE(ep.TokenQR, ep.QRCode) AS CodigoQR,
    ep.ComentarioAdmin,
    ep.FechaRevision AS FechaAprobacion,
    ep.CreatedAt,
    ep.UpdatedAt,
    p.Titulo,
    p.Descripcion,
    p.Categoria,
    p.Estatus AS EstatusProyecto,
    p.EstadoAprobacion,
    p.Progreso,
    alumno.Nombre AS NombreAlumno,
    alumno.Email AS EmailAlumno,
    profesor.Nombre AS NombreProfesor,
    profesor.Email AS EmailProfesor,
    ev.Nombre AS NombreEvento
  FROM eventoproyectos ep
  INNER JOIN proyectos p ON p.ProyectoID = ep.ProyectoID
  INNER JOIN eventos ev ON ev.EventoID = ep.EventoID
  INNER JOIN usuarios alumno ON alumno.UsuarioID = p.AlumnoID
  LEFT JOIN usuarios profesor ON profesor.UsuarioID = COALESCE(ep.ProfesorID, p.ProfesorID)
  LEFT JOIN horariosevento h ON h.HorarioID = ep.HorarioID
  LEFT JOIN aulas a ON a.AulaID = h.AulaID
`;

function generarTokenQR() {
  return crypto.randomBytes(16).toString("hex");
}

async function recalcularEstadoProyecto(proyectoId, conn = dbP) {
  const [[estado]] = await conn.query(
    `SELECT
       CASE
         WHEN SUM(CASE WHEN Estado = 'aceptado' THEN 1 ELSE 0 END) > 0 THEN 'aceptado'
         WHEN SUM(CASE WHEN Estado = 'pendiente' THEN 1 ELSE 0 END) > 0 THEN 'pendiente'
         WHEN SUM(CASE WHEN Estado = 'rechazado' THEN 1 ELSE 0 END) > 0 THEN 'rechazado'
         ELSE 'pendiente'
       END AS EstadoAprobacion,
       (
         SELECT ep2.ProfesorID
         FROM eventoproyectos ep2
         WHERE ep2.ProyectoID = ?
           AND ep2.Estado = 'aceptado'
           AND ep2.ProfesorID IS NOT NULL
         ORDER BY ep2.FechaRevision DESC, ep2.CreatedAt DESC, ep2.EventoProyectoID DESC
         LIMIT 1
       ) AS ProfesorAceptadoID
     FROM eventoproyectos
     WHERE ProyectoID = ?`,
    [proyectoId, proyectoId]
  );

  const estadoFinal = estado?.EstadoAprobacion || "pendiente";
  const estatus = {
    aceptado: "aprobado",
    pendiente: "Pendiente de aprobación admin",
    rechazado: "rechazado",
  }[estadoFinal];

  await conn.query(
    `UPDATE proyectos
     SET EstadoAprobacion = ?,
         Estatus = ?,
         ProfesorID = COALESCE(?, ProfesorID),
         FechaRevision = CASE WHEN ? <> 'pendiente' THEN NOW() ELSE FechaRevision END
     WHERE ProyectoID = ?`,
    [estadoFinal, estatus, estado?.ProfesorAceptadoID || null, estadoFinal, proyectoId]
  );
}

router.get("/citas", async (_req, res) => {
  try {
    const [rows] = await dbP.query(`
      ${SELECT_CITAS}
      ORDER BY
        CASE ep.Estado
          WHEN 'pendiente' THEN 1
          WHEN 'aceptado' THEN 2
          WHEN 'rechazado' THEN 3
          ELSE 4
        END,
        Fecha ASC,
        HoraInicio ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error("GET /api/citas:", err);
    res.status(500).json({ message: "Error al listar citas", error: err.message });
  }
});

router.get("/citas/alumno/:id", async (req, res) => {
  try {
    const [rows] = await dbP.query(
      `${SELECT_CITAS}
       WHERE p.AlumnoID = ?
       ORDER BY ep.CreatedAt DESC`,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /api/citas/alumno/:id:", err);
    res.status(500).json({ message: "Error al listar citas del alumno", error: err.message });
  }
});

router.get("/citas/profesor/:id", async (req, res) => {
  try {
    const [rows] = await dbP.query(
      `${SELECT_CITAS}
       WHERE COALESCE(ep.ProfesorID, p.ProfesorID) = ?
       ORDER BY Fecha ASC, HoraInicio ASC`,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /api/citas/profesor/:id:", err);
    res.status(500).json({ message: "Error al listar citas del profesor", error: err.message });
  }
});

router.put("/citas/:id/aprobar", async (req, res) => {
  const { ComentarioAdmin } = req.body;
  const conn = dbP;

  try {
    await conn.beginTransaction();

    const [[cita]] = await conn.query(
      `SELECT EventoProyectoID, ProyectoID, Estado, QRCode, TokenQR
       FROM eventoproyectos
       WHERE EventoProyectoID = ?
       LIMIT 1
       FOR UPDATE`,
      [req.params.id]
    );

    if (!cita) {
      await conn.rollback();
      return res.status(404).json({ message: "Cita no encontrada" });
    }

    const tokenExistente = cita.TokenQR || cita.QRCode || "";
    const token = /^[a-f0-9]{32}$/i.test(tokenExistente) ? tokenExistente : generarTokenQR();

    await conn.query(
      `UPDATE eventoproyectos
       SET Estado = 'aceptado',
           ComentarioAdmin = ?,
           FechaRevision = NOW(),
           QRCode = ?,
           TokenQR = ?
       WHERE EventoProyectoID = ?`,
      [ComentarioAdmin || null, token, token, req.params.id]
    );

    await recalcularEstadoProyecto(cita.ProyectoID, conn);
    await conn.commit();

    res.json({
      message: "Cita aprobada. QR habilitado.",
      CitaID: cita.EventoProyectoID,
      EventoProyectoID: cita.EventoProyectoID,
      CodigoQR: token,
      Estado: "aprobada",
      EstadoInscripcion: "aceptado",
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error("PUT /api/citas/:id/aprobar:", err);
    res.status(500).json({ message: "Error al aprobar cita", error: err.message });
  }
});

router.put("/citas/:id/rechazar", async (req, res) => {
  const { ComentarioAdmin } = req.body;
  const conn = dbP;

  try {
    await conn.beginTransaction();

    const [[cita]] = await conn.query(
      `SELECT EventoProyectoID, ProyectoID
       FROM eventoproyectos
       WHERE EventoProyectoID = ?
       LIMIT 1
       FOR UPDATE`,
      [req.params.id]
    );

    if (!cita) {
      await conn.rollback();
      return res.status(404).json({ message: "Cita no encontrada" });
    }

    await conn.query(
      `UPDATE eventoproyectos
       SET Estado = 'rechazado',
           ComentarioAdmin = ?,
           FechaRevision = NOW(),
           QRCode = NULL,
           TokenQR = NULL
       WHERE EventoProyectoID = ?`,
      [ComentarioAdmin || null, req.params.id]
    );

    await recalcularEstadoProyecto(cita.ProyectoID, conn);
    await conn.commit();

    res.json({
      message: "Cita rechazada",
      CitaID: cita.EventoProyectoID,
      EventoProyectoID: cita.EventoProyectoID,
      Estado: "rechazada",
      EstadoInscripcion: "rechazado",
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error("PUT /api/citas/:id/rechazar:", err);
    res.status(500).json({ message: "Error al rechazar cita", error: err.message });
  }
});

router.get("/citas/qr/:codigo", async (req, res) => {
  const codigo = String(req.params.codigo || "").trim();

  if (!codigo) return res.status(400).json({ message: "Código QR requerido" });

  try {
    const [[cita]] = await dbP.query(
      `${SELECT_CITAS}
       WHERE (ep.QRCode = ? OR ep.TokenQR = ?)
       LIMIT 1`,
      [codigo, codigo]
    );

    if (!cita) return res.status(404).json({ message: "QR no encontrado" });
    if (cita.EstadoInscripcion !== "aceptado") {
      return res.status(403).json({ message: "La cita todavía no está aprobada por admin", cita });
    }

    const [documentos] = await dbP.query(
      `SELECT DocumentoID, ProyectoID, NombreArchivo, MimeType, TamanoBytes, Descripcion, CreatedAt
       FROM documentos_proyecto
       WHERE ProyectoID = ?
       ORDER BY CreatedAt DESC`,
      [cita.ProyectoID]
    );

    res.json({ message: "QR válido", cita, documentos });
  } catch (err) {
    console.error("GET /api/citas/qr/:codigo:", err);
    res.status(500).json({ message: "Error al validar QR", error: err.message });
  }
});

module.exports = router;
