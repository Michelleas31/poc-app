// panel-alumno.js — v2.0 flujo evaluación con QR

const API = 'http://localhost:3000/api';

const inscripcion = {
  eventoId: null,
  eventoNombre: null,
  titulo: '',
  categoria: '',
  descripcion: '',
  archivo: null,
  participantes: [],
  asesores: [],
};

let user = null;
let miProyecto = null;
let etapasActuales = [];
let pasoActual = 1;
let proyectoActualId = null;
let todosAlumnos = [];
let todosProfesores = [];

// ── INIT ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('user');

  if (!raw) {
    window.location.href = 'login.html';
    return;
  }

  user = JSON.parse(raw);

  if (user.rol !== 'Alumno') {
    window.location.href = 'login.html';
    return;
  }

  const navNombre = document.getElementById('nav-nombre');
  const navAvatar = document.getElementById('nav-avatar');

  if (navNombre) navNombre.textContent = user.nombre;
  if (navAvatar) navAvatar.textContent = user.nombre[0].toUpperCase();

  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        overlay.classList.remove('open');
      }
    });
  });

  initUploadZone();
  loadMiProyecto();
  precargarUsuarios();
});

// ── NAVEGACIÓN ───────────────────────────────────────────────────────────────

function showSection(id, el) {
  document.querySelectorAll('.section').forEach((section) => {
    section.classList.remove('active');
  });

  document.querySelectorAll('.nav-item').forEach((nav) => {
    nav.classList.remove('active');
  });

  const section = document.getElementById('section-' + id);
  if (section) section.classList.add('active');
  if (el) el.classList.add('active');

  const titulos = {
    'mi-proyecto': ['Mi proyecto', 'Progreso, etapas y documentos'],
    evaluador: ['Elegir evaluador', 'Profesores disponibles para evaluarte'],
    'mi-qr': ['Generar QR', 'Codigo QR temporal para presentar'],
    inscribir: ['Inscribir a evento', 'Registra tu proyecto en una feria'],
    'mis-inscripciones': ['Mis inscripciones', 'Estado de tus solicitudes'],
    moderador: ['Ser moderador', 'Postulate para apoyar la logistica de un aula'],
    'mi-desempeno': ['Mi desempeño', 'Historial, indicadores y ranking'],
  };

  const [titulo, subtitulo] = titulos[id] || [id, ''];

  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  if (pageTitle) pageTitle.textContent = titulo;
  if (pageSubtitle) pageSubtitle.textContent = subtitulo;

  if (id === 'evaluador') loadEvaluadoresDisponibles();

  if (id === 'mi-qr') loadMiQR();

  if (id === 'inscribir') {
    loadEventosDisponibles();
    irPaso(1);
  }

  if (id === 'mis-inscripciones') loadMisInscripciones();

  if (id === 'moderador') loadModeradorAlumno();

  if (id === 'mi-desempeno') loadMiDesempeno();
}

function logout() {
  sessionStorage.removeItem('user');
  window.location.href = 'login.html';
}

function toast(msg, type = 'green') {
  const toastElement = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  const toastDot = document.getElementById('toast-dot');

  if (!toastElement || !toastMsg || !toastDot) {
    alert(msg);
    return;
  }

  toastMsg.textContent = msg;
  toastDot.className = `toast-dot ${type}`;

  toastElement.classList.add('show');

  setTimeout(() => {
    toastElement.classList.remove('show');
  }, 3200);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// ── MI PROYECTO ──────────────────────────────────────────────────────────────

async function loadMiProyecto() {
  const container = document.getElementById('proyecto-content');
  if (!container) return;

  try {
    const response = await fetch(`${API}/proyectos/por-alumno/${user.id}`);
    const data = await response.json();

    const proyectos = Array.isArray(data) ? data : [];

    if (!proyectos.length) {
      container.innerHTML = `
        <div class="empty student-project-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            <path d="M9 12l2 2 4-4"></path>
          </svg>
          <h3>Sin proyecto</h3>
          <p>Aún no tienes un proyecto registrado.</p>
          <button class="btn btn-primary" style="margin-top:12px" onclick="openModal('modal-crear-proyecto')">
            + Crear mi proyecto
          </button>
        </div>
      `;
      return;
    }

    miProyecto = proyectos[0];
    proyectoActualId = miProyecto.ProyectoID;

    const pct = Number(miProyecto.Progreso) || 0;

    const colores = {
      Pendiente: 'badge-orange',
      'En progreso': 'badge-blue',
      Completado: 'badge-green',
    };

    const barFill =
      pct === 100
        ? 'var(--green)'
        : pct > 0
          ? 'var(--blue)'
          : 'var(--border)';

    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    if (pageTitle) pageTitle.textContent = miProyecto.Titulo || 'Mi proyecto';
    if (pageSubtitle) {
      pageSubtitle.textContent = miProyecto.Descripcion
        ? miProyecto.Descripcion.substring(0, 80) + '…'
        : 'Sin descripción';
    }

    container.innerHTML = `
      <div class="student-project-hero">
        <div class="student-project-hero-main">
          <div class="student-project-kicker">Proyecto activo</div>
          <h2>${escapeHtml(miProyecto.Titulo || 'Mi proyecto')}</h2>
          <p>${escapeHtml(miProyecto.Descripcion || 'Sin descripcion registrada.')}</p>
          <div class="student-project-tags">
            <span class="badge ${colores[miProyecto.Estatus] || 'badge-gray'}">${escapeHtml(miProyecto.Estatus || 'Pendiente')}</span>
            <span class="student-soft-pill">${escapeHtml(miProyecto.Categoria || 'Sin categoria')}</span>
            <span class="student-soft-pill">${escapeHtml(miProyecto.NombreProfesor || 'Sin evaluador')}</span>
          </div>
        </div>
        <div class="student-project-hero-score">
          <span>${pct}%</span>
          <small>avance</small>
        </div>
      </div>

      <div class="meta-grid">
        <div class="meta-card">
          <div class="meta-label">Estado</div>
          <div class="meta-value">
            <span class="badge ${colores[miProyecto.Estatus] || 'badge-gray'}">
              ${miProyecto.Estatus || 'Pendiente'}
            </span>
          </div>
        </div>

        <div class="meta-card">
          <div class="meta-label">Categoría</div>
          <div class="meta-value">
            ${miProyecto.Categoria || '<span style="color:var(--text-muted)">Sin categoría</span>'}
          </div>
        </div>

        <div class="meta-card">
          <div class="meta-label">Profesor</div>
          <div class="meta-value">
            ${miProyecto.NombreProfesor || '<span style="color:var(--text-muted)">Sin asignar</span>'}
          </div>
        </div>

        <div class="meta-card">
          <div class="meta-label">Fecha inicio</div>
          <div class="meta-value">
            ${miProyecto.FechaInicio ? formatFecha(miProyecto.FechaInicio) : '—'}
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-title">
          <span>Progreso del proyecto</span>
          <span id="pct-display" style="font-size:24px;font-weight:800;font-family:'Syne',sans-serif;color:${pct === 100 ? 'var(--green)' : 'var(--blue)'}">
            ${pct}%
          </span>
        </div>

        <div class="progress-bar-label">
          <span>Completado</span>
          <span id="etapas-label">Cargando...</span>
        </div>

        <div class="progress-bar" style="height:12px;border-radius:6px">
          <div class="progress-bar-fill" id="main-bar" style="width:${pct}%;background:${barFill}"></div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-title">Estado de aprobación</div>
        <div id="aprob-container">
          <div style="color:var(--text-muted);font-size:13px">Cargando...</div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-title">
          <span>Mis etapas</span>
          <span style="font-size:12px;color:var(--text-muted);font-weight:400">
            Actualizacion automatica
          </span>
        </div>

        <div id="etapas-container" style="display:flex;flex-direction:column;gap:10px">
          <div style="color:var(--text-muted);font-size:13px">Cargando...</div>
        </div>
      </div>

      <div class="section-card student-doc-section">
        <div class="student-section-head">
          <div>
            <div class="section-card-title no-margin">Documentos de mi proyecto</div>
            <p class="student-section-subtitle">
              Sube archivos o crea documentos de texto para que tu evaluador los revise.
            </p>
          </div>

          <div class="project-doc-actions">
            <button class="btn btn-ghost btn-sm" onclick="abrirDocTextoAlumno()">Crear texto</button>
            <button class="btn btn-primary btn-sm" onclick="abrirSubir()">Subir archivo</button>
            <button class="btn btn-ghost btn-sm" onclick="abrirSubirImagen()">Subir imagen</button>
          </div>
        </div>

        <div id="docs-container">
          <div style="color:var(--text-muted);font-size:13px">Cargando...</div>
        </div>
      </div>
    `;

    const projectCards = Array.from(container.querySelectorAll(':scope > .section-card'));
    projectCards[0]?.classList.add('student-progress-card');
    projectCards[1]?.classList.add('student-approval-card');
    projectCards[2]?.classList.add('student-stage-section');
    projectCards[3]?.classList.add('student-doc-section');

    await Promise.all([
      loadEtapas(miProyecto.ProyectoID),
      cargarEstadoAprobacion(miProyecto.ProyectoID),
    ]);
    cargarDocumentos(miProyecto.ProyectoID);
    verificarBadgeEvaluador();
  } catch (error) {
    console.error(error);
    container.innerHTML = `
      <div style="color:var(--red);font-size:13px;padding:16px">
        Error al cargar tu proyecto.
      </div>
    `;
  }
}

async function crearProyecto() {
  const titulo = document.getElementById('cp-titulo')?.value.trim();
  const categoria = document.getElementById('cp-categoria')?.value.trim();
  const descripcion = document.getElementById('cp-descripcion')?.value.trim();
  const pdfFile = document.getElementById('cp-pdf')?.files[0];

  if (!titulo) return toast('Escribe el título', 'orange');
  if (!categoria) return toast('Escribe la categoría', 'orange');
  if (!descripcion) return toast('Escribe la descripción', 'orange');

  const btn = document.getElementById('btn-crear-proy');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creando...';
  }

  try {
    const hoy = new Date().toISOString().slice(0, 10);

    const response = await fetch(`${API}/proyectos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Titulo: titulo,
        Descripcion: descripcion,
        Categoria: categoria,
        FechaInicio: hoy,
        AlumnoID: user.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error al crear');
    }

    const proyectoId = data.ProyectoID;

    if (pdfFile) {
      if (pdfFile.size > 10 * 1024 * 1024) {
        toast('PDF demasiado grande. Máximo 10 MB.', 'orange');
      } else {
        const base64 = await fileToBase64(pdfFile);

        await fetch(`${API}/proyectos/${proyectoId}/documentos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            NombreArchivo: pdfFile.name,
            MimeType: pdfFile.type || 'application/pdf',
            ContenidoBase64: base64,
            Descripcion: 'PDF de presentación',
            SubidoPorID: user.id,
          }),
        });
      }
    }

    await fetch(`${API}/proyectos/${proyectoId}/documentos/texto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Titulo: 'Descripción del proyecto',
        Contenido: descripcion,
        SubidoPorID: user.id,
      }),
    });

    toast('¡Proyecto creado! 🎉');
    closeModal('modal-crear-proyecto');
    loadMiProyecto();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Error al crear el proyecto', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Crear proyecto';
    }
  }
}

// ── ETAPAS ────────────────────────────────────────────────────────────────────

async function loadEtapasManualLegacy(proyectoId) {
  const container = document.getElementById('etapas-container');
  const label = document.getElementById('etapas-label');

  try {
    const response = await fetch(`${API}/proyectos/${proyectoId}/etapas`);
    const etapas = await response.json();

    etapasActuales = Array.isArray(etapas) ? etapas : [];

    const completadas = etapasActuales.filter((etapa) => etapa.Completada).length;

    if (label) {
      label.textContent = etapasActuales.length
        ? `${completadas} de ${etapasActuales.length} etapas`
        : 'Sin etapas definidas';
    }

    if (!etapasActuales.length) {
      if (container) {
        container.innerHTML = `
          <div style="color:var(--text-muted);font-size:13px">
            Tu evaluador/admin aún no ha definido etapas.
          </div>
        `;
      }
      return;
    }

    renderEtapas(proyectoId);
  } catch (error) {
    console.error(error);

    if (container) {
      container.innerHTML = `
        <div style="color:var(--red);font-size:13px">
          Error al cargar etapas.
        </div>
      `;
    }

    if (label) label.textContent = 'Sin etapas definidas';
  }
}

function renderEtapasManualLegacy(proyectoId) {
  const container = document.getElementById('etapas-container');
  if (!container) return;

  container.innerHTML = etapasActuales
    .map(
      (etapa) => `
        <div class="etapa-row ${etapa.Completada ? 'done' : ''}" id="row-${etapa.EtapaID}">
          <div class="etapa-checkbox">
            ${
              etapa.Completada
                ? `
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px">
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                `
                : ''
            }
          </div>

          <div style="flex:1;min-width:0">
            <div class="etapa-nombre">${etapa.Nombre || 'Etapa sin nombre'}</div>

            ${
              etapa.Descripcion
                ? `<div style="font-size:12px;color:var(--text-muted);margin-top:3px">${etapa.Descripcion}</div>`
                : ''
            }

            ${
              etapa.FechaFin
                ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">📅 ${formatFecha(etapa.FechaFin)}</div>`
                : ''
            }
          </div>

          <span class="badge ${etapa.Completada ? 'badge-green' : 'badge-gray'}">
            ${etapa.Completada ? '✓ Lista' : 'Pendiente'}
          </span>
        </div>
      `,
    )
    .join('');
}

async function toggleEtapaManualLegacy(etapaId, completada, proyectoId) {
  const etapa = etapasActuales.find((item) => item.EtapaID === etapaId);

  if (!etapa) return;

  etapa.Completada = completada;
  renderEtapas(proyectoId);

  try {
    const response = await fetch(`${API}/etapas/${etapaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Completada: completada,
      }),
    });

    const data = await response.json();

    const pct = data.progreso ?? 0;
    const bar = document.getElementById('main-bar');
    const display = document.getElementById('pct-display');
    const label = document.getElementById('etapas-label');

    const completadas = etapasActuales.filter((item) => item.Completada).length;

    if (bar) {
      bar.style.width = `${pct}%`;
      bar.style.background =
        pct === 100
          ? 'var(--green)'
          : pct > 0
            ? 'var(--blue)'
            : 'var(--border)';
    }

    if (display) {
      display.textContent = `${pct}%`;
      display.style.color = pct === 100 ? 'var(--green)' : 'var(--blue)';
    }

    if (label) {
      label.textContent = `${completadas} de ${etapasActuales.length} etapas`;
    }

    toast(completada ? '✓ Etapa completada' : 'Marcada como pendiente');

    const celebracion = document.getElementById('celebracion');

    if (pct === 100 && celebracion) {
      setTimeout(() => celebracion.classList.add('show'), 600);
    }
  } catch (error) {
    console.error(error);

    etapa.Completada = !completada;
    renderEtapas(proyectoId);

    toast('Error al actualizar', 'red');
  }
}

