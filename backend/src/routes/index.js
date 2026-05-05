// index.js — v2.1 + QR en aprobación + endpoint escaneo QR
const express = require("express");
const crypto  = require("crypto");
const router  = express.Router();
const db       = require("../services/database");
const dbPromise = db.promise();

// FUNCIONES UTILITARIAS

function normalizarTexto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function obtenerEntero(valor, fallback = null) {
  if (valor === undefined || valor === null || valor === "") return fallback;
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : fallback;
}

function validarRubricaPayload(body = {}) {
  const Nombre = normalizarTexto(body.Nombre || body.nombre);
  const Descripcion = normalizarTexto(body.Descripcion || body.descripcion) || null;
  const criteriosEntrada = Array.isArray(body.criterios) ? body.criterios : [];

  if (!Nombre) throw new Error("El nombre de la rúbrica es obligatorio");
  if (!criteriosEntrada.length) throw new Error("Debes registrar al menos un criterio");

  const criterios = criteriosEntrada.map((criterio, indexCriterio) => {
    const nombre = normalizarTexto(criterio.nombre || criterio.Nombre);
    const descripcion = normalizarTexto(criterio.descripcion || criterio.Descripcion) || null;
    const orden = obtenerEntero(criterio.orden || criterio.Orden, indexCriterio + 1);
    const nivelesEntrada = Array.isArray(criterio.niveles) ? criterio.niveles : [];

    if (!nombre) throw new Error(`El criterio ${indexCriterio + 1} debe tener nombre`);
    if (nivelesEntrada.length !== 4) throw new Error(`El criterio "${nombre}" debe tener exactamente 4 niveles`);

    const niveles = nivelesEntrada.map((nivel, indexNivel) => {
      const nombreNivel = normalizarTexto(nivel.nombre || nivel.Nombre);
      const descripcionNivel = normalizarTexto(nivel.descripcion || nivel.Descripcion);
      const puntaje = obtenerEntero(nivel.puntaje ?? nivel.Puntaje, null);
      const ordenNivel = obtenerEntero(nivel.orden || nivel.Orden, indexNivel + 1);

      if (!nombreNivel) throw new Error(`El criterio "${nombre}" tiene un nivel sin nombre`);
      if (puntaje === null || puntaje < 0) throw new Error(`El nivel "${nombreNivel}" del criterio "${nombre}" tiene un puntaje inválido`);
      if (!descripcionNivel) throw new Error(`El nivel "${nombreNivel}" del criterio "${nombre}" debe tener descripción`);

      return { nombre: nombreNivel, puntaje, descripcion: descripcionNivel, orden: ordenNivel };
    });

    const ordenesNivel = new Set(niveles.map(n => n.orden));
    if (ordenesNivel.size !== niveles.length) throw new Error(`El criterio "${nombre}" tiene niveles con orden repetido`);
    niveles.sort((a, b) => a.orden - b.orden);

    return {
      nombre, descripcion, orden,
      puntosMax: Math.max(...niveles.map(n => n.puntaje)),
      niveles,
    };
  });

  const ordenesCriterio = new Set(criterios.map(c => c.orden));
  if (ordenesCriterio.size !== criterios.length) throw new Error("Hay criterios con orden repetido");
  criterios.sort((a, b) => a.orden - b.orden);

  return { Nombre, Descripcion, criterios };
}

// ══════════════════════════════════════════
// USUARIOS
// ══════════════════════════════════════════

router.get("/usuarios", (req, res) => {
  const { rol } = req.query;
  let query = "SELECT * FROM usuarios";
  const params = [];
  if (rol) { query += " WHERE Rol = ?"; params.push(rol); }
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

router.post("/usuarios", (req, res) => {
  const { Nombre, Email, Rol, Contraseña } = req.body;
  if (!Nombre || !Email || !Rol || !Contraseña)
    return res.status(400).json({ message: "Faltan campos obligatorios" });

  db.query(
    "INSERT INTO usuarios (Nombre, Email, Contraseña, Rol) VALUES (?, ?, ?, ?)",
    [Nombre, Email, Contraseña, Rol],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Usuario creado", UsuarioID: result.insertId });
    }
  );
});

router.put("/usuarios/:id", (req, res) => {
  const { Nombre, Email, Rol, Contraseña } = req.body;
  const campos = [], valores = [];
  if (Nombre)    { campos.push("Nombre = ?");    valores.push(Nombre); }
  if (Email)     { campos.push("Email = ?");     valores.push(Email); }
  if (Rol)       { campos.push("Rol = ?");       valores.push(Rol); }
  if (Contraseña){ campos.push("Contraseña = ?"); valores.push(Contraseña); }
  if (!campos.length) return res.status(400).json({ message: "Nada que actualizar" });

  valores.push(req.params.id);
  db.query(`UPDATE usuarios SET ${campos.join(", ")} WHERE UsuarioID = ?`, valores, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Usuario actualizado" });
  });
});

