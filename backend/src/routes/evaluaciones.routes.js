const express = require('express');
const router = express.Router();
const db = require('../services/database');

const dbP = db.promise();

let columnasEvaluacionesCache = null;

async function getColumnasEvaluaciones() {
  if (columnasEvaluacionesCache) return columnasEvaluacionesCache;

  const [rows] = await dbP.query('SHOW COLUMNS FROM evaluaciones');
  columnasEvaluacionesCache = new Set(rows.map((row) => row.Field));
  return columnasEvaluacionesCache;
}

async function profesorPuedeEvaluarProyecto(proyectoId, profesorId, proyectoProfesorId) {
  if (Number(proyectoProfesorId) === Number(profesorId)) return true;

  const [[asignacion]] = await dbP.query(
    `SELECT ep.EventoProyectoID
     FROM eventoproyectos ep
     LEFT JOIN evaluadoresevento ee ON ee.EventoProyectoID = ep.EventoProyectoID
     WHERE ep.ProyectoID = ?
       AND ep.Estado = 'aceptado'
       AND (
        ep.ProfesorID = ?
        OR ee.ProfesorID = ?
       )
     LIMIT 1`,
    [proyectoId, profesorId, profesorId]
  );

  return Boolean(asignacion);
}

async function insertarEvaluacionCompatible({
  ProyectoID,
  ProfesorID,
  CitaID = null,
  RubricaID,
  AlumnoID = null,
  puntajeTotal,
  puntajeMax,
  comentarios = null,
}) {
  const columnas = await getColumnasEvaluaciones();
  const campos = [];
  const placeholders = [];
  const valores = [];
  const add = (campo, valor) => {
    if (!columnas.has(campo)) return;
    campos.push(campo);
    placeholders.push('?');
    valores.push(valor);
  };

  add('ProyectoID', ProyectoID);
  add('ProfesorID', ProfesorID);
  add('CitaID', CitaID);
  add('RubricaID', RubricaID);
  add('AlumnoID', AlumnoID);
  add('PuntajeTotal', puntajeTotal);
  add('PuntajeMax', puntajeMax);
  add('PuntajeMaximo', puntajeMax);
  add('Porcentaje', puntajeMax > 0 ? Number(((puntajeTotal / puntajeMax) * 100).toFixed(2)) : 0);
  add('Comentarios', comentarios);
  add('ComentarioGeneral', comentarios);

  const [result] = await dbP.query(
    `INSERT INTO evaluaciones (${campos.join(', ')})
     VALUES (${placeholders.join(', ')})`,
    valores
  );

  return result.insertId;
}

/*
  GET /api/rubrica/activa
  Devuelve la rúbrica activa con criterios y niveles.
*/
router.get('/rubrica/activa', async (req, res) => {
  try {
    const [[rubrica]] = await dbP.query(`
      SELECT *
      FROM rubricas
      WHERE Activa = 1
      ORDER BY RubricaID DESC
      LIMIT 1
    `);

    if (!rubrica) {
      return res.status(404).json({
        message: 'No hay rúbrica activa'
      });
    }

    const [criterios] = await dbP.query(
      `
      SELECT *
      FROM criteriosrubrica
      WHERE RubricaID = ?
      ORDER BY Orden ASC
      `,
      [rubrica.RubricaID]
    );

    const [niveles] = await dbP.query(
      `
      SELECT n.*
      FROM nivelescriterio n
      JOIN criteriosrubrica c ON c.CriterioID = n.CriterioID
      WHERE c.RubricaID = ?
      ORDER BY n.CriterioID ASC, n.Orden ASC
      `,
      [rubrica.RubricaID]
    );

    const criteriosConNiveles = criterios.map((criterio) => ({
      ...criterio,
      niveles: niveles.filter((nivel) => nivel.CriterioID === criterio.CriterioID)
    }));

    return res.json({
      rubrica,
      criterios: criteriosConNiveles
    });
  } catch (err) {
    console.error('GET /api/rubrica/activa:', err);
    return res.status(500).json({
      message: 'Error al obtener rúbrica activa'
    });
  }
});

