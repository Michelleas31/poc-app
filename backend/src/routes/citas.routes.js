const express = require('express');
const router = express.Router();
const db = require('../services/database');

const dbP = db.promise();

/*
  FLUJO DE ESTE ARCHIVO:

  1. Alumno elige una disponibilidad ofrecida por un profesor.
  2. El sistema crea una cita con:
     - ProyectoID
     - AlumnoID
     - ProfesorID
     - Fecha
     - HoraInicio
     - HoraFin
     - Sala
     - Estado = pendiente_admin
     - CodigoQR
  3. Admin aprueba o rechaza.
  4. Si admin aprueba, el QR queda válido.
  5. Profesor escanea/pega QR y ve datos del proyecto antes de evaluar.
*/

const SELECT_CITAS = `
  SELECT
    c.CitaID,
    c.ProyectoID,
    c.AlumnoID,
    c.ProfesorID,
    c.DisponibilidadID,
    c.Fecha,
    c.HoraInicio,
    c.HoraFin,
    c.Sala,
    c.Estado,
    c.CodigoQR,
    c.ComentarioAdmin,
    c.FechaAprobacion,
    c.CreatedAt,
    c.UpdatedAt,

    p.Titulo,
    p.Descripcion,
    p.Categoria,
    p.Estatus AS EstatusProyecto,
    p.EstadoAprobacion,
    p.Progreso,

    alumno.Nombre AS NombreAlumno,
    alumno.Email AS EmailAlumno,

    profesor.Nombre AS NombreProfesor,
    profesor.Email AS EmailProfesor

  FROM citas_evaluacion c
  INNER JOIN proyectos p ON p.ProyectoID = c.ProyectoID
  INNER JOIN usuarios alumno ON alumno.UsuarioID = c.AlumnoID
  INNER JOIN usuarios profesor ON profesor.UsuarioID = c.ProfesorID
`;

/* =========================================================
   Helpers
========================================================= */

function generarCodigoQR() {
  const parteRandom = Math.random().toString(36).substring(2, 10).toUpperCase();
  const parteFecha = Date.now().toString(36).toUpperCase();
  return `PM-${parteFecha}-${parteRandom}`;
}

function validarCampo(valor) {
  return valor !== undefined && valor !== null && String(valor).trim() !== '';
}

function normalizarSala(sala) {
  if (!validarCampo(sala)) return null;
  return String(sala).trim();
}

/* =========================================================
   GET /api/citas
   Admin: listar todas las citas
========================================================= */

