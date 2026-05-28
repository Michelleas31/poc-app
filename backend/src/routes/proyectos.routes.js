const express = require("express");
const router = express.Router();

const db = require("../services/database");
const dbP = db.promise();

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════

function normalizarEstadoProyecto(proyecto) {
  if (!proyecto) return proyecto;

  if (["pendiente", "aceptado", "rechazado"].includes(proyecto.EstadoCita)) {
    proyecto.EstadoAprobacion = proyecto.EstadoCita;
  }

  if (!proyecto.CodigoQR && proyecto.TokenQR) {
    proyecto.CodigoQR = proyecto.TokenQR;
  }

  proyecto.TotalEtapas = Number(proyecto.TotalEtapas || 0);
  proyecto.EtapasCompletadas = Number(proyecto.EtapasCompletadas || 0);

  if (proyecto.TotalEtapas > 0) {
    proyecto.ProgresoCalculado = Math.round(
      (proyecto.EtapasCompletadas / proyecto.TotalEtapas) * 100
    );
    proyecto.TextoProgreso = `${proyecto.ProgresoCalculado}% - ${proyecto.EtapasCompletadas}/${proyecto.TotalEtapas} etapas`;
  } else {
    proyecto.ProgresoCalculado = Number(proyecto.Progreso || 0);
    proyecto.TextoProgreso = proyecto.ProgresoCalculado > 0
      ? `${proyecto.ProgresoCalculado}%`
      : "Sin etapas registradas";
  }

  return proyecto;
}

async function recalcularProgresoProyecto(proyectoId) {
  const [[stats]] = await dbP.query(
    `SELECT 
      COUNT(*) AS Total,
      COALESCE(SUM(CASE WHEN Completada = 1 THEN 1 ELSE 0 END), 0) AS Completadas
     FROM etapasproyecto
     WHERE ProyectoID = ?`,
    [proyectoId]
  );

  const total = Number(stats.Total || 0);
  const completadas = Number(stats.Completadas || 0);
  const progreso = total > 0 ? Math.round((completadas / total) * 100) : 0;
  const estatus = progreso === 100
    ? "Completado"
    : progreso > 0
      ? "En progreso"
      : "Pendiente";

  await dbP.query(
    `UPDATE proyectos 
     SET Progreso = ?, Estatus = ?
     WHERE ProyectoID = ?`,
    [progreso, estatus, proyectoId]
  );

  return { total, completadas, progreso, estatus };
}

