const API = 'http://localhost:3000/api';

let user = null;
let misProyectosData = [];
let proyectoDocActualId = null;
let evalProyectoId = null;
let evalRubrica = null;
let ofrecerProyectoId = null;
let disponiblesData = [];
let qrEvalData = null;
let qrScanAnimId = null;
let qrStream = null;

document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('user');

  if (!raw) {
    window.location.href = 'login.html';
    return;
  }

  user = JSON.parse(raw);

  if (user.rol !== 'Profesor') {
    window.location.href = 'login.html';
    return;
  }

  const navNombre = document.getElementById('nav-nombre');
  const navAvatar = document.getElementById('nav-avatar');

  if (navNombre) navNombre.textContent = user.nombre || 'Profesor';
  if (navAvatar) navAvatar.textContent = (user.nombre || 'P')[0].toUpperCase();

  loadMisProyectos();
});

function logout() {
  sessionStorage.removeItem('user');
  window.location.href = 'login.html';
}

function showSection(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById('section-' + id);
  if (section) section.classList.add('active');
  if (el) el.classList.add('active');

  const titulos = {
    'mis-proyectos': ['Mis proyectos', 'Proyectos asignados a ti'],
    'proyectos-disponibles': ['Proyectos disponibles', 'Ofrece tu disponibilidad para evaluar'],
    'mis-citas': ['Mis citas', 'Citas de evaluación confirmadas'],
    'escanear': ['Escanear QR / Evaluar', 'Escanea el QR del alumno y evalúa'],
    'historial': ['Historial de evaluaciones', 'Desempeño histórico de tus proyectos'],
    'indicadores': ['Indicadores de calidad', 'Métricas y desempeño por proyecto'],
  };

  const [titulo, subtitulo] = titulos[id] || [id, ''];

  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  if (pageTitle) pageTitle.textContent = titulo;
  if (pageSubtitle) pageSubtitle.textContent = subtitulo;

  if (id === 'mis-proyectos') loadMisProyectos();
  if (id === 'proyectos-disponibles') loadProyectosDisponibles();
  if (id === 'mis-citas') loadMisCitas();
  if (id === 'historial') iniciarHistorial();
  if (id === 'indicadores') iniciarIndicadores();
  if (id !== 'escanear') detenerCamara();
}

// ══════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════

function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeDate(value, options = {}) {
  if (!value) return '—';

  const str = String(value);
  const dateOnly = str.includes('T') ? str.split('T')[0] : str.split(' ')[0];

  if (!dateOnly || dateOnly === '0000-00-00') return '—';

  const date = new Date(dateOnly + 'T12:00:00');

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('es-MX', options);
}

function safeDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('es-MX');
}

function safeTime(value) {
  if (!value) return '—';
  return String(value).substring(0, 5);
}

function getProgressText(p) {
  const total = Number(p.TotalEtapas || 0);
  const completadas = Number(p.EtapasCompletadas || 0);

  if (total <= 0) {
    return 'Sin etapas definidas';
  }

  const pct = Number(p.Progreso || 0);
  return `${pct}% · ${completadas}/${total} etapas`;
}