router.get('/citas', async (req, res) => {
  try {
    const [rows] = await dbP.query(`
      ${SELECT_CITAS}
      ORDER BY
        CASE c.Estado
          WHEN 'pendiente_admin' THEN 1
          WHEN 'aprobada' THEN 2
          WHEN 'evaluada' THEN 3
          WHEN 'rechazada' THEN 4
          ELSE 5
        END,
        c.Fecha ASC,
        c.HoraInicio ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error('GET /api/citas:', err);
    res.status(500).json({
      message: 'Error al listar citas'
    });
  }
});

/* =========================================================
   GET /api/citas/alumno/:id
   Alumno: ver sus citas reales
========================================================= */

router.get('/citas/alumno/:id', async (req, res) => {
  const alumnoID = req.params.id;

  try {
    const [rows] = await dbP.query(
      `
      ${SELECT_CITAS}
      WHERE c.AlumnoID = ?
      ORDER BY c.CreatedAt DESC
      `,
      [alumnoID]
    );

    res.json(rows);
  } catch (err) {
    console.error('GET /api/citas/alumno/:id:', err);
    res.status(500).json({
      message: 'Error al listar citas del alumno'
    });
  }
});

/* =========================================================
   GET /api/citas/profesor/:id
   Profesor: ver citas asignadas/aprobadas/evaluadas
========================================================= */

router.get('/citas/profesor/:id', async (req, res) => {
  const profesorID = req.params.id;

  try {
    const [rows] = await dbP.query(
      `
      ${SELECT_CITAS}
      WHERE c.ProfesorID = ?
      ORDER BY c.Fecha ASC, c.HoraInicio ASC
      `,
      [profesorID]
    );

    res.json(rows);
  } catch (err) {
    console.error('GET /api/citas/profesor/:id:', err);
    res.status(500).json({
      message: 'Error al listar citas del profesor'
    });
  }
});

/* =========================================================
   POST /api/citas
   Alumno elige profesor + día + hora + sala

   Body recomendado:
   {
     "ProyectoID": 1,
     "AlumnoID": 2,
     "ProfesorID": 3,
     "DisponibilidadID": 4
   }

   También acepta directo:
   {
     "ProyectoID": 1,
     "AlumnoID": 2,
     "ProfesorID": 3,
     "Fecha": "2026-05-02",
     "HoraInicio": "10:00:00",
     "HoraFin": "10:30:00",
     "Sala": "Aula 5"
   }
========================================================= */

router.post('/citas', async (req, res) => {
  const {
    ProyectoID,
    AlumnoID,
    ProfesorID,
    DisponibilidadID,
    Fecha,
    HoraInicio,
    HoraFin,
    Sala
  } = req.body;

  if (!validarCampo(ProyectoID) || !validarCampo(AlumnoID)) {
    return res.status(400).json({
      message: 'Faltan datos obligatorios: ProyectoID y AlumnoID'
    });
  }

  try {
    await dbP.beginTransaction();

    const [[proyecto]] = await dbP.query(
      `
      SELECT
        ProyectoID,
        AlumnoID,
        Titulo,
        Estatus,
        EstadoAprobacion
      FROM proyectos
      WHERE ProyectoID = ?
      FOR UPDATE
      `,
      [ProyectoID]
    );

    if (!proyecto) {
      await dbP.rollback();
      return res.status(404).json({
        message: 'Proyecto no encontrado'
      });
    }

    if (Number(proyecto.AlumnoID) !== Number(AlumnoID)) {
      await dbP.rollback();
      return res.status(403).json({
        message: 'Este proyecto no pertenece al alumno indicado'
      });
    }

    const [citasActivas] = await dbP.query(
      `
      SELECT CitaID, Estado
      FROM citas_evaluacion
      WHERE ProyectoID = ?
        AND Estado IN ('pendiente_admin', 'aprobada', 'evaluada')
      LIMIT 1
      `,
      [ProyectoID]
    );

    if (citasActivas.length > 0) {
      await dbP.rollback();
      return res.status(409).json({
        message: 'Este proyecto ya tiene una cita activa. No puedes crear otra mientras esté pendiente, aprobada o evaluada.',
        cita: citasActivas[0]
      });
    }

    let citaProfesorID = ProfesorID;
    let citaFecha = Fecha;
    let citaHoraInicio = HoraInicio;
    let citaHoraFin = HoraFin;
    let citaSala = normalizarSala(Sala);
    let disponibilidadUsada = DisponibilidadID || null;

    /*
      Caso recomendado:
      El alumno elige una disponibilidad ya ofrecida por el profesor.
    */
    if (validarCampo(DisponibilidadID)) {
      const [[disponibilidad]] = await dbP.query(
        `
        SELECT
          DisponibilidadID,
          ProfesorID,
          ProyectoID,
          Fecha,
          HoraInicio,
          HoraFin,
          Sala,
          Estado
        FROM disponibilidad_profesor
        WHERE DisponibilidadID = ?
        FOR UPDATE
        `,
        [DisponibilidadID]
      );

      if (!disponibilidad) {
        await dbP.rollback();
        return res.status(404).json({
          message: 'Disponibilidad no encontrada'
        });
      }

      if (
        disponibilidad.ProyectoID !== null &&
        Number(disponibilidad.ProyectoID) !== Number(ProyectoID)
      ) {
        await dbP.rollback();
        return res.status(409).json({
          message: 'Esta disponibilidad pertenece a otro proyecto'
        });
      }

      if (disponibilidad.Estado && disponibilidad.Estado !== 'disponible') {
        await dbP.rollback();
        return res.status(409).json({
          message: 'Esta disponibilidad ya no está disponible'
        });
      }

      citaProfesorID = disponibilidad.ProfesorID;
      citaFecha = disponibilidad.Fecha;
      citaHoraInicio = disponibilidad.HoraInicio;
      citaHoraFin = disponibilidad.HoraFin;
      citaSala = normalizarSala(disponibilidad.Sala);

      await dbP.query(
        `
        UPDATE disponibilidad_profesor
        SET Estado = 'seleccionada',
            ProyectoID = ?,
            UpdatedAt = NOW()
        WHERE DisponibilidadID = ?
        `,
        [ProyectoID, DisponibilidadID]
      );
    }

    /*
      Caso alternativo:
      Si no usas disponibilidad_profesor, el frontend puede mandar
      ProfesorID + Fecha + HoraInicio + HoraFin + Sala directamente.
    */
    if (
      !validarCampo(citaProfesorID) ||
      !validarCampo(citaFecha) ||
      !validarCampo(citaHoraInicio) ||
      !validarCampo(citaHoraFin) ||
      !validarCampo(citaSala)
    ) {
      await dbP.rollback();
      return res.status(400).json({
        message: 'Faltan datos para crear la cita: ProfesorID, Fecha, HoraInicio, HoraFin y Sala'
      });
    }

    const codigoQR = generarCodigoQR();

    const [insertResult] = await dbP.query(
      `
      INSERT INTO citas_evaluacion
        (
          ProyectoID,
          AlumnoID,
          ProfesorID,
          DisponibilidadID,
          Fecha,
          HoraInicio,
          HoraFin,
          Sala,
          Estado,
          CodigoQR,
          CreatedAt,
          UpdatedAt
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente_admin', ?, NOW(), NOW())
      `,
      [
        ProyectoID,
        AlumnoID,
        citaProfesorID,
        disponibilidadUsada,
        citaFecha,
        citaHoraInicio,
        citaHoraFin,
        citaSala,
        codigoQR
      ]
    );

    await dbP.query(
      `
      UPDATE proyectos
      SET
        ProfesorID = ?,
        FechaExposicion = ?,
        HoraExposicion = ?,
        Sala = ?,
        Estatus = 'pendiente_admin',
        EstadoAprobacion = 'pendiente',
        Progreso = 60,
        UpdatedAt = NOW()
      WHERE ProyectoID = ?
      `,
      [
        citaProfesorID,
        citaFecha,
        citaHoraInicio,
        citaSala,
        ProyectoID
      ]
    );

    await dbP.commit();

    res.status(201).json({
      message: 'Cita creada. Queda pendiente de aprobación del admin.',
      CitaID: insertResult.insertId,
      ProyectoID,
      AlumnoID,
      ProfesorID: citaProfesorID,
      DisponibilidadID: disponibilidadUsada,
      Fecha: citaFecha,
      HoraInicio: citaHoraInicio,
      HoraFin: citaHoraFin,
      Sala: citaSala,
      Estado: 'pendiente_admin',
      CodigoQR: codigoQR
    });
  } catch (err) {
    try {
      await dbP.rollback();
    } catch (_) {}

    console.error('POST /api/citas:', err);
    res.status(500).json({
      message: 'Error al crear cita'
    });
  }
});

/* =========================================================
   PUT /api/citas/:id/aprobar
   Admin aprueba cita.
   Aquí se habilita el QR.
========================================================= */

router.put('/citas/:id/aprobar', async (req, res) => {
  const citaID = req.params.id;
  const { ComentarioAdmin } = req.body;

  try {
    await dbP.beginTransaction();

    const [[cita]] = await dbP.query(
      `
      SELECT *
      FROM citas_evaluacion
      WHERE CitaID = ?
      FOR UPDATE
      `,
      [citaID]
    );

    if (!cita) {
      await dbP.rollback();
      return res.status(404).json({
        message: 'Cita no encontrada'
      });
    }

    if (cita.Estado === 'evaluada') {
      await dbP.rollback();
      return res.status(409).json({
        message: 'No puedes aprobar una cita que ya fue evaluada'
      });
    }

    await dbP.query(
      `
      UPDATE citas_evaluacion
      SET
        Estado = 'aprobada',
        ComentarioAdmin = ?,
        FechaAprobacion = NOW(),
        UpdatedAt = NOW()
      WHERE CitaID = ?
      `,
      [ComentarioAdmin || null, citaID]
    );

    await dbP.query(
      `
      UPDATE proyectos
      SET
        Estatus = 'aprobado',
        EstadoAprobacion = 'aceptado',
        ComentarioRevision = ?,
        FechaRevision = NOW(),
        Progreso = 80,
        UpdatedAt = NOW()
      WHERE ProyectoID = ?
      `,
      [ComentarioAdmin || null, cita.ProyectoID]
    );

    await dbP.commit();

    res.json({
      message: 'Cita aprobada. QR habilitado.',
      CitaID: cita.CitaID,
      CodigoQR: cita.CodigoQR,
      Estado: 'aprobada'
    });
  } catch (err) {
    try {
      await dbP.rollback();
    } catch (_) {}

    console.error('PUT /api/citas/:id/aprobar:', err);
    res.status(500).json({
      message: 'Error al aprobar cita'
    });
  }
});

/* =========================================================
   PUT /api/citas/:id/rechazar
   Admin rechaza cita.
========================================================= */

router.put('/citas/:id/rechazar', async (req, res) => {
  const citaID = req.params.id;
  const { ComentarioAdmin } = req.body;

  try {
    await dbP.beginTransaction();

    const [[cita]] = await dbP.query(
      `
      SELECT *
      FROM citas_evaluacion
      WHERE CitaID = ?
      FOR UPDATE
      `,
      [citaID]
    );

    if (!cita) {
      await dbP.rollback();
      return res.status(404).json({
        message: 'Cita no encontrada'
      });
    }

    if (cita.Estado === 'evaluada') {
      await dbP.rollback();
      return res.status(409).json({
        message: 'No puedes rechazar una cita que ya fue evaluada'
      });
    }

    await dbP.query(
      `
      UPDATE citas_evaluacion
      SET
        Estado = 'rechazada',
        ComentarioAdmin = ?,
        UpdatedAt = NOW()
      WHERE CitaID = ?
      `,
      [ComentarioAdmin || null, citaID]
    );

    if (cita.DisponibilidadID) {
      await dbP.query(
        `
        UPDATE disponibilidad_profesor
        SET
          Estado = 'disponible',
          ProyectoID = NULL,
          UpdatedAt = NOW()
        WHERE DisponibilidadID = ?
        `,
        [cita.DisponibilidadID]
      );
    }

    await dbP.query(
      `
      UPDATE proyectos
      SET
        Estatus = 'rechazado',
        EstadoAprobacion = 'rechazado',
        ComentarioRevision = ?,
        FechaRevision = NOW(),
        Progreso = 40,
        UpdatedAt = NOW()
      WHERE ProyectoID = ?
      `,
      [ComentarioAdmin || null, cita.ProyectoID]
    );

    await dbP.commit();

    res.json({
      message: 'Cita rechazada',
      CitaID: cita.CitaID,
      Estado: 'rechazada'
    });
  } catch (err) {
    try {
      await dbP.rollback();
    } catch (_) {}

    console.error('PUT /api/citas/:id/rechazar:', err);
    res.status(500).json({
      message: 'Error al rechazar cita'
    });
  }
});

/* =========================================================
   GET /api/citas/qr/:codigo
   Profesor escanea o pega QR.
   Solo permite pasar si la cita está aprobada o evaluada.
========================================================= */

router.get('/citas/qr/:codigo', async (req, res) => {
  const codigo = String(req.params.codigo || '').trim();

  if (!codigo) {
    return res.status(400).json({
      message: 'Código QR requerido'
    });
  }

  try {
    const [[cita]] = await dbP.query(
      `
      ${SELECT_CITAS}
      WHERE c.CodigoQR = ?
      LIMIT 1
      `,
      [codigo]
    );

    if (!cita) {
      return res.status(404).json({
        message: 'QR no encontrado'
      });
    }

    if (cita.Estado !== 'aprobada' && cita.Estado !== 'evaluada') {
      return res.status(403).json({
        message: 'La cita todavía no está aprobada por admin',
        cita
      });
    }

    const [documentos] = await dbP.query(
      `
      SELECT
        DocumentoID,
        ProyectoID,
        NombreArchivo,
        RutaArchivo,
        MimeType,
        TamanoBytes,
        Descripcion,
        CreatedAt
      FROM documentos_proyecto
      WHERE ProyectoID = ?
      ORDER BY CreatedAt DESC
      `,
      [cita.ProyectoID]
    );

    res.json({
      message: 'QR válido',
      cita,
      documentos
    });
  } catch (err) {
    console.error('GET /api/citas/qr/:codigo:', err);
    res.status(500).json({
      message: 'Error al validar QR'
    });
  }
});

/* =========================================================
   DELETE /api/citas/:id
   Opcional: cancelar cita si aún no está aprobada/evaluada.
========================================================= */

router.delete('/citas/:id', async (req, res) => {
  const citaID = req.params.id;

  try {
    await dbP.beginTransaction();

    const [[cita]] = await dbP.query(
      `
      SELECT *
      FROM citas_evaluacion
      WHERE CitaID = ?
      FOR UPDATE
      `,
      [citaID]
    );

    if (!cita) {
      await dbP.rollback();
      return res.status(404).json({
        message: 'Cita no encontrada'
      });
    }

    if (cita.Estado === 'aprobada' || cita.Estado === 'evaluada') {
      await dbP.rollback();
      return res.status(409).json({
        message: 'No puedes cancelar una cita aprobada o evaluada'
      });
    }

    if (cita.DisponibilidadID) {
      await dbP.query(
        `
        UPDATE disponibilidad_profesor
        SET
          Estado = 'disponible',
          ProyectoID = NULL,
          UpdatedAt = NOW()
        WHERE DisponibilidadID = ?
        `,
        [cita.DisponibilidadID]
      );
    }

    await dbP.query(
      `
      DELETE FROM citas_evaluacion
      WHERE CitaID = ?
      `,
      [citaID]
    );

    await dbP.query(
      `
      UPDATE proyectos
      SET
        ProfesorID = NULL,
        FechaExposicion = NULL,
        HoraExposicion = NULL,
        Sala = NULL,
        Estatus = 'en_revision',
        EstadoAprobacion = 'pendiente',
        Progreso = 40,
        UpdatedAt = NOW()
      WHERE ProyectoID = ?
      `,
      [cita.ProyectoID]
    );

    await dbP.commit();

    res.json({
      message: 'Cita cancelada correctamente'
    });
  } catch (err) {
    try {
      await dbP.rollback();
    } catch (_) {}

    console.error('DELETE /api/citas/:id:', err);
    res.status(500).json({
      message: 'Error al cancelar cita'
    });
  }
});

module.exports = router;