function validarBase64(contenidoBase64) {
  if (!contenidoBase64 || typeof contenidoBase64 !== "string") return null;

  const limpio = contenidoBase64.includes(",")
    ? contenidoBase64.split(",").pop()
    : contenidoBase64;

  try {
    return Buffer.from(limpio, "base64");
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════
// REVISIÓN — rutas estáticas ANTES de /:id
// ══════════════════════════════════════════

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/&lt;br\s*\/?&gt;/gi, "<br>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function buildMarkdownTable(lines) {
  const rows = lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));

  if (rows.length < 2) return "";

  const headers = rows[0];
  const bodyRows = rows.slice(2);

  return `
    <div class="doc-table-wrap">
      <table class="doc-table">
        <thead>
          <tr>${headers.map((cell) => `<th>${formatInlineMarkdown(cell)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${bodyRows.map((row) => `
            <tr>${headers.map((_, index) => `<td>${formatInlineMarkdown(row[index] || "")}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function markdownToDocumentHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = [];
  let orderedList = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${formatInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (list.length) {
      html.push(`<ul>${list.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("")}</ul>`);
      list = [];
    }
    if (orderedList.length) {
      html.push(`<ol>${orderedList.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("")}</ol>`);
      orderedList = [];
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith("|") && lines[i + 1]?.trim().match(/^\|?\s*:?-{3,}/)) {
      flushParagraph();
      flushList();
      const tableLines = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      i -= 1;
      html.push(buildMarkdownTable(tableLines));
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      flushParagraph();
      flushList();
      const level = Math.min(line.match(/^#+/)[0].length, 3);
      const text = line.replace(/^#{1,3}\s+/, "");
      html.push(`<h${level}>${formatInlineMarkdown(text)}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line)) {
      flushParagraph();
      flushList();
      html.push("<hr>");
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      orderedList = [];
      list.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      list = [];
      orderedList.push(line.replace(/^\d+\.\s+/, ""));
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return html.join("\n");
}

function renderTextDocumentHtml(doc) {
  const contenido = doc.ContenidoTexto || (doc.Contenido ? doc.Contenido.toString("utf8") : "");
  const titulo = doc.Titulo || doc.NombreArchivo || "Documento del proyecto";
  const fecha = doc.CreatedAt
    ? new Date(doc.CreatedAt).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(titulo)}</title>
  <style>
    :root{--bg:#0f1117;--paper:#f8fafc;--ink:#0f172a;--muted:#64748b;--border:#dbe3ef;--blue:#3366ff}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;background:radial-gradient(circle at top left,rgba(51,102,255,.18),transparent 32%),var(--bg);color:var(--ink);font-family:Arial,Helvetica,sans-serif;line-height:1.65}
    .shell{width:min(1180px,calc(100% - 32px));margin:32px auto}
    .doc-header{padding:20px 22px;border:1px solid rgba(148,163,184,.22);border-radius:18px 18px 0 0;background:linear-gradient(135deg,#172033,#111827);color:#f8fafc}
    .eyebrow{display:inline-flex;margin-bottom:8px;color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
    h1{margin:0;font-size:clamp(24px,3vw,38px);line-height:1.15;letter-spacing:-.02em}
    .meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;color:#cbd5e1;font-size:13px}
    .pill{padding:6px 10px;border:1px solid rgba(148,163,184,.25);border-radius:999px;background:rgba(15,23,42,.55)}
    .paper{padding:clamp(20px,4vw,42px);border:1px solid var(--border);border-top:0;border-radius:0 0 18px 18px;background:var(--paper);box-shadow:0 24px 80px rgba(0,0,0,.35)}
    .content{max-width:100%;overflow-wrap:anywhere}
    .content h1,.content h2,.content h3{margin:28px 0 12px;color:#111827;line-height:1.25}
    .content h1{font-size:28px}.content h2{padding-bottom:8px;border-bottom:1px solid var(--border);font-size:22px}.content h3{font-size:18px}
    .content p{margin:0 0 14px;color:#1e293b;font-size:15px}.content ul,.content ol{margin:0 0 18px 22px;padding:0}.content li{margin-bottom:8px;color:#1e293b}
    .content strong{color:#0f172a}.content code{padding:2px 6px;border-radius:6px;background:#e2e8f0;color:#0f172a;font-size:13px}
    hr{border:0;border-top:1px solid var(--border);margin:28px 0}
    .doc-table-wrap{width:100%;margin:18px 0 26px;overflow-x:auto;border:1px solid var(--border);border-radius:14px;background:white}
    .doc-table{width:100%;min-width:820px;border-collapse:collapse;font-size:13px}.doc-table th{padding:13px 14px;background:#eaf1ff;color:#17315f;text-align:left;font-weight:800;border-bottom:1px solid var(--border)}
    .doc-table td{vertical-align:top;padding:13px 14px;border-bottom:1px solid #edf2f7;color:#243449}.doc-table tr:nth-child(even) td{background:#f8fafc}.doc-table tr:last-child td{border-bottom:0}
    .footer-note{margin-top:26px;padding:14px 16px;border-radius:12px;background:#eef6ff;color:#35506b;font-size:13px}
    @media print{body{background:white}.shell{width:100%;margin:0}.doc-header,.paper{border-radius:0;box-shadow:none}}
  </style>
</head>
<body>
  <main class="shell">
    <header class="doc-header">
      <div class="eyebrow">ProjectManager · Documento de texto</div>
      <h1>${escapeHtml(titulo)}</h1>
      <div class="meta">
        <span class="pill">Tipo: ${escapeHtml(doc.Tipo || "texto")}</span>
        ${fecha ? `<span class="pill">Creado: ${escapeHtml(fecha)}</span>` : ""}
        ${doc.NombreSubidoPor ? `<span class="pill">Autor: ${escapeHtml(doc.NombreSubidoPor)}</span>` : ""}
      </div>
    </header>
    <section class="paper">
      <article class="content">${markdownToDocumentHtml(contenido)}</article>
      <div class="footer-note">Documento generado o capturado dentro de ProjectManager para facilitar la revision del evaluador.</div>
    </section>
  </main>
</body>
</html>`;
}

router.get("/proyectos/revision/pendientes", (req, res) => {
  db.query(
    `SELECT 
      p.*,
      a.Nombre AS NombreAlumno,
      a.Email AS EmailAlumno,
      pr.Nombre AS NombreProfesor,
      pr.Email AS EmailProfesor,
      ep.EventoProyectoID,
      ep.FechaEvaluacion AS FechaCita,
      ep.HoraInicio AS HoraCita,
      ep.Sala,
      ep.Estado AS EstadoCita
     FROM proyectos p
     LEFT JOIN usuarios a ON p.AlumnoID = a.UsuarioID
     LEFT JOIN usuarios pr ON p.ProfesorID = pr.UsuarioID
     LEFT JOIN eventoproyectos ep ON ep.EventoProyectoID = (
       SELECT ep2.EventoProyectoID
       FROM eventoproyectos ep2
       WHERE ep2.ProyectoID = p.ProyectoID
       ORDER BY FIELD(ep2.Estado, 'aceptado', 'pendiente', 'rechazado'),
                ep2.FechaRevision DESC,
                ep2.CreatedAt DESC,
                ep2.EventoProyectoID DESC
       LIMIT 1
     )
     WHERE p.Activo = 1
       AND COALESCE(ep.Estado, p.EstadoAprobacion, 'pendiente') = 'pendiente'
     ORDER BY p.CreatedAt DESC`,
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results.map(normalizarEstadoProyecto));
    }
  );
});

router.get("/proyectos/revision/profesor/:id", (req, res) => {
  db.query(
    `SELECT 
      p.*,
      a.Nombre AS NombreAlumno,
      a.Email AS EmailAlumno,
      ep.EventoProyectoID,
      ep.FechaEvaluacion AS FechaCita,
      ep.HoraInicio AS HoraCita,
      ep.Sala,
      ep.Estado AS EstadoCita,
      COALESCE(ep.TokenQR, ep.QRCode) AS CodigoQR,
      ep.TokenQR
     FROM proyectos p
     LEFT JOIN usuarios a ON p.AlumnoID = a.UsuarioID
     LEFT JOIN eventoproyectos ep ON ep.EventoProyectoID = (
       SELECT ep2.EventoProyectoID
       FROM eventoproyectos ep2
       WHERE ep2.ProyectoID = p.ProyectoID
       ORDER BY FIELD(ep2.Estado, 'aceptado', 'pendiente', 'rechazado'),
                ep2.FechaRevision DESC,
                ep2.CreatedAt DESC,
                ep2.EventoProyectoID DESC
       LIMIT 1
     )
     WHERE p.ProfesorID = ?
       AND p.Activo = 1
     ORDER BY p.CreatedAt DESC`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results.map(normalizarEstadoProyecto));
    }
  );
});

// ══════════════════════════════════════════
// PROYECTOS — LISTADOS
// ══════════════════════════════════════════

router.get("/proyectos", (req, res) => {
  db.query(
    `SELECT 
      p.*,
      a.Nombre AS NombreAlumno,
      a.Email AS EmailAlumno,
      pr.Nombre AS NombreProfesor,
      pr.Email AS EmailProfesor,
      ep.EventoProyectoID,
      ep.FechaEvaluacion AS FechaCita,
      ep.HoraInicio AS HoraCita,
      ep.Sala,
      ep.Estado AS EstadoCita,
      COALESCE(ep.TokenQR, ep.QRCode) AS CodigoQR,
      ep.TokenQR,
      (
        SELECT COUNT(*)
        FROM etapasproyecto e
        WHERE e.ProyectoID = p.ProyectoID
      ) AS TotalEtapas,
      (
        SELECT COUNT(*)
        FROM etapasproyecto e
        WHERE e.ProyectoID = p.ProyectoID
          AND e.Completada = 1
      ) AS EtapasCompletadas,
      (
        SELECT COUNT(*)
        FROM documentos_proyecto d
        WHERE d.ProyectoID = p.ProyectoID
      ) AS TotalDocumentos
     FROM proyectos p
     LEFT JOIN usuarios a ON p.AlumnoID = a.UsuarioID
     LEFT JOIN usuarios pr ON p.ProfesorID = pr.UsuarioID
     LEFT JOIN eventoproyectos ep ON ep.EventoProyectoID = (
       SELECT ep2.EventoProyectoID
       FROM eventoproyectos ep2
       WHERE ep2.ProyectoID = p.ProyectoID
       ORDER BY FIELD(ep2.Estado, 'aceptado', 'pendiente', 'rechazado'),
                ep2.FechaRevision DESC,
                ep2.CreatedAt DESC,
                ep2.EventoProyectoID DESC
       LIMIT 1
     )
     WHERE p.Activo = 1
     ORDER BY p.CreatedAt DESC`,
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results.map(normalizarEstadoProyecto));
    }
  );
});

router.get("/proyectos/disponibles/profesores", (req, res) => {
  db.query(
    `SELECT 
      p.*,
      a.Nombre AS NombreAlumno,
      a.Email AS EmailAlumno,
      (
        SELECT COUNT(*)
        FROM disponibilidad_profesor dp
        WHERE dp.ProyectoID = p.ProyectoID
      ) AS TotalOfertas
     FROM proyectos p
     LEFT JOIN usuarios a ON p.AlumnoID = a.UsuarioID
     WHERE p.Activo = 1
       AND (
        p.EstadoAprobacion IS NULL
        OR p.EstadoAprobacion = 'pendiente'
       )
     ORDER BY p.CreatedAt DESC`,
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results.map(normalizarEstadoProyecto));
    }
  );
});