// ══════════════════════════════════════════════════════════════════
// ALIAS PARA FRONTEND: GET /api/proyectos/:id/rubrica
// (Frontend llama a esto desde panel-profesor.js)
// ══════════════════════════════════════════════════════════════════
router.get('/proyectos/:id/rubrica', async (req, res) => {
  try {
    const [[rubrica]] = await dbP.query(`
      SELECT *
      FROM rubricas
      WHERE Activa = 1
      ORDER BY RubricaID DESC
      LIMIT 1
    `);

    if (!rubrica) {
      return res.status(404).json({
        message: 'No hay rúbrica activa'
      });
    }

    const [criterios] = await dbP.query(
      `
      SELECT *
      FROM criteriosrubrica
      WHERE RubricaID = ?
      ORDER BY Orden ASC
      `,
      [rubrica.RubricaID]
    );

    const [niveles] = await dbP.query(
      `
      SELECT n.*
      FROM nivelescriterio n
      JOIN criteriosrubrica c ON c.CriterioID = n.CriterioID
      WHERE c.RubricaID = ?
      ORDER BY n.CriterioID ASC, n.Orden ASC
      `,
      [rubrica.RubricaID]
    );

    const criteriosConNiveles = criterios.map((criterio) => ({
      ...criterio,
      niveles: niveles.filter((nivel) => nivel.CriterioID === criterio.CriterioID)
    }));

    return res.json({
      rubrica,
      criterios: criteriosConNiveles
    });
  } catch (err) {
    console.error('GET /api/proyectos/:id/rubrica:', err);
    return res.status(500).json({
      message: 'Error al obtener rúbrica'
    });
  }
});

