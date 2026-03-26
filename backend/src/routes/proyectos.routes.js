const express = require("express");
const router  = express.Router();
const db      = require("../services/database");

// ══════════════════════════════════════════
// PROYECTOS — CRUD GENERAL
// ══════════════════════════════════════════

router.get("/proyectos", (req, res) => {
  db.query(
    `SELECT p.*,
            a.Nombre AS NombreAlumno,
            pr.Nombre AS NombreProfesor
     FROM Proyectos p
     LEFT JOIN Usuarios a  ON p.AlumnoID   = a.UsuarioID
     LEFT JOIN Usuarios pr ON p.ProfesorID = pr.UsuarioID
     WHERE p.Activo = 1
     ORDER BY p.CreatedAt DESC`,
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

router.get("/proyectos/por-profesor/:id", (req, res) => {
  db.query(
    `SELECT p.*,
            a.Nombre AS NombreAlumno,
            pr.Nombre AS NombreProfesor,
            (SELECT COUNT(*) FROM EtapasProyecto e WHERE e.ProyectoID = p.ProyectoID) AS TotalEtapas,
            (SELECT COUNT(*) FROM EtapasProyecto e WHERE e.ProyectoID = p.ProyectoID AND e.Completada = 1) AS EtapasCompletadas
     FROM Proyectos p
     LEFT JOIN Usuarios a  ON p.AlumnoID   = a.UsuarioID
     LEFT JOIN Usuarios pr ON p.ProfesorID = pr.UsuarioID
     WHERE p.ProfesorID = ? AND p.Activo = 1
     ORDER BY p.CreatedAt DESC`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

router.get("/proyectos/por-alumno/:id", (req, res) => {
  db.query(
    `SELECT p.*,
            a.Nombre AS NombreAlumno,
            pr.Nombre AS NombreProfesor,
            (SELECT COUNT(*) FROM EtapasProyecto e WHERE e.ProyectoID = p.ProyectoID) AS TotalEtapas,
            (SELECT COUNT(*) FROM EtapasProyecto e WHERE e.ProyectoID = p.ProyectoID AND e.Completada = 1) AS EtapasCompletadas
     FROM Proyectos p
     LEFT JOIN Usuarios a  ON p.AlumnoID   = a.UsuarioID
     LEFT JOIN Usuarios pr ON p.ProfesorID = pr.UsuarioID
     WHERE p.AlumnoID = ? AND p.Activo = 1
     ORDER BY p.CreatedAt DESC`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

router.get("/proyectos/:id", (req, res) => {
  db.query(
    `SELECT p.*,
            a.Nombre AS NombreAlumno,  a.Email AS EmailAlumno,
            pr.Nombre AS NombreProfesor, pr.Email AS EmailProfesor
     FROM Proyectos p
     LEFT JOIN Usuarios a  ON p.AlumnoID   = a.UsuarioID
     LEFT JOIN Usuarios pr ON p.ProfesorID = pr.UsuarioID
     WHERE p.ProyectoID = ?`,
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      if (!results.length) return res.status(404).json({ message: "Proyecto no encontrado" });
      res.json(results[0]);
    }
  );
});

router.post("/proyectos", (req, res) => {
  const { Titulo, Descripcion, FechaInicio, FechaFin, AlumnoID, ProfesorID } = req.body;
  if (!Titulo || !FechaInicio || !AlumnoID)
    return res.status(400).json({ message: "Faltan campos: Titulo, FechaInicio, AlumnoID" });

  db.query(
    `INSERT INTO Proyectos (Titulo, Descripcion, FechaInicio, FechaFin, AlumnoID, ProfesorID, Estatus, Progreso)
     VALUES (?, ?, ?, ?, ?, ?, 'Pendiente', 0)`,
    [Titulo, Descripcion || null, FechaInicio, FechaFin || null, AlumnoID, ProfesorID || null],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Proyecto creado", ProyectoID: result.insertId });
    }
  );
});

router.put("/proyectos/:id", (req, res) => {
  const { Titulo, Descripcion, FechaInicio, FechaFin, Estatus } = req.body;
  const campos = [], valores = [];
  if (Titulo)                    { campos.push("Titulo = ?");       valores.push(Titulo); }
  if (Descripcion !== undefined) { campos.push("Descripcion = ?");  valores.push(Descripcion); }
  if (FechaInicio)               { campos.push("FechaInicio = ?");  valores.push(FechaInicio); }
  if (FechaFin !== undefined)    { campos.push("FechaFin = ?");     valores.push(FechaFin); }
  if (Estatus)                   { campos.push("Estatus = ?");      valores.push(Estatus); }
  if (!campos.length) return res.status(400).json({ message: "Nada que actualizar" });
  valores.push(req.params.id);
  db.query(`UPDATE Proyectos SET ${campos.join(", ")} WHERE ProyectoID = ?`, valores, (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Proyecto actualizado" });
  });
});

router.put("/proyectos/:id/asignar-profesor", (req, res) => {
  const { ProfesorID } = req.body;
  db.query(
    "UPDATE Proyectos SET ProfesorID = ? WHERE ProyectoID = ?",
    [ProfesorID || null, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Profesor asignado" });
    }
  );
});

router.delete("/proyectos/:id", (req, res) => {
  db.query("UPDATE Proyectos SET Activo = 0 WHERE ProyectoID = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Proyecto eliminado" });
  });
});

// ══════════════════════════════════════════
// ETAPAS
// ══════════════════════════════════════════

router.get("/proyectos/:id/etapas", (req, res) => {
  db.query(
    "SELECT * FROM EtapasProyecto WHERE ProyectoID = ? ORDER BY Orden ASC",
    [req.params.id],
    (err, results) => {
      if (err) return res.status(500).json(err);
      res.json(results);
    }
  );
});

router.post("/proyectos/:id/etapas", (req, res) => {
  const { Nombre, Descripcion, FechaFin } = req.body;
  const proyectoId = req.params.id;
  if (!Nombre) return res.status(400).json({ message: "El nombre es obligatorio" });

  db.query(
    "SELECT COALESCE(MAX(Orden), 0) + 1 AS NextOrden FROM EtapasProyecto WHERE ProyectoID = ?",
    [proyectoId],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      const orden = rows[0].NextOrden;
      db.query(
        "INSERT INTO EtapasProyecto (ProyectoID, Nombre, Descripcion, Orden, FechaFin, Completada) VALUES (?, ?, ?, ?, ?, 0)",
        [proyectoId, Nombre, Descripcion || null, orden, FechaFin || null],
        (err2, result) => {
          if (err2) return res.status(500).json(err2);
          res.json({ message: "Etapa agregada", EtapaID: result.insertId });
        }
      );
    }
  );
});

router.put("/etapas/:id", (req, res) => {
  const { Nombre, Descripcion, FechaFin, Completada } = req.body;
  const campos = [], valores = [];
  if (Nombre !== undefined)      { campos.push("Nombre = ?");      valores.push(Nombre); }
  if (Descripcion !== undefined) { campos.push("Descripcion = ?"); valores.push(Descripcion); }
  if (FechaFin !== undefined)    { campos.push("FechaFin = ?");    valores.push(FechaFin); }
  if (Completada !== undefined)  { campos.push("Completada = ?");  valores.push(Completada ? 1 : 0); }
  if (!campos.length) return res.status(400).json({ message: "Nada que actualizar" });
  valores.push(req.params.id);

  db.query(`UPDATE EtapasProyecto SET ${campos.join(", ")} WHERE EtapaID = ?`, valores, (err) => {
    if (err) return res.status(500).json(err);
    if (Completada === undefined) return res.json({ message: "Etapa actualizada" });

    db.query("SELECT ProyectoID FROM EtapasProyecto WHERE EtapaID = ?", [req.params.id], (err2, rows) => {
      if (err2 || !rows.length) return res.json({ message: "Etapa actualizada" });
      const proyectoId = rows[0].ProyectoID;

      db.query(
        "SELECT COUNT(*) AS Total, SUM(Completada) AS Completadas FROM EtapasProyecto WHERE ProyectoID = ?",
        [proyectoId],
        (err3, stats) => {
          if (err3 || !stats.length) return res.json({ message: "Etapa actualizada" });
          const { Total, Completadas } = stats[0];
          const progreso = Total > 0 ? Math.round((Completadas / Total) * 100) : 0;
          const estatus  = progreso === 100 ? "Completado" : progreso > 0 ? "En progreso" : "Pendiente";
          db.query(
            "UPDATE Proyectos SET Progreso = ?, Estatus = ? WHERE ProyectoID = ?",
            [progreso, estatus, proyectoId],
            () => res.json({ message: "Etapa actualizada", progreso, estatus })
          );
        }
      );
    });
  });
});

router.delete("/etapas/:id", (req, res) => {
  db.query("SELECT ProyectoID FROM EtapasProyecto WHERE EtapaID = ?", [req.params.id], (err, rows) => {
    if (err) return res.status(500).json(err);
    const proyectoId = rows[0]?.ProyectoID;

    db.query("DELETE FROM EtapasProyecto WHERE EtapaID = ?", [req.params.id], (err2) => {
      if (err2) return res.status(500).json(err2);
      if (!proyectoId) return res.json({ message: "Etapa eliminada" });

      db.query(
        "SELECT COUNT(*) AS Total, SUM(Completada) AS Completadas FROM EtapasProyecto WHERE ProyectoID = ?",
        [proyectoId],
        (err3, stats) => {
          if (err3) return res.json({ message: "Etapa eliminada" });
          const { Total, Completadas } = stats[0];
          const progreso = Total > 0 ? Math.round((Completadas / Total) * 100) : 0;
          const estatus  = progreso === 100 ? "Completado" : progreso > 0 ? "En progreso" : "Pendiente";
          db.query(
            "UPDATE Proyectos SET Progreso = ?, Estatus = ? WHERE ProyectoID = ?",
            [progreso, estatus, proyectoId],
            () => res.json({ message: "Etapa eliminada", progreso })
          );
        }
      );
    });
  });
});

module.exports = router;