router.get("/proyectos/por-profesor/:id", (req, res) => {
  db.query(
    `SELECT 
      p.*,
      a.Nombre AS NombreAlumno,
      a.Email AS EmailAlumno,
      pr.Nombre AS NombreProfesor,
      pr.Email AS EmailProfesor,
      ep.EventoProyectoID,
      ep.FechaEvaluacion AS FechaCita,
      ep.HoraInicio AS HoraCita,
      ep.Sala,
      ep.Estado AS EstadoCita,
      COALESCE(ep.TokenQR, ep.QRCode) AS CodigoQR,
      ep.TokenQR,
      (
        SELECT COUNT(*)
        FROM etapasproyecto e
        WHERE e.ProyectoID = p.ProyectoID
      ) AS TotalEtapas,
      (
        SELECT COUNT(*)
        FROM etapasproyecto e
        WHERE e.ProyectoID = p.ProyectoID
          AND e.Completada = 1
      ) AS EtapasCompletadas,
      (
        SELECT COUNT(*)
        FROM documentos_proyecto d
        WHERE d.ProyectoID = p.ProyectoID
      ) AS TotalDocumentos
     FROM proyectos p
     LEFT JOIN usuarios a ON p.AlumnoID = a.UsuarioID
     LEFT JOIN usuarios pr ON p.ProfesorID = pr.UsuarioID
     LEFT JOIN eventoproyectos ep ON ep.EventoProyectoID = (
       SELECT ep2.EventoProyectoID
       FROM eventoproyectos ep2
       WHERE ep2.ProyectoID = p.ProyectoID
       ORDER BY FIELD(ep2.Estado, 'aceptado', 'pendiente', 'rechazado'),
                ep2.FechaRevision DESC,
                ep2.CreatedAt DESC,
                ep2.EventoProyectoID DESC
       LIMIT 1
     )
     WHERE p.ProfesorID = ?
       AND p.Activo = 1
     ORDER BY p.CreatedAt DESC`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results.map(normalizarEstadoProyecto));
    }
  );
});