/*
  POST /api/evaluaciones
  
  VERSIÓN CORREGIDA (sin usar citas_evaluacion):
  Guarda evaluación completa:
  - ProyectoID (requerido)
  - ProfesorID (requerido)
  - RubricaID (requerido)
  - Comentarios (opcional)
  - detalles: [{ CriterioID, NivelID, Comentario }] (requerido)
  
  CitaID ahora es OPCIONAL (para compatibilidad backwards, se ignora)
*/
router.post('/evaluaciones', async (req, res) => {
  const {
    ProyectoID,
    ProfesorID,
    CitaID,
    RubricaID,
    Comentarios,
    Observaciones,
    detalles
  } = req.body;

  if (!ProyectoID || !ProfesorID || !RubricaID) {
    return res.status(400).json({
      message: 'Faltan ProyectoID, ProfesorID o RubricaID'
    });
  }

  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({
      message: 'La evaluación debe incluir al menos un criterio calificado'
    });
  }

  try {
    await dbP.beginTransaction();

    // Validar que el proyecto existe
    const [[proyecto]] = await dbP.query(
      `
      SELECT ProyectoID, ProfesorID, AlumnoID, Estatus
      FROM proyectos
      WHERE ProyectoID = ?
      LIMIT 1
      `,
      [ProyectoID]
    );

    if (!proyecto) {
      await dbP.rollback();
      return res.status(404).json({
        message: 'Proyecto no encontrado'
      });
    }

    // Validar que el profesor esté asignado al proyecto o como evaluador del evento
    if (!(await profesorPuedeEvaluarProyecto(ProyectoID, ProfesorID, proyecto.ProfesorID))) {
      await dbP.rollback();
      return res.status(403).json({
        message: 'Este profesor no está asignado a este proyecto'
      });
    }

    // ✓ ELIMINADO: Validación de citas_evaluacion (tabla no existe)
    // CitaID se ignora ahora, es solo para compatibilidad backwards

    let puntajeTotal = 0;
    let puntajeMax = 0;
    const detallesValidados = [];

    // Validar cada detalle de evaluación
    for (const detalle of detalles) {
      if (!detalle.CriterioID || !detalle.NivelID) {
        await dbP.rollback();
        return res.status(400).json({
          message: 'Cada detalle debe tener CriterioID y NivelID'
        });
      }

      const [[nivel]] = await dbP.query(
        `
        SELECT
          n.NivelID,
          n.CriterioID,
          n.Puntaje,
          c.PuntosMax
        FROM nivelescriterio n
        JOIN criteriosrubrica c ON c.CriterioID = n.CriterioID
        WHERE n.NivelID = ?
          AND c.CriterioID = ?
          AND c.RubricaID = ?
        LIMIT 1
        `,
        [detalle.NivelID, detalle.CriterioID, RubricaID]
      );

      if (!nivel) {
        await dbP.rollback();
        return res.status(400).json({
          message: 'Nivel, criterio o rúbrica inválida'
        });
      }

      puntajeTotal += Number(nivel.Puntaje || 0);
      puntajeMax += Number(nivel.PuntosMax || 0);

      detallesValidados.push({
        CriterioID: detalle.CriterioID,
        NivelID: detalle.NivelID,
        Puntaje: nivel.Puntaje,
        Comentario: detalle.Comentario || null
      });
    }

    // Insertar evaluación principal, compatible con esquemas anteriores y actuales.
    const EvaluacionID = await insertarEvaluacionCompatible({
      ProyectoID,
      ProfesorID,
      CitaID: CitaID || null,
      RubricaID,
      AlumnoID: proyecto.AlumnoID || null,
      puntajeTotal,
      puntajeMax,
      comentarios: Comentarios || req.body.Observaciones || null,
    });

    // Insertar detalles de evaluación
    for (const detalle of detallesValidados) {
      await dbP.query(
        `
        INSERT INTO evaluaciondetalle
          (EvaluacionID, CriterioID, NivelID, Puntaje, Comentario)
        VALUES
          (?, ?, ?, ?, ?)
        `,
        [
          EvaluacionID,
          detalle.CriterioID,
          detalle.NivelID,
          detalle.Puntaje,
          detalle.Comentario
        ]
      );
    }

    // Actualizar estado del proyecto a evaluado
    await dbP.query(
      `
      UPDATE proyectos
      SET Estatus = 'evaluado',
          Progreso = 100
      WHERE ProyectoID = ?
      `,
      [ProyectoID]
    );

    // ✓ ELIMINADO: UPDATE a citas_evaluacion (tabla no existe)

    await dbP.commit();

    return res.status(201).json({
      message: 'Evaluación guardada correctamente',
      EvaluacionID,
      PuntajeTotal: puntajeTotal,
      PuntajeMax: puntajeMax,
      PuntajeMaximo: puntajeMax,
      Porcentaje: puntajeMax > 0 ? Number(((puntajeTotal / puntajeMax) * 100).toFixed(2)) : 0
    });
  } catch (err) {
    try {
      await dbP.rollback();
    } catch (_) {}

    console.error('POST /api/evaluaciones:', err);
    return res.status(500).json({
      message: 'Error al guardar evaluación'
    });
  }
});

