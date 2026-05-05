// disponibilidad.routes.js — v1.1 Flujo completo eventoproyectos
// Reutiliza tablas: proyectos, usuarios, evaluadoresevento, eventoproyectos, disponibilidad_profesor

const express = require('express');
const router = express.Router();
const db = require('../services/database');
const dbP = db.promise();

// ── GET /api/disponibilidad?ProyectoID=X ─────────────────────────────────────
// Alumno: ver qué profesores ofrecen disponibilidad para su proyecto
router.get('/disponibilidad', async (req, res) => {
  const { ProyectoID } = req.query;

  try {
    let sql = `
      SELECT 
        d.*,
        u.Nombre AS NombreProfesor,
        u.Email AS EmailProfesor
      FROM disponibilidad_profesor d
      JOIN usuarios u ON d.ProfesorID = u.UsuarioID
      WHERE d.Estado = 'disponible'
    `;

    const params = [];

    if (ProyectoID) {
      sql += ' AND d.ProyectoID = ?';
      params.push(ProyectoID);
    }

    sql += ' ORDER BY d.Fecha ASC, d.HoraInicio ASC';

    const [rows] = await dbP.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('Error GET /disponibilidad:', err);
    res.status(500).json({
      message: 'Error al obtener disponibilidad',
      error: err.message,
    });
  }
});

