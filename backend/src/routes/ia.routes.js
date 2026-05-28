const express = require("express");
const router = express.Router();

const db = require("../services/database");
const dbP = db.promise();
const ia = require("../services/ia.service");

const TIPOS = {
  ideas: "ideas_proyecto",
  descripcion: "mejorar_descripcion",
  objetivos: "generar_objetivos",
  justificacion: "generar_justificacion",
  guardarDocumento: "guardar_documento",
  validarEvento: "validar_evento",
  mejorarRubrica: "mejorar_rubrica",
};

function ok(res, data = null, extra = {}) {
  res.json({ ok: true, data, ...extra });
}

function fail(res, status, message, extra = {}) {
  res.status(status).json({ ok: false, message, ...extra });
}

function getText(body = {}) {
  return String(body.Texto ?? body.texto ?? body.Entrada ?? body.entrada ?? "").trim();
}

function getInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function requireUsuario(res, body) {
  const id = getInt(body.UsuarioID ?? body.usuarioId);
  if (!id) {
    fail(res, 400, "UsuarioID es obligatorio");
    return null;
  }
  return id;
}

function validateAiText(res, texto) {
  if (!texto) {
    fail(res, 400, "Texto obligatorio");
    return false;
  }
  if (texto.length < 20) {
    fail(res, 400, "Texto insuficiente para generar contenido con IA");
    return false;
  }
  return true;
}

function handleAiError(res, error) {
  if (error?.code === "AI_KEY_MISSING") {
    return fail(res, 503, "No hay API key de IA configurada.");
  }
  if (error?.code === "AI_KEY_INVALID") {
    return fail(res, 401, error.message || "La API key de OpenRouter no es valida.");
  }
  return fail(res, 500, error?.message || "Error al procesar la solicitud de IA");
}

router.post("/ai", async (req, res) => {
  const prompt = String(req.body.prompt ?? req.body.Prompt ?? "").trim();

  if (!prompt) {
    return fail(res, 400, "Prompt obligatorio");
  }

  if (prompt.length < 3) {
    return fail(res, 400, "El prompt es demasiado corto");
  }

  try {
    const result = await ia.generateAIResponse(prompt, {
      systemPrompt: req.body.systemPrompt,
      temperature: Number.isFinite(Number(req.body.temperature)) ? Number(req.body.temperature) : undefined,
      maxTokens: Number.isFinite(Number(req.body.maxTokens)) ? Number(req.body.maxTokens) : undefined,
    });

    ok(res, {
      response: result.text,
      model: result.model,
      provider: result.provider,
    });
  } catch (error) {
    handleAiError(res, error);
  }
});

