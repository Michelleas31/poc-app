const express = require("express");
const router  = express.Router();
const db      = require("../services/database");
const dbPromise = db.promise();

function normalizarTexto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function obtenerEntero(valor, fallback = null) {
  if (valor === undefined || valor === null || valor === "") return fallback;
  const numero = Number(valor);
  return Number.isInteger(numero) ? numero : fallback;
}

function validarRubricaPayload(body = {}) {
  const Nombre = normalizarTexto(body.Nombre);
  const Descripcion = normalizarTexto(body.Descripcion) || null;
  const criteriosEntrada = Array.isArray(body.criterios) ? body.criterios : [];

  if (!Nombre) {
    throw new Error("El nombre de la rúbrica es obligatorio");
  }

  if (!criteriosEntrada.length) {
    throw new Error("Debes registrar al menos un criterio");
  }

  const criterios = criteriosEntrada.map((criterio, indexCriterio) => {
    const nombre = normalizarTexto(criterio.nombre || criterio.Nombre);
    const descripcion = normalizarTexto(criterio.descripcion || criterio.Descripcion) || null;
    const orden = obtenerEntero(criterio.orden || criterio.Orden, indexCriterio + 1);
    const nivelesEntrada = Array.isArray(criterio.niveles) ? criterio.niveles : [];

    if (!nombre) {
      throw new Error(`El criterio ${indexCriterio + 1} debe tener nombre`);
    }

    if (nivelesEntrada.length !== 4) {
      throw new Error(`El criterio "${nombre}" debe tener exactamente 4 niveles`);
    }

    const niveles = nivelesEntrada.map((nivel, indexNivel) => {
      const nombreNivel = normalizarTexto(nivel.nombre || nivel.Nombre);
      const descripcionNivel = normalizarTexto(nivel.descripcion || nivel.Descripcion);
      const puntaje = obtenerEntero(nivel.puntaje ?? nivel.Puntaje, null);
      const ordenNivel = obtenerEntero(nivel.orden || nivel.Orden, indexNivel + 1);

      if (!nombreNivel) {
        throw new Error(`El criterio "${nombre}" tiene un nivel sin nombre`);
      }

      if (puntaje === null || puntaje < 0) {
        throw new Error(`El nivel "${nombreNivel}" del criterio "${nombre}" tiene un puntaje inválido`);
      }

      if (!descripcionNivel) {
        throw new Error(`El nivel "${nombreNivel}" del criterio "${nombre}" debe tener descripción`);
      }

      return {
        nombre: nombreNivel,
        puntaje,
        descripcion: descripcionNivel,
        orden: ordenNivel,
      };
    });

    const ordenesNivel = new Set(niveles.map(nivel => nivel.orden));
    if (ordenesNivel.size !== niveles.length) {
      throw new Error(`El criterio "${nombre}" tiene niveles con orden repetido`);
    }

    niveles.sort((a, b) => a.orden - b.orden);

    return {
      nombre,
      descripcion,
      orden,
      puntosMax: Math.max(...niveles.map(nivel => nivel.puntaje)),
      niveles,
    };
  });

  const ordenesCriterio = new Set(criterios.map(criterio => criterio.orden));
  if (ordenesCriterio.size !== criterios.length) {
    throw new Error("Hay criterios con orden repetido");
  }

  criterios.sort((a, b) => a.orden - b.orden);

  return {
    Nombre,
    Descripcion,
    criterios,
  };
}

// ══════════════════════════════════════════
// USUARIOS
// ══════════════════════════════════════════

// GET todos los usuarios (acepta ?rol=Profesor para filtrar)
router.get("/usuarios", (req, res) => {
  const { rol } = req.query;
  let query  = "SELECT * FROM Usuarios";
  const params = [];
  if (rol) {
    query += " WHERE Rol = ?";
    params.push(rol);
  }
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// POST crear usuario
router.post("/usuarios", (req, res) => {
  const { Nombre, Email, Rol, Contraseña } = req.body;
  if (!Nombre || !Email || !Rol || !Contraseña)
    return res.status(400).json({ message: "Faltan campos obligatorios" });

  db.query(
    "INSERT INTO Usuarios (Nombre, Email, Contraseña, Rol) VALUES (?, ?, ?, ?)",
    [Nombre, Email, Contraseña, Rol],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Usuario creado", UsuarioID: result.insertId });
    }
  );
});

// PUT editar usuario
router.put("/usuarios/:id", (req, res) => {
  const { Nombre, Email, Rol, Contraseña } = req.body;
  const campos = [];
  const valores = [];

  if (Nombre)     { campos.push("Nombre = ?"); valores.push(Nombre); }
  if (Email)      { campos.push("Email = ?"); valores.push(Email); }
  if (Rol)        { campos.push("Rol = ?"); valores.push(Rol); }
  if (Contraseña) { campos.push("Contraseña = ?"); valores.push(Contraseña); }

  if (!campos.length) return res.status(400).json({ message: "Nada que actualizar" });

  valores.push(req.params.id);
  db.query(
    `UPDATE Usuarios SET ${campos.join(", ")} WHERE UsuarioID = ?`,
    valores,
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Usuario actualizado" });
    }
  );
});

