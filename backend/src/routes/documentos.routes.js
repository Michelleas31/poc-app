const express = require("express");
const router  = express.Router();
const db      = require("../services/database");

// ══════════════════════════════════════════
// DETALLE COMPLETO DEL PROYECTO
// ══════════════════════════════════════════

router.get("/proyectos/:id/detalles", (req, res) => {
  const proyId = req.params.id;

  const qProyecto = `
    SELECT p.*,
           a.Nombre  AS NombreAlumno,   a.Email  AS EmailAlumno,
           pr.Nombre AS NombreProfesor, pr.Email AS EmailProfesor
    FROM proyectos p
    LEFT JOIN usuarios a  ON p.AlumnoID   = a.UsuarioID
    LEFT JOIN usuarios pr ON p.ProfesorID = pr.UsuarioID
    WHERE p.ProyectoID = ?`;

  const qDocs = `
    SELECT DocumentoID, NombreArchivo, MimeType, TamanoBytes,
           Descripcion, SubidoPorID, CreatedAt
    FROM documentos_proyecto
    WHERE ProyectoID = ?
    ORDER BY CreatedAt DESC`;

  const qEtapas = `
    SELECT * FROM etapasproyecto
    WHERE ProyectoID = ?
    ORDER BY Orden ASC`;

  db.query(qProyecto, [proyId], (err, pRows) => {
    if (err) return res.status(500).json(err);
    if (!pRows.length) return res.status(404).json({ message: "Proyecto no encontrado" });

    db.query(qDocs, [proyId], (err2, docs) => {
      if (err2) return res.status(500).json(err2);
      db.query(qEtapas, [proyId], (err3, etapas) => {
        if (err3) return res.status(500).json(err3);
        res.json({ proyecto: pRows[0], documentos: docs, etapas });
      });
    });
  });
});

// ══════════════════════════════════════════
// DOCUMENTOS DEL PROYECTO
// ══════════════════════════════════════════

// LISTAR (sin contenido binario)
router.get("/proyectos/:id/documentos", (req, res) => {
  db.query(
    `SELECT d.DocumentoID, d.ProyectoID, d.NombreArchivo, d.MimeType,
            d.TamanoBytes, d.Descripcion, d.SubidoPorID, d.CreatedAt,
            u.Nombre AS NombreSubidoPor
     FROM documentos_proyecto d
     LEFT JOIN usuarios u ON d.SubidoPorID = u.UsuarioID
     WHERE d.ProyectoID = ?
     ORDER BY d.CreatedAt DESC`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

// SUBIR (archivo como base64 dentro del JSON)
router.post("/proyectos/:id/documentos", (req, res) => {
  const { NombreArchivo, MimeType, ContenidoBase64, Descripcion, SubidoPorID } = req.body;
  const proyId = req.params.id;

  if (!NombreArchivo || !ContenidoBase64 || !SubidoPorID) {
    return res.status(400).json({
      message: "Faltan campos: NombreArchivo, ContenidoBase64, SubidoPorID"
    });
  }

  let buffer;
  try {
    buffer = Buffer.from(ContenidoBase64, "base64");
  } catch (e) {
    return res.status(400).json({ message: "Archivo base64 inválido" });
  }

  db.query(
    `INSERT INTO documentos_proyecto
       (ProyectoID, NombreArchivo, MimeType, TamanoBytes, Contenido, Descripcion, SubidoPorID)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [proyId, NombreArchivo, MimeType || null, buffer.length, buffer, Descripcion || null, SubidoPorID],
    (err, result) => {
      if (err) {
        console.error("Error al subir documento:", err);
        return res.status(500).json(err);
      }
      res.json({ message: "Documento subido", DocumentoID: result.insertId });
    }
  );
});

// DESCARGAR documento (envía el binario como attachment)
router.get("/documentos/:id/descargar", (req, res) => {
  db.query(
    "SELECT NombreArchivo, MimeType, Contenido FROM documentos_proyecto WHERE DocumentoID = ?",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length) return res.status(404).json({ message: "Documento no encontrado" });
      const doc = rows[0];
      res.setHeader("Content-Type", doc.MimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.NombreArchivo)}"`);
      res.send(doc.Contenido);
    }
  );
});

// VER documento inline (para previsualizar PDFs/imágenes en el navegador)
router.get("/documentos/:id/ver", (req, res) => {
  db.query(
    "SELECT NombreArchivo, MimeType, Contenido FROM documentos_proyecto WHERE DocumentoID = ?",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length) return res.status(404).json({ message: "Documento no encontrado" });
      const doc = rows[0];
      res.setHeader("Content-Type", doc.MimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.NombreArchivo)}"`);
      res.send(doc.Contenido);
    }
  );
});

// ELIMINAR documento
router.delete("/documentos/:id", (req, res) => {
  db.query("DELETE FROM documentos_proyecto WHERE DocumentoID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Documento eliminado" });
  });
});

// ══════════════════════════════════════════
// REVISIÓN DEL PROYECTO (aceptar / rechazar)
// ══════════════════════════════════════════

// PUT /proyectos/:id/revisar — el profesor (o admin) registra su decisión
// #14: se verifica que quien revisa sea el profesor asignado (si se pasa ProfesorID en body)
router.put("/proyectos/:id/revisar", (req, res) => {
  const { EstadoAprobacion, ComentarioRevision, ProfesorID } = req.body;

  if (!["aceptado", "rechazado", "pendiente"].includes(EstadoAprobacion)) {
    return res.status(400).json({
      message: "EstadoAprobacion debe ser: aceptado, rechazado o pendiente"
    });
  }

  if (ProfesorID) {
    db.query(
      "SELECT ProfesorID FROM proyectos WHERE ProyectoID = ?",
      [req.params.id],
      (err, rows) => {
        if (err) return res.status(500).json(err);
        if (!rows.length) return res.status(404).json({ message: "Proyecto no encontrado" });
        if (rows[0].ProfesorID && rows[0].ProfesorID !== parseInt(ProfesorID, 10)) {
          return res.status(403).json({ message: "No tienes permiso para revisar este proyecto" });
        }
        guardarRevision();
      }
    );
  } else {
    guardarRevision();
  }

  function guardarRevision() {
    db.query(
      `UPDATE proyectos
          SET EstadoAprobacion   = ?,
              ComentarioRevision = ?,
              FechaRevision      = NOW()
        WHERE ProyectoID = ?`,
      [EstadoAprobacion, ComentarioRevision || null, req.params.id],
      (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Revisión registrada", EstadoAprobacion });
      }
    );
  }
});

// GET /proyectos/:id/aprobacion — el alumno consulta el estado rápido
router.get("/proyectos/:id/aprobacion", (req, res) => {
  db.query(
    `SELECT ProyectoID, EstadoAprobacion, ComentarioRevision, FechaRevision,
            ProfesorID,
            (SELECT Nombre FROM usuarios WHERE UsuarioID = proyectos.ProfesorID) AS NombreProfesor
     FROM proyectos
     WHERE ProyectoID = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      if (!rows.length) return res.status(404).json({ message: "Proyecto no encontrado" });
      res.json(rows[0]);
    }
  );
});

module.exports = router;