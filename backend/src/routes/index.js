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

async function calcularResultadosEvento(eventoId) {
  const [promedios] = await dbPromise.query(
    `SELECT
       ep.EventoID,
       ep.ProyectoID,
       ROUND(AVG(ee.PuntajeTotal), 2) AS PromedioFinal,
       COUNT(DISTINCT ee.ProfesorID) AS TotalEvaluadores
     FROM eventoproyectos ep
     JOIN evaluacionesevento ee
       ON ee.EventoID = ep.EventoID
      AND ee.ProyectoID = ep.ProyectoID
     WHERE ep.EventoID = ?
       AND ep.Estado = 'aceptado'
     GROUP BY ep.EventoID, ep.ProyectoID
     HAVING TotalEvaluadores > 0
     ORDER BY PromedioFinal DESC, ep.ProyectoID ASC`,
    [eventoId]
  );

  await dbPromise.query("DELETE FROM resultadosevento WHERE EventoID = ?", [eventoId]);

  if (!promedios.length) return [];

  const valores = promedios.map((row, index) => [
    eventoId,
    row.ProyectoID,
    row.PromedioFinal,
    index + 1,
  ]);

  await dbPromise.query(
    `INSERT INTO resultadosevento
       (EventoID, ProyectoID, PromedioFinal, Posicion)
     VALUES ?`,
    [valores]
  );

  return promedios.map((row, index) => ({ ...row, Posicion: index + 1 }));
}

async function obtenerPodio(eventoId = null) {
  const params = [];
  let where = "ev.Estado = 'finalizado' AND r.Posicion <= 3";

  if (eventoId) {
    where += " AND r.EventoID = ?";
    params.push(eventoId);
  }

  const [rows] = await dbPromise.query(
    `SELECT
       r.ResultadoID,
       r.EventoID,
       ev.Nombre AS NombreEvento,
       ev.Fecha AS FechaEvento,
       r.ProyectoID,
       p.Titulo,
       r.PromedioFinal,
       r.Posicion,
       al.Nombre AS NombreAlumno,
       COALESCE((
         SELECT GROUP_CONCAT(DISTINCT integrante.Nombre ORDER BY integrante.Nombre SEPARATOR ', ')
         FROM proyectoparticipantes pp
         JOIN usuarios integrante ON integrante.UsuarioID = pp.UsuarioID
         WHERE pp.ProyectoID = p.ProyectoID
       ), al.Nombre) AS Integrantes,
       apoyo.Nombre AS NombreProfesorApoyo,
       entrega.EntregaID,
       entrega.ArchivoEntrega,
       entrega.MimeType,
       entrega.RutaExterna
     FROM resultadosevento r
     JOIN eventos ev ON ev.EventoID = r.EventoID
     JOIN proyectos p ON p.ProyectoID = r.ProyectoID
     JOIN usuarios al ON al.UsuarioID = p.AlumnoID
     LEFT JOIN usuarios apoyo ON apoyo.UsuarioID = p.ProfesorID
     LEFT JOIN entregas entrega
       ON entrega.EntregaID = (
         SELECT e2.EntregaID
         FROM entregas e2
         WHERE e2.ProyectoID = p.ProyectoID
         ORDER BY e2.FechaEntrega DESC, e2.EntregaID DESC
         LIMIT 1
       )
     WHERE ${where}
     ORDER BY ev.Fecha DESC, r.Posicion ASC`,
    params
  );

  return rows;
}