// PUT activar/desactivar usuario (soft delete)
router.put("/usuarios/:id/toggle", (req, res) => {
  db.query(
    "UPDATE Usuarios SET Activo = NOT Activo WHERE UsuarioID = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Estado actualizado" });
    }
  );
});

// ══════════════════════════════════════════
// EVENTOS
// ══════════════════════════════════════════

// GET todos los eventos
router.get("/eventos", (req, res) => {
  db.query("SELECT * FROM Eventos ORDER BY Fecha DESC", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// POST crear evento
router.post("/eventos", (req, res) => {
  const { Nombre, Descripcion, Fecha, HoraInicio, HoraFin, Estado } = req.body;
  if (!Nombre || !Fecha || !HoraInicio || !HoraFin)
    return res.status(400).json({ message: "Faltan campos obligatorios" });

  db.query(
    "INSERT INTO Eventos (Nombre, Descripcion, Fecha, HoraInicio, HoraFin, Estado) VALUES (?, ?, ?, ?, ?, ?)",
    [Nombre, Descripcion || null, Fecha, HoraInicio, HoraFin, Estado || "proximo"],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Evento creado", EventoID: result.insertId });
    }
  );
});

// PUT editar evento
router.put("/eventos/:id", (req, res) => {
  const { Nombre, Descripcion, Fecha, HoraInicio, HoraFin, Estado } = req.body;
  const campos = [];
  const valores = [];

  if (Nombre) { campos.push("Nombre = ?"); valores.push(Nombre); }
  if (Descripcion !== undefined) { campos.push("Descripcion = ?"); valores.push(Descripcion); }
  if (Fecha) { campos.push("Fecha = ?"); valores.push(Fecha); }
  if (HoraInicio) { campos.push("HoraInicio = ?"); valores.push(HoraInicio); }
  if (HoraFin) { campos.push("HoraFin = ?"); valores.push(HoraFin); }
  if (Estado) { campos.push("Estado = ?"); valores.push(Estado); }

  if (!campos.length) return res.status(400).json({ message: "Nada que actualizar" });

  valores.push(req.params.id);
  db.query(
    `UPDATE Eventos SET ${campos.join(", ")} WHERE EventoID = ?`,
    valores,
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Evento actualizado" });
    }
  );
});

// DELETE evento
router.delete("/eventos/:id", (req, res) => {
  db.query("DELETE FROM Eventos WHERE EventoID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Evento eliminado" });
  });
});

// ══════════════════════════════════════════
// AULAS
// ══════════════════════════════════════════

router.get("/aulas", (req, res) => {
  db.query("SELECT * FROM Aulas ORDER BY Nombre", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

router.post("/aulas", (req, res) => {
  const { Nombre, Capacidad } = req.body;
  if (!Nombre) return res.status(400).json({ message: "El nombre es obligatorio" });
  db.query(
    "INSERT INTO Aulas (Nombre, Capacidad) VALUES (?, ?)",
    [Nombre, Capacidad || null],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Aula creada", AulaID: result.insertId });
    }
  );
});

router.delete("/aulas/:id", (req, res) => {
  db.query("DELETE FROM Aulas WHERE AulaID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Aula eliminada" });
  });
});

// ══════════════════════════════════════════
// HORARIOS
// ══════════════════════════════════════════

// GET horarios de un evento (con nombre del aula)
router.get("/eventos/:id/horarios", (req, res) => {
  db.query(
    `SELECT h.*, a.Nombre AS NombreAula
     FROM HorariosEvento h
     JOIN Aulas a ON h.AulaID = a.AulaID
     WHERE h.EventoID = ?
     ORDER BY h.HoraInicio`,
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

  db.query(
    "INSERT INTO HorariosEvento (EventoID, AulaID, HoraInicio, HoraFin) VALUES (?, ?, ?, ?)",
    [EventoID, AulaID, HoraInicio, HoraFin],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Horario agregado", HorarioID: result.insertId });
    }
  );
});

router.put("/horarios/:id", (req, res) => {
  const { Disponible } = req.body;
  db.query(
    "UPDATE HorariosEvento SET Disponible = ? WHERE HorarioID = ?",
    [Disponible, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Horario actualizado" });
    }
  );
});

router.delete("/horarios/:id", (req, res) => {
  db.query("DELETE FROM HorariosEvento WHERE HorarioID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Horario eliminado" });
  });
});