// ── GET /api/disponibilidad/profesor/:id ─────────────────────────────────────
// Profesor: ver todas sus ofertas disponibles y reservadas
router.get('/disponibilidad/profesor/:id', async (req, res) => {
  try {
    const [rows] = await dbP.query(
      `
      SELECT 
        d.*,
        p.Titulo AS TituloProyecto,
        p.Categoria,
        u.Nombre AS NombreAlumno
      FROM disponibilidad_profesor d
      JOIN proyectos p ON d.ProyectoID = p.ProyectoID
      JOIN usuarios u ON p.AlumnoID = u.UsuarioID
      WHERE d.ProfesorID = ?
        AND d.Estado != 'cancelada'
      ORDER BY d.Fecha ASC, d.HoraInicio ASC
      `,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error GET /disponibilidad/profesor/:id:', err);
    res.status(500).json({
      message: 'Error al obtener disponibilidad del profesor',
      error: err.message,
    });
  }
});

// ── POST /api/disponibilidad ──────────────────────────────────────────────────
// Profesor ofrece un horario/sala para apoyar o evaluar un proyecto
router.post('/disponibilidad', async (req, res) => {
  const { ProfesorID, ProyectoID, Fecha, HoraInicio, HoraFin, Sala } = req.body;

  if (!ProfesorID || !ProyectoID || !Fecha || !HoraInicio || !HoraFin) {
    return res.status(400).json({
      message: 'Faltan campos obligatorios: ProfesorID, ProyectoID, Fecha, HoraInicio y HoraFin',
    });
  }

  try {
    const [[proyecto]] = await dbP.query(
      `
      SELECT ProyectoID
      FROM proyectos
      WHERE ProyectoID = ?
        AND Activo = 1
      `,
      [ProyectoID]
    );

    if (!proyecto) {
      return res.status(404).json({
        message: 'Proyecto no encontrado o inactivo',
      });
    }

    const [result] = await dbP.query(
      `
      INSERT INTO disponibilidad_profesor
        (ProfesorID, ProyectoID, Fecha, HoraInicio, HoraFin, Sala, Estado)
      VALUES (?, ?, ?, ?, ?, ?, 'disponible')
      `,
      [ProfesorID, ProyectoID, Fecha, HoraInicio, HoraFin, Sala || null]
    );

    res.status(201).json({
      message: 'Disponibilidad registrada correctamente',
      DisponibilidadID: result.insertId,
    });
  } catch (err) {
    console.error('Error POST /disponibilidad:', err);
    res.status(500).json({
      message: 'Error al registrar disponibilidad',
      error: err.message,
    });
  }
});

// ── PUT /api/disponibilidad/:id/seleccionar ───────────────────────────────────
// Alumno elige un slot:
// 1. Reserva disponibilidad
// 2. Asigna ProfesorID al proyecto
// 3. Actualiza eventoproyectos con datos de fecha/hora/sala
// 4. Agrega evaluador en evaluadoresevento
router.put('/disponibilidad/:id/seleccionar', async (req, res) => {
  const { ProyectoID } = req.body;

  if (!ProyectoID) {
    return res.status(400).json({
      message: 'ProyectoID es obligatorio',
    });
  }

  let connection;
  try {
    connection = await dbP.getConnection();

    const [[disp]] = await connection.query(
      `SELECT * FROM disponibilidad_profesor WHERE DisponibilidadID = ? AND Estado = 'disponible'`,
      [req.params.id]
    );

    if (!disp) {
      return res.status(404).json({ message: 'Slot no disponible' });
    }

    // Allow slots with null ProyectoID (open offer); otherwise verify it matches
    if (disp.ProyectoID != null && Number(disp.ProyectoID) !== Number(ProyectoID)) {
      return res.status(400).json({ message: 'Este slot no corresponde a tu proyecto' });
    }

    await connection.beginTransaction();

    // 1. Marcar disponibilidad como reservada
    await connection.query(
      `
      UPDATE disponibilidad_profesor
      SET Estado = 'reservada'
      WHERE DisponibilidadID = ?
      `,
      [req.params.id]
    );

    // 2. Asignar profesor al proyecto
    await connection.query(
      `
      UPDATE proyectos
      SET ProfesorID = ?
      WHERE ProyectoID = ?
      `,
      [disp.ProfesorID, ProyectoID]
    );

    // 3. Buscar eventoproyecto pendiente/aceptado
    const [[eventoProyecto]] = await connection.query(
      `
      SELECT EventoProyectoID
      FROM eventoproyectos
      WHERE ProyectoID = ?
        AND Estado IN ('pendiente', 'aceptado')
      ORDER BY CreatedAt DESC
      LIMIT 1
      `,
      [ProyectoID]
    );

    if (eventoProyecto) {
      // ✓ NUEVO: Actualizar eventoproyectos con datos de disponibilidad
      await connection.query(
        `
        UPDATE eventoproyectos
        SET 
          DisponibilidadID = ?,
          ProfesorID = ?,
          FechaEvaluacion = ?,
          HoraInicio = ?,
          HoraFin = ?,
          Sala = ?
        WHERE EventoProyectoID = ?
        `,
        [
          disp.DisponibilidadID,
          disp.ProfesorID,
          disp.Fecha,
          disp.HoraInicio,
          disp.HoraFin,
          disp.Sala || null,
          eventoProyecto.EventoProyectoID
        ]
      );

      // Eliminar evaluadores anteriores
      await connection.query(
        `
        DELETE FROM evaluadoresevento
        WHERE EventoProyectoID = ?
        `,
        [eventoProyecto.EventoProyectoID]
      );

      // Agregar el profesor como evaluador
      await connection.query(
        `
        INSERT INTO evaluadoresevento
          (EventoProyectoID, ProfesorID)
        VALUES (?, ?)
        `,
        [eventoProyecto.EventoProyectoID, disp.ProfesorID]
      );
    }

    await connection.commit();

    res.json({
      message: 'Evaluador seleccionado correctamente',
      ProfesorID: disp.ProfesorID,
      DisponibilidadID: disp.DisponibilidadID,
      Fecha: disp.Fecha,
      HoraInicio: disp.HoraInicio,
      HoraFin: disp.HoraFin,
      Sala: disp.Sala,
    });
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (_) {}
    }
    console.error('Error PUT /disponibilidad/:id/seleccionar:', err);
    res.status(500).json({
      message: 'Error al seleccionar evaluador',
      error: err.message,
    });
  } finally {
    if (connection) connection.release();
  }
});

// ── DELETE /api/disponibilidad/:id ───────────────────────────────────────────
// Profesor cancela su oferta solo si aún está disponible
router.delete('/disponibilidad/:id', async (req, res) => {
  try {
    const [result] = await dbP.query(
      `
      UPDATE disponibilidad_profesor
      SET Estado = 'cancelada'
      WHERE DisponibilidadID = ?
        AND Estado = 'disponible'
      `,
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(400).json({
        message: 'No se puede cancelar: ya fue reservada o no existe',
      });
    }

    res.json({
      message: 'Disponibilidad cancelada correctamente',
    });
  } catch (err) {
    console.error('Error DELETE /disponibilidad/:id:', err);
    res.status(500).json({
      message: 'Error al cancelar disponibilidad',
      error: err.message,
    });
  }
});

module.exports = router;