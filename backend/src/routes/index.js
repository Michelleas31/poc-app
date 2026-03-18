const express = require("express");
const router  = express.Router();
const db      = require("../services/database");
 
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
 
  if (Nombre)     { campos.push("Nombre = ?");     valores.push(Nombre); }
  if (Email)      { campos.push("Email = ?");      valores.push(Email); }
  if (Rol)        { campos.push("Rol = ?");         valores.push(Rol); }
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
 
  if (Nombre)      { campos.push("Nombre = ?");      valores.push(Nombre); }
  if (Descripcion !== undefined) { campos.push("Descripcion = ?"); valores.push(Descripcion); }
  if (Fecha)       { campos.push("Fecha = ?");       valores.push(Fecha); }
  if (HoraInicio)  { campos.push("HoraInicio = ?");  valores.push(HoraInicio); }
  if (HoraFin)     { campos.push("HoraFin = ?");     valores.push(HoraFin); }
  if (Estado)      { campos.push("Estado = ?");      valores.push(Estado); }
 
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
 
// GET todas las rúbricas con conteo de criterios
router.get("/rubricas", (req, res) => {
  db.query(
    `SELECT r.*, u.Nombre AS NombreProfesor,
            COUNT(c.CriterioID) AS TotalCriterios
     FROM Rubricas r
     LEFT JOIN Usuarios u ON r.ProfesorID = u.UsuarioID
     LEFT JOIN CriteriosRubrica c ON r.RubricaID = c.RubricaID
     GROUP BY r.RubricaID
     ORDER BY r.CreatedAt DESC`,
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});
 
// POST crear rúbrica con sus criterios
router.post("/rubricas", (req, res) => {
  const { Nombre, Descripcion, criterios } = req.body;
  if (!Nombre) return res.status(400).json({ message: "El nombre es obligatorio" });
 
  // Usar ProfesorID = 1 (admin) por defecto por ahora
  db.query(
    "INSERT INTO Rubricas (ProfesorID, Nombre, Descripcion) VALUES (1, ?, ?)",
    [Nombre, Descripcion || null],
    (err, result) => {
      if (err) return res.status(500).json(err);
      const rubricaId = result.insertId;
 
      if (!criterios || !criterios.length) {
        return res.json({ message: "Rúbrica creada", RubricaID: rubricaId });
      }
 
      const valores = criterios.map((c, i) => [rubricaId, c.nombre, c.puntos, i + 1]);
      db.query(
        "INSERT INTO CriteriosRubrica (RubricaID, Nombre, PuntosMax, Orden) VALUES ?",
        [valores],
        (err2) => {
          if (err2) return res.status(500).json(err2);
          res.json({ message: "Rúbrica creada con criterios", RubricaID: rubricaId });
        }
      );
    }
  );
});
 
router.delete("/rubricas/:id", (req, res) => {
  db.query("DELETE FROM CriteriosRubrica WHERE RubricaID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    db.query("DELETE FROM Rubricas WHERE RubricaID = ?", [req.params.id], (err2) => {
      if (err2) return res.status(500).json(err2);
      res.json({ message: "Rúbrica eliminada" });
    });
  });
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
  if (estado)   { query += " AND ep.Estado = ?";   params.push(estado); }
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
 
  // Primero borramos los que ya tenía para hacer reemplazo limpio
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