// ── APROBACIÓN ───────────────────────────────────────────────────────────────

async function loadEtapas(proyectoId) {
  const container = document.getElementById('etapas-container');
  const label = document.getElementById('etapas-label');

  if (!container || !proyectoId) return;

  container.innerHTML = `
    <div style="color:var(--text-muted);font-size:13px">
      Calculando avance del flujo...
    </div>
  `;

  try {
    const [inscripcionesRes, evaluacionesRes] = await Promise.all([
      fetch(`${API}/eventos/proyectos?proyectoId=${proyectoId}`),
      fetch(`${API}/evaluaciones/proyecto/${proyectoId}`),
    ]);

    const inscripcionesData = await inscripcionesRes.json();
    const evaluacionesData = await evaluacionesRes.json();
    const inscripciones = Array.isArray(inscripcionesData) ? inscripcionesData : [];
    const evaluaciones = Array.isArray(evaluacionesData) ? evaluacionesData : [];
    const inscripcionAceptada = inscripciones.find((item) => item.Estado === 'aceptado');
    const ultimaInscripcion = inscripcionAceptada || inscripciones[0] || {};
    const ultimaEvaluacion = evaluaciones[0] || null;
    const tieneEvaluador = Boolean(
      miProyecto?.ProfesorID ||
      miProyecto?.NombreProfesor ||
      ultimaInscripcion.ProfesorID ||
      ultimaInscripcion.Evaluadores
    );
    const adminAcepto = Boolean(
      miProyecto?.EstadoAprobacion === 'aceptado' ||
      inscripcionAceptada
    );
    const adminRechazo = Boolean(
      miProyecto?.EstadoAprobacion === 'rechazado' ||
      inscripciones.some((item) => item.Estado === 'rechazado')
    );

    etapasActuales = [
      {
        Nombre: 'Registro del proyecto',
        Descripcion: 'El alumno registra titulo, descripcion y documentos iniciales.',
        Completada: Boolean(miProyecto?.ProyectoID),
        FechaFin: miProyecto?.CreatedAt || miProyecto?.FechaInicio,
        EstadoTexto: 'Registrado',
      },
      {
        Nombre: 'Evaluador y cita',
        Descripcion: tieneEvaluador
          ? `${miProyecto?.NombreProfesor || ultimaInscripcion.Evaluadores || 'Evaluador asignado'} revisa el proyecto.`
          : 'Pendiente de evaluador, fecha, hora y salon.',
        Completada: tieneEvaluador,
        FechaFin: miProyecto?.FechaCita || ultimaInscripcion.FechaEvaluacion || ultimaInscripcion.FechaEvento,
        EstadoTexto: tieneEvaluador ? 'Asignado' : 'Pendiente',
      },
      {
        Nombre: 'Aprobacion admin',
        Descripcion: adminRechazo
          ? 'Admin rechazo la inscripcion. Revisa comentarios.'
          : 'Admin valida que el proyecto corresponda al evento y confirma la cita.',
        Completada: adminAcepto,
        Rechazada: adminRechazo,
        FechaFin: miProyecto?.FechaAprobacionCita || miProyecto?.FechaRevision || ultimaInscripcion.FechaRevision,
        EstadoTexto: adminRechazo ? 'Rechazado' : adminAcepto ? 'Aprobado' : 'Pendiente',
      },
      {
        Nombre: 'Evaluacion',
        Descripcion: 'El evaluador escanea el QR, califica con rubrica y guarda el resultado.',
        Completada: evaluaciones.length > 0,
        FechaFin: ultimaEvaluacion?.Fecha,
        EstadoTexto: evaluaciones.length > 0 ? 'Evaluado' : 'Pendiente',
      },
    ];

    const completadas = etapasActuales.filter((etapa) => etapa.Completada).length;
    const progresoFlujo = Math.round((completadas / etapasActuales.length) * 100);

    if (label) {
      label.textContent = `${completadas} de ${etapasActuales.length} pasos automaticos`;
    }

    actualizarProgresoVisual(progresoFlujo);
    renderEtapas();
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div style="color:var(--red);font-size:13px">
        Error al calcular el flujo del proyecto.
      </div>
    `;

    if (label) label.textContent = 'Flujo no disponible';
  }
}

function renderEtapas() {
  const container = document.getElementById('etapas-container');
  if (!container) return;

  container.innerHTML = etapasActuales
    .map((etapa, index) => {
      const statusClass = etapa.Rechazada ? 'rejected' : etapa.Completada ? 'done' : 'pending';
      const badgeClass = etapa.Rechazada ? 'badge-red' : etapa.Completada ? 'badge-green' : 'badge-gray';
      const icon = etapa.Rechazada
        ? '<line x1="7" y1="7" x2="17" y2="17"></line><line x1="17" y1="7" x2="7" y2="17"></line>'
        : etapa.Completada
          ? '<polyline points="20,6 9,17 4,12"></polyline>'
          : `<text x="12" y="15" text-anchor="middle" font-size="10" fill="currentColor" font-weight="800">${index + 1}</text>`;

      return `
        <div class="etapa-row is-system ${statusClass}" id="row-flujo-${index + 1}" aria-disabled="true">
          <div class="etapa-checkbox" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              ${icon}
            </svg>
          </div>

          <div style="flex:1;min-width:0">
            <div class="etapa-nombre">${escapeHtml(etapa.Nombre || 'Paso del flujo')}</div>
            <div class="etapa-desc">${escapeHtml(etapa.Descripcion || '')}</div>
            ${
              etapa.FechaFin
                ? `<div class="etapa-date">Actualizado: ${formatFecha(etapa.FechaFin)}</div>`
                : ''
            }
          </div>

          <span class="badge ${badgeClass}">
            ${escapeHtml(etapa.EstadoTexto || (etapa.Completada ? 'Listo' : 'Pendiente'))}
          </span>
        </div>
      `;
    })
    .join('');
}

function actualizarProgresoVisual(pct) {
  const bar = document.getElementById('main-bar');
  const display = document.getElementById('pct-display');
  const safePct = Math.max(0, Math.min(100, Number(pct) || 0));

  if (bar) {
    bar.style.width = `${safePct}%`;
    bar.style.background =
      safePct === 100
        ? 'var(--green)'
        : safePct > 0
          ? 'var(--blue)'
          : 'var(--border)';
  }

  if (display) {
    display.textContent = `${safePct}%`;
    display.style.color = safePct === 100 ? 'var(--green)' : 'var(--blue)';
  }
}

function toggleEtapa() {
  toast('Las etapas se actualizan con acciones del admin y del profesor.', 'orange');
}

async function cargarEstadoAprobacion(proyectoId) {
  const container = document.getElementById('aprob-container');
  if (!container) return;

  try {
    const response = await fetch(`${API}/proyectos/${proyectoId}/aprobacion`);
    const data = await response.json();

    const estado = data.EstadoAprobacion || 'pendiente';

    const config = {
      aceptado: {
        bg: 'rgba(34,197,160,.08)',
        border: 'rgba(34,197,160,.35)',
        color: 'var(--green)',
        icon: '✓',
        titulo: 'Proyecto aceptado',
        sub: `Tu proyecto fue aprobado por ${data.NombreProfesor || 'el evaluador'}.`,
      },
      rechazado: {
        bg: 'rgba(239,68,68,.08)',
        border: 'rgba(239,68,68,.35)',
        color: 'var(--red)',
        icon: '✗',
        titulo: 'Proyecto rechazado',
        sub: 'Revisa el comentario.',
      },
      pendiente: {
        bg: 'rgba(245,158,11,.08)',
        border: 'rgba(245,158,11,.35)',
        color: 'var(--orange)',
        icon: '⏳',
        titulo: 'Esperando revisión',
        sub: data.NombreProfesor
          ? `Tu evaluador ${data.NombreProfesor} aún no ha revisado.`
          : 'Aún no tienes evaluador asignado. Ve a "Elegir evaluador".',
      },
    }[estado] || {
      bg: 'rgba(148,163,184,.08)',
      border: 'rgba(148,163,184,.35)',
      color: 'var(--text-muted)',
      icon: '•',
      titulo: 'Estado no definido',
      sub: 'No hay información de aprobación.',
    };

    container.innerHTML = `
      <div style="background:${config.bg};border:1.5px solid ${config.border};border-radius:12px;padding:18px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:${data.ComentarioRevision ? '12px' : '0'}">
          <div style="width:40px;height:40px;border-radius:50%;background:${config.color};color:white;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">
            ${config.icon}
          </div>

          <div>
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:16px;color:${config.color}">
              ${config.titulo}
            </div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:2px">
              ${config.sub}
            </div>
          </div>
        </div>

        ${
          data.ComentarioRevision
            ? `
              <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;line-height:1.5;color:var(--text)">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
                  Comentario
                </div>

                ${data.ComentarioRevision.replace(/\n/g, '<br>')}

                ${
                  data.FechaRevision
                    ? `
                      <div style="font-size:11px;color:var(--text-muted);margin-top:8px">
                        📅 ${formatFechaHora(data.FechaRevision)}
                      </div>
                    `
                    : ''
                }
              </div>
            `
            : ''
        }
      </div>
    `;
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div style="color:var(--red);font-size:13px">
        Error al cargar estado de aprobación.
      </div>
    `;
  }
}