function getProgressValue(p) {
  const total = Number(p.TotalEtapas || 0);

  if (total <= 0) return 0;

  return Number(p.Progreso || 0);
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function toast(msg, type = 'green') {
  const t = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const dotEl = document.getElementById('toast-dot');

  if (!t || !msgEl || !dotEl) {
    alert(msg);
    return;
  }

  msgEl.textContent = msg;
  dotEl.className = `toast-dot ${type}`;
  t.classList.add('show');

  setTimeout(() => {
    t.classList.remove('show');
  }, 3500);
}

// ══════════════════════════════════════════
// MIS PROYECTOS
// ══════════════════════════════════════════

async function loadMisProyectos() {
  const grid = document.getElementById('proyectos-grid-prof');

  if (!grid) return;

  grid.innerHTML = '<div class="pm-loading">Cargando proyectos...</div>';

  try {
    const res = await fetch(`${API}/proyectos/por-profesor/${user.id}`);
    const data = await res.json();

    const proyectos = Array.isArray(data) ? data : [];

    misProyectosData = proyectos;
    renderStats(proyectos);

    if (!proyectos.length) {
      grid.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          <p>No tienes proyectos asignados aún</p>
        </div>`;
      return;
    }

    const colores = {
      'Pendiente': 'badge-orange',
      'En progreso': 'badge-blue',
      'Completado': 'badge-green',
    };

    const aprobInfo = {
      aceptado: { cls: 'badge-green', txt: 'Aceptado' },
      rechazado: { cls: 'badge-red', txt: 'Rechazado' },
      pendiente: { cls: 'badge-orange', txt: 'Por revisar' },
      aprobado_admin: { cls: 'badge-green', txt: 'Aprobado admin' },
      rechazado_admin: { cls: 'badge-red', txt: 'Rechazado admin' },
    };

    grid.innerHTML = `
      <div class="teacher-card-grid">
        ${proyectos.map(p => {
          const pct = getProgressValue(p);
          const barFill = pct === 100 ? 'var(--green)' : pct > 0 ? 'var(--blue)' : 'var(--border)';
          const estadoAprobacion = p.EstadoAprobacion || p.EstadoAdmin || 'pendiente';
          const aprob = aprobInfo[estadoAprobacion] || aprobInfo.pendiente;
          const initials = String(p.Titulo || 'PM').trim().slice(0, 2).toUpperCase();
          const desc = p.Descripcion
            ? `${escapeHTML(p.Descripcion.substring(0, 160))}${p.Descripcion.length > 160 ? '...' : ''}`
            : 'Sin descripcion registrada.';

          return `
            <article class="teacher-project-card" onclick="verDetalle(${p.ProyectoID})">
              <div class="teacher-project-head">
                <div class="teacher-project-avatar">${escapeHTML(initials)}</div>
                <div class="teacher-project-title-block">
                  <div class="teacher-project-title">${escapeHTML(p.Titulo || 'Proyecto sin titulo')}</div>
                  <div class="teacher-project-subtitle">${escapeHTML(p.NombreAlumno || 'Sin alumno')}</div>
                </div>
                <span class="badge ${colores[p.Estatus] || 'badge-gray'}">${escapeHTML(p.Estatus || 'Pendiente')}</span>
              </div>

              <div class="teacher-project-badges">
                <span class="badge ${aprob.cls}">${aprob.txt}</span>
                ${p.Categoria ? `<span class="badge badge-blue">${escapeHTML(p.Categoria)}</span>` : ''}
              </div>

              <p class="teacher-project-desc">${desc}</p>

              <div class="teacher-progress">
                <div class="teacher-progress-top">
                  <span>Progreso del proyecto</span>
                  <strong>${getProgressText(p)}</strong>
                </div>
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width:${pct}%;background:${barFill}"></div>
                </div>
              </div>

              <div class="teacher-project-meta">
                <div>
                  <span>Inicio</span>
                  <strong>${safeDate(p.FechaInicio)}</strong>
                </div>
                <div>
                  <span>Entrega</span>
                  <strong>${p.FechaFin ? safeDate(p.FechaFin) : 'Sin fecha'}</strong>
                </div>
                <div>
                  <span>Avance</span>
                  <strong>${pct}%</strong>
                </div>
              </div>

              <div class="teacher-project-actions">
                <button class="btn btn-primary btn-sm"
                  onclick="event.stopPropagation();revisarProyecto(${p.ProyectoID})">
                  Revisar
                </button>

                <button class="btn btn-ghost btn-sm"
                  onclick="event.stopPropagation();evaluarProyecto(${p.ProyectoID})"
                  title="Evaluar con rubrica">
                  Evaluar
                </button>

                <button class="btn btn-ghost btn-sm"
                  title="Crear documento de texto"
                  onclick="event.stopPropagation();abrirCrearDocumento(${p.ProyectoID})">
                  Documento
                </button>
              </div>
            </article>`;
        }).join('')}
      </div>`;
  } catch (e) {
    console.error(e);
    grid.innerHTML = '<div class="pm-error">Error al cargar proyectos</div>';
  }
}

function renderStats(proyectos) {
  const stats = document.getElementById('prof-stats');

  if (!stats) return;

  const total = proyectos.length;
  const comp = proyectos.filter(p => p.Estatus === 'Completado').length;
  const prog = proyectos.filter(p => p.Estatus === 'En progreso').length;
  const pend = proyectos.filter(p => p.Estatus === 'Pendiente' || !p.Estatus).length;

  stats.innerHTML = [
    ['Proyectos', 'Asignados', total, 'var(--blue)'],
    ['En progreso', 'Activos', prog, 'var(--blue)'],
    ['Pendientes', 'Sin iniciar', pend, 'var(--orange)'],
    ['Completados', 'Finalizados', comp, 'var(--green)'],
  ].map(([lbl, sub, val, color]) => `
    <div class="stat-card" style="--card-color:${color}">
      <div class="stat-label">${lbl}</div>
      <div class="stat-value">${val}</div>
      <div class="stat-sub">${sub}</div>
    </div>`).join('');
}

async function verDetalle(proyectoId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  const detalle = document.getElementById('section-detalle');
  if (detalle) detalle.classList.add('active');

  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  if (pageTitle) pageTitle.textContent = 'Detalle del proyecto';
  if (pageSubtitle) pageSubtitle.textContent = 'Etapas y progreso del alumno';

  try {
    const res = await fetch(`${API}/proyectos/${proyectoId}`);
    const p = await res.json();

    const colores = {
      'Pendiente': 'badge-orange',
      'En progreso': 'badge-blue',
      'Completado': 'badge-green',
    };

    const detTitulo = document.getElementById('det-titulo');
    const detAlumno = document.getElementById('det-alumno');
    const badge = document.getElementById('det-badge');
    const pctEl = document.getElementById('det-progreso-pct');
    const bar = document.getElementById('det-progreso-bar');
    const meta = document.getElementById('det-meta');

    if (detTitulo) detTitulo.textContent = p.Titulo || 'Proyecto sin título';
    if (detAlumno) detAlumno.textContent = `Alumno: ${p.NombreAlumno || '—'}`;

    if (badge) {
      badge.textContent = p.Estatus || 'Pendiente';
      badge.className = `badge ${colores[p.Estatus] || 'badge-gray'}`;
    }

    const pct = getProgressValue(p);

    if (pctEl) pctEl.textContent = getProgressText(p);

    if (bar) {
      bar.style.width = `${pct}%`;
      bar.style.background = pct === 100 ? 'var(--green)' : pct > 0 ? 'var(--blue)' : 'var(--border)';
    }

    if (meta) {
      meta.innerHTML = [
        ['Alumno', p.NombreAlumno || '—'],
        ['Fecha inicio', safeDate(p.FechaInicio)],
        ['Fecha fin', p.FechaFin ? safeDate(p.FechaFin) : 'Sin definir'],
        ['Progreso', getProgressText(p)],
      ].map(([lbl, val]) => `
        <div class="meta-card">
          <div class="meta-label">${escapeHTML(lbl)}</div>
          <div class="meta-value">${escapeHTML(val)}</div>
        </div>`).join('');
    }

    await loadDetEtapas(proyectoId);
  } catch (e) {
    console.error(e);
    toast('Error al cargar proyecto', 'red');
  }
}

async function loadDetEtapas(proyectoId) {
  const container = document.getElementById('det-etapas');

  if (!container) return;

  try {
    const res = await fetch(`${API}/proyectos/${proyectoId}/etapas`);
    const etapas = await res.json();

    if (!Array.isArray(etapas) || !etapas.length) {
      container.innerHTML = '<div class="pm-loading">Este proyecto no tiene etapas definidas.</div>';
      return;
    }

    container.innerHTML = etapas.map(e => `
      <div class="etapa-item ${e.Completada ? 'done' : ''}">
        <div style="width:20px;height:20px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;${e.Completada ? 'background:var(--green);border-color:var(--green)' : ''}">
          ${e.Completada ? '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><polyline points="20,6 9,17 4,12"/></svg>' : ''}
        </div>

        <div class="etapa-content">
          <div style="font-size:14px;font-weight:500;color:${e.Completada ? 'var(--text-muted)' : 'var(--text)'};text-decoration:${e.Completada ? 'line-through' : 'none'}">
            ${escapeHTML(e.Nombre || 'Etapa')}
          </div>

          ${e.Descripcion ? `
            <div class="etapa-desc">
              ${escapeHTML(e.Descripcion)}
            </div>` : ''}

          ${e.FechaFin ? `
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">
              Fecha limite: ${safeDate(e.FechaFin)}
            </div>` : ''}
        </div>

        <span class="badge ${e.Completada ? 'badge-green' : 'badge-gray'}">
          ${e.Completada ? 'Completada' : 'Pendiente'}
        </span>
      </div>`).join('');
  } catch (e) {
    console.error(e);
    container.innerHTML = '<div class="pm-error">Error al cargar etapas</div>';
  }
}

// ══════════════════════════════════════════
// PROYECTOS DISPONIBLES
// ══════════════════════════════════════════

async function loadProyectosDisponibles() {
  const grid = document.getElementById('disponibles-grid');

  if (!grid) return;

  grid.innerHTML = '<div class="pm-loading">Cargando proyectos...</div>';

  try {
    const res = await fetch(`${API}/proyectos/disponibles/profesores`);
    const data = await res.json();

    disponiblesData = Array.isArray(data) ? data : [];

    renderProyectosDisponibles(disponiblesData);
  } catch (e) {
    console.error(e);
    grid.innerHTML = '<div class="pm-error">Error al cargar proyectos</div>';
  }
}

function filtrarProyectosDisponibles() {
  const q = (document.getElementById('filter-disponibles')?.value || '').toLowerCase();

  const filtrados = disponiblesData.filter(p =>
    (p.Titulo || '').toLowerCase().includes(q) ||
    (p.Categoria || '').toLowerCase().includes(q) ||
    (p.NombreAlumno || '').toLowerCase().includes(q)
  );

  renderProyectosDisponibles(filtrados);
}

function renderProyectosDisponibles(proyectos) {
  const grid = document.getElementById('disponibles-grid');

  if (!grid) return;

  if (!proyectos.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          <path d="M9 12l2 2 4-4"></path>
        </svg>
        <div>No hay proyectos que coincidan</div>
      </div>`;
    return;
  }

  grid.innerHTML = `<div class="available-project-list">${proyectos.map(p => {
    const initials = String(p.Titulo || 'PM').trim().slice(0, 2).toUpperCase();
    const desc = p.Descripcion
      ? `${escapeHTML(p.Descripcion.substring(0, 180))}${p.Descripcion.length > 180 ? '...' : ''}`
      : 'Sin descripcion registrada.';

    return `
      <article class="available-project-card">
        <div class="available-project-avatar">${escapeHTML(initials)}</div>
        <div class="available-project-main">
          <div class="available-project-head">
            <div>
              <div class="available-project-title">${escapeHTML(p.Titulo || 'Proyecto sin titulo')}</div>
              <div class="available-project-owner">${escapeHTML(p.NombreAlumno || 'Sin alumno')}</div>
            </div>
            <span class="badge badge-orange">Sin evaluador</span>
          </div>

          <div class="available-project-meta">
            ${p.Categoria ? `<span>${escapeHTML(p.Categoria)}</span>` : ''}
            <span>Inicio: ${safeDate(p.FechaInicio)}</span>
          </div>

          <p class="available-project-desc">${desc}</p>
        </div>

        <div class="available-project-action">
          <button class="btn btn-primary btn-sm"
            onclick="abrirOfrecerDisponibilidad(${p.ProyectoID}, ${JSON.stringify(p.Titulo || 'Proyecto')})">
            Ofrecer disponibilidad
          </button>
        </div>
      </article>`;
  }).join('')}</div>`;
}

function abrirOfrecerDisponibilidad(proyectoId, titulo) {
  ofrecerProyectoId = proyectoId;

  const info = document.getElementById('ofrecer-proy-info');
  const fecha = document.getElementById('ofrecer-fecha');
  const horaInicio = document.getElementById('ofrecer-hora-inicio');
  const horaFin = document.getElementById('ofrecer-hora-fin');
  const sala = document.getElementById('ofrecer-sala');
  const modal = document.getElementById('modal-ofrecer');

  if (info) info.textContent = `Proyecto: ${titulo}`;
  if (fecha) fecha.value = '';
  if (horaInicio) horaInicio.value = '';
  if (horaFin) horaFin.value = '';
  if (sala) sala.value = '';
  if (modal) modal.classList.add('open');
}

function cerrarOfrecerDisp() {
  const modal = document.getElementById('modal-ofrecer');

  if (modal) modal.classList.remove('open');

  ofrecerProyectoId = null;
}

async function ofrecerDisponibilidad() {
  const fecha = document.getElementById('ofrecer-fecha')?.value || '';
  const horaInicio = document.getElementById('ofrecer-hora-inicio')?.value || '';
  const horaFin = document.getElementById('ofrecer-hora-fin')?.value || '';
  const sala = (document.getElementById('ofrecer-sala')?.value || '').trim();

  if (!ofrecerProyectoId) return toast('No hay proyecto seleccionado', 'red');
  if (!fecha) return toast('Selecciona una fecha', 'red');
  if (!horaInicio) return toast('Indica la hora de inicio', 'red');
  if (!horaFin) return toast('Indica la hora de fin', 'red');
  if (horaFin <= horaInicio) return toast('La hora de fin debe ser posterior a la de inicio', 'red');

  const btn = document.getElementById('btn-confirmar-disp');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const res = await fetch(`${API}/disponibilidad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ProfesorID: user.id,
        ProyectoID: ofrecerProyectoId,
        Fecha: fecha,
        HoraInicio: horaInicio,
        HoraFin: horaFin,
        Sala: sala || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Error al guardar');
    }

    toast('✓ Disponibilidad registrada');
    cerrarOfrecerDisp();
  } catch (e) {
    console.error(e);
    toast(e.message || 'Error al guardar disponibilidad', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Confirmar disponibilidad';
    }
  }
}

// ══════════════════════════════════════════
// MIS CITAS
// ══════════════════════════════════════════

async function loadMisCitas() {
  const list = document.getElementById('citas-list');

  if (!list) return;

  list.innerHTML = '<div class="pm-loading">Cargando citas...</div>';

  try {
    const res = await fetch(`${API}/disponibilidad/profesor/${user.id}`);
    const data = await res.json();

    const citas = Array.isArray(data) ? data : [];

    if (!citas.length) {
      list.innerHTML = `
        <div class="empty-state appointment-empty">
          <div class="empty-state-title">Sin citas registradas</div>
          <div class="empty-state-copy">Cuando un alumno elija tu disponibilidad, la cita aparecera aqui con fecha, hora, sala y estado.</div>
        </div>`;
      return;
    }

    const estadoStyle = {
      reservada: { cls: 'badge-green', lbl: 'Confirmada' },
      disponible: { cls: 'badge-orange', lbl: 'Disponible' },
      cancelada: { cls: 'badge-gray', lbl: 'Cancelada' },
      aprobada: { cls: 'badge-green', lbl: 'Aprobada' },
      pendiente_admin: { cls: 'badge-orange', lbl: 'Pendiente admin' },
      rechazada: { cls: 'badge-red', lbl: 'Rechazada' },
    };

    list.innerHTML = citas.map(c => {
      const est = estadoStyle[c.Estado] || { cls: 'badge-gray', lbl: c.Estado || 'Sin estado' };

      return `
        <article class="appointment-row appointment-card-pro">
          <div class="appointment-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>

          <div class="appointment-main">
            <div class="appointment-head">
              <div>
                <div class="appointment-title">
                  ${escapeHTML(c.TituloProyecto || c.Titulo || 'Proyecto')}
                </div>
                <div class="appointment-meta">
                  Alumno: ${escapeHTML(c.NombreAlumno || 'Sin alumno')}
                </div>
              </div>
              <span class="badge ${est.cls} appointment-badge">${escapeHTML(est.lbl)}</span>
            </div>

            <div class="appointment-grid">
              <div>
                <span>Fecha</span>
                <strong>${safeDate(c.Fecha, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
              </div>
              <div>
                <span>Horario</span>
                <strong>${safeTime(c.HoraInicio)} - ${safeTime(c.HoraFin)}</strong>
              </div>
              <div>
                <span>Sala</span>
                <strong>${escapeHTML(c.Sala || 'Sin sala')}</strong>
              </div>
            </div>

            ${c.QRToken ? `
              <div class="appointment-token">
                QR: <code>${escapeHTML(c.QRToken)}</code>
              </div>` : ''}
          </div>

        </article>`;
    }).join('');
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div class="pm-error">Error al cargar citas</div>';
  }
}

// ══════════════════════════════════════════
// ESCANEAR QR / EVALUAR
// ══════════════════════════════════════════

async function iniciarCamara() {
  const wrap = document.getElementById('qr-cam-wrap');
  const start = document.getElementById('qr-start-wrap');
  const video = document.getElementById('qr-video');
  const status = document.getElementById('qr-scan-status');
  const btnDet = document.getElementById('btn-detener-cam');

  if (!video) {
    toast('No existe el elemento de video para escanear', 'red');
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Tu navegador no permite usar cámara aquí. Usa el campo manual.', 'red');
    return;
  }

  try {
    qrStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });

    video.srcObject = qrStream;

    await video.play();

    if (wrap) wrap.style.display = 'block';
    if (start) start.style.display = 'none';
    if (btnDet) btnDet.style.display = 'block';
    if (status) status.textContent = 'Apunta la cámara al código QR del alumno...';

    escanearFrame();
  } catch (e) {
    console.error(e);
    toast('No se pudo acceder a la cámara. Usa el campo manual.', 'red');
  }
}

function detenerCamara() {
  if (qrScanAnimId) {
    cancelAnimationFrame(qrScanAnimId);
    qrScanAnimId = null;
  }

  if (qrStream) {
    qrStream.getTracks().forEach(t => t.stop());
    qrStream = null;
  }

  const wrap = document.getElementById('qr-cam-wrap');
  const start = document.getElementById('qr-start-wrap');
  const btnDet = document.getElementById('btn-detener-cam');

  if (wrap) wrap.style.display = 'none';
  if (start) start.style.display = 'block';
  if (btnDet) btnDet.style.display = 'none';
}

function escanearFrame() {
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');

  if (!video || !canvas || !qrStream) return;

  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const code = window.jsQR && window.jsQR(img.data, img.width, img.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code?.data) {
      detenerCamara();

      const status = document.getElementById('qr-scan-status');
      if (status) status.textContent = '✓ QR detectado';

      procesarToken(code.data.trim());
      return;
    }
  }

  qrScanAnimId = requestAnimationFrame(escanearFrame);
}

function procesarTokenManual() {
  const token = normalizarTokenQR(document.getElementById('qr-token-manual')?.value || '');

  if (!token) {
    toast('Introduce el token del QR', 'red');
    return;
  }

  procesarToken(token);
}

function normalizarTokenQR(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    return (parsed.searchParams.get('token') || raw).trim();
  } catch (_) {
    const match = raw.match(/[?&]token=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : raw;
  }
}

async function procesarToken(token) {
  token = normalizarTokenQR(token);

  const resultado = document.getElementById('qr-resultado');
  const proyCard = document.getElementById('qr-proy-card');
  const rubricaWrap = document.getElementById('qr-rubrica-wrap');

  if (resultado) resultado.style.display = 'block';
  if (rubricaWrap) rubricaWrap.style.display = 'none';

  if (proyCard) {
    proyCard.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Cargando datos del proyecto...</div>';
  }

  qrEvalData = null;

  try {
    const res = await fetch(`${API}/qr/${encodeURIComponent(token)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Token inválido o proyecto no aceptado');
    }

    qrEvalData = data;

    sessionStorage.setItem('qr_eval_token', token);
    sessionStorage.setItem('qr_eval_preview', JSON.stringify(data));

    detenerCamara();
    window.location.href = `evaluar-qr.html?token=${encodeURIComponent(token)}`;
    return;

    const proyecto = data.proyecto || {};
    const rubrica = data.rubrica || null;
    const horario = data.horario || data.cita || {};

    if (proyCard) {
      proyCard.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:16px">
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:18px;color:var(--text)">
            ${escapeHTML(proyecto.Titulo || 'Proyecto sin título')}
          </div>
          <span class="badge badge-green">Cita aprobada</span>
        </div>

        ${proyecto.Categoria ? `
          <div style="margin-bottom:10px">
            <span class="badge badge-blue">${escapeHTML(proyecto.Categoria)}</span>
          </div>` : ''}

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:14px">
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Alumno</div>
            <div style="font-size:13px;font-weight:500">${escapeHTML(proyecto.NombreAlumno || '—')}</div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Fecha</div>
            <div style="font-size:13px;font-weight:500">${safeDate(horario.Fecha || proyecto.FechaCita)}</div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Hora</div>
            <div style="font-size:13px;font-weight:500">
              ${safeTime(horario.HoraInicio)} – ${safeTime(horario.HoraFin)}
            </div>
          </div>

          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px">Sala</div>
            <div style="font-size:13px;font-weight:500">
              ${escapeHTML(horario.Sala || horario.NombreAula || horario.Lugar || '—')}
            </div>
          </div>
        </div>

        ${proyecto.Descripcion ? `
          <div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:4px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px">
            ${escapeHTML(proyecto.Descripcion)}
          </div>` : `
          <div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-bottom:4px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px">
            Sin descripción registrada.
          </div>`}`;
    }

    if (!rubrica || !Array.isArray(rubrica.criterios) || !rubrica.criterios.length) {
      if (rubricaWrap) rubricaWrap.style.display = 'block';

      const criterios = document.getElementById('qr-rubrica-criterios');
      const btn = document.getElementById('btn-submit-qr-eval');

      if (criterios) {
        criterios.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px;text-align:center">Este proyecto no tiene rúbrica asignada aún.</div>';
      }

      if (btn) btn.style.display = 'none';

      return;
    }

    const titulo = document.getElementById('qr-rubrica-titulo');
    const puntajeDisplay = document.getElementById('qr-puntaje-display');
    const criteriosWrap = document.getElementById('qr-rubrica-criterios');
    const btn = document.getElementById('btn-submit-qr-eval');

    if (titulo) titulo.textContent = `Rúbrica: ${rubrica.Nombre || 'Rúbrica'}`;

    const puntajeMax = rubrica.criterios.reduce((s, c) => s + Number(c.PuntosMax || 0), 0);

    if (puntajeDisplay) puntajeDisplay.textContent = `0 / ${puntajeMax}`;

    if (criteriosWrap) {
      criteriosWrap.innerHTML = rubrica.criterios.map(c => `
        <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:14px">
          <div style="padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border)">
            <div style="font-size:14px;font-weight:600;color:var(--text)">
              ${escapeHTML(c.Nombre || 'Criterio')}
            </div>

            ${c.Descripcion ? `
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">
                ${escapeHTML(c.Descripcion)}
              </div>` : ''}

            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
              Máximo: <strong>${Number(c.PuntosMax || 0)} pts</strong>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
            ${[...(c.niveles || [])].sort((a, b) => Number(b.Puntaje || 0) - Number(a.Puntaje || 0)).map(n => `
              <label style="display:flex;flex-direction:column;padding:12px 14px;border-right:1px solid var(--border);border-bottom:1px solid var(--border);cursor:pointer;gap:4px">
                <input
                  type="radio"
                  name="qr-crit-${c.CriterioID}"
                  value="${Number(n.Puntaje || 0)}"
                  data-criterio="${c.CriterioID}"
                  data-nivel="${n.NivelID}"
                  data-max="${Number(c.PuntosMax || 0)}"
                  onchange="calcularPuntajeQR()"
                  style="margin-bottom:4px"
                >

                <span style="font-size:12px;font-weight:600;color:var(--text)">
                  ${escapeHTML(n.Nombre || 'Nivel')}
                </span>

                <span style="font-size:11px;color:var(--text-muted);line-height:1.4">
                  ${escapeHTML(n.Descripcion || '')}
                </span>

                <span style="font-size:12px;font-weight:700;color:var(--blue)">
                  ${Number(n.Puntaje || 0)} pts
                </span>
              </label>`).join('')}
          </div>
        </div>`).join('');
    }

    if (btn) btn.style.display = 'block';
    if (rubricaWrap) rubricaWrap.style.display = 'block';
  } catch (e) {
    console.error(e);

    if (proyCard) {
      proyCard.innerHTML = `<div style="color:var(--red);font-size:13px;padding:16px">Error: ${escapeHTML(e.message)}</div>`;
    }
  }
}

function calcularPuntajeQR() {
  if (!qrEvalData?.rubrica?.criterios) return;

  const criterios = qrEvalData.rubrica.criterios;
  const maximo = criterios.reduce((s, c) => s + Number(c.PuntosMax || 0), 0);

  let total = 0;

  criterios.forEach(c => {
    const sel = document.querySelector(`input[name="qr-crit-${c.CriterioID}"]:checked`);
    if (sel) total += Number(sel.value || 0);
  });

  const pct = maximo > 0 ? Math.round((total / maximo) * 100) : 0;
  const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--blue)' : 'var(--orange)';

  const disp = document.getElementById('qr-puntaje-display');
  const pdisp = document.getElementById('qr-pct-display');

  if (disp) {
    disp.textContent = `${total} / ${maximo}`;
    disp.style.color = color;
  }

  if (pdisp) {
    pdisp.textContent = `${pct}%`;
    pdisp.style.color = color;
  }
}

async function submitEvaluacionQR() {
  if (!qrEvalData?.proyecto || !qrEvalData?.rubrica) return;

  const { proyecto, rubrica } = qrEvalData;
  const criterios = rubrica.criterios || [];
  const detalles = [];

  let todosSeleccionados = true;

  for (const c of criterios) {
    const sel = document.querySelector(`input[name="qr-crit-${c.CriterioID}"]:checked`);

    if (!sel) {
      todosSeleccionados = false;
      break;
    }

    detalles.push({
      CriterioID: c.CriterioID,
      NivelID: Number(sel.dataset.nivel),
      PuntajeObtenido: Number(sel.value),
      PuntajeMaximo: Number(c.PuntosMax || 0),
    });
  }

  if (!todosSeleccionados) {
    toast('Selecciona un nivel para cada criterio', 'red');
    return;
  }

  const observaciones = (document.getElementById('qr-eval-obs')?.value || '').trim();
  const btn = document.getElementById('btn-submit-qr-eval');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const res = await fetch(`${API}/proyectos/${proyecto.ProyectoID}/evaluacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ProfesorID: user.id,
        RubricaID: rubrica.RubricaID,
        Observaciones: observaciones,
        Comentarios: observaciones,
        detalles,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Error al guardar');
    }

    toast(`✓ Evaluación guardada — ${data.PuntajeTotal}/${data.PuntajeMaximo} (${data.Porcentaje}%)`);

    const rubricaWrap = document.getElementById('qr-rubrica-wrap');
    const resultado = document.getElementById('qr-resultado');
    const tokenInput = document.getElementById('qr-token-manual');

    if (rubricaWrap) rubricaWrap.style.display = 'none';
    if (resultado) resultado.style.display = 'none';
    if (tokenInput) tokenInput.value = '';

    qrEvalData = null;
  } catch (e) {
    console.error(e);
    toast(e.message || 'Error al guardar evaluación', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar evaluación';
    }
  }
}

// ══════════════════════════════════════════
// HISTORIAL
// ══════════════════════════════════════════

async function iniciarHistorial() {
  const sel = document.getElementById('hist-select-proyecto');
  const cont = document.getElementById('hist-content');

  if (!sel) return;

  if (cont) {
    cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Selecciona un proyecto para ver su historial de evaluaciones.</div>';
  }

  if (!misProyectosData.length) {
    const data = await fetch(`${API}/proyectos/por-profesor/${user.id}`).then(r => r.json()).catch(() => []);
    misProyectosData = Array.isArray(data) ? data : [];
  }

  sel.innerHTML = '<option value="">— Selecciona un proyecto —</option>' +
    misProyectosData.map(p => `
      <option value="${p.ProyectoID}">
        ${escapeHTML(p.Titulo || 'Proyecto')}${p.NombreAlumno ? ' — ' + escapeHTML(p.NombreAlumno) : ''}
      </option>`).join('');
}

async function loadHistorialProyecto() {
  const sel = document.getElementById('hist-select-proyecto');
  const cont = document.getElementById('hist-content');
  const id = sel?.value;

  if (!cont) return;

  if (!id) {
    cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Selecciona un proyecto.</div>';
    return;
  }

  cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Cargando historial...</div>';

  try {
    const data = await fetch(`${API}/proyectos/${id}/historial`).then(r => r.json());

    const evals = Array.isArray(data.evaluaciones) ? data.evaluaciones : [];
    const hist = Array.isArray(data.historial) ? data.historial : [];

    const todos = [...evals, ...hist].sort((a, b) => {
      const fa = new Date(a.Fecha || a.FechaRegistro || 0);
      const fb = new Date(b.Fecha || b.FechaRegistro || 0);

      return fb - fa;
    });

    if (!todos.length) {
      cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Este proyecto aún no tiene evaluaciones registradas.</div>';
      return;
    }

    cont.innerHTML = todos.map(r => {
      const fecha = r.Fecha || r.FechaRegistro;
      const puntaje = Number(r.PuntajeTotal ?? r.PuntajeObtenido ?? 0);
      const maximo = Number(r.PuntajeMaximo || 100);
      const pct = maximo > 0 ? Math.round((puntaje / maximo) * 100) : 0;
      const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--blue)' : 'var(--orange)';

      return `
        <div style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">
          <div style="width:52px;height:52px;border-radius:50%;border:3px solid ${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${color}18">
            <span style="font-size:13px;font-weight:700;color:${color}">${pct}%</span>
          </div>

          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600;color:var(--text)">
              ${escapeHTML(r.NombreEvento || r.NombreRubrica || 'Evaluación manual')}
            </div>

            <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
              Puntaje: <strong style="color:${color}">${puntaje}</strong> / ${maximo}
              ${fecha ? ' &nbsp;·&nbsp; ' + safeDateTime(fecha) : ''}
            </div>

            ${r.Observaciones ? `
              <div style="font-size:12px;color:var(--text-muted);margin-top:5px;font-style:italic;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 10px">
                "${escapeHTML(r.Observaciones)}"
              </div>` : ''}
          </div>

          <span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}44;flex-shrink:0">
            ${pct >= 80 ? 'Excelente' : pct >= 50 ? 'Regular' : 'Por mejorar'}
          </span>
        </div>`;
    }).join('');
  } catch (e) {
    console.error(e);
    cont.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Error al cargar historial</div>';
  }
}

// ══════════════════════════════════════════
// INDICADORES
// ══════════════════════════════════════════

async function iniciarIndicadores() {
  const sel = document.getElementById('ind-select-proyecto');
  const cont = document.getElementById('ind-content');

  if (!sel) return;

  if (cont) {
    cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Selecciona un proyecto para ver sus indicadores.</div>';
  }

  if (!misProyectosData.length) {
    const data = await fetch(`${API}/proyectos/por-profesor/${user.id}`).then(r => r.json()).catch(() => []);
    misProyectosData = Array.isArray(data) ? data : [];
  }

  sel.innerHTML = '<option value="">— Selecciona un proyecto —</option>' +
    misProyectosData.map(p => `
      <option value="${p.ProyectoID}">
        ${escapeHTML(p.Titulo || 'Proyecto')}${p.NombreAlumno ? ' — ' + escapeHTML(p.NombreAlumno) : ''}
      </option>`).join('');
}

async function loadIndicadoresProyecto() {
  const sel = document.getElementById('ind-select-proyecto');
  const cont = document.getElementById('ind-content');
  const id = sel?.value;

  if (!cont) return;

  if (!id) {
    cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Selecciona un proyecto.</div>';
    return;
  }

  cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Cargando indicadores...</div>';

  try {
    const ind = await fetch(`${API}/proyectos/${id}/indicadores`).then(r => r.json());

    const promedio = parseFloat(ind.Promedio || 0).toFixed(1);
    const puntajeMaximo = Number(ind.PuntajeMaximo || 0);
    const mejorPuntaje = Number(ind.MejorPuntaje || 0);
    const pctMejor = puntajeMaximo > 0 ? Math.round((mejorPuntaje / puntajeMaximo) * 100) : 0;

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
        ${[
          ['Evaluaciones', ind.TotalEvaluaciones || 0, 'Total registradas', 'var(--blue)'],
          ['Promedio', promedio, 'Puntaje promedio', 'var(--accent)'],
          ['Mejor puntaje', ind.MejorPuntaje || 0, 'Máximo alcanzado', 'var(--green)'],
          ['Peor puntaje', ind.PeorPuntaje || 0, 'Mínimo registrado', 'var(--orange)'],
          ['Etapas', `${ind.EtapasCompletadas || 0}/${ind.TotalEtapas || 0}`, 'Completadas', 'var(--blue)'],
          ['Documentos', ind.TotalDocumentos || 0, 'Archivos subidos', 'var(--text-dim)'],
        ].map(([lbl, val, sub, color]) => `
          <div class="stat-card" style="--card-color:${color}">
            <div class="stat-label">${lbl}</div>
            <div class="stat-value">${val}</div>
            <div class="stat-sub">${sub}</div>
          </div>`).join('')}
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:20px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin-bottom:10px">
          Puntaje total acumulado
        </div>

        <div style="display:flex;align-items:baseline;gap:8px">
          <span style="font-size:36px;font-weight:800;font-family:'Syne',sans-serif;color:var(--blue)">
            ${ind.PuntajeTotal || 0}
          </span>
          <span style="font-size:14px;color:var(--text-muted)">
            puntos en todas las evaluaciones
          </span>
        </div>

        ${pctMejor > 0 ? `
          <div style="margin-top:14px">
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:5px">
              <span>Mejor resultado</span>
              <span>${pctMejor}%</span>
            </div>

            <div class="progress-bar" style="height:8px;border-radius:4px">
              <div class="progress-bar-fill" style="width:${pctMejor}%;background:${pctMejor >= 80 ? 'var(--green)' : 'var(--blue)'}"></div>
            </div>
          </div>` : ''}
      </div>`;
  } catch (e) {
    console.error(e);
    cont.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Error al cargar indicadores</div>';
  }
}

// ══════════════════════════════════════════
// REVISAR PROYECTO
// ══════════════════════════════════════════

function openModalRev() {
  const modal = document.getElementById('modal-revisar');
  if (modal) modal.classList.add('open');
}

function cerrarRevisar() {
  const modal = document.getElementById('modal-revisar');
  if (modal) modal.classList.remove('open');
}

async function revisarProyecto(proyectoId) {
  const body = document.getElementById('rev-body');
  const foot = document.getElementById('rev-foot');

  if (body) {
    body.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Cargando...</div>';
  }

  openModalRev();

  try {
    const res = await fetch(`${API}/proyectos/${proyectoId}/detalles`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Error al cargar detalles');
    }

    const p = data.proyecto || {};
    const docs = data.documentos || [];

    const title = document.getElementById('rev-title');
    if (title) title.textContent = `Revisar — ${p.Titulo || 'Proyecto'}`;

    const estado = p.EstadoAprobacion || 'pendiente';

    const aprobBadge = {
      aceptado: '<span class="badge badge-green">Ya aceptado</span>',
      rechazado: '<span class="badge badge-red">Ya rechazado</span>',
      pendiente: '<span class="badge badge-orange">Pendiente de tu revisión</span>',
      aprobado_admin: '<span class="badge badge-green">Aprobado por admin</span>',
      rechazado_admin: '<span class="badge badge-red">Rechazado por admin</span>',
    }[estado] || '<span class="badge badge-orange">Pendiente</span>';

    if (body) {
      body.innerHTML = `
        <div style="margin-bottom:16px">${aprobBadge}</div>

        <div style="margin-bottom:20px">
          <div style="font-size:12px;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
            De qué trata el proyecto
          </div>

          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;line-height:1.6;color:var(--text)">
            ${p.Descripcion ? escapeHTML(p.Descripcion).replace(/\n/g, '<br>') : '<span style="color:var(--text-muted)">El alumno no incluyó descripción</span>'}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:20px">
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Alumno</div>
            <div style="font-size:14px;font-weight:500">${escapeHTML(p.NombreAlumno || '—')}</div>
            <div style="font-size:11px;color:var(--text-muted)">${escapeHTML(p.EmailAlumno || '')}</div>
          </div>

          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Categoría</div>
            <div style="font-size:14px;font-weight:500">${escapeHTML(p.Categoria || '—')}</div>
          </div>

          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Fecha inicio</div>
            <div style="font-size:14px;font-weight:500">${safeDate(p.FechaInicio)}</div>
          </div>

          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Fecha fin</div>
            <div style="font-size:14px;font-weight:500">${p.FechaFin ? safeDate(p.FechaFin) : 'Por definir'}</div>
          </div>
        </div>

        <div style="margin-bottom:20px">
          <div style="font-size:12px;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
            Documentos del alumno (${docs.length})
          </div>

          ${docs.length === 0
            ? '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;color:var(--text-muted)">El alumno no adjuntó documentos.</div>'
            : docs.map(d => `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;margin-bottom:6px">
                <div style="width:32px;height:32px;border-radius:6px;background:var(--blue);display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                  </svg>
                </div>

                <div style="flex:1;min-width:0">
                  <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                    ${escapeHTML(d.NombreArchivo || d.Nombre || 'Documento')}
                  </div>

                  <div style="font-size:11px;color:var(--text-muted)">
                    ${formatBytes(d.TamanoBytes || d.Tamano || 0)} · ${safeDateTime(d.CreatedAt || d.FechaSubida)}
                  </div>
                </div>

                <a href="${API}/documentos/${d.DocumentoID}/ver" target="_blank" class="btn btn-ghost btn-sm">Ver</a>
                <a href="${API}/documentos/${d.DocumentoID}/descargar" class="btn btn-primary btn-sm">Descargar</a>
              </div>`).join('')
          }
        </div>

        <div>
          <div style="font-size:12px;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
            Tu comentario
          </div>

          <textarea id="rev-comentario" class="form-control" rows="4" style="resize:vertical;width:100%" placeholder="Escribe tu retroalimentación al alumno...">${escapeHTML(p.ComentarioRevision || '')}</textarea>
        </div>`;
    }

    if (foot) {
      foot.innerHTML = `
        <button class="btn btn-ghost" onclick="cerrarRevisar()">Cancelar</button>
        <button class="btn btn-danger" onclick="enviarRevision(${proyectoId}, 'rechazado')">Rechazar</button>
        <button class="btn btn-primary" onclick="enviarRevision(${proyectoId}, 'aceptado')">Aceptar proyecto</button>`;
    }
  } catch (e) {
    console.error(e);

    if (body) {
      body.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Error al cargar</div>';
    }
  }
}

async function enviarRevision(proyectoId, estado) {
  const comentario = (document.getElementById('rev-comentario')?.value || '').trim();

  if (estado === 'rechazado' && !comentario) {
    toast('Para rechazar necesitas dejar un comentario', 'red');
    return;
  }

  try {
    const res = await fetch(`${API}/proyectos/${proyectoId}/revisar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        EstadoAprobacion: estado,
        ComentarioRevision: comentario,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || 'Error al guardar la revisión');
    }

    toast(estado === 'aceptado' ? '✓ Proyecto aceptado' : 'Proyecto rechazado');
    cerrarRevisar();
    loadMisProyectos();
  } catch (e) {
    console.error(e);
    toast(e.message || 'Error al guardar la revisión', 'red');
  }
}

// ══════════════════════════════════════════
// EVALUAR CON RÚBRICA
// ══════════════════════════════════════════

function cerrarEvaluar() {
  const modal = document.getElementById('modal-evaluar');

  if (modal) modal.classList.remove('open');

  evalProyectoId = null;
  evalRubrica = null;
}

async function evaluarProyecto(proyectoId) {
  evalProyectoId = proyectoId;
  evalRubrica = null;

  const body = document.getElementById('eval-body');
  const foot = document.getElementById('eval-foot');

  if (body) {
    body.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Cargando rúbrica...</div>';
  }

  if (foot) {
    foot.innerHTML = '<button class="btn btn-ghost" onclick="cerrarEvaluar()">Cancelar</button>';
  }

  const modal = document.getElementById('modal-evaluar');
  if (modal) modal.classList.add('open');

  try {
    const res = await fetch(`${API}/proyectos/${proyectoId}/rubrica`);
    const rubrica = await res.json();

    if (!res.ok) {
      if (body) {
        body.innerHTML = `
          <div style="text-align:center;padding:32px">
            <div style="font-size:40px;margin-bottom:12px">📋</div>
            <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:8px">Sin rúbrica asignada</div>
            <div style="font-size:13px;color:var(--text-muted);line-height:1.6">
              Este proyecto no está inscrito en un evento con rúbrica.<br>
              El administrador debe asignar una rúbrica al evento primero.
            </div>
          </div>`;
      }
      return;
    }

    // API returns { rubrica: {...}, criterios: [...] } — flatten so RubricaID is top-level
    evalRubrica = { ...rubrica.rubrica, criterios: rubrica.criterios };

    const title = document.getElementById('eval-title');
    if (title) title.textContent = `Evaluar — ${evalRubrica.Nombre || 'Rúbrica'}`;

    const criterios = evalRubrica.criterios || [];
    const puntajeMaxTotal = criterios.reduce((s, c) => s + Number(c.PuntosMax || 0), 0);


    if (body) {
      body.innerHTML = `
        <div class="rubrica-criterios">
          ${criterios.map(c => `
            <div class="rubrica-criterio">
              <div class="rubrica-criterio-header">
                <div class="rubrica-criterio-nombre">${escapeHTML(c.Nombre || 'Criterio')}</div>
                ${c.Descripcion ? `<div class="rubrica-criterio-desc">${escapeHTML(c.Descripcion)}</div>` : ''}
                <div class="rubrica-criterio-max">Máx. ${Number(c.PuntosMax || 0)} pts</div>
              </div>
              <div class="rubrica-niveles">
                ${[...(c.niveles || [])].sort((a, b) => Number(b.Puntaje || 0) - Number(a.Puntaje || 0)).map(n => `
                  <label class="nivel-label">
                    <input
                      type="radio"
                      name="crit-${c.CriterioID}"
                      value="${Number(n.Puntaje || 0)}"
                      data-criterio="${c.CriterioID}"
                      data-nivel="${n.NivelID}"
                      data-max="${Number(c.PuntosMax || 0)}"
                      onchange="calcularPuntajeAuto()"
                    >
                    <div class="nivel-card">
                      <div class="nivel-nombre">${escapeHTML(n.Nombre || 'Nivel')}</div>
                      ${n.Descripcion ? `<div class="nivel-desc">${escapeHTML(n.Descripcion)}</div>` : ''}
                      <div class="nivel-pts">${Number(n.Puntaje || 0)} pts</div>
                    </div>
                  </label>`).join('')}
              </div>
            </div>`).join('')}
        </div>

        <div class="form-group" style="margin-top:20px">
          <label style="font-size:13px;font-weight:600;color:var(--text);display:block;margin-bottom:8px">Observaciones generales</label>
          <textarea id="eval-observaciones" class="form-control" rows="3" style="resize:vertical" placeholder="Comentarios sobre el desempeño del proyecto..."></textarea>
        </div>

        <div class="rubrica-score-bar">
          <div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Puntaje total</div>
            <div id="eval-puntaje-display" class="score-total">0 / ${puntajeMaxTotal}</div>
          </div>
          <div id="eval-porcentaje-display" class="score-pct">0%</div>
        </div>`;
    }

    if (foot) {
      foot.innerHTML = `
        <button class="btn btn-ghost" onclick="cerrarEvaluar()">Cancelar</button>
        <button class="btn btn-primary" id="btn-guardar-eval" onclick="guardarEvaluacion()">Guardar evaluación</button>`;
    }
  } catch (e) {
    console.error(e);

    if (body) {
      body.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Error al cargar la rúbrica</div>';
    }
  }
}

function calcularPuntajeAuto() {
  if (!evalRubrica) return;

  let total = 0;
  const criterios = evalRubrica.criterios || [];
  const maximo = criterios.reduce((s, c) => s + Number(c.PuntosMax || 0), 0);

  criterios.forEach(c => {
    const sel = document.querySelector(`input[name="crit-${c.CriterioID}"]:checked`);
    if (sel) total += Number(sel.value || 0);
  });

  const pct = maximo > 0 ? Math.round((total / maximo) * 100) : 0;
  const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--blue)' : 'var(--orange)';

  const disp = document.getElementById('eval-puntaje-display');
  const pdisp = document.getElementById('eval-porcentaje-display');

  if (disp) {
    disp.textContent = `${total} / ${maximo}`;
    disp.style.color = color;
  }

  if (pdisp) {
    pdisp.textContent = `${pct}%`;
    pdisp.style.color = color;
  }
}

