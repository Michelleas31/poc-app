const DEFAULT_MODEL = "openai/gpt-oss-20b:free";
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

function getConfig() {
  return {
    provider: process.env.AI_PROVIDER || "openrouter",
    model: process.env.AI_MODEL || DEFAULT_MODEL,
    apiKey: process.env.OPENROUTER_API_KEY || "",
    baseUrl: process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL,
  };
}

function missingKeyError() {
  const err = new Error("No hay API key de IA configurada.");
  err.code = "AI_KEY_MISSING";
  return err;
}

function invalidKeyError(message = "La API key de OpenRouter no es valida.") {
  const err = new Error(message);
  err.code = "AI_KEY_INVALID";
  return err;
}

function validateOpenRouterKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) throw missingKeyError();

  if (!key.startsWith("sk-or-v1-") || key.length < 40) {
    throw invalidKeyError(
      "La API key de OpenRouter parece incompleta o invalida. Copia la key completa desde OpenRouter."
    );
  }
}

async function chatCompletion(systemPrompt, userPrompt, options = {}) {
  const config = getConfig();

  if (config.provider !== "openrouter") {
    throw new Error(`Proveedor IA no soportado: ${config.provider}`);
  }

  validateOpenRouterKey(config.apiKey);

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:8080",
      "X-Title": "ProjectManager",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: options.temperature ?? 0.45,
      max_tokens: options.maxTokens ?? 1200,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      "El proveedor de IA no pudo generar una respuesta.";

    const lower = String(message).toLowerCase();
    if ([401, 403].includes(response.status) || lower.includes("user not found")) {
      throw invalidKeyError("OpenRouter rechazo la API key. Genera una nueva key y pegala completa en backend/.env.");
    }

    const err = new Error(message);
    err.code = "AI_PROVIDER_ERROR";
    err.status = response.status;
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("La IA no devolvio contenido.");
  }

  return {
    text: String(content).trim(),
    model: data?.model || config.model,
    provider: config.provider,
  };
}

async function generateAIResponse(prompt, options = {}) {
  const cleanPrompt = String(prompt || "").trim();

  if (!cleanPrompt) {
    throw new Error("Prompt obligatorio");
  }

  return chatCompletion(
    options.systemPrompt ||
      "Actua como un asistente de IA util, claro y seguro dentro de ProjectManager. Responde en espanol, con pasos concretos y sin inventar datos.",
    cleanPrompt,
    {
      temperature: options.temperature ?? 0.4,
      maxTokens: options.maxTokens ?? 1000,
    }
  );
}

function buildContext(data = {}) {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join("\n");
}

async function generarIdeasProyecto(data) {
  return chatCompletion(
    `Actua como asesor academico de Ingenieria en Sistemas Computacionales.
Genera ideas de proyectos realistas para alumnos.
Las ideas deben incluir titulo, problema, solucion, modulos, tecnologias sugeridas, dificultad y escalabilidad.
No inventes proyectos imposibles.
Prioriza proyectos que puedan desarrollarse con HTML, CSS, JavaScript, Node.js, Express y MariaDB.`,
    buildContext(data),
    { maxTokens: 1300 }
  );
}

async function mejorarDescripcion(texto) {
  return chatCompletion(
    `Actua como asesor academico de redaccion tecnica.
Mejora el texto del alumno para que suene mas claro, completo, formal y profesional.
No inventes datos que el alumno no haya mencionado.
Conserva la idea original.
Corrige ortografia y coherencia.
Devuelve solo el texto mejorado.`,
    texto,
    { maxTokens: 1000 }
  );
}

async function generarObjetivos(data) {
  return chatCompletion(
    `Actua como asesor academico.
Genera un objetivo general y 4 objetivos especificos para el proyecto.
Deben ser claros, medibles y adecuados para un proyecto escolar de ingenieria.`,
    buildContext(data),
    { maxTokens: 900 }
  );
}

async function generarJustificacion(data) {
  return chatCompletion(
    `Actua como asesor academico.
Genera una justificacion formal del proyecto.
Explica la importancia, problema que atiende, beneficios y posible impacto institucional.
No exageres ni inventes datos no proporcionados.`,
    buildContext(data),
    { maxTokens: 1000 }
  );
}

async function validarProyectoEvento(data) {
  return chatCompletion(
    `Actua como evaluador academico.
Compara el proyecto con el tema del evento.
Devuelve:
- Resultado: Alineado, Parcialmente alineado o No alineado
- Motivo
- Recomendaciones
No apruebes ni rechaces oficialmente el proyecto.`,
    buildContext(data),
    { maxTokens: 900, temperature: 0.25 }
  );
}

async function mejorarRubrica(data) {
  return chatCompletion(
    `Actua como experto en evaluacion academica.
Mejora la redaccion de criterios, niveles y descripciones de una rubrica.
Mantiene la escala original y los puntajes.
No elimines criterios sin justificar.
Devuelve SOLO JSON valido con esta forma:
{
  "nombre": "Nombre de la rubrica",
  "descripcion": "Descripcion mejorada",
  "criterios": [
    {
      "orden": 1,
      "nombre": "Nombre del criterio",
      "descripcion": "Descripcion del criterio",
      "puntosMax": 3,
      "niveles": [
        { "orden": 1, "nombre": "Sobresaliente", "puntaje": 3, "descripcion": "..." }
      ]
    }
  ]
}`,
    buildContext(data),
    { maxTokens: 1800, temperature: 0.25 }
  );
}

function parseJsonFromText(text) {
  if (!text) return null;

  const clean = String(text)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch (_) {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(clean.slice(start, end + 1));
    } catch (_) {
      return null;
    }
  }
}

function formatRubricaPreview(estructura) {
  if (!estructura) return "";

  const partes = [
    `Rubrica: ${estructura.nombre || "Sin nombre"}`,
    estructura.descripcion ? `Descripcion: ${estructura.descripcion}` : "",
    "",
  ];

  (estructura.criterios || []).forEach((criterio, i) => {
    partes.push(`${i + 1}. ${criterio.nombre || "Criterio"}`);
    if (criterio.descripcion) partes.push(`   ${criterio.descripcion}`);
    partes.push(`   Puntaje maximo: ${criterio.puntosMax ?? ""}`);
    (criterio.niveles || []).forEach((nivel) => {
      partes.push(`   - ${nivel.nombre || "Nivel"} (${nivel.puntaje ?? 0} pts): ${nivel.descripcion || ""}`);
    });
    partes.push("");
  });

  return partes.filter(Boolean).join("\n");
}

module.exports = {
  generateAIResponse,
  generarIdeasProyecto,
  mejorarDescripcion,
  generarObjetivos,
  generarJustificacion,
  validarProyectoEvento,
  mejorarRubrica,
  parseJsonFromText,
  formatRubricaPreview,
  getConfig,
};