// ── ELEGIR EVALUADOR ─────────────────────────────────────────────────────────

async function verificarBadgeEvaluador() {
  if (!proyectoActualId) return;

  try {
    const response = await fetch(`${API}/disponibilidad?ProyectoID=${proyectoActualId}`);
    const rows = await response.json();

    const badge = document.getElementById('badge-evaluador');

    if (badge) {
      badge.style.display = Array.isArray(rows) && rows.length ? 'inline-flex' : 'none';
    }
  } catch (error) {
    console.error(error);
  }
}

async function loadEvaluadoresDisponibles() {
  const container = document.getElementById('evaluadores-disponibles');
  if (!container) return;

  if (!proyectoActualId) {
    container.innerHTML = `
      <div style="color:var(--text-muted);font-size:13px">
        Primero crea tu proyecto para ver evaluadores disponibles.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="color:var(--text-muted);font-size:13px">
      Cargando...
    </div>
  `;

  try {
    const response = await fetch(`${API}/disponibilidad?ProyectoID=${proyectoActualId}`);
    const rows = await response.json();

    const disponibilidades = Array.isArray(rows) ? rows : [];

    if (!disponibilidades.length) {
      container.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
          </svg>

          <h3>Sin evaluadores disponibles</h3>
          <p>Aún ningún profesor ha ofrecido evaluarte.<br>Vuelve más tarde.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="eval-list">` +
      disponibilidades.map((disp) => `
        <div class="eval-card">
          <div class="eval-avatar">${disp.NombreProfesor ? disp.NombreProfesor[0].toUpperCase() : 'P'}</div>
          <div class="eval-info">
            <div class="eval-name">${disp.NombreProfesor || 'Profesor'}</div>
            <div class="eval-meta">
              ${disp.Fecha ? `<span>📅 ${formatFecha(disp.Fecha)}</span>` : ''}
              <span>🕐 ${disp.HoraInicio || '--:--'} – ${disp.HoraFin || '--:--'}</span>
              ${disp.Sala ? `<span>🏫 ${disp.Sala}</span>` : ''}
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="elegirEvaluador(${disp.DisponibilidadID}, '${escapeForJS(disp.NombreProfesor || 'Profesor')}')">
            Elegir
          </button>
        </div>
      `).join('') + `</div>`;

    cargarEvaluadorActual();
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div style="color:var(--red);font-size:13px">
        Error al cargar evaluadores.
      </div>
    `;
  }
}

async function cargarEvaluadorActual() {
  const card = document.getElementById('card-mi-evaluador');
  const info = document.getElementById('mi-evaluador-info');

  if (!card || !info) return;

  if (!miProyecto?.NombreProfesor) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  try {
    const response = await fetch(`${API}/disponibilidad/profesor/${miProyecto.ProfesorID}`);
    const disponibilidades = await response.json();

    const reservada = Array.isArray(disponibilidades)
      ? disponibilidades.find(
          (disp) =>
            disp.ProyectoID === proyectoActualId &&
            (disp.Estado === 'reservada' || disp.Estado === 'aprobada'),
        )
      : null;

    info.innerHTML = `
      <div class="eval-card eval-selected">
        <div class="eval-avatar green">✓</div>
        <div class="eval-info">
          <div class="eval-name">${miProyecto.NombreProfesor}</div>
          ${reservada ? `
            <div class="eval-meta">
              ${reservada.Fecha ? `<span>📅 ${formatFecha(reservada.Fecha)}</span>` : ''}
              <span>🕐 ${reservada.HoraInicio || '--:--'} – ${reservada.HoraFin || '--:--'}</span>
              ${reservada.Sala ? `<span>🏫 ${reservada.Sala}</span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } catch (error) {
    console.error(error);

    info.innerHTML = `
      <div class="eval-card eval-selected">
        <div class="eval-avatar green">✓</div>
        <div class="eval-info">
          <div class="eval-name">${miProyecto.NombreProfesor}</div>
        </div>
      </div>
    `;
  }
}

async function elegirEvaluador(disponibilidadId, nombre) {
  const confirmar = confirm(`¿Confirmar a ${nombre} como tu evaluador?`);

  if (!confirmar) return;

  try {
    const response = await fetch(`${API}/disponibilidad/${disponibilidadId}/seleccionar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ProyectoID: proyectoActualId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error al seleccionar evaluador');
    }

    toast(`✓ ${nombre} seleccionado como tu evaluador`);
    await loadMiProyecto();
    loadEvaluadoresDisponibles();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Error al seleccionar', 'red');
  }
}

// ── MI QR ─────────────────────────────────────────────────────────────────────

async function loadMiQR() {
  const container = document.getElementById('qr-content');
  if (!container) return;

  if (!proyectoActualId) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:13px">Primero crea tu proyecto.</div>`;
    return;
  }

  container.innerHTML = `<div style="color:var(--text-muted);font-size:13px">Buscando inscripcion aprobada...</div>`;

  try {
    const response = await fetch(`${API}/eventos/proyectos?proyectoId=${proyectoActualId}`);
    const data = await response.json();

    const inscripciones = Array.isArray(data) ? data : [];
    const aceptada = inscripciones.find((item) => item.Estado === 'aceptado');

    if (!aceptada) {
      container.innerHTML = `
        <div class="qr-lock-card">
          <div style="font-size:48px;margin-bottom:12px">⏳</div>
          <div class="qr-lock-title">Aun no puedes generar tu QR</div>
          <div class="student-inline-note">
            ${inscripciones.length
              ? 'Tu inscripcion esta pendiente de aprobacion del administrador.'
              : 'Aun no estas inscrito a ningun evento.'}
          </div>
          ${inscripciones.length
            ? `<div style="margin-top:16px"><span class="badge badge-orange">Pendiente de aprobacion</span></div>`
            : `<button class="btn btn-primary btn-sm" style="margin-top:16px" onclick="showSection('inscribir', document.querySelector('[onclick*=inscribir]'))">Inscribir a un evento</button>`}
        </div>
      `;
      return;
    }

    const horarioPendienteNotice = !aceptada.HorarioID
      ? `
        <div class="qr-lock-card" style="margin-bottom:16px">
          <div class="qr-lock-title">Aula y horario pendientes</div>
          <div class="student-inline-note">
            Tu proyecto ya fue aceptado y el QR puede generarse. Elige un slot disponible para completar la logistica del evento.
          </div>
          <button class="btn btn-secondary btn-sm" style="margin-top:16px" onclick="showSection('mis-inscripciones', document.querySelector('[onclick*=mis-inscripciones]'))">
            Elegir horario
          </button>
        </div>
      `
      : '';

    container.innerHTML = `
      ${horarioPendienteNotice}
      <div class="qr-ready-shell">
        <div class="qr-guidance">
          Genera el QR cuando estes frente al evaluador. El token es temporal y evita usar codigos viejos.
        </div>

        <div class="qr-ready-card">
          <div>
            <div class="qr-ready-label">Inscripcion aprobada</div>
            <div class="qr-ready-title">${escapeHtml(aceptada.NombreEvento || 'Evento aprobado')}</div>
            <div class="qr-ready-meta">
              ${aceptada.HoraInicio || aceptada.HoraEval || 'Horario por confirmar'}
              ${aceptada.NombreAula || aceptada.SalaEval ? ' · ' + escapeHtml(aceptada.NombreAula || aceptada.SalaEval) : ''}
            </div>
          </div>
          <button class="btn btn-primary" id="btn-generar-qr" onclick="generarQRPresentation(${aceptada.EventoProyectoID})">
            Generar QR para presentar
          </button>
        </div>

        <div id="qr-generated" class="qr-generated-slot"></div>
      </div>
    `;
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div style="color:var(--red);font-size:13px">Error al cargar QR.</div>`;
  }
}

async function generarQRPresentation(eventoProyectoId) {
  const btn = document.getElementById('btn-generar-qr');
  const container = document.getElementById('qr-generated');

  if (!proyectoActualId || !user?.id) return toast('No hay proyecto activo', 'red');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generando...';
  }

  if (container) {
    container.innerHTML = `<div style="font-size:13px;color:var(--text-muted)">Generando token temporal...</div>`;
  }

  try {
    const response = await fetch(`${API}/qr/generar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ProyectoID: proyectoActualId,
        AlumnoID: user.id,
        EventoProyectoID: eventoProyectoId,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'No se pudo generar el QR');

    await renderQRPresentation(data);
    toast('QR generado para presentar');
  } catch (error) {
    console.error(error);
    if (container) container.innerHTML = `<div style="color:var(--red);font-size:13px">${escapeHtml(error.message || 'Error al generar QR.')}</div>`;
    toast(error.message || 'Error al generar QR', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Generar nuevo QR';
    }
  }
}