router.get("/proyectos/por-alumno/:id", (req, res) => {
  db.query(
    `SELECT 
      p.*,
      a.Nombre AS NombreAlumno,
      a.Email AS EmailAlumno,
      pr.Nombre AS NombreProfesor,
      pr.Email AS EmailProfesor,
      ep.EventoProyectoID,
      ep.FechaEvaluacion AS FechaCita,
      ep.HoraInicio AS HoraCita,
      ep.Sala,
      ep.Estado AS EstadoCita,
      COALESCE(ep.TokenQR, ep.QRCode) AS CodigoQR,
      ep.TokenQR,
      ep.FechaRevision AS FechaAprobacionCita,
      (
        SELECT COUNT(*)
        FROM etapasproyecto e
        WHERE e.ProyectoID = p.ProyectoID
      ) AS TotalEtapas,
      (
        SELECT COUNT(*)
        FROM etapasproyecto e
        WHERE e.ProyectoID = p.ProyectoID
          AND e.Completada = 1
      ) AS EtapasCompletadas,
      (
        SELECT COUNT(*)
        FROM documentos_proyecto d
        WHERE d.ProyectoID = p.ProyectoID
      ) AS TotalDocumentos,
      (
        SELECT COUNT(*)
        FROM evaluaciones ev
        WHERE ev.ProyectoID = p.ProyectoID
      ) AS TotalEvaluaciones
     FROM proyectos p
     LEFT JOIN usuarios a ON p.AlumnoID = a.UsuarioID
     LEFT JOIN usuarios pr ON p.ProfesorID = pr.UsuarioID
     LEFT JOIN eventoproyectos ep ON ep.EventoProyectoID = (
       SELECT ep2.EventoProyectoID
       FROM eventoproyectos ep2
       WHERE ep2.ProyectoID = p.ProyectoID
       ORDER BY FIELD(ep2.Estado, 'aceptado', 'pendiente', 'rechazado'),
                ep2.FechaRevision DESC,
                ep2.CreatedAt DESC,
                ep2.EventoProyectoID DESC
       LIMIT 1
     )
     WHERE p.AlumnoID = ?
       AND p.Activo = 1
     ORDER BY p.CreatedAt DESC`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results.map(normalizarEstadoProyecto));
    }
  );
});

// ══════════════════════════════════════════
// DETALLES COMPLETOS
// IMPORTANTE: estas rutas van ANTES de /proyectos/:id
// ══════════════════════════════════════════