// ══════════════════════════════════════════════════════════════════
// ALIAS PARA FRONTEND: POST /api/proyectos/:id/evaluacion
// (Frontend llama a esto desde panel-profesor.js)
// ══════════════════════════════════════════════════════════════════
router.post('/proyectos/:id/evaluacion', async (req, res) => {
  const {
    ProfesorID,
    RubricaID,
    Comentarios,
    Observaciones,
    detalles
  } = req.body;

  const ProyectoID = req.params.id;

  if (!ProfesorID || !RubricaID) {
    return res.status(400).json({
      message: 'Faltan ProfesorID o RubricaID'
    });
  }

  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({
      message: 'La evaluación debe incluir al menos un criterio calificado'
    });
  }

  try {
    await dbP.beginTransaction();

    // Validar que el proyecto existe
    const [[proyecto]] = await dbP.query(
      `
      SELECT ProyectoID, ProfesorID, AlumnoID, Estatus
      FROM proyectos
      WHERE ProyectoID = ?
      LIMIT 1
      `,
      [ProyectoID]
    );

    if (!proyecto) {
      await dbP.rollback();
      return res.status(404).json({
        message: 'Proyecto no encontrado'
      });
    }

    // Validar que el profesor esté asignado al proyecto o como evaluador del evento
    if (!(await profesorPuedeEvaluarProyecto(ProyectoID, ProfesorID, proyecto.ProfesorID))) {
      await dbP.rollback();
      return res.status(403).json({
        message: 'Este profesor no está asignado a este proyecto'
      });
    }

    let puntajeTotal = 0;
    let puntajeMax = 0;
    const detallesValidados = [];

    // Validar cada detalle
    for (const detalle of detalles) {
      if (!detalle.CriterioID || !detalle.NivelID) {
        await dbP.rollback();
        return res.status(400).json({
          message: 'Cada detalle debe tener CriterioID y NivelID'
        });
      }

      const [[nivel]] = await dbP.query(
        `
        SELECT
          n.NivelID,
          n.CriterioID,
          n.Puntaje,
          c.PuntosMax
        FROM nivelescriterio n
        JOIN criteriosrubrica c ON c.CriterioID = n.CriterioID
        WHERE n.NivelID = ?
          AND c.CriterioID = ?
          AND c.RubricaID = ?
        LIMIT 1
        `,
        [detalle.NivelID, detalle.CriterioID, RubricaID]
      );

      if (!nivel) {
        await dbP.rollback();
        return res.status(400).json({
          message: 'Nivel, criterio o rúbrica inválida'
        });
      }

      puntajeTotal += Number(nivel.Puntaje || 0);
      puntajeMax += Number(nivel.PuntosMax || 0);

      detallesValidados.push({
        CriterioID: detalle.CriterioID,
        NivelID: detalle.NivelID,
        Puntaje: nivel.Puntaje,
        Comentario: detalle.Comentario || null
      });
    }

    // Insertar evaluación, compatible con esquemas anteriores y actuales.
    const EvaluacionID = await insertarEvaluacionCompatible({
      ProyectoID,
      ProfesorID,
      RubricaID,
      AlumnoID: proyecto.AlumnoID || null,
      puntajeTotal,
      puntajeMax,
      comentarios: Comentarios || Observaciones || null,
    });

    // Insertar detalles
    for (const detalle of detallesValidados) {
      await dbP.query(
        `
        INSERT INTO evaluaciondetalle
          (EvaluacionID, CriterioID, NivelID, Puntaje, Comentario)
        VALUES
          (?, ?, ?, ?, ?)
        `,
        [
          EvaluacionID,
          detalle.CriterioID,
          detalle.NivelID,
          detalle.Puntaje,
          detalle.Comentario
        ]
      );
    }

    // Actualizar estado del proyecto
    await dbP.query(
      `
      UPDATE proyectos
      SET Estatus = 'evaluado',
          Progreso = 100
      WHERE ProyectoID = ?
      `,
      [ProyectoID]
    );

    await dbP.commit();

    return res.status(201).json({
      message: 'Evaluación guardada correctamente',
      EvaluacionID,
      PuntajeTotal: puntajeTotal,
      PuntajeMax: puntajeMax,
      PuntajeMaximo: puntajeMax,
      Porcentaje: puntajeMax > 0 ? Number(((puntajeTotal / puntajeMax) * 100).toFixed(2)) : 0
    });
  } catch (err) {
    try {
      await dbP.rollback();
    } catch (_) {}

    console.error('POST /api/proyectos/:id/evaluacion:', err);
    return res.status(500).json({
      message: 'Error al guardar evaluación'
    });
  }
});