async function renderQRPresentation(data) {
  const container = document.getElementById('qr-generated');
  if (!container) return;

  const token = data.token || '';
  const evalUrl = new URL(`evaluar-qr.html?token=${encodeURIComponent(token)}`, window.location.href).href;
  const expires = data.expiresAt ? formatFechaHora(data.expiresAt) : '24 horas';

  container.innerHTML = `
    <div class="qr-result-card">
      <canvas id="qr-canvas"></canvas>

      <div class="qr-token-box">
        <div class="qr-ready-label">Enlace de evaluacion</div>
        <div class="qr-token-value">${escapeHtml(evalUrl)}</div>
      </div>

      <div class="qr-token-box compact">
        <div class="qr-ready-label">Token de respaldo</div>
        <div class="qr-token-value">${escapeHtml(token)}</div>
      </div>

      <div class="qr-expire-text">Expira: ${escapeHtml(expires)}</div>

      <div class="qr-actions">
        <a class="btn btn-ghost btn-sm" href="${escapeHtml(evalUrl)}" target="_blank" rel="noopener">Abrir vista</a>
        <button class="btn btn-ghost btn-sm" onclick="descargarQRPresentation()">Descargar QR</button>
        <button class="btn btn-ghost btn-sm" onclick="imprimirQRPresentation()">Imprimir QR</button>
      </div>
    </div>
  `;

  const canvas = document.getElementById('qr-canvas');
  if (canvas) {
    const rendered = await renderQRCanvas(canvas, evalUrl);
    if (!rendered) {
      canvas.insertAdjacentHTML('afterend', `<div class="qr-render-warning">No se pudo dibujar el QR. Usa el enlace o token de respaldo.</div>`);
    }
  }
}

async function renderQRCanvas(canvas, value) {
  if (!canvas || !value) return false;

  if (typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function') {
    try {
      await new Promise((resolve, reject) => {
        QRCode.toCanvas(canvas, value, { width: 280, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } }, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return true;
    } catch (error) {
      console.warn('QR CDN renderer failed, using local renderer.', error);
    }
  }

  try {
    drawLocalQR(canvas, value);
    return true;
  } catch (error) {
    console.error('Local QR renderer failed:', error);
    return false;
  }
}

function drawLocalQR(canvas, value) {
  const version = 5;
  const size = 17 + version * 4;
  const dataCodewords = 108;
  const ecCodewords = 26;
  const bytes = new TextEncoder().encode(value);

  if (bytes.length > 106) {
    throw new Error('El enlace del QR es demasiado largo para el generador local.');
  }

  const data = makeQRDataCodewords(bytes, dataCodewords);
  const ecc = makeQRErrorCorrection(data, ecCodewords);
  const codewords = data.concat(ecc);
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  const setFunction = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    matrix[y][x] = !!dark;
    reserved[y][x] = true;
  };

  const drawFinder = (x, y) => {
    for (let dy = -1; dy <= 7; dy += 1) {
      for (let dx = -1; dx <= 7; dx += 1) {
        const xx = x + dx;
        const yy = y + dy;
        const inPattern = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
        const dark = inPattern && (
          dx === 0 || dx === 6 || dy === 0 || dy === 6 ||
          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
        );
        setFunction(xx, yy, dark);
      }
    }
  };

  const drawAlignment = (cx, cy) => {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);
  drawAlignment(30, 30);

  for (let i = 8; i < size - 8; i += 1) {
    setFunction(i, 6, i % 2 === 0);
    setFunction(6, i, i % 2 === 0);
  }

  setFunction(8, size - 8, true);
  drawQRFormatBits(matrix, reserved, size, 0);
  placeQRData(matrix, reserved, size, codewords, 0);

  const quiet = 4;
  const scale = Math.max(1, Math.floor(280 / (size + quiet * 2)));
  const pixelSize = (size + quiet * 2) * scale;
  canvas.width = pixelSize;
  canvas.height = pixelSize;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pixelSize, pixelSize);
  ctx.fillStyle = '#0f172a';

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (matrix[y][x]) {
        ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
      }
    }
  }
}

function makeQRDataCodewords(bytes, dataCodewords) {
  const bits = [];
  const pushBits = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };

  pushBits(0x4, 4);
  pushBits(bytes.length, 8);
  bytes.forEach((byte) => pushBits(byte, 8));
  const maxBits = dataCodewords * 8;
  pushBits(0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }

  for (let pad = 0xec; data.length < dataCodewords; pad = pad === 0xec ? 0x11 : 0xec) {
    data.push(pad);
  }

  return data;
}

function makeQRErrorCorrection(data, degree) {
  const generator = makeQRGenerator(degree);
  const result = Array(degree).fill(0);

  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    generator.forEach((coef, index) => {
      result[index] ^= qrGFMul(coef, factor);
    });
  });

  return result;
}

function makeQRGenerator(degree) {
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = Array(result.length + 1).fill(0);
    result.forEach((coef, index) => {
      next[index] ^= qrGFMul(coef, 1);
      next[index + 1] ^= qrGFMul(coef, qrGFPow(i));
    });
    result = next;
  }
  return result.slice(1);
}

function qrGFPow(power) {
  let result = 1;
  for (let i = 0; i < power; i += 1) result = qrGFMul(result, 2);
  return result;
}

function qrGFMul(a, b) {
  let result = 0;
  let x = a;
  let y = b;
  while (y > 0) {
    if (y & 1) result ^= x;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
    y >>>= 1;
  }
  return result;
}

function drawQRFormatBits(matrix, reserved, size, mask) {
  const bits = getQRFormatBits(mask);
  const setFunction = (x, y, dark) => {
    matrix[y][x] = !!dark;
    reserved[y][x] = true;
  };
  const bit = (index) => ((bits >>> index) & 1) !== 0;

  for (let i = 0; i <= 5; i += 1) setFunction(8, i, bit(i));
  setFunction(8, 7, bit(6));
  setFunction(8, 8, bit(7));
  setFunction(7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) setFunction(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i += 1) setFunction(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i += 1) setFunction(8, size - 15 + i, bit(i));
}

function getQRFormatBits(mask) {
  const data = (1 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i += 1) {
    rem = (rem << 1) ^ (((rem >>> 9) & 1) ? 0x537 : 0);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function placeQRData(matrix, reserved, size, codewords, mask) {
  const bits = [];
  codewords.forEach((byte) => {
    for (let i = 7; i >= 0; i -= 1) bits.push(((byte >>> i) & 1) !== 0);
  });

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        if (!reserved[y][x]) {
          let dark = bitIndex < bits.length ? bits[bitIndex] : false;
          bitIndex += 1;
          if (isQRMaskDark(mask, x, y)) dark = !dark;
          matrix[y][x] = dark;
        }
      }
    }
    upward = !upward;
  }
}

function isQRMaskDark(mask, x, y) {
  if (mask === 0) return (x + y) % 2 === 0;
  return false;
}