async function guardarEvaluacion() {
  if (!evalProyectoId || !evalRubrica) return;

  const detalles = [];
  const criterios = evalRubrica.criterios || [];

  let todosSeleccionados = true;

  for (const c of criterios) {
    const sel = document.querySelector(`input[name="crit-${c.CriterioID}"]:checked`);

    if (!sel) {
      todosSeleccionados = false;
      break;
    }

    detalles.push({
      CriterioID: c.CriterioID,
      NivelID: Number(sel.dataset.nivel),
      PuntajeObtenido: Number(sel.value),
      PuntajeMaximo: Number(c.PuntosMax || 0),
    });
  }

  if (!todosSeleccionados) {
    toast('Selecciona un nivel para cada criterio', 'red');
    return;
  }

  const observaciones = document.getElementById('eval-observaciones')?.value?.trim() || '';
  const btn = document.getElementById('btn-guardar-eval');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const res = await fetch(`${API}/proyectos/${evalProyectoId}/evaluacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ProfesorID: user.id,
        RubricaID: evalRubrica.RubricaID,
        Observaciones: observaciones,
        Comentarios: observaciones,
        detalles,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Error al guardar');
    }

    toast(`✓ Evaluación guardada — ${data.PuntajeTotal}/${data.PuntajeMaximo} (${data.Porcentaje}%)`);
    cerrarEvaluar();
    loadMisProyectos();
  } catch (e) {
    console.error(e);
    toast(e.message || 'Error al guardar evaluación', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar evaluación';
    }
  }
}

// ══════════════════════════════════════════
// CREAR DOCUMENTO DE TEXTO
// ══════════════════════════════════════════

function abrirCrearDocumento(proyectoId) {
  proyectoDocActualId = proyectoId;

  const titulo = document.getElementById('doc-txt-titulo');
  const contenido = document.getElementById('doc-txt-contenido');
  const modal = document.getElementById('modal-doc-texto');

  if (titulo) titulo.value = '';
  if (contenido) contenido.value = '';
  if (modal) modal.classList.add('open');
}

function cerrarCrearDocumento() {
  const modal = document.getElementById('modal-doc-texto');

  if (modal) modal.classList.remove('open');

  proyectoDocActualId = null;
}

async function guardarDocumentoTexto() {
  const titulo = document.getElementById('doc-txt-titulo')?.value.trim() || '';
  const contenido = document.getElementById('doc-txt-contenido')?.value.trim() || '';

  if (!titulo) return toast('Escribe un título para el documento', 'red');
  if (!contenido) return toast('El documento no puede estar vacío', 'red');
  if (!proyectoDocActualId) return toast('No hay proyecto seleccionado', 'red');

  const btn = document.getElementById('btn-guardar-doc-txt');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const res = await fetch(`${API}/proyectos/${proyectoDocActualId}/documentos/texto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Titulo: titulo,
        Contenido: contenido,
        SubidoPorID: user.id,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || 'Fallo al guardar');
    }

    toast('✓ Documento creado correctamente');
    cerrarCrearDocumento();
  } catch (e) {
    console.error(e);
    toast(e.message || 'Error al crear el documento', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Guardar documento';
    }
  }
}