router.put("/usuarios/:id/toggle", (req, res) => {
  db.query("UPDATE usuarios SET Activo = NOT Activo WHERE UsuarioID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Estado actualizado" });
  });
});

// ══════════════════════════════════════════
// EVENTOS — estáticas ANTES de /:id
// ══════════════════════════════════════════

// GET comparativa de eventos por promedio de evaluaciones
router.get("/eventos/comparativa", async (req, res) => {
  try {
    const [rows] = await dbPromise.query(
      `SELECT
         ev.EventoID,
         ev.Nombre AS NombreEvento,
         ev.Fecha,
         ev.Estado,
         COUNT(DISTINCT ep.ProyectoID)          AS TotalProyectos,
         COUNT(DISTINCT eval.EvaluacionID)       AS TotalEvaluaciones,
         COALESCE(AVG(eval.PuntajeTotal), 0)     AS PromedioGeneral,
         COALESCE(MAX(eval.PuntajeTotal), 0)     AS MejorPuntaje,
         COALESCE(MIN(eval.PuntajeTotal), 0)     AS PeorPuntaje
       FROM eventos ev
       LEFT JOIN eventoproyectos ep   ON ev.EventoID = ep.EventoID AND ep.Estado = 'aceptado'
       LEFT JOIN evaluaciones eval    ON eval.ProyectoID = ep.ProyectoID
       GROUP BY ev.EventoID
       ORDER BY ev.Fecha DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET todos los eventos
router.get("/eventos", (req, res) => {
  db.query("SELECT * FROM eventos ORDER BY Fecha DESC", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// POST crear evento
router.post("/eventos", (req, res) => {
  const { Nombre, Descripcion, Fecha, HoraInicio, HoraFin, Estado, RubricaID } = req.body;
  if (!Nombre || !Fecha || !HoraInicio || !HoraFin)
    return res.status(400).json({ message: "Faltan campos obligatorios" });

  db.query(
    "INSERT INTO eventos (Nombre, Descripcion, Fecha, HoraInicio, HoraFin, Estado, RubricaID) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [Nombre, Descripcion || null, Fecha, HoraInicio, HoraFin, Estado || "proximo", RubricaID || null],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Evento creado", EventoID: result.insertId });
    }
  );
});

// PUT editar evento
router.put("/eventos/:id", (req, res) => {
  const { Nombre, Descripcion, Fecha, HoraInicio, HoraFin, Estado, RubricaID } = req.body;
  const campos = [], valores = [];
  if (Nombre)                    { campos.push("Nombre = ?");      valores.push(Nombre); }
  if (Descripcion !== undefined) { campos.push("Descripcion = ?"); valores.push(Descripcion); }
  if (Fecha)                     { campos.push("Fecha = ?");       valores.push(Fecha); }
  if (HoraInicio)                { campos.push("HoraInicio = ?");  valores.push(HoraInicio); }
  if (HoraFin)                   { campos.push("HoraFin = ?");     valores.push(HoraFin); }
  if (Estado)                    { campos.push("Estado = ?");      valores.push(Estado); }
  if (RubricaID !== undefined)   { campos.push("RubricaID = ?");   valores.push(RubricaID || null); }
  if (!campos.length) return res.status(400).json({ message: "Nada que actualizar" });

  valores.push(req.params.id);
  db.query(`UPDATE eventos SET ${campos.join(", ")} WHERE EventoID = ?`, valores, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Evento actualizado" });
  });
});

// DELETE evento
router.delete("/eventos/:id", (req, res) => {
  db.query("DELETE FROM eventos WHERE EventoID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Evento eliminado" });
  });
});

// GET ranking de proyectos de un evento ordenado por puntaje DESC
router.get("/eventos/:id/ranking", async (req, res) => {
  try {
    const [rows] = await dbPromise.query(
      `SELECT
         p.ProyectoID,
         p.Titulo,
         p.Progreso,
         u.Nombre AS NombreAlumno,
         ep.Estado AS EstadoInscripcion,
         COUNT(DISTINCT eval.EvaluacionID)    AS TotalEvaluaciones,
         COALESCE(SUM(eval.PuntajeTotal), 0)  AS PuntajeTotal,
         COALESCE(AVG(eval.PuntajeTotal), 0)  AS Promedio,
         COALESCE(MAX(eval.PuntajeTotal), 0)  AS MejorPuntaje
       FROM eventoproyectos ep
       JOIN proyectos p       ON ep.ProyectoID  = p.ProyectoID
       JOIN usuarios u        ON p.AlumnoID     = u.UsuarioID
       LEFT JOIN evaluaciones eval ON eval.ProyectoID = p.ProyectoID
       WHERE ep.EventoID = ? AND ep.Estado = 'aceptado'
       GROUP BY p.ProyectoID
       ORDER BY PuntajeTotal DESC, Promedio DESC`,
      [req.params.id]
    );

    const ranked = rows.map((r, i) => ({
      ...r,
      Posicion: i + 1,
      Promedio: parseFloat(r.Promedio).toFixed(2),
    }));

    res.json(ranked);
  } catch (err) {
    res.status(500).json(err);
  }
});

// ══════════════════════════════════════════
// AULAS
// ══════════════════════════════════════════

router.get("/aulas", (req, res) => {
  db.query("SELECT * FROM aulas ORDER BY Nombre", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

router.post("/aulas", (req, res) => {
  const { Nombre, Capacidad } = req.body;
  if (!Nombre) return res.status(400).json({ message: "El nombre es obligatorio" });
  db.query("INSERT INTO aulas (Nombre, Capacidad) VALUES (?, ?)", [Nombre, Capacidad || null], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Aula creada", AulaID: result.insertId });
  });
});

router.delete("/aulas/:id", (req, res) => {
  db.query("DELETE FROM aulas WHERE AulaID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Aula eliminada" });
  });
});

// ══════════════════════════════════════════
// HORARIOS
// ══════════════════════════════════════════

router.get("/eventos/:id/horarios", (req, res) => {
  db.query(
    `SELECT h.*, a.Nombre AS NombreAula
     FROM horariosevento h JOIN aulas a ON h.AulaID = a.AulaID
     WHERE h.EventoID = ? ORDER BY h.HoraInicio`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

router.post("/horarios", (req, res) => {
  const { EventoID, AulaID, HoraInicio, HoraFin } = req.body;
  if (!EventoID || !AulaID || !HoraInicio || !HoraFin)
    return res.status(400).json({ message: "Faltan campos obligatorios" });

  db.query("INSERT INTO horariosevento (EventoID, AulaID, HoraInicio, HoraFin) VALUES (?, ?, ?, ?)",
    [EventoID, AulaID, HoraInicio, HoraFin],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Horario agregado", HorarioID: result.insertId });
    }
  );
});

router.put("/horarios/:id", (req, res) => {
  const { Disponible } = req.body;
  db.query("UPDATE horariosevento SET Disponible = ? WHERE HorarioID = ?", [Disponible, req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Horario actualizado" });
  });
});

router.delete("/horarios/:id", (req, res) => {
  db.query("DELETE FROM horariosevento WHERE HorarioID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Horario eliminado" });
  });
});

// ══════════════════════════════════════════
// RÚBRICAS
// ══════════════════════════════════════════

router.get("/rubricas", async (req, res) => {
  try {
    const [results] = await dbPromise.query(
      `SELECT r.RubricaID, r.ProfesorID, r.Nombre, r.Descripcion, r.Activa, r.CreatedAt,
              u.Nombre AS NombreProfesor,
              COALESCE(stats.TotalCriterios, 0) AS TotalCriterios,
              COALESCE(stats.TotalNiveles, 0)   AS TotalNiveles,
              COALESCE(stats.PuntajeMaximo, 0)  AS PuntajeMaximo
       FROM rubricas r
       LEFT JOIN usuarios u ON r.ProfesorID = u.UsuarioID
       LEFT JOIN (
         SELECT c.RubricaID,
                COUNT(DISTINCT c.CriterioID) AS TotalCriterios,
                COUNT(n.NivelID)             AS TotalNiveles,
                COALESCE(SUM(c.PuntosMax),0) AS PuntajeMaximo
         FROM criteriosrubrica c
         LEFT JOIN nivelescriterio n ON c.CriterioID = n.CriterioID
         GROUP BY c.RubricaID
       ) stats ON stats.RubricaID = r.RubricaID
       ORDER BY r.CreatedAt DESC`
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener rúbricas", error: err });
  }
});

router.get("/rubricas/:id", async (req, res) => {
  try {
    const [[rubrica]] = await dbPromise.query(
      `SELECT r.RubricaID, r.ProfesorID, r.Nombre, r.Descripcion, r.Activa, r.CreatedAt,
              u.Nombre AS NombreProfesor
       FROM rubricas r LEFT JOIN usuarios u ON r.ProfesorID = u.UsuarioID
       WHERE r.RubricaID = ?`,
      [req.params.id]
    );
    if (!rubrica) return res.status(404).json({ message: "Rúbrica no encontrada" });

    const [rows] = await dbPromise.query(
      `SELECT c.CriterioID, c.Nombre AS CriterioNombre, c.Descripcion AS CriterioDescripcion,
              c.PuntosMax, c.Orden AS CriterioOrden,
              n.NivelID, n.Nombre AS NivelNombre, n.Puntaje, n.Descripcion AS NivelDescripcion, n.Orden AS NivelOrden
       FROM criteriosrubrica c
       LEFT JOIN nivelescriterio n ON c.CriterioID = n.CriterioID
       WHERE c.RubricaID = ? ORDER BY c.Orden ASC, n.Orden ASC`,
      [req.params.id]
    );

    const criteriosMap = new Map();
    rows.forEach(row => {
      if (!criteriosMap.has(row.CriterioID)) {
        criteriosMap.set(row.CriterioID, {
          CriterioID: row.CriterioID,
          Nombre: row.CriterioNombre,
          Descripcion: row.CriterioDescripcion,
          PuntosMax: row.PuntosMax,
          Orden: row.CriterioOrden,
          niveles: [],
        });
      }
      if (row.NivelID) {
        criteriosMap.get(row.CriterioID).niveles.push({
          NivelID: row.NivelID,
          Nombre: row.NivelNombre,
          Puntaje: row.Puntaje,
          Descripcion: row.NivelDescripcion,
          Orden: row.NivelOrden,
        });
      }
    });

    rubrica.criterios = Array.from(criteriosMap.values());
    res.json(rubrica);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener rúbrica", error: err });
  }
});

router.post("/rubricas", async (req, res) => {
  let payload;
  try {
    payload = validarRubricaPayload(req.body);
  } catch (validationError) {
    return res.status(400).json({ message: validationError.message });
  }

  try {
    await dbPromise.beginTransaction();
    const profesorId = parseInt(req.body.ProfesorID, 10) || 1;
    const [rubricaResult] = await dbPromise.query(
      "INSERT INTO rubricas (ProfesorID, Nombre, Descripcion) VALUES (?, ?, ?)",
      [profesorId, payload.Nombre, payload.Descripcion]
    );
    const rubricaId = rubricaResult.insertId;

    for (const criterio of payload.criterios) {
      const [criterioResult] = await dbPromise.query(
        `INSERT INTO criteriosrubrica (RubricaID, Nombre, Descripcion, PuntosMax, Orden) VALUES (?, ?, ?, ?, ?)`,
        [rubricaId, criterio.nombre, criterio.descripcion, criterio.puntosMax, criterio.orden]
      );
      const criterioId = criterioResult.insertId;
      const nivelesValues = criterio.niveles.map(n => [criterioId, n.nombre, n.puntaje, n.descripcion, n.orden]);
      await dbPromise.query(
        "INSERT INTO nivelescriterio (CriterioID, Nombre, Puntaje, Descripcion, Orden) VALUES ?",
        [nivelesValues]
      );
    }

    await dbPromise.commit();
    res.status(201).json({ message: "Rúbrica creada correctamente", RubricaID: rubricaId });
  } catch (err) {
    try { await dbPromise.rollback(); } catch (_) {}
    res.status(500).json({ message: "Error al crear rúbrica", error: err });
  }
});

router.delete("/rubricas/:id", async (req, res) => {
  try {
    const [[rubrica]] = await dbPromise.query("SELECT RubricaID FROM rubricas WHERE RubricaID = ?", [req.params.id]);
    if (!rubrica) return res.status(404).json({ message: "Rúbrica no encontrada" });

    const [[evaluaciones]] = await dbPromise.query(
      "SELECT COUNT(*) AS Total FROM evaluaciones WHERE RubricaID = ?", [req.params.id]
    );
    if (evaluaciones.Total > 0) {
      return res.status(409).json({ message: "No se puede eliminar porque ya tiene evaluaciones registradas" });
    }

    await dbPromise.beginTransaction();
    const [criterios] = await dbPromise.query("SELECT CriterioID FROM criteriosrubrica WHERE RubricaID = ?", [req.params.id]);
    const criterioIds = criterios.map(c => c.CriterioID);
    if (criterioIds.length) {
      const ph = criterioIds.map(() => "?").join(",");
      await dbPromise.query(`DELETE FROM nivelescriterio WHERE CriterioID IN (${ph})`, criterioIds);
    }
    await dbPromise.query("DELETE FROM criteriosrubrica WHERE RubricaID = ?", [req.params.id]);
    await dbPromise.query("DELETE FROM rubricas WHERE RubricaID = ?", [req.params.id]);
    await dbPromise.commit();
    res.json({ message: "Rúbrica eliminada" });
  } catch (err) {
    try { await dbPromise.rollback(); } catch (_) {}
    res.status(500).json({ message: "Error al eliminar rúbrica", error: err });
  }
});

// ══════════════════════════════════════════
// PROYECTOS EN EVENTOS
// ══════════════════════════════════════════

router.get("/eventos/proyectos", (req, res) => {
  const { eventoId, estado, proyectoId } = req.query;
  let query = `
    SELECT ep.EventoProyectoID, ep.Estado, ep.CreatedAt, ep.HorarioID,
           ep.QRCode, ep.TokenQR,
           ep.FechaEvaluacion, ep.HoraInicio AS HoraEval, ep.HoraFin AS HoraFinEval,
           ep.Sala AS SalaEval, ep.ComentarioAdmin,
           p.Titulo AS TituloProyecto, p.ProyectoID,
           e.Nombre AS NombreEvento, e.Fecha AS FechaEvento,
           u.Nombre AS NombreAlumno,
           a.Nombre AS NombreAula, h.HoraInicio, h.HoraFin,
           GROUP_CONCAT(ev_u.Nombre SEPARATOR ', ') AS Evaluadores
    FROM eventoproyectos ep
    JOIN proyectos p        ON ep.ProyectoID = p.ProyectoID
    JOIN eventos e          ON ep.EventoID   = e.EventoID
    JOIN usuarios u         ON p.AlumnoID    = u.UsuarioID
    LEFT JOIN horariosevento h  ON ep.HorarioID  = h.HorarioID
    LEFT JOIN aulas a           ON h.AulaID       = a.AulaID
    LEFT JOIN evaluadoresevento ee  ON ep.EventoProyectoID = ee.EventoProyectoID
    LEFT JOIN usuarios ev_u         ON ee.ProfesorID       = ev_u.UsuarioID
    WHERE 1=1`;
  const params = [];
  if (eventoId)   { query += " AND ep.EventoID   = ?"; params.push(eventoId); }
  if (estado)     { query += " AND ep.Estado      = ?"; params.push(estado); }
  if (proyectoId) { query += " AND ep.ProyectoID  = ?"; params.push(proyectoId); }
  query += " GROUP BY ep.EventoProyectoID ORDER BY ep.CreatedAt DESC";

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// REEMPLAZA ESTA SECCIÓN EN backend/src/routes/index.js (líneas 497-524)
// PUT /api/eventos/proyectos/:id/estado

router.put("/eventos/proyectos/:id/estado", async (req, res) => {
  const { Estado } = req.body;
  if (!["pendiente", "aceptado", "rechazado"].includes(Estado))
    return res.status(400).json({ message: "Estado inválido" });

  try {
    if (Estado === "aceptado") {
      // Obtener QRCode existente para no regenerarlo
      const [[ep]] = await dbPromise.query(
        "SELECT EventoProyectoID, QRCode, TokenQR FROM eventoproyectos WHERE EventoProyectoID = ?",
        [req.params.id]
      );

      if (!ep) {
        return res.status(404).json({ message: "EventoProyecto no encontrado" });
      }

      // Generar QR token si aún no existe — el alumno lo mostrará el día de la exposición
      const qrToken = ep.QRCode || crypto.randomBytes(16).toString("hex");

      await dbPromise.query(
        `UPDATE eventoproyectos
         SET Estado = ?,
             QRCode = ?,
             TokenQR = ?,
             FechaRevision = NOW()
         WHERE EventoProyectoID = ?`,
        [Estado, qrToken, qrToken, req.params.id]
      );

      // Sync project approval status so alumno sees "Aprobado" immediately
      await dbPromise.query(
        `UPDATE proyectos SET EstadoAprobacion = 'aceptado'
         WHERE ProyectoID = (SELECT ProyectoID FROM eventoproyectos WHERE EventoProyectoID = ?)`,
        [req.params.id]
      );

      return res.json({
        message: "Inscripción aceptada. QR generado — el alumno ya puede verlo.",
        QRCode: qrToken,
        TokenQR: qrToken
      });
    }

    // Para rechazado y otros estados
    if (Estado === "rechazado") {
      const { ComentarioAdmin } = req.body;

      await dbPromise.query(
        `UPDATE eventoproyectos
         SET Estado = ?,
             ComentarioAdmin = ?,
             FechaRevision = NOW()
         WHERE EventoProyectoID = ?`,
        [Estado, ComentarioAdmin || null, req.params.id]
      );

      await dbPromise.query(
        `UPDATE proyectos SET EstadoAprobacion = 'rechazado'
         WHERE ProyectoID = (SELECT ProyectoID FROM eventoproyectos WHERE EventoProyectoID = ?)`,
        [req.params.id]
      );

      return res.json({
        message: "Proyecto rechazado",
        comentario: ComentarioAdmin || null
      });
    }

    // Estado pendiente o cualquier otro
    await dbPromise.query(
      `UPDATE eventoproyectos 
       SET Estado = ?,
           FechaRevision = NOW()
       WHERE EventoProyectoID = ?`,
      [Estado, req.params.id]
    );

    res.json({ message: "Estado actualizado" });
  } catch (err) {
    console.error("Error PUT /eventos/proyectos/:id/estado:", err);
    res.status(500).json({ message: "Error al actualizar estado", error: err.message });
  }
});

router.get("/eventos/:id/proyectos/aceptados", (req, res) => {
  db.query(
    `SELECT ep.EventoProyectoID,
            p.Titulo AS TituloProyecto,
            a.Nombre AS NombreAula, h.HoraInicio, h.HoraFin,
            GROUP_CONCAT(u.Nombre SEPARATOR ', ') AS Evaluadores
     FROM eventoproyectos ep
     JOIN proyectos p        ON ep.ProyectoID  = p.ProyectoID
     LEFT JOIN horariosevento h ON ep.HorarioID = h.HorarioID
     LEFT JOIN aulas a          ON h.AulaID     = a.AulaID
     LEFT JOIN evaluadoresevento ev ON ep.EventoProyectoID = ev.EventoProyectoID
     LEFT JOIN usuarios u        ON ev.ProfesorID = u.UsuarioID
     WHERE ep.EventoID = ? AND ep.Estado = 'aceptado'
     GROUP BY ep.EventoProyectoID`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

router.post("/eventos/proyectos/:id/evaluadores", (req, res) => {
  const { profesores } = req.body;
  if (!profesores || !profesores.length)
    return res.status(400).json({ message: "Selecciona al menos un profesor" });

  db.query("DELETE FROM evaluadoresevento WHERE EventoProyectoID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    const valores = profesores.map(pid => [req.params.id, pid]);
    db.query("INSERT INTO evaluadoresevento (EventoProyectoID, ProfesorID) VALUES ?", [valores], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json({ message: "Evaluadores asignados" });
    });
  });
});

router.post("/eventos/proyectos", async (req, res) => {
  const { EventoID, ProyectoID, Descripcion, Participantes, Asesores } = req.body;
  if (!EventoID || !ProyectoID)
    return res.status(400).json({ message: "EventoID y ProyectoID son obligatorios" });

  try {
    const [existente] = await dbPromise.query(
      "SELECT EventoProyectoID FROM eventoproyectos WHERE EventoID = ? AND ProyectoID = ?",
      [EventoID, ProyectoID]
    );
    if (existente.length > 0)
      return res.status(409).json({ message: "Este proyecto ya está inscrito en el evento" });

    const [result] = await dbPromise.query(
      `INSERT INTO eventoproyectos (EventoID, ProyectoID, Estado, QRCode) VALUES (?, ?, 'pendiente', NULL)`,
      [EventoID, ProyectoID]
    );
    const eventoProyectoId = result.insertId;

    if (Descripcion) {
      await dbPromise.query("UPDATE proyectos SET Descripcion = ? WHERE ProyectoID = ?", [Descripcion, ProyectoID]);
    }

    if (Array.isArray(Participantes) && Participantes.length) {
      await dbPromise.query("DELETE FROM proyectoparticipantes WHERE ProyectoID = ?", [ProyectoID]);
      const valores = Participantes.map(p => [ProyectoID, p.id]);
      await dbPromise.query("INSERT INTO proyectoparticipantes (ProyectoID, UsuarioID) VALUES ?", [valores]);
    }

    res.status(201).json({
      message: "Inscripción enviada. El administrador la revisará pronto.",
      EventoProyectoID: eventoProyectoId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});

// ══════════════════════════════════════════
// ESCANEO QR — endpoint público para el evaluador
// GET /api/qr/:token → devuelve datos del proyecto + rúbrica
// ══════════════════════════════════════════

router.post("/qr/generar", async (req, res) => {
  try {
    const ProyectoID = obtenerEntero(req.body.ProyectoID, null);
    const AlumnoID = obtenerEntero(req.body.AlumnoID, null);
    const EventoProyectoID = obtenerEntero(req.body.EventoProyectoID, null);

    if (!ProyectoID || !AlumnoID) {
      return res.status(400).json({ message: "ProyectoID y AlumnoID son obligatorios" });
    }

    const params = [ProyectoID, AlumnoID];
    let filtroEventoProyecto = "";
    if (EventoProyectoID) {
      filtroEventoProyecto = " AND ep.EventoProyectoID = ?";
      params.push(EventoProyectoID);
    }

    const [[inscripcion]] = await dbPromise.query(
      `SELECT ep.EventoProyectoID, ep.EventoID, ep.ProyectoID, ep.Estado,
              p.AlumnoID, p.Titulo,
              ev.Nombre AS NombreEvento
       FROM eventoproyectos ep
       JOIN proyectos p ON p.ProyectoID = ep.ProyectoID
       JOIN eventos ev ON ev.EventoID = ep.EventoID
       WHERE ep.ProyectoID = ?
         AND p.AlumnoID = ?
         AND ep.Estado = 'aceptado'
         ${filtroEventoProyecto}
       ORDER BY ep.FechaRevision DESC, ep.CreatedAt DESC
       LIMIT 1`,
      params
    );

    if (!inscripcion) {
      return res.status(403).json({
        message: "El proyecto debe estar aprobado por admin antes de generar QR"
      });
    }

    const [[limite]] = await dbPromise.query(
      `SELECT COUNT(*) AS Total
       FROM qr_sessions
       WHERE ProyectoID = ?
         AND AlumnoID = ?
         AND CreatedAt >= CURDATE()`,
      [ProyectoID, AlumnoID]
    );

    if (Number(limite?.Total || 0) >= 5) {
      return res.status(429).json({
        message: "Ya generaste 5 QR hoy. Usa el ultimo token activo o pide apoyo al administrador."
      });
    }

    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await dbPromise.query(
      `INSERT INTO qr_sessions
        (Token, ProyectoID, EventoProyectoID, AlumnoID, ExpiresAt)
       VALUES (?, ?, ?, ?, ?)`,
      [token, ProyectoID, inscripcion.EventoProyectoID, AlumnoID, expiresAt]
    );

    res.status(201).json({
      token,
      expiresAt,
      proyecto: {
        ProyectoID,
        Titulo: inscripcion.Titulo,
        EventoProyectoID: inscripcion.EventoProyectoID,
        NombreEvento: inscripcion.NombreEvento,
      },
      evaluacionUrl: `/src/pages/evaluar-qr.html?token=${encodeURIComponent(token)}`
    });
  } catch (err) {
    console.error("POST /api/qr/generar:", err);

    if (err?.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "Falta la tabla qr_sessions. Ejecuta la migracion db/migrations/20260502_frontend_flow_fixes.sql"
      });
    }

    res.status(500).json({ message: "Error al generar QR temporal", error: err.message });
  }
});

router.get("/qr/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) return res.status(400).json({ message: "Token requerido" });

    const [[ep]] = await dbPromise.query(
      `SELECT ep.EventoProyectoID, ep.EventoID, ep.ProyectoID,
              ep.HorarioID, ep.QRCode,
              qs.QRSessionID, qs.ExpiresAt, qs.UsedAt,
              p.Titulo, p.Descripcion, p.Categoria, p.Progreso,
              p.AlumnoID, p.ProfesorID,
              al.Nombre AS NombreAlumno,  al.Email AS EmailAlumno,
              pr.Nombre AS NombreProfesor,
              ev.Nombre AS NombreEvento,  ev.Fecha AS FechaEvento,
              ev.RubricaID,
              COALESCE(ep.HoraInicio, h.HoraInicio) AS HoraInicio,
              COALESCE(ep.HoraFin, h.HoraFin) AS HoraFin,
              COALESCE(ep.Sala, au.Nombre) AS NombreAula
       FROM eventoproyectos ep
       JOIN proyectos  p  ON ep.ProyectoID = p.ProyectoID
       JOIN usuarios   al ON p.AlumnoID    = al.UsuarioID
       LEFT JOIN usuarios   pr ON p.ProfesorID   = pr.UsuarioID
       JOIN eventos    ev ON ep.EventoID   = ev.EventoID
       LEFT JOIN horariosevento h  ON ep.HorarioID   = h.HorarioID
       LEFT JOIN aulas          au ON h.AulaID        = au.AulaID
       LEFT JOIN qr_sessions qs
              ON qs.EventoProyectoID = ep.EventoProyectoID
             AND qs.Token = ?
       WHERE (
           (qs.Token = ? AND qs.ExpiresAt > NOW())
           OR ep.QRCode = ?
           OR ep.TokenQR = ?
         )
         AND ep.Estado = 'aceptado'
       ORDER BY qs.CreatedAt DESC
       LIMIT 1`,
      [token, token, token, token]
    );
    if (!ep) return res.status(404).json({ message: "QR invalido, expirado o proyecto no aprobado" });

    if (ep.QRSessionID && !ep.UsedAt) {
      await dbPromise.query(
        "UPDATE qr_sessions SET UsedAt = NOW() WHERE QRSessionID = ?",
        [ep.QRSessionID]
      );
    }

    // Obtener rúbrica del evento
    let rubrica = null;
    if (ep.RubricaID) {
      const [[r]] = await dbPromise.query(
        "SELECT RubricaID, Nombre, Descripcion FROM rubricas WHERE RubricaID = ?",
        [ep.RubricaID]
      );
      if (r) {
        const [rows] = await dbPromise.query(
          `SELECT c.CriterioID, c.Nombre AS CriterioNombre, c.PuntosMax, c.Orden AS CriterioOrden,
                  n.NivelID, n.Nombre AS NivelNombre, n.Puntaje, n.Descripcion AS NivelDesc, n.Orden AS NivelOrden
           FROM criteriosrubrica c
           LEFT JOIN nivelescriterio n ON c.CriterioID = n.CriterioID
           WHERE c.RubricaID = ? ORDER BY c.Orden ASC, n.Orden ASC`,
          [ep.RubricaID]
        );
        const mapa = new Map();
        rows.forEach(row => {
          if (!mapa.has(row.CriterioID)) {
            mapa.set(row.CriterioID, {
              CriterioID: row.CriterioID, Nombre: row.CriterioNombre,
              PuntosMax: row.PuntosMax, Orden: row.CriterioOrden, niveles: []
            });
          }
          if (row.NivelID) {
            mapa.get(row.CriterioID).niveles.push({
              NivelID: row.NivelID, Nombre: row.NivelNombre,
              Puntaje: row.Puntaje, Descripcion: row.NivelDesc, Orden: row.NivelOrden
            });
          }
        });
        rubrica = { ...r, criterios: Array.from(mapa.values()) };
      }
    }

    // Si el evento no tiene rúbrica, usar la primera rúbrica activa
    if (!rubrica) {
      const [[r]] = await dbPromise.query(
        "SELECT RubricaID, Nombre, Descripcion FROM rubricas WHERE Activa = 1 ORDER BY RubricaID LIMIT 1"
      );
      if (r) {
        const [rows] = await dbPromise.query(
          `SELECT c.CriterioID, c.Nombre AS CriterioNombre, c.PuntosMax, c.Orden AS CriterioOrden,
                  n.NivelID, n.Nombre AS NivelNombre, n.Puntaje, n.Descripcion AS NivelDesc, n.Orden AS NivelOrden
           FROM criteriosrubrica c
           LEFT JOIN nivelescriterio n ON c.CriterioID = n.CriterioID
           WHERE c.RubricaID = ? ORDER BY c.Orden ASC, n.Orden ASC`,
          [r.RubricaID]
        );
        const mapa = new Map();
        rows.forEach(row => {
          if (!mapa.has(row.CriterioID)) {
            mapa.set(row.CriterioID, {
              CriterioID: row.CriterioID, Nombre: row.CriterioNombre,
              PuntosMax: row.PuntosMax, Orden: row.CriterioOrden, niveles: []
            });
          }
          if (row.NivelID) {
            mapa.get(row.CriterioID).niveles.push({
              NivelID: row.NivelID, Nombre: row.NivelNombre,
              Puntaje: row.Puntaje, Descripcion: row.NivelDesc, Orden: row.NivelOrden
            });
          }
        });
        rubrica = { ...r, criterios: Array.from(mapa.values()) };
      }
    }

    res.json({
      evento: { EventoID: ep.EventoID, Nombre: ep.NombreEvento, Fecha: ep.FechaEvento },
      proyecto: {
        ProyectoID: ep.ProyectoID, Titulo: ep.Titulo,
        Descripcion: ep.Descripcion, Categoria: ep.Categoria,
        Progreso: ep.Progreso,
        NombreAlumno: ep.NombreAlumno,   EmailAlumno: ep.EmailAlumno,
        NombreProfesor: ep.NombreProfesor,
      },
      horario: {
        HoraInicio: ep.HoraInicio, HoraFin: ep.HoraFin, NombreAula: ep.NombreAula
      },
      rubrica,
      qr: {
        QRSessionID: ep.QRSessionID || null,
        ExpiresAt: ep.ExpiresAt || null,
      },
    });
  } catch (err) {
    console.error("GET /api/qr/:token:", err);
    res.status(500).json({ message: "Error al cargar QR", error: err.message });
  }
});

module.exports = router;