function descargarQRPresentation() {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return toast('Primero genera el QR', 'orange');

  const link = document.createElement('a');
  link.download = `qr-presentacion-${proyectoActualId || 'proyecto'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function imprimirQRPresentation() {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return toast('Primero genera el QR', 'orange');

  const img = canvas.toDataURL('image/png');
  const token = document.querySelector('.qr-token-box.compact .qr-token-value')?.textContent?.trim() || '';
  const win = window.open('', '_blank', 'width=520,height=680');
  if (!win) return toast('No se pudo abrir la ventana de impresion', 'red');

  win.document.write(`
    <html>
      <head>
        <title>QR de presentacion</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; text-align: center; padding: 32px; }
          img { width: 320px; height: 320px; }
          code { display: block; margin-top: 18px; word-break: break-all; font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>QR de presentacion</h1>
        <p>${escapeHtml(miProyecto?.Titulo || 'Proyecto')}</p>
        <img src="${img}" alt="QR">
        <code>${escapeHtml(token)}</code>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

// ── INSCRIBIR A EVENTO ───────────────────────────────────────────────────────

function irPaso(num) {
  if (num === 2 && !inscripcion.eventoId) {
    return toast('Selecciona un evento primero', 'orange');
  }

  if (num === 4) {
    const titulo = document.getElementById('inscripcion-titulo')?.value.trim();
    const categoria = document.getElementById('inscripcion-categoria')?.value.trim();
    const descripcion = document.getElementById('inscripcion-descripcion')?.value.trim();

    if (!titulo) return toast('Escribe el nombre del proyecto', 'orange');
    if (!categoria) return toast('Escribe la categoría del proyecto', 'orange');
    if (!descripcion) return toast('Escribe la descripción del proyecto', 'orange');

    inscripcion.titulo = titulo;
    inscripcion.categoria = categoria;
    inscripcion.descripcion = descripcion;

    renderResumen();
  }

  [1, 2, 3, 4].forEach((paso) => {
    const el = document.getElementById(`paso-${paso}`);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById(`paso-${num}`);
  if (target) target.style.display = 'block';

  pasoActual = num;
  actualizarSteps(num);
}

function actualizarSteps(actual) {
  [1, 2, 3, 4].forEach((paso) => {
    const el = document.getElementById(`step-${paso}`);
    if (!el) return;

    el.classList.remove('active', 'done');

    if (paso < actual) el.classList.add('done');
    if (paso === actual) el.classList.add('active');
  });
}

async function loadEventosDisponibles() {
  const grid = document.getElementById('eventos-disponibles');
  if (!grid) return;

  try {
    const response = await fetch(`${API}/eventos`);
    const data = await response.json();

    const disponibles = Array.isArray(data)
      ? data.filter((evento) => ['proximo', 'activo'].includes(evento.Estado))
      : [];

    if (!disponibles.length) {
      grid.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <h3>Sin eventos disponibles</h3>
          <p>No hay eventos activos en este momento.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = disponibles
      .map((evento) => {
        const fecha = formatFechaLarga(evento.Fecha);
        const selected = inscripcion.eventoId === evento.EventoID;

        return `
          <div class="evento-card ${selected ? 'selected' : ''}" onclick="seleccionarEvento(${evento.EventoID}, '${escapeForJS(evento.Nombre)}', this)">
            <div class="evento-card-nombre">${evento.Nombre}</div>
            <div class="evento-card-fecha">📅 ${fecha}</div>
            <div class="evento-card-hora">🕐 ${evento.HoraInicio || '--:--'} – ${evento.HoraFin || '--:--'}</div>

            ${
              evento.Descripcion
                ? `<p style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.5">${evento.Descripcion}</p>`
                : ''
            }

            <div style="margin-top:12px">
              <span class="badge ${evento.Estado === 'activo' ? 'badge-green' : 'badge-blue'}">
                ${evento.Estado === 'activo' ? 'Activo' : 'Próximo'}
              </span>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (error) {
    console.error(error);

    grid.innerHTML = `
      <div style="color:var(--red);font-size:13px">
        Error al cargar eventos.
      </div>
    `;
  }
}

function seleccionarEvento(id, nombre, el) {
  inscripcion.eventoId = id;
  inscripcion.eventoNombre = nombre;

  document.querySelectorAll('.evento-card').forEach((card) => {
    card.classList.remove('selected');
  });

  if (el) el.classList.add('selected');

  const btn = document.getElementById('btn-paso-2');
  if (btn) btn.disabled = false;

  toast(`Evento: ${nombre}`);
}

function renderResumen() {
  const resumen = document.getElementById('resumen-inscripcion');
  if (!resumen) return;

  resumen.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:180px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
            Evento
          </div>
          <div style="font-size:14px;font-weight:500">
            ${inscripcion.eventoNombre || '—'}
          </div>
        </div>

        <div style="flex:1;min-width:180px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
            Categoría
          </div>
          <div style="font-size:14px;font-weight:500">
            ${inscripcion.categoria || '—'}
          </div>
        </div>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
          Proyecto
        </div>
        <div style="font-size:14px;font-weight:500">
          ${inscripcion.titulo || '—'}
        </div>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
          Participantes (${inscripcion.participantes.length + 1})
        </div>

        <div style="font-size:13px">👑 ${user.nombre} (Líder)</div>

        ${inscripcion.participantes.map((p) => `<div style="font-size:13px">• ${p.nombre}</div>`).join('')}
      </div>
    </div>
  `;
}

async function confirmarInscripcion() {
  if (!inscripcion.eventoId) return toast('Selecciona un evento', 'orange');
  if (!inscripcion.titulo) return toast('Falta el nombre del proyecto', 'orange');
  if (!inscripcion.descripcion) return toast('Falta la descripción', 'orange');

  const btn = document.getElementById('btn-confirmar');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando...';
  }

  try {
    let proyectoId = miProyecto?.ProyectoID || null;

    if (!proyectoId) {
      const hoy = new Date().toISOString().slice(0, 10);

      const proyectoResponse = await fetch(`${API}/proyectos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Titulo: inscripcion.titulo,
          Descripcion: inscripcion.descripcion,
          Categoria: inscripcion.categoria,
          FechaInicio: hoy,
          AlumnoID: user.id,
        }),
      });

      const proyectoData = await proyectoResponse.json();

      if (!proyectoResponse.ok) {
        throw new Error(proyectoData.message || 'Error al crear proyecto');
      }

      proyectoId = proyectoData.ProyectoID;

      miProyecto = {
        ProyectoID: proyectoId,
        Titulo: inscripcion.titulo,
        AlumnoID: user.id,
        Estatus: 'Pendiente',
        Progreso: 0,
      };

      proyectoActualId = proyectoId;

      await fetch(`${API}/proyectos/${proyectoId}/documentos/texto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Titulo: 'Descripción del proyecto',
          Contenido: inscripcion.descripcion,
          SubidoPorID: user.id,
        }),
      });
    } else {
      await fetch(`${API}/proyectos/${proyectoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Titulo: inscripcion.titulo,
          Descripcion: inscripcion.descripcion,
          Categoria: inscripcion.categoria,
        }),
      });
    }

    if (inscripcion.archivo) {
      const base64 = await fileToBase64(inscripcion.archivo);

      await fetch(`${API}/proyectos/${proyectoId}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          NombreArchivo: inscripcion.archivo.name,
          MimeType: inscripcion.archivo.type || 'application/pdf',
          ContenidoBase64: base64,
          Descripcion: 'PDF de presentación',
          SubidoPorID: user.id,
        }),
      });
    }

    const participantesPayload = [
      {
        id: user.id,
        rol: 'Lider',
      },
      ...inscripcion.participantes.map((participante) => ({
        id: participante.id,
        rol: 'Participante',
      })),
    ];

    const inscripcionResponse = await fetch(`${API}/eventos/proyectos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        EventoID: inscripcion.eventoId,
        ProyectoID: proyectoId,
        Descripcion: inscripcion.descripcion,
        Participantes: participantesPayload,
      }),
    });

    const inscripcionData = await inscripcionResponse.json();

    if (!inscripcionResponse.ok) {
      throw new Error(inscripcionData.message || 'Error al inscribir proyecto');
    }

    Object.assign(inscripcion, {
      eventoId: null,
      eventoNombre: null,
      titulo: '',
      categoria: '',
      descripcion: '',
      archivo: null,
      participantes: [],
      asesores: [],
    });

    const inputTitulo = document.getElementById('inscripcion-titulo');
    const inputCategoria = document.getElementById('inscripcion-categoria');
    const inputDescripcion = document.getElementById('inscripcion-descripcion');
    const fileNameDisplay = document.getElementById('file-name-display');

    if (inputTitulo) inputTitulo.value = '';
    if (inputCategoria) inputCategoria.value = '';
    if (inputDescripcion) inputDescripcion.value = '';

    if (fileNameDisplay) {
      fileNameDisplay.textContent = '';
      fileNameDisplay.style.display = 'none';
    }

    renderListaParticipantes();
    renderListaAsesores();

    irPaso(1);
    actualizarSteps(1);

    toast('¡Inscripción enviada! El admin la revisará pronto. 🎉');

    setTimeout(() => {
      showSection(
        'mis-inscripciones',
        document.querySelector('[onclick*="mis-inscripciones"]'),
      );
    }, 1200);
  } catch (error) {
    console.error(error);
    toast(error.message || 'Error al enviar inscripción', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
        Enviar inscripción
      `;
    }
  }
}

// ── MIS INSCRIPCIONES ────────────────────────────────────────────────────────

async function loadMisInscripciones() {
  const container = document.getElementById('inscripciones-content');
  if (!container) return;

  if (!miProyecto) {
    await loadMiProyecto();
  }

  if (!miProyecto) {
    container.innerHTML = `
      <div class="empty">
        <h3>Sin proyecto</h3>
        <p>Necesitas tener un proyecto para ver inscripciones.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="color:var(--text-muted);font-size:13px;padding:16px">
      Cargando...
    </div>
  `;

  try {
    const response = await fetch(`${API}/eventos/proyectos?proyectoId=${miProyecto.ProyectoID}`);
    const data = await response.json();

    const inscripciones = Array.isArray(data) ? data : [];
    const pendientes = inscripciones.filter((item) => item.Estado === 'pendiente').length;

    const badge = document.getElementById('badge-inscripciones');

    if (badge) {
      badge.textContent = pendientes;
      badge.style.display = pendientes > 0 ? 'inline-flex' : 'none';
    }

    if (!inscripciones.length) {
      container.innerHTML = `
        <div class="empty">
          <h3>Sin inscripciones</h3>
          <p>
            No has inscrito tu proyecto a ningún evento.<br>
            <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="showSection('inscribir',document.querySelector('[onclick*=inscribir]'))">
              Inscribir a evento
            </button>
          </p>
        </div>
      `;
      return;
    }

    const colores = {
      pendiente: 'badge-orange',
      aceptado: 'badge-green',
      rechazado: 'badge-red',
    };

    const iconos = {
      pendiente: '⏳',
      aceptado: '✅',
      rechazado: '❌',
    };

    container.innerHTML = inscripciones
      .map(
        (insc) => `
          <div class="inscripcion-card">
            <div class="inscripcion-header">
              <div>
                <div class="inscripcion-titulo">
                  ${insc.NombreEvento || '—'}
                </div>
                <div class="inscripcion-evento">
                  Proyecto: ${insc.TituloProyecto || miProyecto.Titulo}
                </div>
              </div>

              <span class="badge ${colores[insc.Estado] || 'badge-gray'}">
                ${iconos[insc.Estado] || ''} ${capitalize(insc.Estado || 'pendiente')}
              </span>
            </div>

            ${
              insc.Estado === 'aceptado'
                ? `
                  <div style="background:rgba(34,197,160,.08);border:1px solid rgba(34,197,160,.2);border-radius:8px;padding:12px 14px;font-size:13px;color:var(--green);margin-bottom:12px;display:flex;align-items:center;gap:10px">
                    <span style="font-size:20px">🎉</span>

                    <div>
                      Tu proyecto fue aprobado. <strong>Genera tu QR</strong> cuando vayas a presentar.
                      <button class="btn btn-ghost btn-sm" style="margin-left:10px" onclick="showSection('mi-qr',document.querySelector('[onclick*=mi-qr]'))">
                        Generar QR
                      </button>
                    </div>
                  </div>
                `
                : ''
            }

            ${
              insc.Estado === 'aceptado' && !insc.HorarioID
                ? `
                  <div class="slot-picker" id="slot-picker-${insc.EventoProyectoID}">
                    <div style="color:var(--text-muted);font-size:13px">Cargando horarios disponibles...</div>
                  </div>
                `
                : ''
            }

            ${
              insc.Estado === 'rechazado'
                ? `
                  <div style="background:rgba(232,64,64,.08);border:1px solid rgba(232,64,64,.2);border-radius:8px;padding:12px 14px;font-size:13px;color:var(--red);margin-bottom:12px">
                    Tu inscripción fue rechazada.
                  </div>
                `
                : ''
            }

            <div class="inscripcion-meta">
              <span>📅 ${insc.CreatedAt ? formatFecha(insc.CreatedAt) : '—'}</span>
              ${insc.NombreAula ? `<span>🏫 ${insc.NombreAula}</span>` : ''}
              ${insc.HoraInicio ? `<span>🕐 ${insc.HoraInicio} – ${insc.HoraFin}</span>` : ''}
              ${insc.Evaluadores ? `<span>👨‍🏫 ${insc.Evaluadores}</span>` : ''}
            </div>
          </div>
        `,
      )
      .join('');

    inscripciones
      .filter((insc) => insc.Estado === 'aceptado' && !insc.HorarioID)
      .forEach((insc) => loadSlotsForInscripcion(insc.EventoProyectoID, insc.EventoID));
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div style="color:var(--red);font-size:13px;padding:16px">
        Error al cargar inscripciones.
      </div>
    `;
  }
}