function especialidadesRepetidas(rows) {
  const conteo = new Map();
  rows.forEach((row) => {
    String(row.Especialidades || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((nombre) => {
        conteo.set(nombre, (conteo.get(nombre) || 0) + 1);
      });
  });

  return Array.from(conteo.entries())
    .filter(([, total]) => total > 1)
    .map(([nombre]) => nombre);
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

router.post("/usuarios", async (req, res) => {
  const { Nombre, Email, Rol } = req.body;
  const password = req.body.Contraseña || req.body["ContraseÃ±a"] || req.body.Contrasena || req.body.Password;

  if (!Nombre || !Email || !Rol || !password) {
    return res.status(400).json({ message: "Faltan campos obligatorios" });
  }

  try {
    const [result] = await dbPromise.query(
      "INSERT INTO usuarios (Nombre, Email, Contraseña, Rol) VALUES (?, ?, ?, ?)",
      [Nombre, Email, password, Rol]
    );

    const [[usuario]] = await dbPromise.query(
      "SELECT UsuarioID, Nombre, Email, Rol, Activo, CreatedAt, UpdatedAt FROM usuarios WHERE UsuarioID = ?",
      [result.insertId]
    );

    res.status(201).json({ message: "Usuario creado", UsuarioID: result.insertId, usuario });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ya existe un usuario con ese correo" });
    }

    console.error("POST /api/usuarios:", err);
    res.status(500).json({ message: "Error al crear usuario", error: err.message });
  }
});

router.put("/usuarios/:id", async (req, res) => {
  const { Nombre, Email, Rol } = req.body;
  const password = req.body.Contraseña || req.body["ContraseÃ±a"] || req.body.Contrasena || req.body.Password;
  const campos = [], valores = [];

  if (Nombre) { campos.push("Nombre = ?"); valores.push(Nombre); }
  if (Email)  { campos.push("Email = ?"); valores.push(Email); }
  if (Rol)    { campos.push("Rol = ?"); valores.push(Rol); }
  if (password) { campos.push("Contraseña = ?"); valores.push(password); }
  if (!campos.length) return res.status(400).json({ message: "Nada que actualizar" });

  valores.push(req.params.id);

  try {
    const [result] = await dbPromise.query(
      `UPDATE usuarios SET ${campos.join(", ")} WHERE UsuarioID = ?`,
      valores
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const [[usuario]] = await dbPromise.query(
      "SELECT UsuarioID, Nombre, Email, Rol, Activo, CreatedAt, UpdatedAt FROM usuarios WHERE UsuarioID = ?",
      [req.params.id]
    );

    res.json({ message: "Usuario actualizado", usuario });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ya existe un usuario con ese correo" });
    }

    console.error("PUT /api/usuarios/:id:", err);
    res.status(500).json({ message: "Error al actualizar usuario", error: err.message });
  }
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
router.put("/eventos/:id", async (req, res) => {
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
  try {
    await dbPromise.query(`UPDATE eventos SET ${campos.join(", ")} WHERE EventoID = ?`, valores);

    let resultados = null;
    if (Estado === "finalizado") {
      resultados = await calcularResultadosEvento(req.params.id);
    }

    res.json({
      message: Estado === "finalizado"
        ? "Evento actualizado y podio recalculado"
        : "Evento actualizado",
      resultadosGenerados: resultados ? resultados.length : undefined,
    });
  } catch (err) {
    console.error("PUT /api/eventos/:id:", err);
    res.status(500).json({ message: "Error al actualizar evento", error: err.message });
  }
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
    const [resultados] = await dbPromise.query(
      `SELECT
         p.ProyectoID,
         p.Titulo,
         p.Progreso,
         u.Nombre AS NombreAlumno,
         ep.Estado AS EstadoInscripcion,
         r.Posicion,
         r.PromedioFinal AS Promedio,
         r.PromedioFinal AS PuntajeTotal,
         r.PromedioFinal AS MejorPuntaje,
         COUNT(DISTINCT ee.EvalEventoID) AS TotalEvaluaciones
       FROM resultadosevento r
       JOIN proyectos p ON p.ProyectoID = r.ProyectoID
       JOIN usuarios u ON u.UsuarioID = p.AlumnoID
       JOIN eventoproyectos ep ON ep.EventoID = r.EventoID AND ep.ProyectoID = r.ProyectoID
       LEFT JOIN evaluacionesevento ee ON ee.EventoID = r.EventoID AND ee.ProyectoID = r.ProyectoID
       WHERE r.EventoID = ?
       GROUP BY r.ResultadoID
       ORDER BY r.Posicion ASC`,
      [req.params.id]
    );

    if (resultados.length) {
      return res.json(resultados.map((r) => ({
        ...r,
        Promedio: Number(r.Promedio || 0).toFixed(2),
      })));
    }

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

router.get("/eventos/pasados/podio", async (_req, res) => {
  try {
    const rows = await obtenerPodio();
    res.json(rows);
  } catch (err) {
    console.error("GET /api/eventos/pasados/podio:", err);
    res.status(500).json({ message: "Error al cargar podios historicos", error: err.message });
  }
});

router.get("/eventos/:id/podio", async (req, res) => {
  try {
    const rows = await obtenerPodio(req.params.id);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/eventos/:id/podio:", err);
    res.status(500).json({ message: "Error al cargar podio", error: err.message });
  }
});

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

router.get("/eventos/:id/horarios-disponibles", async (req, res) => {
  try {
    const mostrarTodos = String(req.query.all || "") === "1";
    const [rows] = await dbPromise.query(
      `SELECT
         h.HorarioID,
         h.EventoID,
         h.AulaID,
         h.HoraInicio,
         h.HoraFin,
         h.Disponible,
         a.Nombre AS NombreAula,
         ocupada.EventoProyectoID AS OcupadoPor,
         CASE
           WHEN h.Disponible = 1 AND ocupada.EventoProyectoID IS NULL THEN 1
           ELSE 0
         END AS DisponibleReal
       FROM horariosevento h
       JOIN aulas a ON a.AulaID = h.AulaID
       LEFT JOIN eventoproyectos ocupada
         ON ocupada.HorarioID = h.HorarioID
        AND ocupada.Estado = 'aceptado'
       WHERE h.EventoID = ?
       ${mostrarTodos ? "" : "HAVING DisponibleReal = 1"}
       ORDER BY a.Nombre ASC, h.HoraInicio ASC`,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /api/eventos/:id/horarios-disponibles:", err);
    res.status(500).json({ message: "Error al cargar horarios disponibles", error: err.message });
  }
});

router.put("/eventos/proyectos/:id/horario", async (req, res) => {
  const horarioId = obtenerEntero(req.body.HorarioID || req.body.horarioId);
  const alumnoId = obtenerEntero(req.body.AlumnoID || req.body.alumnoId);

  if (!horarioId || !alumnoId) {
    return res.status(400).json({ message: "AlumnoID y HorarioID son obligatorios" });
  }

  const conn = dbPromise;

  try {
    await conn.beginTransaction();

    const [[ep]] = await conn.query(
      `SELECT
         ep.EventoProyectoID,
         ep.EventoID,
         ep.ProyectoID,
         ep.HorarioID AS HorarioAnteriorID,
         ep.Estado,
         p.AlumnoID,
         ev.Fecha
       FROM eventoproyectos ep
       JOIN proyectos p ON p.ProyectoID = ep.ProyectoID
       JOIN eventos ev ON ev.EventoID = ep.EventoID
       WHERE ep.EventoProyectoID = ?
       LIMIT 1
       FOR UPDATE`,
      [req.params.id]
    );

    if (!ep) {
      await conn.rollback();
      return res.status(404).json({ message: "Inscripcion no encontrada" });
    }

    if (Number(ep.AlumnoID) !== Number(alumnoId)) {
      await conn.rollback();
      return res.status(403).json({ message: "Este alumno no puede modificar esta inscripcion" });
    }

    if (ep.Estado !== "aceptado") {
      await conn.rollback();
      return res.status(409).json({ message: "El proyecto debe estar aceptado antes de elegir horario" });
    }

    const [[horario]] = await conn.query(
      `SELECT h.*, a.Nombre AS NombreAula
       FROM horariosevento h
       JOIN aulas a ON a.AulaID = h.AulaID
       WHERE h.HorarioID = ?
         AND h.EventoID = ?
       LIMIT 1
       FOR UPDATE`,
      [horarioId, ep.EventoID]
    );

    if (!horario) {
      await conn.rollback();
      return res.status(404).json({ message: "El horario no pertenece a este evento" });
    }

    const [[tomado]] = await conn.query(
      `SELECT EventoProyectoID
       FROM eventoproyectos
       WHERE HorarioID = ?
         AND EventoProyectoID <> ?
         AND Estado = 'aceptado'
       LIMIT 1
       FOR UPDATE`,
      [horarioId, ep.EventoProyectoID]
    );

    if (tomado || Number(horario.Disponible) !== 1) {
      await conn.rollback();
      return res.status(409).json({ message: "Ese horario ya no esta disponible" });
    }

    if (ep.HorarioAnteriorID && Number(ep.HorarioAnteriorID) !== Number(horarioId)) {
      await conn.query("UPDATE horariosevento SET Disponible = 1 WHERE HorarioID = ?", [ep.HorarioAnteriorID]);
    }

    await conn.query(
      `UPDATE eventoproyectos
       SET HorarioID = ?,
           FechaEvaluacion = ?,
           HoraInicio = ?,
           HoraFin = ?,
           Sala = ?
       WHERE EventoProyectoID = ?`,
      [horarioId, ep.Fecha, horario.HoraInicio, horario.HoraFin, horario.NombreAula, ep.EventoProyectoID]
    );

    await conn.query("UPDATE horariosevento SET Disponible = 0 WHERE HorarioID = ?", [horarioId]);
    await conn.commit();

    res.json({
      message: "Horario seleccionado",
      HorarioID: horarioId,
      AulaID: horario.AulaID,
      NombreAula: horario.NombreAula,
      HoraInicio: horario.HoraInicio,
      HoraFin: horario.HoraFin,
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error("PUT /api/eventos/proyectos/:id/horario:", err);
    res.status(500).json({ message: "Error al confirmar horario", error: err.message });
  }
});

router.get("/eventos/:id/aulas-resumen", async (req, res) => {
  try {
    const [rows] = await dbPromise.query(
      `SELECT
         base.AulaID,
         a.Nombre AS NombreAula,
         a.Capacidad,
         (
           SELECT COUNT(*)
           FROM horariosevento h2
           WHERE h2.EventoID = base.EventoID
             AND h2.AulaID = base.AulaID
         ) AS TotalSlots,
         (
           SELECT COUNT(*)
           FROM horariosevento h3
           LEFT JOIN eventoproyectos ep3
             ON ep3.HorarioID = h3.HorarioID
            AND ep3.Estado = 'aceptado'
           WHERE h3.EventoID = base.EventoID
             AND h3.AulaID = base.AulaID
             AND h3.Disponible = 1
             AND ep3.EventoProyectoID IS NULL
         ) AS SlotsDisponibles,
         (
           SELECT GROUP_CONCAT(DISTINCT prof.Nombre ORDER BY prof.Nombre SEPARATOR ', ')
           FROM evaluadoresaula ea
           JOIN usuarios prof ON prof.UsuarioID = ea.ProfesorID
           WHERE ea.EventoID = base.EventoID
             AND ea.AulaID = base.AulaID
         ) AS Evaluadores,
         (
           SELECT COUNT(DISTINCT ea2.ProfesorID)
           FROM evaluadoresaula ea2
           WHERE ea2.EventoID = base.EventoID
             AND ea2.AulaID = base.AulaID
         ) AS TotalEvaluadores,
         (
           SELECT alumno.Nombre
           FROM moderadoresaula ma
           JOIN usuarios alumno ON alumno.UsuarioID = ma.AlumnoID
           WHERE ma.EventoID = base.EventoID
             AND ma.AulaID = base.AulaID
             AND ma.Estado = 'aceptado'
           ORDER BY ma.CreatedAt ASC
           LIMIT 1
         ) AS Moderador,
         (
           SELECT COUNT(*)
           FROM moderadoresaula ma2
           WHERE ma2.EventoID = base.EventoID
             AND ma2.AulaID = base.AulaID
             AND ma2.Estado = 'pendiente'
         ) AS PostulacionesPendientes
       FROM (
         SELECT DISTINCT EventoID, AulaID
         FROM horariosevento
         WHERE EventoID = ?
       ) base
       JOIN aulas a ON a.AulaID = base.AulaID
       ORDER BY a.Nombre ASC`,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /api/eventos/:id/aulas-resumen:", err);
    res.status(500).json({ message: "Error al cargar aulas del evento", error: err.message });
  }
});

router.get("/profesores/evaluadores-candidatos", async (_req, res) => {
  try {
    const [rows] = await dbPromise.query(
      `SELECT
         u.UsuarioID,
         u.Nombre,
         u.Email,
         COALESCE(GROUP_CONCAT(DISTINCT esp.Nombre ORDER BY esp.Nombre SEPARATOR ', '), '') AS Especialidades,
         COALESCE(GROUP_CONCAT(DISTINCT pe.Departamento ORDER BY pe.Departamento SEPARATOR ', '), '') AS Departamentos
       FROM usuarios u
       LEFT JOIN profesorespecialidad pe ON pe.ProfesorID = u.UsuarioID
       LEFT JOIN especialidades esp ON esp.EspecialidadID = pe.EspecialidadID
       WHERE u.Rol = 'Profesor'
         AND u.Activo = 1
       GROUP BY u.UsuarioID
       ORDER BY u.Nombre ASC`
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /api/profesores/evaluadores-candidatos:", err);
    res.status(500).json({ message: "Error al cargar profesores", error: err.message });
  }
});

router.get("/eventos/:eventoId/aulas/:aulaId/evaluadores", async (req, res) => {
  try {
    const [rows] = await dbPromise.query(
      `SELECT
         ea.EvaluadorAulaID,
         ea.EventoID,
         ea.AulaID,
         ea.ProfesorID,
         u.Nombre,
         u.Email,
         COALESCE(GROUP_CONCAT(DISTINCT esp.Nombre ORDER BY esp.Nombre SEPARATOR ', '), '') AS Especialidades,
         COALESCE(GROUP_CONCAT(DISTINCT pe.Departamento ORDER BY pe.Departamento SEPARATOR ', '), '') AS Departamentos
       FROM evaluadoresaula ea
       JOIN usuarios u ON u.UsuarioID = ea.ProfesorID
       LEFT JOIN profesorespecialidad pe ON pe.ProfesorID = u.UsuarioID
       LEFT JOIN especialidades esp ON esp.EspecialidadID = pe.EspecialidadID
       WHERE ea.EventoID = ?
         AND ea.AulaID = ?
       GROUP BY ea.EvaluadorAulaID
       ORDER BY u.Nombre ASC`,
      [req.params.eventoId, req.params.aulaId]
    );

    res.json({
      evaluadores: rows,
      especialidadesRepetidas: especialidadesRepetidas(rows),
    });
  } catch (err) {
    console.error("GET /api/eventos/:eventoId/aulas/:aulaId/evaluadores:", err);
    res.status(500).json({ message: "Error al cargar evaluadores del aula", error: err.message });
  }
});

router.put("/eventos/:eventoId/aulas/:aulaId/evaluadores", async (req, res) => {
  const profesores = Array.isArray(req.body.profesores)
    ? req.body.profesores.map((id) => obtenerEntero(id)).filter(Boolean)
    : [];

  if (profesores.length > 3) {
    return res.status(400).json({ message: "Solo puedes asignar hasta 3 evaluadores por aula" });
  }

  try {
    if (profesores.length) {
      const [validos] = await dbPromise.query(
        `SELECT UsuarioID
         FROM usuarios
         WHERE Rol = 'Profesor'
           AND Activo = 1
           AND UsuarioID IN (?)`,
        [profesores]
      );

      if (validos.length !== profesores.length) {
        return res.status(400).json({ message: "Uno o mas evaluadores no son profesores activos" });
      }
    }

    await dbPromise.query(
      "DELETE FROM evaluadoresaula WHERE EventoID = ? AND AulaID = ?",
      [req.params.eventoId, req.params.aulaId]
    );

    if (profesores.length) {
      const valores = profesores.map((profesorId) => [
        req.params.eventoId,
        req.params.aulaId,
        profesorId,
        0,
      ]);
      await dbPromise.query(
        `INSERT INTO evaluadoresaula
           (EventoID, AulaID, ProfesorID, EsModeradorExterno)
         VALUES ?`,
        [valores]
      );
    }

    const [asignados] = await dbPromise.query(
      `SELECT
         u.UsuarioID AS ProfesorID,
         u.Nombre,
         COALESCE(GROUP_CONCAT(DISTINCT esp.Nombre ORDER BY esp.Nombre SEPARATOR ', '), '') AS Especialidades,
         COALESCE(GROUP_CONCAT(DISTINCT pe.Departamento ORDER BY pe.Departamento SEPARATOR ', '), '') AS Departamentos
       FROM usuarios u
       LEFT JOIN profesorespecialidad pe ON pe.ProfesorID = u.UsuarioID
       LEFT JOIN especialidades esp ON esp.EspecialidadID = pe.EspecialidadID
       WHERE u.UsuarioID IN (?)
       GROUP BY u.UsuarioID
       ORDER BY u.Nombre ASC`,
      [profesores.length ? profesores : [0]]
    );

    res.json({
      message: "Evaluadores de aula actualizados",
      evaluadores: asignados,
      especialidadesRepetidas: especialidadesRepetidas(asignados),
    });
  } catch (err) {
    console.error("PUT /api/eventos/:eventoId/aulas/:aulaId/evaluadores:", err);
    res.status(500).json({ message: "Error al asignar evaluadores", error: err.message });
  }
});

router.get("/moderadores-aula", async (req, res) => {
  const params = [];
  let where = "1=1";

  if (req.query.eventoId) {
    where += " AND ma.EventoID = ?";
    params.push(req.query.eventoId);
  }

  if (req.query.alumnoId) {
    where += " AND ma.AlumnoID = ?";
    params.push(req.query.alumnoId);
  }

  if (req.query.estado) {
    where += " AND ma.Estado = ?";
    params.push(req.query.estado);
  }

  try {
    const [rows] = await dbPromise.query(
      `SELECT
         ma.*,
         ev.Nombre AS NombreEvento,
         ev.Fecha AS FechaEvento,
         a.Nombre AS NombreAula,
         alumno.Nombre AS NombreAlumno,
         alumno.Email AS EmailAlumno,
         alumno.Semestre
       FROM moderadoresaula ma
       JOIN eventos ev ON ev.EventoID = ma.EventoID
       JOIN aulas a ON a.AulaID = ma.AulaID
       JOIN usuarios alumno ON alumno.UsuarioID = ma.AlumnoID
       WHERE ${where}
       ORDER BY ma.CreatedAt DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /api/moderadores-aula:", err);
    res.status(500).json({ message: "Error al cargar postulaciones", error: err.message });
  }
});

router.post("/moderadores-aula", async (req, res) => {
  const eventoId = obtenerEntero(req.body.EventoID || req.body.eventoId);
  const aulaId = obtenerEntero(req.body.AulaID || req.body.aulaId);
  const alumnoId = obtenerEntero(req.body.AlumnoID || req.body.alumnoId);

  if (!eventoId || !aulaId || !alumnoId) {
    return res.status(400).json({ message: "EventoID, AulaID y AlumnoID son obligatorios" });
  }

  try {
    const [[alumno]] = await dbPromise.query(
      "SELECT UsuarioID, Rol, Semestre FROM usuarios WHERE UsuarioID = ? LIMIT 1",
      [alumnoId]
    );

    if (!alumno || alumno.Rol !== "Alumno") {
      return res.status(403).json({ message: "Solo alumnos pueden postularse como moderadores" });
    }

    if (alumno.Semestre && Number(alumno.Semestre) > 2) {
      return res.status(403).json({ message: "Solo alumnos de primero o segundo semestre pueden postularse" });
    }

    const [[eventoAula]] = await dbPromise.query(
      `SELECT h.HorarioID
       FROM horariosevento h
       JOIN eventos ev ON ev.EventoID = h.EventoID
       WHERE h.EventoID = ?
         AND h.AulaID = ?
         AND ev.Estado IN ('proximo', 'activo')
       LIMIT 1`,
      [eventoId, aulaId]
    );

    if (!eventoAula) {
      return res.status(404).json({ message: "El aula no esta disponible para postulaciones en este evento" });
    }

    const [[moderadorAceptado]] = await dbPromise.query(
      `SELECT ModeradorID
       FROM moderadoresaula
       WHERE EventoID = ?
         AND AulaID = ?
         AND Estado = 'aceptado'
       LIMIT 1`,
      [eventoId, aulaId]
    );

    if (moderadorAceptado) {
      return res.status(409).json({ message: "Esta aula ya tiene moderador aceptado" });
    }

    const [result] = await dbPromise.query(
      `INSERT INTO moderadoresaula
         (EventoID, AulaID, AlumnoID, Estado)
       VALUES (?, ?, ?, 'pendiente')`,
      [eventoId, aulaId, alumnoId]
    );

    res.status(201).json({
      message: "Postulacion enviada",
      ModeradorID: result.insertId,
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Ya existe una postulacion para esta aula" });
    }

    console.error("POST /api/moderadores-aula:", err);
    res.status(500).json({ message: "Error al enviar postulacion", error: err.message });
  }
});

router.put("/moderadores-aula/:id/estado", async (req, res) => {
  const { Estado } = req.body;

  if (!["pendiente", "aceptado", "rechazado"].includes(Estado)) {
    return res.status(400).json({ message: "Estado invalido" });
  }

  const conn = dbPromise;

  try {
    await conn.beginTransaction();

    const [[postulacion]] = await conn.query(
      `SELECT *
       FROM moderadoresaula
       WHERE ModeradorID = ?
       LIMIT 1
       FOR UPDATE`,
      [req.params.id]
    );

    if (!postulacion) {
      await conn.rollback();
      return res.status(404).json({ message: "Postulacion no encontrada" });
    }

    if (Estado === "aceptado") {
      const [[actual]] = await conn.query(
        `SELECT ModeradorID
         FROM moderadoresaula
         WHERE EventoID = ?
           AND AulaID = ?
           AND Estado = 'aceptado'
           AND ModeradorID <> ?
         LIMIT 1
         FOR UPDATE`,
        [postulacion.EventoID, postulacion.AulaID, postulacion.ModeradorID]
      );

      if (actual) {
        await conn.rollback();
        return res.status(409).json({ message: "Esta aula ya tiene moderador aceptado" });
      }
    }

    await conn.query(
      "UPDATE moderadoresaula SET Estado = ? WHERE ModeradorID = ?",
      [Estado, req.params.id]
    );

    await conn.commit();
    res.json({ message: "Postulacion actualizada" });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error("PUT /api/moderadores-aula/:id/estado:", err);
    res.status(500).json({ message: "Error al actualizar postulacion", error: err.message });
  }
});

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
    SELECT ep.EventoProyectoID, ep.EventoID, ep.Estado, ep.CreatedAt, ep.HorarioID,
           ep.QRCode, ep.TokenQR,
           ep.FechaEvaluacion, ep.HoraInicio AS HoraEval, ep.HoraFin AS HoraFinEval,
           ep.Sala AS SalaEval, ep.ComentarioAdmin,
           p.Titulo AS TituloProyecto, p.ProyectoID,
           e.Nombre AS NombreEvento, e.Fecha AS FechaEvento,
           u.Nombre AS NombreAlumno,
           a.Nombre AS NombreAula, h.HoraInicio, h.HoraFin,
           GROUP_CONCAT(DISTINCT ev_u.Nombre ORDER BY ev_u.Nombre SEPARATOR ', ') AS Evaluadores
    FROM eventoproyectos ep
    JOIN proyectos p        ON ep.ProyectoID = p.ProyectoID
    JOIN eventos e          ON ep.EventoID   = e.EventoID
    JOIN usuarios u         ON p.AlumnoID    = u.UsuarioID
    LEFT JOIN horariosevento h  ON ep.HorarioID  = h.HorarioID
    LEFT JOIN aulas a           ON h.AulaID       = a.AulaID
    LEFT JOIN evaluadoresaula ea    ON ea.EventoID = ep.EventoID AND ea.AulaID = h.AulaID
    LEFT JOIN usuarios ev_u         ON ea.ProfesorID = ev_u.UsuarioID
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
            GROUP_CONCAT(DISTINCT u.Nombre ORDER BY u.Nombre SEPARATOR ', ') AS Evaluadores
     FROM eventoproyectos ep
     JOIN proyectos p        ON ep.ProyectoID  = p.ProyectoID
     LEFT JOIN horariosevento h ON ep.HorarioID = h.HorarioID
     LEFT JOIN aulas a          ON h.AulaID     = a.AulaID
     LEFT JOIN evaluadoresaula ev ON ev.EventoID = ep.EventoID AND ev.AulaID = h.AulaID
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

router.get("/profesores/:id/evaluaciones-evento", async (req, res) => {
  try {
    const [rows] = await dbPromise.query(
      `SELECT
         ea.EventoID,
         ev.Nombre AS NombreEvento,
         ev.Fecha AS FechaEvento,
         ev.Estado AS EstadoEvento,
         ev.RubricaID,
         ea.AulaID,
         a.Nombre AS NombreAula,
         ep.EventoProyectoID,
         ep.ProyectoID,
         p.Titulo AS TituloProyecto,
         p.Categoria,
         p.Progreso,
         alumno.Nombre AS NombreAlumno,
         apoyo.Nombre AS NombreProfesorApoyo,
         h.HorarioID,
         h.HoraInicio,
         h.HoraFin,
         ee.EvalEventoID,
         ee.PuntajeTotal,
         ee.Fecha AS FechaEvaluacion
       FROM evaluadoresaula ea
       JOIN eventos ev ON ev.EventoID = ea.EventoID
       JOIN aulas a ON a.AulaID = ea.AulaID
       JOIN horariosevento h
         ON h.EventoID = ea.EventoID
        AND h.AulaID = ea.AulaID
       JOIN eventoproyectos ep
         ON ep.HorarioID = h.HorarioID
        AND ep.Estado = 'aceptado'
       JOIN proyectos p ON p.ProyectoID = ep.ProyectoID
       JOIN usuarios alumno ON alumno.UsuarioID = p.AlumnoID
       LEFT JOIN usuarios apoyo ON apoyo.UsuarioID = p.ProfesorID
       LEFT JOIN evaluacionesevento ee
         ON ee.EventoID = ea.EventoID
        AND ee.ProyectoID = p.ProyectoID
        AND ee.ProfesorID = ea.ProfesorID
       WHERE ea.ProfesorID = ?
       ORDER BY ev.Fecha DESC, a.Nombre ASC, h.HoraInicio ASC`,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("GET /api/profesores/:id/evaluaciones-evento:", err);
    res.status(500).json({ message: "Error al cargar evaluaciones del evento", error: err.message });
  }
});

router.get("/entregas/:id/ver", async (req, res) => {
  try {
    const [[entrega]] = await dbPromise.query(
      `SELECT ArchivoEntrega, ArchivoContenido, MimeType, RutaExterna
       FROM entregas
       WHERE EntregaID = ?
       LIMIT 1`,
      [req.params.id]
    );

    if (!entrega) return res.status(404).json({ message: "Entrega no encontrada" });

    if (entrega.RutaExterna) {
      return res.redirect(entrega.RutaExterna);
    }

    if (!entrega.ArchivoContenido) {
      return res.status(404).json({ message: "La entrega no tiene archivo almacenado" });
    }

    res.setHeader("Content-Type", entrega.MimeType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(entrega.ArchivoEntrega || "entrega.pdf")}"`);
    res.send(entrega.ArchivoContenido);
  } catch (err) {
    console.error("GET /api/entregas/:id/ver:", err);
    res.status(500).json({ message: "Error al abrir entrega", error: err.message });
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