router.get("/proyectos/:id/detalles", async (req, res) => {
  try {
    const [[proyecto]] = await dbP.query(
      `SELECT 
        p.*,
        a.Nombre AS NombreAlumno,
        a.Email AS EmailAlumno,
        pr.Nombre AS NombreProfesor,
        pr.Email AS EmailProfesor,
        ep.EventoProyectoID,
        ep.FechaEvaluacion AS FechaCita,
        ep.HoraInicio AS HoraCita,
        ep.Sala,
        ep.Estado AS EstadoCita,
        COALESCE(ep.TokenQR, ep.QRCode) AS CodigoQR,
        ep.TokenQR,
        ep.FechaRevision AS FechaAprobacionCita,
        ep.ComentarioAdmin,
        (
          SELECT COUNT(*)
          FROM etapasproyecto e
          WHERE e.ProyectoID = p.ProyectoID
        ) AS TotalEtapas,
        (
          SELECT COUNT(*)
          FROM etapasproyecto e
          WHERE e.ProyectoID = p.ProyectoID
            AND e.Completada = 1
        ) AS EtapasCompletadas
       FROM proyectos p
       LEFT JOIN usuarios a ON p.AlumnoID = a.UsuarioID
       LEFT JOIN usuarios pr ON p.ProfesorID = pr.UsuarioID
       LEFT JOIN eventoproyectos ep ON ep.EventoProyectoID = (
         SELECT ep2.EventoProyectoID
         FROM eventoproyectos ep2
         WHERE ep2.ProyectoID = p.ProyectoID
         ORDER BY FIELD(ep2.Estado, 'aceptado', 'pendiente', 'rechazado'),
                  ep2.FechaRevision DESC,
                  ep2.CreatedAt DESC,
                  ep2.EventoProyectoID DESC
         LIMIT 1
       )
       WHERE p.ProyectoID = ?`,
      [req.params.id]
    );

    if (!proyecto) {
      return res.status(404).json({ message: "Proyecto no encontrado" });
    }

    normalizarEstadoProyecto(proyecto);

    const [documentos] = await dbP.query(
      `SELECT 
        DocumentoID,
        ProyectoID,
        Titulo,
        NombreArchivo,
        Tipo,
        MimeType,
        TamanoBytes,
        Descripcion,
        SubidoPorID,
        CreatedAt
       FROM documentos_proyecto
       WHERE ProyectoID = ?
       ORDER BY CreatedAt DESC`,
      [req.params.id]
    );

    const [etapas] = await dbP.query(
      `SELECT *
       FROM etapasproyecto
       WHERE ProyectoID = ?
       ORDER BY Orden ASC`,
      [req.params.id]
    );

    const [ofertas] = await dbP.query(
      `SELECT 
        d.DisponibilidadID,
        d.ProyectoID,
        d.ProfesorID,
        d.Fecha,
        d.HoraInicio,
        d.HoraFin,
        d.Sala,
        d.Estado,
        d.CreatedAt,
        u.Nombre AS NombreProfesor,
        u.Email AS EmailProfesor
       FROM disponibilidad_profesor d
       JOIN usuarios u ON d.ProfesorID = u.UsuarioID
       WHERE d.ProyectoID = ?
       ORDER BY d.Fecha ASC, d.HoraInicio ASC`,
      [req.params.id]
    );

    const [evaluaciones] = await dbP.query(
      `SELECT 
        ev.EvaluacionID,
        ev.PuntajeTotal,
        ev.PuntajeMaximo,
        ev.Porcentaje,
        ev.Comentarios AS ComentarioGeneral,
        ev.CreatedAt AS Fecha,
        r.Nombre AS NombreRubrica,
        u.Nombre AS NombreProfesor
       FROM evaluaciones ev
       LEFT JOIN rubricas r ON ev.RubricaID = r.RubricaID
       LEFT JOIN usuarios u ON ev.ProfesorID = u.UsuarioID
       WHERE ev.ProyectoID = ?
       ORDER BY ev.CreatedAt DESC`,
      [req.params.id]
    );

    res.json({
      proyecto,
      documentos,
      etapas,
      ofertas,
      evaluaciones,
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/proyectos/:id/aprobacion", async (req, res) => {
  try {
    const [[row]] = await dbP.query(
      `SELECT 
        p.EstadoAprobacion,
        p.ComentarioRevision,
        p.FechaRevision,
        pr.Nombre AS NombreProfesor,
        pr.Email AS EmailProfesor
       FROM proyectos p
       LEFT JOIN usuarios pr ON p.ProfesorID = pr.UsuarioID
       WHERE p.ProyectoID = ?`,
      [req.params.id]
    );

    if (!row) {
      return res.status(404).json({ message: "Proyecto no encontrado" });
    }

    res.json(row);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/proyectos/:id/historial", async (req, res) => {
  try {
    const [fromEval] = await dbP.query(
      `SELECT 
        ev.EvaluacionID,
        ev.PuntajeTotal,
        ev.PuntajeMaximo,
        ev.Porcentaje,
        ev.ComentarioGeneral,
        ev.Fecha,
        r.Nombre AS NombreRubrica,
        u.Nombre AS NombreProfesor,
        e.NombreEvento
       FROM evaluaciones ev
       LEFT JOIN entregas en2 ON ev.EntregaID = en2.EntregaID
       LEFT JOIN rubricas r ON ev.RubricaID = r.RubricaID
       LEFT JOIN usuarios u ON ev.ProfesorID = u.UsuarioID
       LEFT JOIN (
        SELECT ep.ProyectoID, ev2.Nombre AS NombreEvento
        FROM eventoproyectos ep
        JOIN eventos ev2 ON ep.EventoID = ev2.EventoID
        WHERE ep.Estado = 'aceptado'
       ) e ON e.ProyectoID = COALESCE(en2.ProyectoID, ev.ProyectoID)
       WHERE en2.ProyectoID = ?
          OR ev.ProyectoID = ?
       GROUP BY ev.EvaluacionID
       ORDER BY ev.Fecha DESC`,
      [req.params.id, req.params.id]
    );

    const [fromHistorial] = await dbP.query(
      `SELECT 
        h.HistorialID,
        h.PuntajeObtenido,
        h.PuntajeMaximo,
        h.Porcentaje,
        h.Observaciones,
        h.FechaRegistro,
        ev.Nombre AS NombreEvento
       FROM historial_desempeno h
       LEFT JOIN eventos ev ON h.EventoID = ev.EventoID
       WHERE h.ProyectoID = ?
       ORDER BY h.FechaRegistro DESC`,
      [req.params.id]
    );

    res.json({
      evaluaciones: fromEval,
      historial: fromHistorial,
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/proyectos/:id/indicadores", async (req, res) => {
  try {
    const [[proyecto]] = await dbP.query(
      `SELECT 
        Titulo,
        Estatus,
        Progreso,
        EstadoAprobacion
       FROM proyectos
       WHERE ProyectoID = ?`,
      [req.params.id]
    );

    if (!proyecto) {
      return res.status(404).json({ message: "Proyecto no encontrado" });
    }

    const [[stats]] = await dbP.query(
      `SELECT 
        COUNT(ev.EvaluacionID) AS TotalEvaluaciones,
        COALESCE(AVG(ev.PuntajeTotal), 0) AS Promedio,
        COALESCE(MAX(ev.PuntajeTotal), 0) AS MejorPuntaje,
        COALESCE(MIN(ev.PuntajeTotal), 0) AS PeorPuntaje,
        COALESCE(SUM(ev.PuntajeTotal), 0) AS PuntajeTotal
       FROM evaluaciones ev
       LEFT JOIN entregas en2 ON ev.EntregaID = en2.EntregaID
       WHERE en2.ProyectoID = ?
          OR ev.ProyectoID = ?`,
      [req.params.id, req.params.id]
    );

    const [[etapas]] = await dbP.query(
      `SELECT 
        COUNT(*) AS Total,
        COALESCE(SUM(CASE WHEN Completada = 1 THEN 1 ELSE 0 END), 0) AS Completadas
       FROM etapasproyecto
       WHERE ProyectoID = ?`,
      [req.params.id]
    );

    const [[docCount]] = await dbP.query(
      `SELECT COUNT(*) AS Total
       FROM documentos_proyecto
       WHERE ProyectoID = ?`,
      [req.params.id]
    );

    res.json({
      Titulo: proyecto.Titulo,
      Estatus: proyecto.Estatus,
      Progreso: Number(proyecto.Progreso || 0),
      EstadoAprobacion: proyecto.EstadoAprobacion,
      TotalEvaluaciones: Number(stats.TotalEvaluaciones || 0),
      Promedio: Number(stats.Promedio || 0).toFixed(2),
      MejorPuntaje: Number(stats.MejorPuntaje || 0),
      PeorPuntaje: Number(stats.PeorPuntaje || 0),
      PuntajeTotal: Number(stats.PuntajeTotal || 0),
      TotalEtapas: Number(etapas.Total || 0),
      EtapasCompletadas: Number(etapas.Completadas || 0),
      TotalDocumentos: Number(docCount.Total || 0),
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

// ══════════════════════════════════════════
// DOCUMENTOS DEL PROYECTO
// ══════════════════════════════════════════

router.get("/proyectos/:id/documentos", async (req, res) => {
  try {
    const [rows] = await dbP.query(
      `SELECT 
        DocumentoID,
        ProyectoID,
        Titulo,
        NombreArchivo,
        Tipo,
        MimeType,
        TamanoBytes,
        Descripcion,
        SubidoPorID,
        CreatedAt
       FROM documentos_proyecto
       WHERE ProyectoID = ?
       ORDER BY CreatedAt DESC`,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.post("/proyectos/:id/documentos", async (req, res) => {
  const {
    NombreArchivo,
    MimeType,
    ContenidoBase64,
    Descripcion,
    SubidoPorID,
  } = req.body;

  if (!NombreArchivo || !ContenidoBase64) {
    return res.status(400).json({
      message: "NombreArchivo y ContenidoBase64 son obligatorios",
    });
  }

  const nombre = String(NombreArchivo).trim().substring(0, 255);
  const mime = String(MimeType || "application/octet-stream").substring(0, 100);
  const desc = Descripcion
    ? String(Descripcion).trim().substring(0, 500)
    : null;

  const buffer = validarBase64(ContenidoBase64);

  if (!buffer) {
    return res.status(400).json({ message: "ContenidoBase64 inválido" });
  }

  if (buffer.length > 26214400) {
    return res.status(400).json({ message: "El archivo excede 25 MB" });
  }

  try {
    const [result] = await dbP.query(
      `INSERT INTO documentos_proyecto
        (
          ProyectoID,
          Titulo,
          NombreArchivo,
          Contenido,
          Tipo,
          MimeType,
          TamanoBytes,
          Descripcion,
          SubidoPorID
        )
       VALUES (?, ?, ?, ?, 'archivo', ?, ?, ?, ?)`,
      [
        req.params.id,
        nombre,
        nombre,
        buffer,
        mime,
        buffer.length,
        desc,
        SubidoPorID || null,
      ]
    );

    res.status(201).json({
      message: "Documento subido",
      DocumentoID: result.insertId,
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

router.post("/proyectos/:id/documentos/texto", async (req, res) => {
  const {
    Titulo,
    Contenido,
    Descripcion,
    SubidoPorID,
  } = req.body;

  if (!Titulo || !String(Titulo).trim()) {
    return res.status(400).json({ message: "Titulo es obligatorio" });
  }

  if (!Contenido || !String(Contenido).trim()) {
    return res.status(400).json({ message: "Contenido es obligatorio" });
  }

  const titulo = String(Titulo).trim().substring(0, 200);
  const desc = Descripcion
    ? String(Descripcion).trim().substring(0, 500)
    : null;
  const buffer = Buffer.from(String(Contenido), "utf8");
  const nombre = `${titulo}.txt`;

  try {
    const [result] = await dbP.query(
      `INSERT INTO documentos_proyecto
        (
          ProyectoID,
          Titulo,
          NombreArchivo,
          Contenido,
          Tipo,
          MimeType,
          TamanoBytes,
          Descripcion,
          SubidoPorID
        )
       VALUES (?, ?, ?, ?, 'texto', 'text/plain', ?, ?, ?)`,
      [
        req.params.id,
        titulo,
        nombre,
        buffer,
        buffer.length,
        desc,
        SubidoPorID || null,
      ]
    );

    res.status(201).json({
      message: "Documento creado",
      DocumentoID: result.insertId,
    });
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/documentos/:id/ver", async (req, res) => {
  try {
    const [[doc]] = await dbP.query(
      `SELECT 
        d.Titulo,
        NombreArchivo,
        Contenido,
        ContenidoTexto,
        MimeType,
        Tipo,
        d.CreatedAt,
        u.Nombre AS NombreSubidoPor
       FROM documentos_proyecto d
       LEFT JOIN usuarios u ON u.UsuarioID = d.SubidoPorID
       WHERE d.DocumentoID = ?`,
      [req.params.id]
    );

    if (!doc) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    if (doc.Tipo === "texto") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(renderTextDocumentHtml(doc));
    }

    const mime = doc.MimeType || "application/octet-stream";

    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(doc.NombreArchivo)}"`
    );

    res.send(doc.Contenido);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.get("/documentos/:id/descargar", async (req, res) => {
  try {
    const [[doc]] = await dbP.query(
      `SELECT 
        NombreArchivo,
        Contenido,
        MimeType
       FROM documentos_proyecto
       WHERE DocumentoID = ?`,
      [req.params.id]
    );

    if (!doc) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    res.setHeader("Content-Type", doc.MimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(doc.NombreArchivo)}"`
    );

    res.send(doc.Contenido);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.delete("/documentos/:id", async (req, res) => {
  try {
    const [[doc]] = await dbP.query(
      `SELECT DocumentoID
       FROM documentos_proyecto
       WHERE DocumentoID = ?`,
      [req.params.id]
    );

    if (!doc) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    await dbP.query(
      `DELETE FROM documentos_proyecto
       WHERE DocumentoID = ?`,
      [req.params.id]
    );

    res.json({ message: "Documento eliminado" });
  } catch (err) {
    res.status(500).json(err);
  }
});

// ══════════════════════════════════════════
// ETAPAS
// ══════════════════════════════════════════

router.get("/proyectos/:id/etapas", (req, res) => {
  db.query(
    `SELECT *
     FROM etapasproyecto
     WHERE ProyectoID = ?
     ORDER BY Orden ASC`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

router.post("/proyectos/:id/etapas", (req, res) => {
  const {
    Nombre,
    Descripcion,
    FechaFin,
  } = req.body;

  const proyectoId = req.params.id;

  if (!Nombre || !String(Nombre).trim()) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  db.query(
    `SELECT COALESCE(MAX(Orden), 0) + 1 AS NextOrden
     FROM etapasproyecto
     WHERE ProyectoID = ?`,
    [proyectoId],
    (err, rows) => {
      if (err) return res.status(500).json(err);

      const orden = rows[0].NextOrden;

      db.query(
        `INSERT INTO etapasproyecto
          (
            ProyectoID,
            Nombre,
            Descripcion,
            Orden,
            FechaFin,
            Completada
          )
         VALUES (?, ?, ?, ?, ?, 0)`,
        [
          proyectoId,
          String(Nombre).trim(),
          Descripcion || null,
          orden,
          FechaFin || null,
        ],
        async (err2, result) => {
          if (err2) return res.status(500).json(err2);

          try {
            const progreso = await recalcularProgresoProyecto(proyectoId);
            res.status(201).json({
              message: "Etapa agregada",
              EtapaID: result.insertId,
              progreso,
            });
          } catch (err3) {
            res.status(500).json(err3);
          }
        }
      );
    }
  );
});

router.put("/etapas/:id", (req, res) => {
  const {
    Nombre,
    Descripcion,
    FechaFin,
    Completada,
  } = req.body;

  const campos = [];
  const valores = [];

  if (Nombre !== undefined) {
    campos.push("Nombre = ?");
    valores.push(Nombre);
  }

  if (Descripcion !== undefined) {
    campos.push("Descripcion = ?");
    valores.push(Descripcion);
  }

  if (FechaFin !== undefined) {
    campos.push("FechaFin = ?");
    valores.push(FechaFin || null);
  }

  if (Completada !== undefined) {
    campos.push("Completada = ?");
    valores.push(Completada ? 1 : 0);
  }

  if (!campos.length) {
    return res.status(400).json({ message: "Nada que actualizar" });
  }

  valores.push(req.params.id);

  db.query(
    `UPDATE etapasproyecto
     SET ${campos.join(", ")}
     WHERE EtapaID = ?`,
    valores,
    (err) => {
      if (err) return res.status(500).json(err);

      db.query(
        `SELECT ProyectoID
         FROM etapasproyecto
         WHERE EtapaID = ?`,
        [req.params.id],
        async (err2, rows) => {
          if (err2) return res.status(500).json(err2);

          if (!rows.length) {
            return res.json({ message: "Etapa actualizada" });
          }

          try {
            const progreso = await recalcularProgresoProyecto(rows[0].ProyectoID);

            res.json({
              message: "Etapa actualizada",
              progreso,
            });
          } catch (err3) {
            res.status(500).json(err3);
          }
        }
      );
    }
  );
});

router.delete("/etapas/:id", (req, res) => {
  db.query(
    `SELECT ProyectoID
     FROM etapasproyecto
     WHERE EtapaID = ?`,
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json(err);

      const proyectoId = rows[0]?.ProyectoID;

      db.query(
        `DELETE FROM etapasproyecto
         WHERE EtapaID = ?`,
        [req.params.id],
        async (err2) => {
          if (err2) return res.status(500).json(err2);

          if (!proyectoId) {
            return res.json({ message: "Etapa eliminada" });
          }

          try {
            const progreso = await recalcularProgresoProyecto(proyectoId);

            res.json({
              message: "Etapa eliminada",
              progreso,
            });
          } catch (err3) {
            res.status(500).json(err3);
          }
        }
      );
    }
  );
});

// ══════════════════════════════════════════
// PROYECTO — CREAR / ACTUALIZAR / ELIMINAR
// ══════════════════════════════════════════

router.post("/proyectos", (req, res) => {
  const {
    Titulo,
    Descripcion,
    Categoria,
    FechaInicio,
    FechaFin,
    AlumnoID,
    ProfesorID,
  } = req.body;

  if (!Titulo || !String(Titulo).trim()) {
    return res.status(400).json({ message: "Falta Titulo" });
  }

  if (!FechaInicio) {
    return res.status(400).json({ message: "Falta FechaInicio" });
  }

  if (!AlumnoID) {
    return res.status(400).json({ message: "Falta AlumnoID" });
  }

  db.query(
    `INSERT INTO proyectos
      (
        Titulo,
        Descripcion,
        Categoria,
        FechaInicio,
        FechaFin,
        AlumnoID,
        ProfesorID,
        Estatus,
        Progreso,
        EstadoAprobacion,
        Activo
      )
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', 0, 'pendiente', 1)`,
    [
      String(Titulo).trim(),
      Descripcion || null,
      Categoria || null,
      FechaInicio,
      FechaFin || null,
      AlumnoID,
      ProfesorID || null,
    ],
    (err, result) => {
      if (err) return res.status(500).json(err);

      res.status(201).json({
        message: "Proyecto creado",
        ProyectoID: result.insertId,
      });
    }
  );
});

router.put("/proyectos/:id", (req, res) => {
  const {
    Titulo,
    Descripcion,
    Categoria,
    FechaInicio,
    FechaFin,
    Estatus,
  } = req.body;

  const campos = [];
  const valores = [];

  if (Titulo !== undefined) {
    campos.push("Titulo = ?");
    valores.push(Titulo);
  }

  if (Descripcion !== undefined) {
    campos.push("Descripcion = ?");
    valores.push(Descripcion || null);
  }

  if (Categoria !== undefined) {
    campos.push("Categoria = ?");
    valores.push(Categoria || null);
  }

  if (FechaInicio !== undefined) {
    campos.push("FechaInicio = ?");
    valores.push(FechaInicio || null);
  }

  if (FechaFin !== undefined) {
    campos.push("FechaFin = ?");
    valores.push(FechaFin || null);
  }

  if (Estatus !== undefined) {
    campos.push("Estatus = ?");
    valores.push(Estatus);
  }

  if (!campos.length) {
    return res.status(400).json({ message: "Nada que actualizar" });
  }

  valores.push(req.params.id);

  db.query(
    `UPDATE proyectos
     SET ${campos.join(", ")}
     WHERE ProyectoID = ?`,
    valores,
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Proyecto actualizado" });
    }
  );
});

router.put("/proyectos/:id/asignar-profesor", (req, res) => {
  const { ProfesorID } = req.body;

  db.query(
    `UPDATE proyectos
     SET ProfesorID = ?
     WHERE ProyectoID = ?`,
    [ProfesorID || null, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Profesor asignado" });
    }
  );
});

router.put("/proyectos/:id/revisar", async (req, res) => {
  const {
    EstadoAprobacion,
    ComentarioRevision,
  } = req.body;

  const estados = ["pendiente", "aceptado", "rechazado", "aprobado"];

  if (!estados.includes(EstadoAprobacion)) {
    return res.status(400).json({ message: "EstadoAprobacion inválido" });
  }

  if (
    EstadoAprobacion === "rechazado" &&
    (!ComentarioRevision || !String(ComentarioRevision).trim())
  ) {
    return res.status(400).json({
      message: "El comentario es obligatorio al rechazar",
    });
  }

  const estadoFinal = EstadoAprobacion === "aprobado"
    ? "aceptado"
    : EstadoAprobacion;

  try {
    await dbP.query(
      `UPDATE proyectos
       SET 
        EstadoAprobacion = ?,
        ComentarioRevision = ?,
        FechaRevision = NOW()
       WHERE ProyectoID = ?`,
      [
        estadoFinal,
        ComentarioRevision ? String(ComentarioRevision).trim() : null,
        req.params.id,
      ]
    );

    res.json({ message: "Revisión guardada" });
  } catch (err) {
    res.status(500).json(err);
  }
});

router.delete("/proyectos/:id", (req, res) => {
  db.query(
    `UPDATE proyectos
     SET Activo = 0
     WHERE ProyectoID = ?`,
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Proyecto eliminado" });
    }
  );
});

// ══════════════════════════════════════════
// GET /proyectos/:id — SIEMPRE AL FINAL
// ══════════════════════════════════════════

router.get("/proyectos/:id", (req, res) => {
  db.query(
    `SELECT 
      p.*,
      a.Nombre AS NombreAlumno,
      a.Email AS EmailAlumno,
      pr.Nombre AS NombreProfesor,
      pr.Email AS EmailProfesor,
      ep.EventoProyectoID,
      ep.FechaEvaluacion AS FechaCita,
      ep.HoraInicio AS HoraCita,
      ep.Sala,
      ep.Estado AS EstadoCita,
      COALESCE(ep.TokenQR, ep.QRCode) AS CodigoQR,
      ep.TokenQR,
      (
        SELECT COUNT(*)
        FROM etapasproyecto e
        WHERE e.ProyectoID = p.ProyectoID
      ) AS TotalEtapas,
      (
        SELECT COUNT(*)
        FROM etapasproyecto e
        WHERE e.ProyectoID = p.ProyectoID
          AND e.Completada = 1
      ) AS EtapasCompletadas
     FROM proyectos p
     LEFT JOIN usuarios a ON p.AlumnoID = a.UsuarioID
     LEFT JOIN usuarios pr ON p.ProfesorID = pr.UsuarioID
     LEFT JOIN eventoproyectos ep ON ep.EventoProyectoID = (
       SELECT ep2.EventoProyectoID
       FROM eventoproyectos ep2
       WHERE ep2.ProyectoID = p.ProyectoID
       ORDER BY FIELD(ep2.Estado, 'aceptado', 'pendiente', 'rechazado'),
                ep2.FechaRevision DESC,
                ep2.CreatedAt DESC,
                ep2.EventoProyectoID DESC
       LIMIT 1
     )
     WHERE p.ProyectoID = ?`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);

      if (!results.length) {
        return res.status(404).json({ message: "Proyecto no encontrado" });
      }

      res.json(normalizarEstadoProyecto(results[0]));
    }
  );
});

module.exports = router;