// ── MI DESEMPEÑO ─────────────────────────────────────────────────────────────

async function loadSlotsForInscripcion(eventoProyectoId, eventoId) {
  const container = document.getElementById(`slot-picker-${eventoProyectoId}`);
  if (!container) return;

  try {
    const response = await fetch(`${API}/eventos/${eventoId}/horarios-disponibles`);
    const slots = await response.json();

    if (!response.ok) {
      throw new Error(slots.message || 'Error al cargar horarios');
    }

    if (!Array.isArray(slots) || !slots.length) {
      container.innerHTML = `
        <div class="notice-card notice-warning">
          No hay slots disponibles por ahora. Intenta mas tarde o consulta con administracion.
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="slot-picker-title">Elige aula y horario</div>
      <div class="slot-grid">
        ${slots.map((slot) => `
          <button class="slot-card" onclick="elegirHorarioAlumno(${eventoProyectoId},${slot.HorarioID})">
            <span class="slot-card-aula">${escapeHtml(slot.NombreAula || 'Aula')}</span>
            <span class="slot-card-time">${escapeHtml(String(slot.HoraInicio || '').slice(0, 5))} - ${escapeHtml(String(slot.HoraFin || '').slice(0, 5))}</span>
          </button>
        `).join('')}
      </div>
    `;
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div style="color:var(--red);font-size:13px">${escapeHtml(error.message || 'Error')}</div>`;
  }
}

async function elegirHorarioAlumno(eventoProyectoId, horarioId) {
  try {
    const response = await fetch(`${API}/eventos/proyectos/${eventoProyectoId}/horario`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        AlumnoID: user.id,
        HorarioID: horarioId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo confirmar horario');
    }

    toast('Horario confirmado');
    await loadMisInscripciones();
    await loadMiQR();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Error al elegir horario', 'red');
    loadMisInscripciones();
  }
}

async function loadModeradorAlumno() {
  const container = document.getElementById('moderador-content');
  if (!container) return;

  container.innerHTML = `<div style="color:var(--text-muted);font-size:13px">Cargando eventos...</div>`;

  try {
    const [eventosRes, postulacionesRes] = await Promise.all([
      fetch(`${API}/eventos`),
      fetch(`${API}/moderadores-aula?alumnoId=${user.id}`),
    ]);

    const eventos = await eventosRes.json();
    const postulaciones = await postulacionesRes.json();

    if (!eventosRes.ok) throw new Error(eventos.message || 'Error al cargar eventos');
    if (!postulacionesRes.ok) throw new Error(postulaciones.message || 'Error al cargar postulaciones');

    const candidatos = Array.isArray(eventos)
      ? eventos.filter((e) => ['proximo', 'activo'].includes(String(e.Estado || '').toLowerCase()))
      : [];

    if (!candidatos.length) {
      container.innerHTML = `
        <div class="empty">
          <h3>Sin eventos abiertos</h3>
          <p>No hay eventos proximos o activos para postulaciones.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="moderador-list">
        ${candidatos.map((evento) => `
          <div class="moderador-event-card">
            <div class="inscripcion-header">
              <div>
                <div class="inscripcion-titulo">${escapeHtml(evento.Nombre)}</div>
                <div class="inscripcion-evento">${formatFecha(evento.Fecha)} - ${escapeHtml(evento.Estado)}</div>
              </div>
            </div>
            <div id="moderador-aulas-${evento.EventoID}" class="slot-grid">
              <div style="color:var(--text-muted);font-size:13px">Cargando aulas...</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    candidatos.forEach((evento) => loadAulasModerador(evento.EventoID, postulaciones));
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div style="color:var(--red);font-size:13px">${escapeHtml(error.message || 'Error')}</div>`;
  }
}

async function loadAulasModerador(eventoId, postulaciones = []) {
  const container = document.getElementById(`moderador-aulas-${eventoId}`);
  if (!container) return;

  try {
    const response = await fetch(`${API}/eventos/${eventoId}/aulas-resumen`);
    const aulas = await response.json();

    if (!response.ok) throw new Error(aulas.message || 'Error al cargar aulas');

    if (!Array.isArray(aulas) || !aulas.length) {
      container.innerHTML = `<div style="color:var(--text-muted);font-size:13px">Este evento aun no tiene aulas.</div>`;
      return;
    }

    container.innerHTML = aulas.map((aula) => {
      const postulacion = postulaciones.find((p) => Number(p.EventoID) === Number(eventoId) && Number(p.AulaID) === Number(aula.AulaID));
      const bloqueada = Boolean(aula.Moderador) || Boolean(postulacion);
      const label = aula.Moderador
        ? `Moderador: ${aula.Moderador}`
        : postulacion
          ? `Tu postulacion esta ${postulacion.Estado}`
          : `${Number(aula.SlotsDisponibles || 0)} slots disponibles`;

      return `
        <button class="slot-card" ${bloqueada ? 'disabled' : ''} onclick="postularModerador(${eventoId},${aula.AulaID})">
          <span class="slot-card-aula">${escapeHtml(aula.NombreAula || 'Aula')}</span>
          <span class="slot-card-time">${escapeHtml(label)}</span>
        </button>
      `;
    }).join('');
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div style="color:var(--red);font-size:13px">${escapeHtml(error.message || 'Error')}</div>`;
  }
}

async function postularModerador(eventoId, aulaId) {
  try {
    const response = await fetch(`${API}/moderadores-aula`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        EventoID: eventoId,
        AulaID: aulaId,
        AlumnoID: user.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message || 'No se pudo enviar postulacion');

    toast('Postulacion enviada');
    loadModeradorAlumno();
  } catch (error) {
    console.error(error);
    toast(error.message || 'Error al postularte', 'red');
  }
}

async function loadMiDesempeno() {
  if (!proyectoActualId) {
    try {
      const response = await fetch(`${API}/proyectos/por-alumno/${user.id}`);
      const data = await response.json();

      const proyectos = Array.isArray(data) ? data : [];

      if (proyectos.length) {
        miProyecto = proyectos[0];
        proyectoActualId = proyectos[0].ProyectoID;
      }
    } catch (error) {
      console.error(error);
    }
  }

  if (!proyectoActualId) {
    ['desemp-evaluacion', 'desemp-historial', 'desemp-indicadores', 'desemp-ranking'].forEach((id) => {
      const el = document.getElementById(id);

      if (el) {
        el.innerHTML = `
          <div style="color:var(--text-muted);font-size:13px">
            Necesitas tener un proyecto.
          </div>
        `;
      }
    });

    return;
  }

  loadDesempEvaluaciones();
  loadDesempHistorial();
  loadDesempIndicadores();
  loadDesempRankingEventos();
  loadPodiosAlumno();
}

async function loadDesempEvaluaciones() {
  const container = document.getElementById('desemp-evaluacion');

  if (!container || !proyectoActualId) return;

  container.innerHTML = `
    <div style="color:var(--text-muted);font-size:13px">
      Cargando...
    </div>
  `;

  try {
    const response = await fetch(`${API}/evaluaciones/proyecto/${proyectoActualId}`);
    const evaluaciones = await response.json();

    if (!Array.isArray(evaluaciones) || !evaluaciones.length) {
      container.innerHTML = `
        <div style="color:var(--text-muted);font-size:13px">
          Aún no tienes evaluaciones registradas.
        </div>
      `;
      return;
    }

    container.innerHTML = evaluaciones
      .map((evaluacion, index) => {
        const porcentaje =
          evaluacion.Porcentaje != null ? parseFloat(evaluacion.Porcentaje).toFixed(1) : 0;

        const color =
          porcentaje >= 80
            ? 'var(--green)'
            : porcentaje >= 50
              ? 'var(--blue)'
              : 'var(--orange)';

        const detalles = Array.isArray(evaluacion.detalles) ? evaluacion.detalles : [];

        return `
          <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px">
            <div style="padding:14px 16px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <div style="flex:1;min-width:180px">
                <div style="font-size:14px;font-weight:600">
                  ${evaluacion.NombreRubrica || 'Evaluación #' + (index + 1)}
                </div>

                <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                  Por: ${evaluacion.NombreProfesor || '—'}
                  ${evaluacion.Fecha ? ' · ' + formatFecha(evaluacion.Fecha) : ''}
                </div>
              </div>

              <div style="text-align:right">
                <div style="font-size:22px;font-weight:800;font-family:'Syne',sans-serif;color:${color}">
                  ${porcentaje}%
                </div>
                <div style="font-size:12px;color:var(--text-muted)">
                  ${evaluacion.PuntajeTotal || 0} / ${evaluacion.PuntajeMaximo || 0} pts
                </div>
              </div>
            </div>

            ${
              detalles.length
                ? `
                  <div style="padding:10px 16px">
                    ${detalles
                      .map((detalle) => {
                        const detallePorcentaje =
                          detalle.PuntosMax > 0
                            ? Math.round((detalle.PuntajeObtenido / detalle.PuntosMax) * 100)
                            : 0;

                        const detalleColor =
                          detallePorcentaje >= 80
                            ? 'var(--green)'
                            : detallePorcentaje >= 50
                              ? 'var(--blue)'
                              : 'var(--orange)';

                        return `
                          <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                            <div style="flex:1;min-width:0">
                              <div style="font-size:13px;font-weight:500">
                                ${detalle.NombreCriterio || 'Criterio'}
                              </div>

                              ${
                                detalle.NombreNivel
                                  ? `
                                    <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                                      ${detalle.NombreNivel}
                                    </div>
                                  `
                                  : ''
                              }
                            </div>

                            <div style="flex-shrink:0;text-align:right">
                              <span style="font-size:13px;font-weight:700;color:${detalleColor}">
                                ${detalle.PuntajeObtenido || 0}
                              </span>
                              <span style="font-size:11px;color:var(--text-muted)">
                                / ${detalle.PuntosMax || 0}
                              </span>
                            </div>
                          </div>
                        `;
                      })
                      .join('')}
                  </div>
                `
                : ''
            }

            ${
              evaluacion.ComentarioGeneral
                ? `
                  <div style="padding:12px 16px;border-top:1px solid var(--border);background:var(--surface2);font-size:13px;color:var(--text-muted);font-style:italic">
                    💬 "${evaluacion.ComentarioGeneral}"
                  </div>
                `
                : ''
            }
          </div>
        `;
      })
      .join('');
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div style="color:var(--red);font-size:13px">
        Error al cargar evaluación.
      </div>
    `;
  }
}

async function loadDesempHistorial() {
  const container = document.getElementById('desemp-historial');

  if (!container || !proyectoActualId) return;

  container.innerHTML = `
    <div style="color:var(--text-muted);font-size:13px">
      Cargando...
    </div>
  `;

  try {
    const response = await fetch(`${API}/proyectos/${proyectoActualId}/historial`);
    const data = await response.json();

    const todos = [...(data.evaluaciones || []), ...(data.historial || [])].sort(
      (a, b) => new Date(b.Fecha || b.FechaRegistro) - new Date(a.Fecha || a.FechaRegistro),
    );

    if (!todos.length) {
      container.innerHTML = `
        <div style="color:var(--text-muted);font-size:13px">
          Sin historial aún.
        </div>
      `;
      return;
    }

    container.innerHTML = todos
      .map((registro) => {
        const fecha = registro.Fecha || registro.FechaRegistro;
        const puntaje = registro.PuntajeTotal ?? registro.PuntajeObtenido ?? 0;
        const maximo = registro.PuntajeMaximo || 100;
        const porcentaje = maximo > 0 ? Math.round((puntaje / maximo) * 100) : 0;

        const color =
          porcentaje >= 80
            ? 'var(--green)'
            : porcentaje >= 50
              ? 'var(--blue)'
              : 'var(--orange)';

        return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">
            <div style="width:48px;height:48px;border-radius:50%;border:3px solid ${color};background:${color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <span style="font-size:12px;font-weight:700;color:${color}">
                ${porcentaje}%
              </span>
            </div>

            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:600">
                ${registro.NombreEvento || 'Evaluación'}
              </div>

              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                Puntaje:
                <strong style="color:${color}">${puntaje}</strong>
                / ${maximo}
                ${fecha ? ' · ' + formatFecha(fecha) : ''}
              </div>

              ${
                registro.Observaciones
                  ? `
                    <div style="font-size:12px;color:var(--text-muted);margin-top:4px;font-style:italic">
                      "${registro.Observaciones}"
                    </div>
                  `
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div style="color:var(--red);font-size:13px">
        Error al cargar historial.
      </div>
    `;
  }
}

async function loadDesempIndicadores() {
  const container = document.getElementById('desemp-indicadores');

  if (!container || !proyectoActualId) return;

  container.innerHTML = `
    <div style="color:var(--text-muted);font-size:13px">
      Cargando...
    </div>
  `;

  try {
    const response = await fetch(`${API}/proyectos/${proyectoActualId}/indicadores`);
    const indicadores = await response.json();

    const promedio = parseFloat(indicadores.Promedio || 0).toFixed(1);

    const cards = [
      ['Evaluaciones', indicadores.TotalEvaluaciones || 0, 'Recibidas', 'var(--blue)'],
      ['Promedio', promedio, 'Puntaje medio', 'var(--accent)'],
      ['Mejor', indicadores.MejorPuntaje || 0, 'Máximo logrado', 'var(--green)'],
      [
        'Etapas',
        `${indicadores.EtapasCompletadas || 0}/${indicadores.TotalEtapas || 0}`,
        'Completadas',
        'var(--blue)',
      ],
      ['Total pts.', indicadores.PuntajeTotal || 0, 'Acumulados', 'var(--orange)'],
      ['Documentos', indicadores.TotalDocumentos || 0, 'Subidos', 'var(--text-dim)'],
    ];

    container.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
        ${cards
          .map(
            ([label, value, sub, color]) => `
              <div class="stat-card" style="--card-color:${color}">
                <div class="stat-label">${label}</div>
                <div class="stat-value">${value}</div>
                <div class="stat-sub">${sub}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    `;
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div style="color:var(--red);font-size:13px">
        Error al cargar indicadores.
      </div>
    `;
  }
}

async function loadDesempRankingEventos() {
  const select = document.getElementById('desemp-select-evento');

  if (!select || !proyectoActualId) return;

  try {
    const response = await fetch(`${API}/eventos/proyectos?proyectoId=${proyectoActualId}`);
    const data = await response.json();

    const aceptados = Array.isArray(data)
      ? data.filter((item) => item.Estado === 'aceptado')
      : [];

    if (!aceptados.length) {
      select.innerHTML = '<option value="">Sin eventos aceptados</option>';
      return;
    }

    select.innerHTML =
      '<option value="">— Selecciona evento —</option>' +
      aceptados
        .map(
          (item) => `
            <option value="${item.EventoID}">
              ${item.NombreEvento || 'Evento ' + item.EventoID}
            </option>
          `,
        )
        .join('');
  } catch (error) {
    console.error(error);
    select.innerHTML = '<option value="">Error</option>';
  }
}

async function loadDesempRanking() {
  const select = document.getElementById('desemp-select-evento');
  const container = document.getElementById('desemp-ranking');

  if (!select || !container) return;

  const eventoId = select.value;

  if (!eventoId) {
    container.innerHTML = `
      <div style="color:var(--text-muted);font-size:13px">
        Selecciona un evento.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="color:var(--text-muted);font-size:13px">
      Cargando ranking...
    </div>
  `;

  try {
    const response = await fetch(`${API}/eventos/${eventoId}/ranking`);
    const ranking = await response.json();

    if (!Array.isArray(ranking) || !ranking.length) {
      container.innerHTML = `
        <div style="color:var(--text-muted);font-size:13px">
          Sin datos de ranking aún.
        </div>
      `;
      return;
    }

    const medallas = ['🥇', '🥈', '🥉'];

    container.innerHTML = ranking
      .map((registro, index) => {
        const esMio = registro.ProyectoID === proyectoActualId;
        const color = esMio ? 'var(--blue)' : 'var(--text)';

        return `
          <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:${esMio ? 'rgba(99,102,241,.08)' : 'var(--surface)'};border:${esMio ? '2px solid var(--blue)' : '1px solid var(--border)'};border-radius:10px;margin-bottom:8px">
            <div style="font-size:22px;flex-shrink:0;width:36px;text-align:center">
              ${medallas[index] || '#' + registro.Posicion}
            </div>

            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:${esMio ? '700' : '500'};color:${color}">
                ${registro.Titulo || 'Proyecto'}
              </div>

              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                ${registro.NombreAlumno || '—'}
              </div>
            </div>

            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:16px;font-weight:700;color:${color}">
                ${registro.PuntajeTotal || 0}
              </div>
              <div style="font-size:11px;color:var(--text-muted)">pts</div>
            </div>

            ${esMio ? '<span class="badge badge-blue" style="flex-shrink:0">Tú</span>' : ''}
          </div>
        `;
      })
      .join('');
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div style="color:var(--red);font-size:13px">
        Error al cargar ranking.
      </div>
    `;
  }
}

// ── DOCUMENTOS ───────────────────────────────────────────────────────────────

async function loadPodiosAlumno() {
  const container = document.getElementById('desemp-podios');
  if (!container) return;

  container.innerHTML = `<div style="color:var(--text-muted);font-size:13px">Cargando podios...</div>`;

  try {
    const response = await fetch(`${API}/eventos/pasados/podio`);
    const podios = await response.json();

    if (!response.ok) throw new Error(podios.message || 'Error al cargar podios');

    if (!Array.isArray(podios) || !podios.length) {
      container.innerHTML = `<div style="color:var(--text-muted);font-size:13px">Aun no hay eventos finalizados con podio.</div>`;
      return;
    }

    container.innerHTML = podios.map((item) => `
      <div class="podio-row ${Number(item.ProyectoID) === Number(proyectoActualId) ? 'is-mine' : ''}">
        <div class="podio-pos">${item.Posicion}</div>
        <div class="podio-main">
          <div class="podio-title">${escapeHtml(item.Titulo || 'Proyecto')}</div>
          <div class="podio-meta">${escapeHtml(item.NombreEvento || 'Evento')} - ${formatFecha(item.FechaEvento)}</div>
          <div class="podio-meta">Integrantes: ${escapeHtml(item.Integrantes || item.NombreAlumno || '-')}</div>
          <div class="podio-meta">Profesor de apoyo: ${escapeHtml(item.NombreProfesorApoyo || 'Sin asignar')}</div>
        </div>
        <div class="podio-score">${Number(item.PromedioFinal || 0).toFixed(2)}</div>
        ${item.EntregaID ? `<a class="btn btn-ghost btn-sm" href="${API}/entregas/${item.EntregaID}/ver" target="_blank">Leer PDF</a>` : ''}
      </div>
    `).join('');
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div style="color:var(--red);font-size:13px">${escapeHtml(error.message || 'Error')}</div>`;
  }
}

function abrirSubir() {
  const modal = document.getElementById('modal-subir-doc');
  const input = document.getElementById('doc-file');

  if (input) input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.zip';
  if (modal) modal.classList.add('open');
}

function abrirSubirImagen() {
  const modal = document.getElementById('modal-subir-doc');
  const input = document.getElementById('doc-file');
  const desc = document.getElementById('doc-desc');

  if (input) input.accept = '.png,.jpg,.jpeg,.webp';
  if (desc && !desc.value.trim()) desc.value = 'Imagen del proyecto';
  if (modal) modal.classList.add('open');
}

function cerrarSubir() {
  const modal = document.getElementById('modal-subir-doc');
  const input = document.getElementById('doc-file');
  const desc = document.getElementById('doc-desc');

  if (modal) modal.classList.remove('open');
  if (input) input.value = '';
  if (desc) desc.value = '';
}

function formatBytesDoc(bytes) {
  if (!bytes) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(k));

  return (bytes / Math.pow(k, index)).toFixed(1) + ' ' + sizes[index];
}

async function subirDocumento() {
  const inputFile = document.getElementById('doc-file');
  const inputDesc = document.getElementById('doc-desc');

  const file = inputFile?.files[0];
  const descripcion = inputDesc?.value.trim() || '';

  if (!file) return toast('Selecciona un archivo', 'red');
  if (file.size > 25 * 1024 * 1024) return toast('Archivo excede 25 MB', 'red');
  if (!proyectoActualId) return toast('No hay proyecto activo', 'red');

  const btn = document.getElementById('btn-subir-doc');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Subiendo...';
  }

  try {
    const base64 = await fileToBase64(file);

    const response = await fetch(`${API}/proyectos/${proyectoActualId}/documentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        NombreArchivo: file.name,
        MimeType: file.type || 'application/octet-stream',
        ContenidoBase64: base64,
        Descripcion: descripcion,
        SubidoPorID: user.id,
      }),
    });

    if (!response.ok) {
      throw new Error('Fallo al subir documento');
    }

    toast('✓ Documento subido');
    cerrarSubir();
    cargarDocumentos(proyectoActualId);
  } catch (error) {
    console.error(error);
    toast('Error al subir', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Subir';
    }
  }
}

async function eliminarDocumento(documentoId) {
  const confirmar = confirm('¿Eliminar este documento?');

  if (!confirmar) return;

  try {
    await fetch(`${API}/documentos/${documentoId}`, {
      method: 'DELETE',
    });

    toast('Documento eliminado');
    cargarDocumentos(proyectoActualId);
  } catch (error) {
    console.error(error);
    toast('Error al eliminar documento', 'red');
  }
}

async function cargarDocumentos(proyectoId) {
  const container = document.getElementById('docs-container');
  if (!container) return;

  try {
    const response = await fetch(`${API}/proyectos/${proyectoId}/documentos`);
    const documentos = await response.json();

    if (!Array.isArray(documentos) || !documentos.length) {
      container.innerHTML = `
        <div class="student-empty-docs">
          <div class="student-empty-docs-icon">DOC</div>
          <div>
            <strong>Aun no has subido documentos</strong>
            <span>Agrega un archivo, imagen o documento de texto para que el evaluador tenga contexto.</span>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = documentos
      .map(
        (documento) => `
          <div class="student-doc-card">
            <div class="student-doc-icon ${documento.Tipo === 'texto' ? 'is-text' : 'is-file'}">
              ${documento.Tipo === 'texto' ? 'TXT' : 'FILE'}
            </div>

            <div class="student-doc-main">
              <div class="student-doc-title">
                ${escapeHtml(documento.Titulo || documento.NombreArchivo || 'Documento')}
              </div>

              <div class="student-doc-meta">
                ${documento.Tipo === 'texto' ? 'Documento de texto' : formatBytesDoc(documento.TamanoBytes)}
                · ${documento.CreatedAt ? formatFecha(documento.CreatedAt) : '—'}
              </div>
            </div>

            <div class="student-doc-actions">
              <a href="${API}/documentos/${documento.DocumentoID}/ver" target="_blank" class="btn btn-ghost btn-sm">Ver</a>
              <a href="${API}/documentos/${documento.DocumentoID}/descargar" class="btn btn-ghost btn-sm">Descargar</a>
              <button class="btn btn-danger btn-sm" onclick="eliminarDocumento(${documento.DocumentoID})">Eliminar</button>
            </div>
          </div>
        `,
      )
      .join('');
  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div style="color:var(--red);font-size:13px">
        Error al cargar documentos.
      </div>
    `;
  }
}

function abrirDocTextoAlumno() {
  if (!proyectoActualId) {
    toast('No hay proyecto activo', 'red');
    return;
  }

  const titulo = document.getElementById('alum-doc-titulo');
  const contenido = document.getElementById('alum-doc-contenido');
  const modal = document.getElementById('modal-doc-texto-alumno');

  if (titulo) titulo.value = '';
  if (contenido) contenido.value = '';
  if (modal) modal.classList.add('open');
}

function cerrarDocTextoAlumno() {
  const modal = document.getElementById('modal-doc-texto-alumno');
  if (modal) modal.classList.remove('open');
}

async function guardarDocTextoAlumno() {
  const titulo = document.getElementById('alum-doc-titulo')?.value.trim();
  const contenido = document.getElementById('alum-doc-contenido')?.value.trim();

  if (!titulo) return toast('Escribe un título', 'red');
  if (!contenido) return toast('El documento no puede estar vacío', 'red');

  const btn = document.getElementById('btn-guardar-doc-alumno');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const response = await fetch(`${API}/proyectos/${proyectoActualId}/documentos/texto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Titulo: titulo,
        Contenido: contenido,
        SubidoPorID: user.id,
      }),
    });

    if (!response.ok) {
      throw new Error('Fallo al crear documento');
    }

    toast('✓ Documento creado');
    cerrarDocTextoAlumno();
    cargarDocumentos(proyectoActualId);
  } catch (error) {
    console.error(error);
    toast('Error al crear el documento', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  }
}

// ── PARTICIPANTES / ASESORES ─────────────────────────────────────────────────

async function precargarUsuarios() {
  try {
    const response = await fetch(`${API}/usuarios`);
    const data = await response.json();

    if (!Array.isArray(data)) return;

    todosAlumnos = data.filter(
      (u) => u.Rol === 'Alumno' && u.Activo && u.UsuarioID !== user.id,
    );

    todosProfesores = data.filter(
      (u) => u.Rol === 'Profesor' && u.Activo,
    );
  } catch (error) {
    console.error(error);
  }
}

function buscarAlumnos(query) {
  const container = document.getElementById('resultados-participante');
  if (!container) return;

  if (!query.trim()) {
    container.innerHTML = '';
    return;
  }

  const q = query.toLowerCase();

  const results = todosAlumnos.filter(
    (u) =>
      u.Nombre.toLowerCase().includes(q) ||
      u.Email.toLowerCase().includes(q),
  );

  if (!results.length) {
    container.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);padding:8px">
        Sin resultados
      </div>
    `;
    return;
  }

  container.innerHTML = results
    .map(
      (u) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;cursor:pointer" onclick="agregarParticipante(${u.UsuarioID}, '${escapeForJS(u.Nombre)}')">
          <div class="participante-avatar">
            ${u.Nombre[0].toUpperCase()}
          </div>

          <div>
            <div style="font-size:13px;font-weight:500">${u.Nombre}</div>
            <div style="font-size:11px;color:var(--text-muted)">${u.Email}</div>
          </div>
        </div>
      `,
    )
    .join('');
}

function buscarProfesores(query) {
  const container = document.getElementById('resultados-asesor');
  if (!container) return;

  if (!query.trim()) {
    container.innerHTML = '';
    return;
  }

  const q = query.toLowerCase();

  const results = todosProfesores.filter(
    (u) =>
      u.Nombre.toLowerCase().includes(q) ||
      u.Email.toLowerCase().includes(q),
  );

  if (!results.length) {
    container.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);padding:8px">
        Sin resultados
      </div>
    `;
    return;
  }

  container.innerHTML = results
    .map(
      (u) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;cursor:pointer" onclick="agregarAsesor(${u.UsuarioID}, '${escapeForJS(u.Nombre)}')">
          <div class="participante-avatar" style="background:var(--green)">
            ${u.Nombre[0].toUpperCase()}
          </div>

          <div>
            <div style="font-size:13px;font-weight:500">${u.Nombre}</div>
            <div style="font-size:11px;color:var(--text-muted)">${u.Email}</div>
          </div>
        </div>
      `,
    )
    .join('');
}

function agregarParticipante(id, nombre) {
  if (inscripcion.participantes.find((participante) => participante.id === id)) {
    toast('Ya está en la lista', 'orange');
    return;
  }

  inscripcion.participantes.push({ id, nombre });

  renderListaParticipantes();

  closeModal('modal-agregar-participante');

  const input = document.getElementById('buscar-participante');
  const resultados = document.getElementById('resultados-participante');

  if (input) input.value = '';
  if (resultados) resultados.innerHTML = '';

  toast(`${nombre} agregado`);
}

function agregarAsesor(id, nombre) {
  if (inscripcion.asesores.find((asesor) => asesor.id === id)) {
    toast('Ya está en la lista', 'orange');
    return;
  }

  inscripcion.asesores.push({ id, nombre });

  renderListaAsesores();

  closeModal('modal-agregar-asesor');

  const input = document.getElementById('buscar-asesor');
  const resultados = document.getElementById('resultados-asesor');

  if (input) input.value = '';
  if (resultados) resultados.innerHTML = '';

  toast(`${nombre} agregado`);
}

function renderListaParticipantes() {
  const lista = document.getElementById('lista-participantes');
  if (!lista) return;

  lista.innerHTML =
    `
      <div class="participante-item">
        <div class="participante-avatar">${user.nombre[0].toUpperCase()}</div>

        <div class="participante-info">
          <div class="participante-nombre">${user.nombre}</div>
          <div class="participante-rol">Líder</div>
        </div>

        <span class="badge badge-green">Tú</span>
      </div>
    ` +
    inscripcion.participantes
      .map(
        (participante, index) => `
          <div class="participante-item">
            <div class="participante-avatar">
              ${participante.nombre[0].toUpperCase()}
            </div>

            <div class="participante-info">
              <div class="participante-nombre">${participante.nombre}</div>
              <div class="participante-rol">Participante</div>
            </div>

            <button class="participante-remove" onclick="quitarParticipante(${index})">
              ✕
            </button>
          </div>
        `,
      )
      .join('');
}

function renderListaAsesores() {
  const lista = document.getElementById('lista-asesores');
  if (!lista) return;

  if (!inscripcion.asesores.length) {
    lista.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted)">
        Sin asesores.
      </div>
    `;
    return;
  }

  lista.innerHTML = inscripcion.asesores
    .map(
      (asesor, index) => `
        <div class="participante-item">
          <div class="participante-avatar" style="background:var(--green)">
            ${asesor.nombre[0].toUpperCase()}
          </div>

          <div class="participante-info">
            <div class="participante-nombre">${asesor.nombre}</div>
            <div class="participante-rol">Asesor</div>
          </div>

          <button class="participante-remove" onclick="quitarAsesor(${index})">
            ✕
          </button>
        </div>
      `,
    )
    .join('');
}

function quitarParticipante(index) {
  inscripcion.participantes.splice(index, 1);
  renderListaParticipantes();
}

function quitarAsesor(index) {
  inscripcion.asesores.splice(index, 1);
  renderListaAsesores();
}

// ── UPLOAD ZONE ──────────────────────────────────────────────────────────────

function initUploadZone() {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');

  if (!zone || !input) return;

  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });

  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('dragover');

    if (event.dataTransfer.files[0]) {
      handleFile(event.dataTransfer.files[0]);
    }
  });

  input.addEventListener('change', () => {
    if (input.files[0]) {
      handleFile(input.files[0]);
    }
  });
}

function handleFile(file) {
  if (file.type !== 'application/pdf') {
    toast('Solo se permiten PDF', 'red');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    toast('Máximo 10 MB', 'red');
    return;
  }

  inscripcion.archivo = file;

  const display = document.getElementById('file-name-display');

  if (display) {
    display.textContent = `📎 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    display.style.display = 'block';
  }

  toast(`PDF cargado: ${file.name}`);
}

// ── UTILS ────────────────────────────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };

    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));

    reader.readAsDataURL(file);
  });
}

function formatFecha(fecha) {
  if (!fecha) return '—';

  try {
    const clean = String(fecha).split('T')[0];
    const [year, month, day] = clean.split('-').map(Number);

    if (!year || !month || !day) return '—';

    return new Date(year, month - 1, day).toLocaleDateString('es-MX');
  } catch (error) {
    return '—';
  }
}

function formatFechaLarga(fecha) {
  if (!fecha) return '—';

  try {
    const clean = String(fecha).split('T')[0];
    const [year, month, day] = clean.split('-').map(Number);

    if (!year || !month || !day) return '—';

    return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    return '—';
  }
}

function formatFechaHora(fecha) {
  if (!fecha) return '—';

  try {
    return new Date(fecha).toLocaleString('es-MX');
  } catch (error) {
    return '—';
  }
}

function escapeForJS(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, ' ');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function capitalize(value) {
  const text = String(value || '');
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}