/*
  GET /api/evaluaciones/proyecto/:id
  Lista evaluaciones de un proyecto.
*/
router.get('/evaluaciones/proyecto/:id', async (req, res) => {
  try {
    const [rows] = await dbP.query(
      `
      SELECT
        e.*,
        u.Nombre AS NombreProfesor,
        r.Nombre AS NombreRubrica
      FROM evaluaciones e
      JOIN usuarios u ON u.UsuarioID = e.ProfesorID
      JOIN rubricas r ON r.RubricaID = e.RubricaID
      WHERE e.ProyectoID = ?
      ORDER BY e.EvaluacionID DESC
      `,
      [req.params.id]
    );

    return res.json(rows);
  } catch (err) {
    console.error('GET /api/evaluaciones/proyecto/:id:', err);
    return res.status(500).json({
      message: 'Error al listar evaluaciones del proyecto'
    });
  }
});

/*
  GET /api/evaluaciones/:id/detalle
  Muestra una evaluación con sus criterios, niveles y comentarios.
*/
router.get('/evaluaciones/:id/detalle', async (req, res) => {
  try {
    const [[evaluacion]] = await dbP.query(
      `
      SELECT
        e.*,
        p.Titulo AS TituloProyecto,
        p.Categoria,
        alumno.Nombre AS NombreAlumno,
        profesor.Nombre AS NombreProfesor,
        r.Nombre AS NombreRubrica
      FROM evaluaciones e
      JOIN proyectos p ON p.ProyectoID = e.ProyectoID
      JOIN usuarios alumno ON alumno.UsuarioID = p.AlumnoID
      JOIN usuarios profesor ON profesor.UsuarioID = e.ProfesorID
      JOIN rubricas r ON r.RubricaID = e.RubricaID
      WHERE e.EvaluacionID = ?
      LIMIT 1
      `,
      [req.params.id]
    );

    if (!evaluacion) {
      return res.status(404).json({
        message: 'Evaluación no encontrada'
      });
    }

    const [detalles] = await dbP.query(
      `
      SELECT
        d.*,
        c.Nombre AS NombreCriterio,
        c.Descripcion AS DescripcionCriterio,
        n.Nombre AS NombreNivel,
        n.Descripcion AS DescripcionNivel
      FROM evaluaciondetalle d
      JOIN criteriosrubrica c ON c.CriterioID = d.CriterioID
      JOIN nivelescriterio n ON n.NivelID = d.NivelID
      WHERE d.EvaluacionID = ?
      ORDER BY c.Orden ASC
      `,
      [req.params.id]
    );

    return res.json({
      evaluacion,
      detalles
    });
  } catch (err) {
    console.error('GET /api/evaluaciones/:id/detalle:', err);
    return res.status(500).json({
      message: 'Error al obtener detalle de evaluación'
    });
  }
});

/*
  GET /api/ranking
  Ranking general por último resultado de cada proyecto.
*/
router.get('/ranking', async (req, res) => {
  try {
    const [rows] = await dbP.query(`
      SELECT
        p.ProyectoID,
        p.Titulo,
        p.Categoria,
        alumno.Nombre AS NombreAlumno,
        e.EvaluacionID,
        e.PuntajeTotal,
        e.PuntajeMaximo,
        COALESCE(e.Porcentaje, ROUND((e.PuntajeTotal / NULLIF(e.PuntajeMaximo, 0)) * 100, 2)) AS Porcentaje,
        e.Fecha
      FROM evaluaciones e
      JOIN proyectos p ON p.ProyectoID = e.ProyectoID
      JOIN usuarios alumno ON alumno.UsuarioID = p.AlumnoID
      WHERE e.EvaluacionID = (
        SELECT MAX(e2.EvaluacionID)
        FROM evaluaciones e2
        WHERE e2.ProyectoID = e.ProyectoID
      )
      ORDER BY Porcentaje DESC, e.PuntajeTotal DESC, e.CreatedAt ASC
    `);

    return res.json(rows);
  } catch (err) {
    console.error('GET /api/ranking:', err);
    return res.status(500).json({
      message: 'Error al obtener ranking'
    });
  }
});

module.exports = router;