async function registrarInteraccion({
  UsuarioID,
  ProyectoID = null,
  Tipo,
  Entrada,
  Respuesta,
  ModeloUsado = null,
  Proveedor = null,
}) {
  await dbP.query(
    `INSERT INTO ia_interacciones
      (UsuarioID, ProyectoID, Tipo, Entrada, Respuesta, ModeloUsado, Proveedor)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      UsuarioID,
      ProyectoID,
      Tipo,
      typeof Entrada === "string" ? Entrada : JSON.stringify(Entrada),
      typeof Respuesta === "string" ? Respuesta : JSON.stringify(Respuesta),
      ModeloUsado,
      Proveedor,
    ]
  );
}

async function obtenerProyecto(proyectoId) {
  if (!proyectoId) return null;
  const [[proyecto]] = await dbP.query(
    `SELECT p.ProyectoID, p.Titulo, p.Descripcion, p.Categoria, p.Estatus,
            p.EstadoAprobacion, p.Progreso,
            alumno.Nombre AS NombreAlumno,
            profesor.Nombre AS NombreProfesor
     FROM proyectos p
     LEFT JOIN usuarios alumno ON alumno.UsuarioID = p.AlumnoID
     LEFT JOIN usuarios profesor ON profesor.UsuarioID = p.ProfesorID
     WHERE p.ProyectoID = ?`,
    [proyectoId]
  );
  return proyecto || null;
}

async function obtenerEvento(eventoId) {
  if (!eventoId) return null;
  const [[evento]] = await dbP.query(
    `SELECT EventoID, Nombre, Descripcion, Fecha, HoraInicio, HoraFin, Estado, RubricaID
     FROM eventos
     WHERE EventoID = ?`,
    [eventoId]
  );
  return evento || null;
}

async function obtenerRubrica(rubricaId) {
  const [[rubrica]] = await dbP.query(
    `SELECT RubricaID, Nombre, Descripcion, Activa
     FROM rubricas
     WHERE RubricaID = ?`,
    [rubricaId]
  );

  if (!rubrica) return null;

  const [rows] = await dbP.query(
    `SELECT c.CriterioID, c.Nombre AS CriterioNombre, c.Descripcion AS CriterioDescripcion,
            c.PuntosMax, c.Orden AS CriterioOrden,
            n.NivelID, n.Nombre AS NivelNombre, n.Puntaje, n.Descripcion AS NivelDescripcion, n.Orden AS NivelOrden
     FROM criteriosrubrica c
     LEFT JOIN nivelescriterio n ON n.CriterioID = c.CriterioID
     WHERE c.RubricaID = ?
     ORDER BY c.Orden ASC, n.Orden ASC`,
    [rubricaId]
  );

  const criterios = [];
  const map = new Map();

  rows.forEach((row) => {
    if (!map.has(row.CriterioID)) {
      const criterio = {
        CriterioID: row.CriterioID,
        Orden: row.CriterioOrden,
        Nombre: row.CriterioNombre,
        Descripcion: row.CriterioDescripcion,
        PuntosMax: row.PuntosMax,
        niveles: [],
      };
      map.set(row.CriterioID, criterio);
      criterios.push(criterio);
    }

    if (row.NivelID) {
      map.get(row.CriterioID).niveles.push({
        NivelID: row.NivelID,
        Orden: row.NivelOrden,
        Nombre: row.NivelNombre,
        Puntaje: row.Puntaje,
        Descripcion: row.NivelDescripcion,
      });
    }
  });

  return { ...rubrica, criterios };
}

async function generarContenido(req, res, tipo, generator) {
  const UsuarioID = requireUsuario(res, req.body);
  if (!UsuarioID) return;

  const ProyectoID = getInt(req.body.ProyectoID);
  const texto = getText(req.body);
  if (!validateAiText(res, texto)) return;

  try {
    const proyecto = await obtenerProyecto(ProyectoID);
    const result = await generator({
      textoBase: texto,
      proyecto,
    });

    await registrarInteraccion({
      UsuarioID,
      ProyectoID,
      Tipo: tipo,
      Entrada: { textoBase: texto, proyecto },
      Respuesta: result.text,
      ModeloUsado: result.model,
      Proveedor: result.provider,
    });

    ok(res, result.text, {
      modelo: result.model,
      proveedor: result.provider,
    });
  } catch (error) {
    handleAiError(res, error);
  }
}

router.post("/ia/generar-ideas", (req, res) => {
  generarContenido(req, res, TIPOS.ideas, ia.generarIdeasProyecto);
});

router.post("/ia/mejorar-descripcion", (req, res) => {
  generarContenido(req, res, TIPOS.descripcion, ({ textoBase }) => ia.mejorarDescripcion(textoBase));
});

router.post("/ia/generar-objetivos", (req, res) => {
  generarContenido(req, res, TIPOS.objetivos, ia.generarObjetivos);
});

router.post("/ia/generar-justificacion", (req, res) => {
  generarContenido(req, res, TIPOS.justificacion, ia.generarJustificacion);
});

router.post("/ia/guardar-documento", async (req, res) => {
  const UsuarioID = requireUsuario(res, req.body);
  if (!UsuarioID) return;

  const ProyectoID = getInt(req.body.ProyectoID);
  const texto = getText(req.body);
  const titulo = String(req.body.Titulo || "Documento generado con IA").trim().substring(0, 200);

  if (!ProyectoID) return fail(res, 400, "ProyectoID es obligatorio");
  if (!texto) return fail(res, 400, "No se puede guardar un documento vacio");

  try {
    const [[proyecto]] = await dbP.query(
      "SELECT ProyectoID FROM proyectos WHERE ProyectoID = ?",
      [ProyectoID]
    );

    if (!proyecto) return fail(res, 404, "Proyecto no encontrado");

    const contenido = Buffer.from(texto, "utf8");
    const [result] = await dbP.query(
      `INSERT INTO documentos_proyecto
        (ProyectoID, Titulo, NombreArchivo, Contenido, ContenidoTexto, Tipo, MimeType, TamanoBytes, Descripcion, SubidoPorID)
       VALUES (?, ?, ?, ?, ?, 'texto', 'text/plain', ?, ?, ?)`,
      [
        ProyectoID,
        titulo,
        "documento-ia.txt",
        contenido,
        texto,
        contenido.length,
        "Documento de texto generado con Asistente IA",
        UsuarioID,
      ]
    );

    await registrarInteraccion({
      UsuarioID,
      ProyectoID,
      Tipo: TIPOS.guardarDocumento,
      Entrada: { titulo },
      Respuesta: `Documento guardado con ID ${result.insertId}`,
      ModeloUsado: null,
      Proveedor: "projectmanager",
    });

    ok(res, {
      DocumentoID: result.insertId,
      message: "Documento generado con IA guardado correctamente",
    });
  } catch (error) {
    fail(res, 500, error?.message || "Error al guardar documento generado con IA");
  }
});

router.post("/ia/validar-evento", async (req, res) => {
  const UsuarioID = requireUsuario(res, req.body);
  if (!UsuarioID) return;

  const ProyectoID = getInt(req.body.ProyectoID);
  const EventoID = getInt(req.body.EventoID);

  if (!ProyectoID) return fail(res, 400, "ProyectoID es obligatorio");
  if (!EventoID) return fail(res, 400, "EventoID es obligatorio");

  try {
    const [proyecto, evento] = await Promise.all([
      obtenerProyecto(ProyectoID),
      obtenerEvento(EventoID),
    ]);

    if (!proyecto) return fail(res, 404, "Proyecto no encontrado");
    if (!evento) return fail(res, 404, "Evento no encontrado");

    const result = await ia.validarProyectoEvento({ proyecto, evento });

    await registrarInteraccion({
      UsuarioID,
      ProyectoID,
      Tipo: TIPOS.validarEvento,
      Entrada: { proyecto, evento },
      Respuesta: result.text,
      ModeloUsado: result.model,
      Proveedor: result.provider,
    });

    ok(res, result.text, {
      modelo: result.model,
      proveedor: result.provider,
    });
  } catch (error) {
    handleAiError(res, error);
  }
});

async function aplicarEstructuraRubrica(rubricaId, estructura) {
  const rubricaActual = await obtenerRubrica(rubricaId);
  if (!rubricaActual) throw new Error("Rubrica no encontrada");

  await dbP.beginTransaction();

  try {
    await dbP.query(
      "UPDATE rubricas SET Nombre = ?, Descripcion = ? WHERE RubricaID = ?",
      [
        estructura.nombre || rubricaActual.Nombre,
        estructura.descripcion || rubricaActual.Descripcion || null,
        rubricaId,
      ]
    );

    const criteriosActuales = rubricaActual.criterios || [];
    const criteriosNuevos = Array.isArray(estructura.criterios) ? estructura.criterios : [];

    for (let i = 0; i < criteriosActuales.length; i += 1) {
      const actual = criteriosActuales[i];
      const nuevo = criteriosNuevos[i];
      if (!nuevo) continue;

      await dbP.query(
        `UPDATE criteriosrubrica
         SET Nombre = ?, Descripcion = ?, PuntosMax = ?
         WHERE CriterioID = ?`,
        [
          nuevo.nombre || actual.Nombre,
          nuevo.descripcion || actual.Descripcion || null,
          Number.isFinite(Number(nuevo.puntosMax)) ? Number(nuevo.puntosMax) : actual.PuntosMax,
          actual.CriterioID,
        ]
      );

      const nivelesActuales = actual.niveles || [];
      const nivelesNuevos = Array.isArray(nuevo.niveles) ? nuevo.niveles : [];

      for (let j = 0; j < nivelesActuales.length; j += 1) {
        const nivelActual = nivelesActuales[j];
        const nivelNuevo = nivelesNuevos[j];
        if (!nivelNuevo) continue;

        await dbP.query(
          `UPDATE nivelescriterio
           SET Nombre = ?, Puntaje = ?, Descripcion = ?
           WHERE NivelID = ?`,
          [
            nivelNuevo.nombre || nivelActual.Nombre,
            Number.isFinite(Number(nivelNuevo.puntaje)) ? Number(nivelNuevo.puntaje) : nivelActual.Puntaje,
            nivelNuevo.descripcion || nivelActual.Descripcion,
            nivelActual.NivelID,
          ]
        );
      }
    }

    await dbP.commit();
  } catch (error) {
    await dbP.rollback();
    throw error;
  }
}

router.post("/ia/mejorar-rubrica", async (req, res) => {
  const UsuarioID = requireUsuario(res, req.body);
  if (!UsuarioID) return;

  const RubricaID = getInt(req.body.RubricaID);
  const aplicar = Boolean(req.body.aplicar);

  if (!RubricaID) return fail(res, 400, "RubricaID es obligatorio");

  try {
    if (aplicar) {
      const estructura =
        req.body.estructura ||
        ia.parseJsonFromText(req.body.Respuesta || req.body.respuesta || "");

      if (!estructura || !Array.isArray(estructura.criterios)) {
        return fail(res, 400, "No hay una mejora estructurada para aplicar");
      }

      await aplicarEstructuraRubrica(RubricaID, estructura);

      await registrarInteraccion({
        UsuarioID,
        ProyectoID: null,
        Tipo: TIPOS.mejorarRubrica,
        Entrada: { RubricaID, aplicar: true },
        Respuesta: estructura,
        ModeloUsado: null,
        Proveedor: "projectmanager",
      });

      return ok(res, { message: "Mejora aplicada a la rubrica" });
    }

    const rubrica = await obtenerRubrica(RubricaID);
    if (!rubrica) return fail(res, 404, "Rubrica no encontrada");

    const textoAdicional = getText(req.body);
    if (textoAdicional && textoAdicional.length < 20) {
      return fail(res, 400, "Texto insuficiente para generar contenido con IA");
    }

    const result = await ia.mejorarRubrica({
      rubrica,
      instrucciones: textoAdicional || "Mejora claridad, criterios, niveles y descripciones.",
    });

    const estructura = ia.parseJsonFromText(result.text);
    const preview = estructura ? ia.formatRubricaPreview(estructura) : result.text;

    await registrarInteraccion({
      UsuarioID,
      ProyectoID: null,
      Tipo: TIPOS.mejorarRubrica,
      Entrada: { RubricaID, rubrica, instrucciones: textoAdicional || null },
      Respuesta: preview,
      ModeloUsado: result.model,
      Proveedor: result.provider,
    });

    ok(res, {
      texto: preview,
      estructura,
    }, {
      modelo: result.model,
      proveedor: result.provider,
    });
  } catch (error) {
    handleAiError(res, error);
  }
});

router.get("/ia/historial", async (req, res) => {
  const usuarioId = getInt(req.query.UsuarioID || req.query.usuarioId);
  const proyectoId = getInt(req.query.ProyectoID || req.query.proyectoId);
  const limit = Math.min(getInt(req.query.limit) || 80, 200);

  const where = [];
  const params = [];

  if (usuarioId) {
    where.push("ia.UsuarioID = ?");
    params.push(usuarioId);
  }

  if (proyectoId) {
    where.push("ia.ProyectoID = ?");
    params.push(proyectoId);
  }

  params.push(limit);

  try {
    const [rows] = await dbP.query(
      `SELECT ia.InteraccionID, ia.UsuarioID, u.Nombre AS NombreUsuario, u.Rol,
              ia.ProyectoID, p.Titulo AS TituloProyecto,
              ia.Tipo, ia.Entrada, ia.Respuesta,
              ia.ModeloUsado, ia.Proveedor, ia.CreatedAt
       FROM ia_interacciones ia
       JOIN usuarios u ON u.UsuarioID = ia.UsuarioID
       LEFT JOIN proyectos p ON p.ProyectoID = ia.ProyectoID
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY ia.CreatedAt DESC
       LIMIT ?`,
      params
    );

    ok(res, rows);
  } catch (error) {
    fail(res, 500, error?.message || "Error al cargar historial de IA");
  }
});

module.exports = router;