// ══════════════════════════════════════════
// RÚBRICAS
// ══════════════════════════════════════════

// GET todas las rúbricas con resumen
router.get("/rubricas", async (req, res) => {
  try {
    const [results] = await dbPromise.query(
      `SELECT r.RubricaID,
              r.ProfesorID,
              r.Nombre,
              r.Descripcion,
              r.Activa,
              r.CreatedAt,
              u.Nombre AS NombreProfesor,
              COALESCE(stats.TotalCriterios, 0) AS TotalCriterios,
              COALESCE(stats.TotalNiveles, 0) AS TotalNiveles,
              COALESCE(stats.PuntajeMaximo, 0) AS PuntajeMaximo
       FROM Rubricas r
       LEFT JOIN Usuarios u ON r.ProfesorID = u.UsuarioID
       LEFT JOIN (
         SELECT c.RubricaID,
                COUNT(DISTINCT c.CriterioID) AS TotalCriterios,
                COUNT(n.NivelID) AS TotalNiveles,
                COALESCE(SUM(c.PuntosMax), 0) AS PuntajeMaximo
         FROM CriteriosRubrica c
         LEFT JOIN NivelesCriterio n ON c.CriterioID = n.CriterioID
         GROUP BY c.RubricaID
       ) stats ON stats.RubricaID = r.RubricaID
       ORDER BY r.CreatedAt DESC`
    );

    res.json(results);
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET detalle completo de una rúbrica
router.get("/rubricas/:id", async (req, res) => {
  try {
    const [[rubrica]] = await dbPromise.query(
      `SELECT r.RubricaID,
              r.ProfesorID,
              r.Nombre,
              r.Descripcion,
              r.Activa,
              r.CreatedAt,
              u.Nombre AS NombreProfesor
       FROM Rubricas r
       LEFT JOIN Usuarios u ON r.ProfesorID = u.UsuarioID
       WHERE r.RubricaID = ?`,
      [req.params.id]
    );

    if (!rubrica) {
      return res.status(404).json({ message: "Rúbrica no encontrada" });
    }

    const [rows] = await dbPromise.query(
      `SELECT c.CriterioID,
              c.Nombre AS CriterioNombre,
              c.Descripcion AS CriterioDescripcion,
              c.PuntosMax,
              c.Orden AS CriterioOrden,
              n.NivelID,
              n.Nombre AS NivelNombre,
              n.Puntaje,
              n.Descripcion AS NivelDescripcion,
              n.Orden AS NivelOrden
       FROM CriteriosRubrica c
       LEFT JOIN NivelesCriterio n ON c.CriterioID = n.CriterioID
       WHERE c.RubricaID = ?
       ORDER BY c.Orden ASC, n.Orden ASC`,
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
    res.status(500).json(err);
  }
});

// POST crear rúbrica con criterios y 4 niveles por criterio
router.post("/rubricas", async (req, res) => {
  let payload;

  try {
    payload = validarRubricaPayload(req.body);
  } catch (validationError) {
    return res.status(400).json({ message: validationError.message });
  }

  try {
    await dbPromise.beginTransaction();

    const [rubricaResult] = await dbPromise.query(
      "INSERT INTO Rubricas (ProfesorID, Nombre, Descripcion) VALUES (1, ?, ?)",
      [payload.Nombre, payload.Descripcion]
    );

    const rubricaId = rubricaResult.insertId;

    for (const criterio of payload.criterios) {
      const [criterioResult] = await dbPromise.query(
        `INSERT INTO CriteriosRubrica (RubricaID, Nombre, Descripcion, PuntosMax, Orden)
         VALUES (?, ?, ?, ?, ?)`,
        [rubricaId, criterio.nombre, criterio.descripcion, criterio.puntosMax, criterio.orden]
      );

      const criterioId = criterioResult.insertId;
      const nivelesValues = criterio.niveles.map(nivel => [
        criterioId,
        nivel.nombre,
        nivel.puntaje,
        nivel.descripcion,
        nivel.orden,
      ]);

      await dbPromise.query(
        "INSERT INTO NivelesCriterio (CriterioID, Nombre, Puntaje, Descripcion, Orden) VALUES ?",
        [nivelesValues]
      );
    }

    await dbPromise.commit();

    res.status(201).json({
      message: "Rúbrica creada correctamente",
      RubricaID: rubricaId,
    });
  } catch (err) {
    try {
      await dbPromise.rollback();
    } catch (_) {}

    res.status(500).json(err);
  }
});

router.delete("/rubricas/:id", async (req, res) => {
  try {
    const [[rubrica]] = await dbPromise.query(
      "SELECT RubricaID FROM Rubricas WHERE RubricaID = ?",
      [req.params.id]
    );

    if (!rubrica) {
      return res.status(404).json({ message: "Rúbrica no encontrada" });
    }

    const [[evaluaciones]] = await dbPromise.query(
      "SELECT COUNT(*) AS Total FROM Evaluaciones WHERE RubricaID = ?",
      [req.params.id]
    );

    if (evaluaciones.Total > 0) {
      return res.status(409).json({
        message: "No se puede eliminar la rúbrica porque ya tiene evaluaciones registradas",
      });
    }

    await dbPromise.beginTransaction();

    const [criterios] = await dbPromise.query(
      "SELECT CriterioID FROM CriteriosRubrica WHERE RubricaID = ?",
      [req.params.id]
    );

    const criterioIds = criterios.map(criterio => criterio.CriterioID);

    if (criterioIds.length) {
      const placeholders = criterioIds.map(() => "?").join(",");
      await dbPromise.query(
        `DELETE FROM NivelesCriterio WHERE CriterioID IN (${placeholders})`,
        criterioIds
      );
    }

    await dbPromise.query(
      "DELETE FROM CriteriosRubrica WHERE RubricaID = ?",
      [req.params.id]
    );

    await dbPromise.query(
      "DELETE FROM Rubricas WHERE RubricaID = ?",
      [req.params.id]
    );

    await dbPromise.commit();

    res.json({ message: "Rúbrica eliminada" });
  } catch (err) {
    try {
      await dbPromise.rollback();
    } catch (_) {}

    res.status(500).json(err);
  }
});

// ══════════════════════════════════════════
// PROYECTOS EN EVENTOS (APROBAR / RECHAZAR)
// ══════════════════════════════════════════

// GET proyectos inscritos en eventos (acepta ?eventoId= y ?estado=)
router.get("/eventos/proyectos", (req, res) => {
  const { eventoId, estado } = req.query;
  let query = `
    SELECT ep.EventoProyectoID, ep.Estado, ep.CreatedAt,
           p.Titulo AS TituloProyecto,
           e.Nombre AS NombreEvento,
           u.Nombre AS NombreAlumno
    FROM EventoProyectos ep
    JOIN Proyectos p  ON ep.ProyectoID = p.ProyectoID
    JOIN Eventos e    ON ep.EventoID   = e.EventoID
    JOIN Usuarios u   ON p.AlumnoID    = u.UsuarioID
    WHERE 1=1
  `;
  const params = [];
  if (eventoId) { query += " AND ep.EventoID = ?"; params.push(eventoId); }
  if (estado)   { query += " AND ep.Estado = ?"; params.push(estado); }
  query += " ORDER BY ep.CreatedAt DESC";

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// PUT cambiar estado del proyecto en el evento
router.put("/eventos/proyectos/:id/estado", (req, res) => {
  const { Estado } = req.body;
  if (!["pendiente", "aceptado", "rechazado"].includes(Estado))
    return res.status(400).json({ message: "Estado inválido" });

  db.query(
    "UPDATE EventoProyectos SET Estado = ? WHERE EventoProyectoID = ?",
    [Estado, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Estado actualizado" });
    }
  );
});

// GET proyectos aceptados de un evento con su horario y evaluadores asignados
router.get("/eventos/:id/proyectos/aceptados", (req, res) => {
  db.query(
    `SELECT ep.EventoProyectoID,
            p.Titulo AS TituloProyecto,
            a.Nombre AS NombreAula,
            h.HoraInicio, h.HoraFin,
            GROUP_CONCAT(u.Nombre SEPARATOR ', ') AS Evaluadores
     FROM EventoProyectos ep
     JOIN Proyectos p        ON ep.ProyectoID  = p.ProyectoID
     LEFT JOIN HorariosEvento h ON ep.HorarioID = h.HorarioID
     LEFT JOIN Aulas a          ON h.AulaID     = a.AulaID
     LEFT JOIN EvaluadoresEvento ev ON ep.EventoProyectoID = ev.EventoProyectoID
     LEFT JOIN Usuarios u        ON ev.ProfesorID = u.UsuarioID
     WHERE ep.EventoID = ? AND ep.Estado = 'aceptado'
     GROUP BY ep.EventoProyectoID`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

// POST asignar evaluadores a un proyecto del evento
router.post("/eventos/proyectos/:id/evaluadores", (req, res) => {
  const { profesores } = req.body;
  if (!profesores || !profesores.length)
    return res.status(400).json({ message: "Selecciona al menos un profesor" });

  db.query(
    "DELETE FROM EvaluadoresEvento WHERE EventoProyectoID = ?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);

      const valores = profesores.map(pid => [req.params.id, pid]);
      db.query(
        "INSERT INTO EvaluadoresEvento (EventoProyectoID, ProfesorID) VALUES ?",
        [valores],
        (err2) => {
          if (err2) return res.status(500).json(err2);
          res.json({ message: "Evaluadores asignados" });
        }
      );
    }
  );
});

module.exports = router;