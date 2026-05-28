const API = 'http://localhost:3000/api';
let user = null;
let iaRubricaMejora = null;

const pageTitles = {
  dashboard: ['Dashboard', 'Resumen general del sistema'],
  usuarios: ['Usuarios', 'Gestión de alumnos, profesores y admins'],
  eventos: ['Gestionar Eventos', 'Crea, edita y administra los eventos'],
  horarios: ['Horarios y Aulas', 'Configura espacios y tiempos del evento'],
  rubricas: ['Rúbricas', 'Criterios de evaluación por evento'],
  proyectos: ['Aprobar Proyectos', 'Revisa proyectos, citas, profesor, horario y sala'],
  citas: ['Citas y QR', 'Aprueba o rechaza citas para liberar el QR de evaluación'],
  evaluadores: ['Asignar Evaluadores', 'Designa profesores por aula de evento'],
  'gestion-proyectos': ['Gestión de Proyectos', 'Crea, edita y asigna proyectos a alumnos'],
  analiticas: ['Analíticas', 'Ranking, comparativa e indicadores por evento'],
  'ia-admin': ['Asistente IA administrativo', 'Validacion academica, rubricas e historial de uso'],
};

const ESTADOS_CITA = {
  pendiente_admin: 'Pendiente admin',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  evaluada: 'Evaluada',
};

function $(id) {
  return document.getElementById(id);
}

function safeText(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonForOnclick(obj) {
  return escapeHtml(JSON.stringify(obj));
}

function formatDate(value) {
  if (!value) return '—';

  const raw = String(value);
  const onlyDate = raw.includes('T') ? raw.split('T')[0] : raw;

  if (!/^\d{4}-\d{2}-\d{2}/.test(onlyDate)) return '—';

  const [y, m, d] = onlyDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatDateLong(value) {
  if (!value) return '—';

  const raw = String(value);
  const onlyDate = raw.includes('T') ? raw.split('T')[0] : raw;

  if (!/^\d{4}-\d{2}-\d{2}/.test(onlyDate)) return '—';

  const [y, m, d] = onlyDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(value) {
  if (!value) return '—';
  return String(value).slice(0, 5);
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function normalizeUser(raw) {
  if (!raw) return null;

  const parsed = JSON.parse(raw);

  return {
    ...parsed,
    id: parsed.id || parsed.UsuarioID || parsed.usuarioId,
    UsuarioID: parsed.UsuarioID || parsed.id || parsed.usuarioId,
    nombre: parsed.nombre || parsed.Nombre,
    Nombre: parsed.Nombre || parsed.nombre,
    email: parsed.email || parsed.Email,
    Email: parsed.Email || parsed.email,
    rol: parsed.rol || parsed.Rol,
    Rol: parsed.Rol || parsed.rol,
  };
}

function apiGet(path) {
  return fetch(`${API}${path}`).then(async (res) => {
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || `Error GET ${path}`);
    return data;
  });
}

function apiSend(path, method, body = {}) {
  return fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || `Error ${method} ${path}`);
    return data;
  });
}

function toast(msg, type = 'green') {
  const t = $('toast');
  const m = $('toast-msg');
  const d = $('toast-dot');

  if (!t || !m || !d) {
    alert(msg);
    return;
  }

  m.textContent = msg;
  d.className = `toast-dot ${type}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function badgeEstado(estado) {
  const normalized = String(estado || '').toLowerCase();

  const map = {
    proximo: 'badge-blue',
    activo: 'badge-green',
    finalizado: 'badge-gray',
    no_disponible: 'badge-red',
    pendiente: 'badge-orange',
    pendiente_admin: 'badge-orange',
    buscando_profesor: 'badge-orange',
    profesor_seleccionado: 'badge-blue',
    aprobado: 'badge-green',
    aprobada: 'badge-green',
    aceptado: 'badge-green',
    rechazada: 'badge-red',
    rechazado: 'badge-red',
    evaluada: 'badge-blue',
    completado: 'badge-green',
    'en progreso': 'badge-blue',
  };

  const labels = {
    proximo: 'Próximo',
    activo: 'Activo',
    finalizado: 'Finalizado',
    no_disponible: 'No disponible',
    pendiente: 'Pendiente',
    pendiente_admin: 'Pendiente admin',
    buscando_profesor: 'Buscando profesor',
    profesor_seleccionado: 'Profesor seleccionado',
    aprobado: 'Aprobado',
    aprobada: 'Aprobada',
    aceptado: 'Aceptado',
    rechazada: 'Rechazada',
    rechazado: 'Rechazado',
    evaluada: 'Evaluada',
    completado: 'Completado',
    'en progreso': 'En progreso',
  };

  return `<span class="badge ${map[normalized] || 'badge-gray'}">${labels[normalized] || escapeHtml(estado || 'Sin estado')}</span>`;
}

function estadoProyectoCanonico(item = {}) {
  const estadoInscripcion = String(item.EstadoInscripcion || item.EstadoCita || item.Estado || '').toLowerCase();
  if (['pendiente', 'aceptado', 'rechazado'].includes(estadoInscripcion)) return estadoInscripcion;

  const estadoCita = String(item.Estado || '').toLowerCase();
  if (estadoCita === 'pendiente_admin') return 'pendiente';
  if (estadoCita === 'aprobada') return 'aceptado';
  if (estadoCita === 'rechazada') return 'rechazado';

  const estadoProyecto = String(item.EstadoAprobacion || item.EstadoProyecto || '').toLowerCase();
  if (estadoProyecto === 'aprobado') return 'aceptado';
  if (['pendiente', 'aceptado', 'rechazado'].includes(estadoProyecto)) return estadoProyecto;

  return 'pendiente';
}

function badgeRol(rol) {
  const m = {
    Admin: 'badge-yellow',
    Profesor: 'badge-blue',
    Alumno: 'badge-green',
  };

  return `<span class="badge ${m[rol] || 'badge-gray'}">${escapeHtml(rol || '—')}</span>`;
}

function openModal(id) {
  const modal = $(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = $(id);
  if (modal) modal.classList.remove('open');
}

function showSection(id, el) {
  document.querySelectorAll('.section').forEach((s) => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));

  const section = $('section-' + id) || $(id);
  if (section) section.classList.add('active');

  if (el) {
    el.classList.add('active');
  } else {
    const nav = document.querySelector(`[data-section="${id}"]`);
    if (nav) nav.classList.add('active');
  }

  const [t, s] = pageTitles[id] || [id, ''];
  if ($('page-title')) $('page-title').textContent = t;
  if ($('page-subtitle')) $('page-subtitle').textContent = s;

  loadSection(id);
}

function loadSection(id) {
  if (id === 'dashboard') loadDashboard();
  if (id === 'usuarios') loadUsuarios();
  if (id === 'eventos') loadEventos();
  if (id === 'horarios') {
    loadEventosSelect();
    loadAulas();
    loadEventosSelectModeradores();
  }
  if (id === 'rubricas') loadRubricas();
  if (id === 'proyectos') {
    loadEventosSelect2();
    loadProyectosEvento();
    loadCitasAdmin();
  }
  if (id === 'citas') loadCitasAdmin();
  if (id === 'evaluadores') loadEventosSelectEval();
  if (id === 'gestion-proyectos') loadGestionProyectos();
  if (id === 'analiticas') loadAnaliticas();
  if (id === 'ia-admin') loadIaAdmin();
}

function switchTab(el, tabId) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  if (el) el.classList.add('active');

  ['tab-horarios', 'tab-aulas', 'tab-moderadores'].forEach((id) => {
    const tab = $(id);
    if (tab) tab.style.display = id === tabId ? 'block' : 'none';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const raw =
    sessionStorage.getItem('user') ||
    localStorage.getItem('user') ||
    localStorage.getItem('usuario');

  if (!raw) {
    window.location.href = 'login.html';
    return;
  }

  user = normalizeUser(raw);

  if (!user || (user.rol !== 'Admin' && user.Rol !== 'Admin')) {
    window.location.href = 'login.html';
    return;
  }

  document.querySelectorAll('.modal-overlay').forEach((o) => {
    o.addEventListener('click', (e) => {
      if (e.target === o) o.classList.remove('open');
    });
  });

  document.querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => showSection(btn.dataset.section, btn));
  });

  const newUserBtn = $('btn-new-usuario');
  if (newUserBtn) {
    newUserBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openNewUsuario();
    });
  }

  const saveUserBtn = $('btn-save-usuario');
  if (saveUserBtn) {
    saveUserBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveUsuario();
    });
  }

  loadGestionProyectos();
  loadDashboard();
});

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

async function loadDashboard() {
  try {
    const [usuarios, proyectos, citas] = await Promise.all([
      apiGet('/usuarios').catch(() => []),
      apiGet('/proyectos').catch(() => []),
      apiGet('/citas').catch(() => []),
    ]);

    const usuariosActivos = Array.isArray(usuarios)
      ? usuarios.filter((u) => Number(u.Activo) === 1 || u.Activo === true).length
      : 0;

    const proyectosPendientes = Array.isArray(proyectos)
      ? proyectos.filter((p) =>
          estadoProyectoCanonico(p) === 'pendiente'
        )
      : [];

    const citasPendientes = Array.isArray(citas)
      ? citas.filter((c) => String(c.Estado || '').toLowerCase() === 'pendiente_admin')
      : [];

    const citasAprobadas = Array.isArray(citas)
      ? citas.filter((c) => String(c.Estado || '').toLowerCase() === 'aprobada')
      : [];

    if ($('stat-usuarios')) $('stat-usuarios').textContent = usuariosActivos;
    if ($('stat-eventos')) $('stat-eventos').textContent = Array.isArray(proyectos) ? proyectos.length : 0;
    if ($('stat-pendientes')) $('stat-pendientes').textContent = citasPendientes.length || proyectosPendientes.length;
    if ($('stat-aceptados')) $('stat-aceptados').textContent = citasAprobadas.length;
    if ($('badge-proyectos')) $('badge-proyectos').textContent = citasPendientes.length || '';

    const tbody = $('dash-proyectos-tbody');
    if (!tbody) return;

    const recent = citasPendientes.slice(0, 5);

    if (!recent.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">
            Sin citas pendientes de aprobación
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = recent.map((c) => `
      <tr>
        <td class="td-name">${escapeHtml(c.Titulo || c.TituloProyecto || '—')}</td>
        <td>${escapeHtml(c.NombreAlumno || '—')}</td>
        <td>${escapeHtml(c.NombreProfesor || '—')}</td>
        <td>${formatDate(c.Fecha)} · ${formatTime(c.HoraInicio)} · ${escapeHtml(c.Sala || 'Sin sala')}</td>
        <td>${badgeEstado(c.Estado)}</td>
        <td>
          <button class="btn btn-success btn-sm" onclick="aprobarCita(${c.CitaID})">Aprobar</button>
          <button class="btn btn-danger btn-sm" onclick="rechazarCita(${c.CitaID})" style="margin-left:6px">Rechazar</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error(e);
    toast('Error al cargar dashboard', 'red');
  }
}

// ─────────────────────────────────────────────
// USUARIOS
// ─────────────────────────────────────────────

let allUsuarios = [];

async function loadUsuarios() {
  const tbody = $('usuarios-tbody');

  try {
    const data = await apiGet('/usuarios');
    allUsuarios = Array.isArray(data) ? data : [];
    renderUsuarios(allUsuarios);
  } catch (e) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:24px;color:var(--red)">
            Error al cargar usuarios
          </td>
        </tr>`;
    }
  }
}

function renderUsuarios(list) {
  const tbody = $('usuarios-tbody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">
          Sin usuarios registrados
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map((u) => `
    <tr>
      <td class="td-name">${escapeHtml(u.Nombre)}</td>
      <td>${escapeHtml(u.Email)}</td>
      <td>${badgeRol(u.Rol)}</td>
      <td>
        ${u.Activo
          ? '<span class="badge badge-green">Activo</span>'
          : '<span class="badge badge-red">Inactivo</span>'}
      </td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editUsuario(${safeJsonForOnclick(u)})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUsuario(${u.UsuarioID},'${escapeHtml(u.Nombre)}')" style="margin-left:6px">
          ${u.Activo ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>
  `).join('');
}

function filterUsuarios(q) {
  const query = String(q || '').toLowerCase();

  const f = allUsuarios.filter((u) =>
    String(u.Nombre || '').toLowerCase().includes(query) ||
    String(u.Email || '').toLowerCase().includes(query)
  );

  renderUsuarios(f);
}

function openNewUsuario() {
  if ($('modal-usuario-title')) $('modal-usuario-title').textContent = 'Nuevo usuario';
  if ($('usuario-id')) $('usuario-id').value = '';
  if ($('u-nombre')) $('u-nombre').value = '';
  if ($('u-email')) $('u-email').value = '';
  if ($('u-rol')) $('u-rol').value = 'Alumno';
  if ($('u-password')) $('u-password').value = '';
  if ($('u-pass-hint')) $('u-pass-hint').style.display = 'none';

  openModal('modal-usuario');
}

function editUsuario(u) {
  if ($('modal-usuario-title')) $('modal-usuario-title').textContent = 'Editar usuario';
  if ($('usuario-id')) $('usuario-id').value = u.UsuarioID;
  if ($('u-nombre')) $('u-nombre').value = u.Nombre || '';
  if ($('u-email')) $('u-email').value = u.Email || '';
  if ($('u-rol')) $('u-rol').value = u.Rol || 'Alumno';
  if ($('u-password')) $('u-password').value = '';
  if ($('u-pass-hint')) $('u-pass-hint').style.display = 'inline';

  openModal('modal-usuario');
}

async function saveUsuario() {
  const id = $('usuario-id')?.value;
  const btn = $('btn-save-usuario');
  const password = $('u-password')?.value || '';

  if (btn?.dataset.saving === '1') return;

  const body = {
    Nombre: $('u-nombre')?.value?.trim(),
    Email: $('u-email')?.value?.trim(),
    Rol: $('u-rol')?.value,
    Contraseña: password || undefined,
    Contrasena: password || undefined,
  };

  if (!body.Nombre || !body.Email) {
    toast('Completa nombre y correo', 'red');
    return;
  }

  if (!id && !password) {
    toast('La contraseña es obligatoria para usuarios nuevos', 'red');
    return;
  }

  try {
    if (btn) {
      btn.dataset.saving = '1';
      btn.disabled = true;
      btn.textContent = id ? 'Actualizando...' : 'Creando...';
    }

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/usuarios/${id}` : '/usuarios';

    await apiSend(url, method, body);

    closeModal('modal-usuario');
    toast(id ? 'Usuario actualizado' : 'Usuario creado');

    if ($('usuario-id')) $('usuario-id').value = '';
    loadUsuarios();
  } catch (e) {
    toast(e.message || 'Error al guardar', 'red');
  } finally {
    if (btn) {
      delete btn.dataset.saving;
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  }
}

async function deleteUsuario(id, nombre) {
  if (!confirm(`¿Cambiar estado de "${nombre}"?`)) return;

  try {
    await apiSend(`/usuarios/${id}/toggle`, 'PUT');
    toast('Estado actualizado');
    loadUsuarios();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

// ─────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────

async function loadEventos() {
  const grid = $('eventos-grid');
  if (!grid) return;

  try {
    const data = await apiGet('/eventos');

    if (!Array.isArray(data) || !data.length) {
      grid.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          <p>No hay eventos registrados aún</p>
        </div>`;
      return;
    }

    grid.innerHTML = data.map((ev) => `
      <div class="event-card">
        <div class="event-card-top">
          <div>
            <div class="event-name">${escapeHtml(ev.Nombre)}</div>
            <div class="event-date">📅 ${formatDateLong(ev.Fecha)}</div>
          </div>
          ${badgeEstado(ev.Estado)}
        </div>

        <div class="event-hours">🕐 ${formatTime(ev.HoraInicio)} – ${formatTime(ev.HoraFin)}</div>

        ${ev.Descripcion
          ? `<p style="font-size:13px;color:var(--text-muted);line-height:1.5">${escapeHtml(ev.Descripcion)}</p>`
          : ''}

        <div class="event-actions">
          <button class="btn btn-ghost btn-sm" onclick="editEvento(${safeJsonForOnclick(ev)})">Editar</button>

          <select class="form-control btn-sm" style="padding:5px 10px;font-size:12px;width:auto" onchange="cambiarEstadoEvento(${ev.EventoID},this.value)">
            <option value="">Cambiar estado</option>
            <option value="proximo">Próximo</option>
            <option value="activo">Activo</option>
            <option value="no_disponible">No disponible</option>
            <option value="finalizado">Finalizado</option>
          </select>

          <button class="btn btn-danger btn-sm" onclick="deleteEvento(${ev.EventoID},'${escapeHtml(ev.Nombre)}')">Eliminar</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = `<div style="color:var(--red);font-size:13px">Error al cargar eventos</div>`;
  }
}

async function cargarRubricasSelect(valorSeleccionado) {
  const sel = $('ev-rubrica');
  if (!sel) return;

  try {
    const data = await apiGet('/rubricas');
    const rubricas = Array.isArray(data) ? data : [];

    sel.innerHTML = '<option value="">Sin rúbrica</option>' +
      rubricas.map((r) =>
        `<option value="${r.RubricaID}"${r.RubricaID == valorSeleccionado ? ' selected' : ''}>${escapeHtml(r.Nombre)}</option>`
      ).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Error al cargar rúbricas</option>';
  }
}

async function abrirModalEvento() {
  if ($('modal-evento-title')) $('modal-evento-title').textContent = 'Nuevo evento';
  if ($('evento-id')) $('evento-id').value = '';
  if ($('ev-nombre')) $('ev-nombre').value = '';
  if ($('ev-desc')) $('ev-desc').value = '';
  if ($('ev-fecha')) $('ev-fecha').value = '';
  if ($('ev-estado')) $('ev-estado').value = 'proximo';
  if ($('ev-inicio')) $('ev-inicio').value = '';
  if ($('ev-fin')) $('ev-fin').value = '';

  await cargarRubricasSelect(null);
  openModal('modal-evento');
}

async function editEvento(ev) {
  if ($('modal-evento-title')) $('modal-evento-title').textContent = 'Editar evento';
  if ($('evento-id')) $('evento-id').value = ev.EventoID;
  if ($('ev-nombre')) $('ev-nombre').value = ev.Nombre || '';
  if ($('ev-desc')) $('ev-desc').value = ev.Descripcion || '';
  if ($('ev-fecha')) $('ev-fecha').value = ev.Fecha?.split('T')[0] || '';
  if ($('ev-estado')) $('ev-estado').value = ev.Estado || 'proximo';
  if ($('ev-inicio')) $('ev-inicio').value = formatTime(ev.HoraInicio);
  if ($('ev-fin')) $('ev-fin').value = formatTime(ev.HoraFin);

  await cargarRubricasSelect(ev.RubricaID);
  openModal('modal-evento');
}

async function saveEvento() {
  const id = $('evento-id')?.value;

  const body = {
    Nombre: $('ev-nombre')?.value?.trim(),
    Descripcion: $('ev-desc')?.value?.trim(),
    Fecha: $('ev-fecha')?.value,
    HoraInicio: $('ev-inicio')?.value,
    HoraFin: $('ev-fin')?.value,
    Estado: $('ev-estado')?.value,
    RubricaID: $('ev-rubrica')?.value || null,
  };

  if (!body.Nombre || !body.Fecha) {
    toast('Completa nombre y fecha', 'red');
    return;
  }

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/eventos/${id}` : '/eventos';

    await apiSend(url, method, body);

    closeModal('modal-evento');
    if ($('evento-id')) $('evento-id').value = '';

    toast(id ? 'Evento actualizado' : 'Evento creado');
    loadEventos();
  } catch (e) {
    toast(e.message || 'Error al guardar', 'red');
  }
}

async function cambiarEstadoEvento(id, estado) {
  if (!estado) return;

  try {
    await apiSend(`/eventos/${id}`, 'PUT', { Estado: estado });
    toast('Estado del evento actualizado');
    loadEventos();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

async function deleteEvento(id, nombre) {
  if (!confirm(`¿Eliminar el evento "${nombre}"?`)) return;

  try {
    await apiSend(`/eventos/${id}`, 'DELETE');
    toast('Evento eliminado');
    loadEventos();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

// ─────────────────────────────────────────────
// AULAS Y HORARIOS
// ─────────────────────────────────────────────

async function loadAulas() {
  const tbody = $('aulas-tbody');

  try {
    const data = await apiGet('/aulas');

    if (!Array.isArray(data) || !data.length) {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align:center;padding:24px;color:var(--text-muted)">
              Sin aulas registradas
            </td>
          </tr>`;
      }
      return;
    }

    if (tbody) {
      tbody.innerHTML = data.map((a) => `
        <tr>
          <td class="td-name">${escapeHtml(a.Nombre)}</td>
          <td>${escapeHtml(a.Capacidad || '—')}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteAula(${a.AulaID},'${escapeHtml(a.Nombre)}')">Eliminar</button>
          </td>
        </tr>
      `).join('');
    }

    if ($('hor-aula')) {
      $('hor-aula').innerHTML = data.map((a) =>
        `<option value="${a.AulaID}">${escapeHtml(a.Nombre)}</option>`
      ).join('');
    }
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="color:var(--red);padding:16px">Error</td></tr>`;
  }
}

async function saveAula() {
  const body = {
    Nombre: $('aula-nombre')?.value?.trim(),
    Capacidad: $('aula-capacidad')?.value || null,
  };

  if (!body.Nombre) {
    toast('Ingresa nombre del aula', 'red');
    return;
  }

  try {
    await apiSend('/aulas', 'POST', body);
    closeModal('modal-aula');
    toast('Aula creada');
    loadAulas();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

async function deleteAula(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;

  try {
    await apiSend(`/aulas/${id}`, 'DELETE');
    toast('Aula eliminada');
    loadAulas();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

async function loadEventosSelect() {
  try {
    const data = await apiGet('/eventos');

    if ($('select-evento-horario')) {
      $('select-evento-horario').innerHTML =
        '<option value="">Seleccionar evento...</option>' +
        (Array.isArray(data)
          ? data.map((e) => `<option value="${e.EventoID}">${escapeHtml(e.Nombre)}</option>`).join('')
          : '');
    }
  } catch (e) {}
}

async function loadHorarios() {
  const eid = $('select-evento-horario')?.value;
  const tbody = $('horarios-tbody');

  if (!tbody) return;

  if (!eid) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">
          Selecciona un evento
        </td>
      </tr>`;
    return;
  }

  try {
    const data = await apiGet(`/eventos/${eid}/horarios`);

    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">
            Sin horarios para este evento
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = data.map((h) => `
      <tr>
        <td class="td-name">${escapeHtml(h.NombreAula || h.AulaID)}</td>
        <td>${formatTime(h.HoraInicio)}</td>
        <td>${formatTime(h.HoraFin)}</td>
        <td>
          ${h.Disponible
            ? '<span class="badge badge-green">Sí</span>'
            : '<span class="badge badge-red">No</span>'}
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="toggleHorario(${h.HorarioID},${h.Disponible ? 1 : 0})">
            ${h.Disponible ? 'Desactivar' : 'Activar'}
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteHorario(${h.HorarioID})" style="margin-left:6px">
            Eliminar
          </button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--red);padding:16px">Error</td></tr>`;
  }
}

async function saveHorario() {
  const eid = $('select-evento-horario')?.value;

  if (!eid) {
    toast('Selecciona un evento primero', 'red');
    return;
  }

  const body = {
    EventoID: eid,
    AulaID: $('hor-aula')?.value,
    HoraInicio: $('hor-inicio')?.value,
    HoraFin: $('hor-fin')?.value,
  };

  if (!body.HoraInicio || !body.HoraFin) {
    toast('Ingresa horas', 'red');
    return;
  }

  try {
    await apiSend('/horarios', 'POST', body);
    closeModal('modal-horario');
    toast('Horario agregado');
    loadHorarios();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

async function toggleHorario(id, actual) {
  try {
    await apiSend(`/horarios/${id}`, 'PUT', { Disponible: actual ? 0 : 1 });
    toast('Horario actualizado');
    loadHorarios();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

async function deleteHorario(id) {
  if (!confirm('¿Eliminar este horario?')) return;

  try {
    await apiSend(`/horarios/${id}`, 'DELETE');
    toast('Horario eliminado');
    loadHorarios();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

// ─────────────────────────────────────────────
// RÚBRICAS
// ─────────────────────────────────────────────

const DEFAULT_RUBRICA_LEVELS = [
  {
    nombre: 'Sobresaliente',
    puntaje: 3,
    descripcion: 'Cumple ampliamente con lo esperado en este criterio.',
    orden: 1,
  },
  {
    nombre: 'Bien',
    puntaje: 2,
    descripcion: 'Cumple adecuadamente con lo esperado en este criterio.',
    orden: 2,
  },
  {
    nombre: 'Suficiente',
    puntaje: 1,
    descripcion: 'Cumple parcialmente con lo esperado en este criterio.',
    orden: 3,
  },
  {
    nombre: 'Insuficiente',
    puntaje: 0,
    descripcion: 'No cumple con lo esperado en este criterio.',
    orden: 4,
  },
];

let criterios = [];

function createDefaultLevels() {
  return DEFAULT_RUBRICA_LEVELS.map((n) => ({ ...n }));
}

function createDefaultCriterio() {
  return {
    nombre: '',
    descripcion: '',
    orden: criterios.length + 1,
    niveles: createDefaultLevels(),
  };
}

function normalizarOrdenCriterios() {
  criterios.forEach((c, i) => {
    c.orden = i + 1;
    c.niveles = (c.niveles || [])
      .slice()
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      .map((n, j) => ({ ...n, orden: j + 1 }));
  });
}

function resetRubricaForm() {
  criterios = [];

  if ($('rub-nombre')) $('rub-nombre').value = '';
  if ($('rub-desc')) $('rub-desc').value = '';

  renderCriterios();
}

function openModalRubrica() {
  resetRubricaForm();
  addCriterio();
  openModal('modal-rubrica');
}

function renderCriterios() {
  const list = $('criterios-list');
  if (!list) return;

  if (!criterios.length) {
    list.innerHTML = `
      <div style="padding:18px;border:1px dashed var(--border);border-radius:12px;background:var(--surface2);text-align:center;color:var(--text-muted);font-size:13px">
        Agrega al menos un criterio para construir la rúbrica.
      </div>`;
    return;
  }

  list.innerHTML = criterios.map((c, ci) => `
    <div style="border:1px solid var(--border);border-radius:14px;background:var(--surface);overflow:hidden">
      <div style="display:grid;grid-template-columns:minmax(280px,320px) minmax(0,1fr);gap:0">
        <div style="padding:16px;border-right:1px solid var(--border);background:var(--surface2)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px">
            <div>
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.45px;color:var(--text-muted);font-weight:700">
                Criterio ${ci + 1}
              </div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="removeCriterio(${ci})">Eliminar</button>
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label>Nombre del criterio</label>
            <input class="form-control" value="${escapeHtml(c.nombre)}" placeholder="Ej. Desarrollo de la temática" oninput="updateCriterioField(${ci},'nombre',this.value)">
          </div>

          <div class="form-group" style="margin-bottom:0">
            <label>Descripción</label>
            <textarea class="form-control" rows="4" style="resize:vertical" oninput="updateCriterioField(${ci},'descripcion',this.value)">${escapeHtml(c.descripcion || '')}</textarea>
          </div>
        </div>

        <div style="padding:16px">
          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">
            ${c.niveles.map((n, ni) => `
              <div style="border:1px solid var(--border);border-radius:12px;background:var(--surface2);padding:12px;display:flex;flex-direction:column;gap:10px">
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <span class="badge badge-blue">Nivel ${ni + 1}</span>
                </div>

                <div>
                  <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:6px">Nombre</label>
                  <input class="form-control" value="${escapeHtml(n.nombre)}" oninput="updateNivelField(${ci},${ni},'nombre',this.value)">
                </div>

                <div>
                  <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:6px">Puntaje</label>
                  <input class="form-control" type="number" min="0" step="1" value="${escapeHtml(n.puntaje)}" oninput="updateNivelField(${ci},${ni},'puntaje',this.value)">
                </div>

                <div style="flex:1">
                  <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:6px">Descripción</label>
                  <textarea class="form-control" rows="5" style="resize:vertical" oninput="updateNivelField(${ci},${ni},'descripcion',this.value)">${escapeHtml(n.descripcion)}</textarea>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function addCriterio() {
  criterios.push(createDefaultCriterio());
  normalizarOrdenCriterios();
  renderCriterios();
}

function removeCriterio(i) {
  criterios.splice(i, 1);
  normalizarOrdenCriterios();
  renderCriterios();
}

function updateCriterioField(i, f, v) {
  if (criterios[i]) criterios[i][f] = v;
}

function updateNivelField(ci, ni, f, v) {
  if (criterios[ci] && criterios[ci].niveles[ni]) {
    criterios[ci].niveles[ni][f] = v;
  }
}

async function loadRubricas() {
  const tbody = $('rubricas-tbody');

  try {
    const data = await apiGet('/rubricas');

    if (!tbody) return;

    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">
            Sin rúbricas creadas
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = data.map((r) => `
      <tr>
        <td class="td-name">
          <div>${escapeHtml(r.Nombre)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
            ${escapeHtml(r.Descripcion || 'Sin descripción')}
          </div>
        </td>
        <td>${escapeHtml(r.NombreProfesor || 'Admin')}</td>
        <td>
          <span class="badge badge-blue">${r.TotalCriterios || 0} criterios</span>
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
            ${r.TotalNiveles || 0} niveles · ${r.PuntajeMaximo || 0} pts max.
          </div>
        </td>
        <td>
          ${r.Activa
            ? '<span class="badge badge-green">Activa</span>'
            : '<span class="badge badge-gray">Inactiva</span>'}
        </td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteRubrica(${r.RubricaID})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="color:var(--red);padding:16px">Error</td></tr>`;
  }
}

async function saveRubrica() {
  const body = {
    Nombre: $('rub-nombre')?.value?.trim(),
    Descripcion: $('rub-desc')?.value?.trim(),
    ProfesorID: user ? user.UsuarioID : 1,
    criterios: criterios.map((c, ci) => ({
      nombre: (c.nombre || '').trim(),
      descripcion: (c.descripcion || '').trim(),
      orden: ci + 1,
      niveles: (c.niveles || []).map((n, ni) => ({
        nombre: (n.nombre || '').trim(),
        puntaje: Number(n.puntaje),
        descripcion: (n.descripcion || '').trim(),
        orden: ni + 1,
      })),
    })),
  };

  if (!body.Nombre) return toast('Ingresa nombre de rúbrica', 'red');
  if (!body.criterios.length) return toast('Agrega al menos un criterio', 'red');

  for (const c of body.criterios) {
    if (!c.nombre) return toast('Todos los criterios deben tener nombre', 'red');

    if (!Array.isArray(c.niveles) || c.niveles.length !== 4) {
      return toast(`El criterio "${c.nombre}" debe tener 4 niveles`, 'red');
    }

    for (const n of c.niveles) {
      if (!n.nombre || !n.descripcion || Number.isNaN(n.puntaje) || n.puntaje < 0) {
        return toast(`Revisa los niveles del criterio "${c.nombre}"`, 'red');
      }
    }
  }

  try {
    await apiSend('/rubricas', 'POST', body);
    closeModal('modal-rubrica');
    resetRubricaForm();
    toast('Rúbrica creada');
    loadRubricas();
  } catch (e) {
    toast(e.message || 'Error al guardar la rúbrica', 'red');
  }
}

async function deleteRubrica(id) {
  if (!confirm('¿Eliminar esta rúbrica?')) return;

  try {
    await apiSend(`/rubricas/${id}`, 'DELETE');
    toast('Rúbrica eliminada');
    loadRubricas();
  } catch (e) {
    toast(e.message || 'No fue posible eliminar la rúbrica', 'red');
  }
}

// ─────────────────────────────────────────────
// PROYECTOS / CITAS ADMIN
// ─────────────────────────────────────────────

async function loadEventosSelect2() {
  try {
    const data = await apiGet('/eventos');

    if ($('select-evento-proyectos')) {
      $('select-evento-proyectos').innerHTML =
        '<option value="">Todos los eventos</option>' +
        (Array.isArray(data)
          ? data.map((e) => `<option value="${e.EventoID}">${escapeHtml(e.Nombre)}</option>`).join('')
          : '');
    }
  } catch (e) {}
}

async function loadProyectosEvento() {
  const tbody = $('proyectos-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">
        Cargando proyectos...
      </td>
    </tr>`;

  try {
    const eventoFiltro = $('select-evento-proyectos')?.value || '';
    const estadoFiltro = $('filter-estado-proyecto')?.value || '';
    const params = new URLSearchParams();

    if (eventoFiltro) params.set('eventoId', eventoFiltro);
    if (estadoFiltro) params.set('estado', estadoFiltro);

    const [inscripciones, citas] = await Promise.all([
      apiGet(`/eventos/proyectos${params.toString() ? `?${params.toString()}` : ''}`).catch(() => []),
      apiGet('/citas').catch(() => []),
    ]);

    const data = Array.isArray(inscripciones) ? inscripciones : [];
    const citasArr = Array.isArray(citas) ? citas : [];

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">
            Sin inscripciones con esos filtros
          </td>
        </tr>`;
      return;
    }

    const pendientesAdmin = citasArr.filter((c) => String(c.Estado || '').toLowerCase() === 'pendiente_admin');
    if ($('badge-proyectos')) $('badge-proyectos').textContent = pendientesAdmin.length || '';

    tbody.innerHTML = data.map((p) => {
      const cita = citasArr.find((c) => Number(c.EventoProyectoID || c.CitaID) === Number(p.EventoProyectoID));
      const estadoReal = estadoProyectoCanonico(p);
      const qr = p.CodigoQR || p.TokenQR || p.QRCode || cita?.CodigoQR || '';

      return `
        <tr>
          <td class="td-name">
            <div>${escapeHtml(p.Titulo || p.TituloProyecto || '—')}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
              ${escapeHtml(p.Categoria || 'Sin categoría')}
            </div>
          </td>

          <td>${escapeHtml(p.NombreAlumno || '—')}</td>

          <td>
            ${p.NombreProfesor
              ? escapeHtml(p.NombreProfesor)
              : '<span style="color:var(--text-muted);font-size:12px">Sin profesor elegido</span>'}
          </td>

          <td>
            ${p.FechaEvaluacion || p.FechaEvento || p.HoraEval || p.HoraInicio
              ? `${formatDate(p.FechaEvaluacion || p.FechaEvento)}<br><span style="font-size:11px;color:var(--text-muted)">${formatTime(p.HoraEval || p.HoraInicio)} - ${formatTime(p.HoraFinEval || p.HoraFin)} · ${escapeHtml(p.SalaEval || p.NombreAula || 'Sin sala')}</span>`
              : '<span style="color:var(--text-muted);font-size:12px">Sin cita</span>'}
          </td>

          <td>${badgeEstado(estadoReal)}</td>

          <td>
            ${qr
              ? `<code style="font-size:11px;background:var(--surface2);padding:4px 6px;border-radius:6px">${escapeHtml(qr)}</code>`
              : '<span style="color:var(--text-muted);font-size:12px">QR no generado</span>'}
          </td>

          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" onclick="verDetallesProyecto(${p.ProyectoID})">Ver</button>

            ${p.EventoProyectoID && estadoReal === 'pendiente'
              ? `
                <button class="btn btn-success btn-sm" onclick="cambiarEstadoProyecto(${p.EventoProyectoID}, 'aceptado')">Aprobar</button>
                <button class="btn btn-danger btn-sm" onclick="rechazarInscripcion(${p.EventoProyectoID})">Rechazar</button>
              `
              : ''}

            ${estadoReal === 'aceptado' && qr
              ? `<button class="btn btn-ghost btn-sm" onclick="copiarQR('${escapeHtml(qr)}')">Copiar QR</button>`
              : ''}
          </td>
        </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--red);padding:16px">Error al cargar proyectos</td></tr>`;
  }
}

async function loadCitasAdmin() {
  return cargarCitasAdmin();
}

async function cargarCitasAdmin() {
  const tbody = $('citas-tbody') || $('admin-citas-tbody') || $('proyectos-citas-tbody');

  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">
        Cargando citas...
      </td>
    </tr>`;

  try {
    const data = await apiGet('/citas');
    const citas = Array.isArray(data) ? data : [];

    if (!citas.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">
            No hay citas registradas todavía
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = citas.map((c) => `
      <tr>
        <td class="td-name">
          <div>${escapeHtml(c.Titulo || c.TituloProyecto || '—')}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
            ${escapeHtml(c.Categoria || 'Sin categoría')}
          </div>
        </td>

        <td>
          <div>${escapeHtml(c.NombreAlumno || '—')}</div>
          <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(c.EmailAlumno || '')}</div>
        </td>

        <td>
          <div>${escapeHtml(c.NombreProfesor || '—')}</div>
          <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(c.EmailProfesor || '')}</div>
        </td>

        <td>${formatDate(c.Fecha)}</td>

        <td>${formatTime(c.HoraInicio)} - ${formatTime(c.HoraFin)}</td>

        <td>${escapeHtml(c.Sala || 'Sin sala')}</td>

        <td>${badgeEstado(c.Estado)}</td>

        <td style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="verDetallesProyecto(${c.ProyectoID})">Ver</button>

          ${String(c.Estado || '').toLowerCase() === 'pendiente_admin'
            ? `
              <button class="btn btn-success btn-sm" onclick="aprobarCita(${c.CitaID})">Aprobar</button>
              <button class="btn btn-danger btn-sm" onclick="rechazarCita(${c.CitaID})">Rechazar</button>
            `
            : ''}

          ${c.CodigoQR
            ? `<button class="btn btn-ghost btn-sm" onclick="copiarQR('${escapeHtml(c.CodigoQR)}')">QR</button>`
            : ''}
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:var(--red);padding:16px">Error al cargar citas</td></tr>`;
  }
}

async function aprobarCita(citaId) {
  const ComentarioAdmin = prompt('Comentario para aprobar la cita (opcional):') || '';

  try {
    const data = await apiSend(`/citas/${citaId}/aprobar`, 'PUT', { ComentarioAdmin });

    toast(data?.CodigoQR ? `Cita aprobada. QR: ${data.CodigoQR}` : 'Cita aprobada. QR habilitado.');

    loadDashboard();
    loadProyectosEvento();
    cargarCitasAdmin();
  } catch (e) {
    toast(e.message || 'Error al aprobar cita', 'red');
  }
}

async function rechazarCita(citaId) {
  const ComentarioAdmin = prompt('Motivo de rechazo:') || '';

  if (!ComentarioAdmin.trim()) {
    toast('Debes escribir un motivo de rechazo', 'red');
    return;
  }

  try {
    await apiSend(`/citas/${citaId}/rechazar`, 'PUT', { ComentarioAdmin });

    toast('Cita rechazada', 'red');

    loadDashboard();
    loadProyectosEvento();
    cargarCitasAdmin();
  } catch (e) {
    toast(e.message || 'Error al rechazar cita', 'red');
  }
}

async function cambiarEstadoProyecto(epId, estado) {
  try {
    await apiSend(`/eventos/proyectos/${epId}/estado`, 'PUT', { Estado: estado });

    toast(
      estado === 'aceptado' ? 'Proyecto aceptado ✓' : 'Proyecto rechazado',
      estado === 'aceptado' ? 'green' : 'red'
    );

    loadProyectosEvento();
    loadDashboard();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

async function rechazarInscripcion(epId) {
  const comentario = prompt('Motivo del rechazo (opcional):') || '';
  try {
    await apiSend(`/eventos/proyectos/${epId}/estado`, 'PUT', {
      Estado: 'rechazado',
      ComentarioAdmin: comentario,
    });
    toast('Inscripción rechazada', 'red');
    loadProyectosEvento();
    loadDashboard();
  } catch (e) {
    toast(e.message || 'Error al rechazar', 'red');
  }
}

function copiarQR(codigo) {
  if (!codigo) {
    toast('No hay código QR disponible', 'red');
    return;
  }

  navigator.clipboard
    .writeText(codigo)
    .then(() => toast('Código QR copiado'))
    .catch(() => {
      prompt('Copia el código QR:', codigo);
    });
}

// ─────────────────────────────────────────────
// EVALUADORES
// ─────────────────────────────────────────────

async function loadEventosSelectEval() {
  try {
    const data = await apiGet('/eventos');

    if ($('select-evento-eval')) {
      $('select-evento-eval').innerHTML =
        '<option value="">Seleccionar evento...</option>' +
        (Array.isArray(data)
          ? data.map((e) => `<option value="${e.EventoID}">${escapeHtml(e.Nombre)}</option>`).join('')
          : '');
    }
  } catch (e) {}
}

async function loadProyectosEval() {
  const eid = $('select-evento-eval')?.value;
  const tbody = $('evaluadores-tbody');

  if (!tbody) return;

  if (!eid) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">
          Selecciona un evento
        </td>
      </tr>`;
    return;
  }

  try {
    const data = await apiGet(`/eventos/${eid}/proyectos/aceptados`);

    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">
            Sin proyectos aceptados en este evento
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = data.map((p) => `
      <tr>
        <td class="td-name">${escapeHtml(p.TituloProyecto || p.Titulo || '—')}</td>
        <td>
          ${p.NombreAula
            ? `${escapeHtml(p.NombreAula)} · ${formatTime(p.HoraInicio)}–${formatTime(p.HoraFin)}`
            : 'Sin asignar'}
        </td>
        <td>
          ${p.Evaluadores
            ? p.Evaluadores.split(',').map((e) => `<span class="badge badge-blue" style="margin-right:4px">${escapeHtml(e)}</span>`).join('')
            : '<span style="color:var(--text-muted);font-size:12px">Sin asignar</span>'}
        </td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openAsignarEval(${p.EventoProyectoID},'${escapeHtml(p.TituloProyecto || p.Titulo || '')}')">
            Asignar
          </button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--red);padding:16px">Error</td></tr>`;
  }
}

let selectedProfesores = [];

async function openAsignarEval(epId, titulo) {
  if ($('eval-ep-id')) $('eval-ep-id').value = epId;
  if ($('modal-eval-title')) $('modal-eval-title').textContent = `Evaluadores — ${titulo}`;

  selectedProfesores = [];

  const list = $('profesores-eval-list');
  if (list) list.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Cargando profesores...</div>';

  openModal('modal-evaluadores');

  try {
    const data = await apiGet('/usuarios?rol=Profesor');

    if (!list) return;

    if (!Array.isArray(data) || !data.length) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Sin profesores registrados</div>';
      return;
    }

    list.innerHTML = data.map((p) => `
      <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:8px;cursor:pointer;border:1.5px solid var(--border)">
        <input type="checkbox" value="${p.UsuarioID}" onchange="toggleProfesorEval(this,${p.UsuarioID})" style="accent-color:var(--blue)">
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--text)">${escapeHtml(p.Nombre)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(p.Email)}</div>
        </div>
      </label>
    `).join('');
  } catch (e) {
    if (list) list.innerHTML = '<div style="color:var(--red);font-size:13px">Error</div>';
  }
}

function toggleProfesorEval(el, id) {
  if (el.checked) {
    if (selectedProfesores.length >= 3) {
      el.checked = false;
      toast('Máximo 3 evaluadores por proyecto', 'red');
      return;
    }

    selectedProfesores.push(id);
  } else {
    selectedProfesores = selectedProfesores.filter((x) => x !== id);
  }
}

async function saveEvaluadores() {
  const epId = $('eval-ep-id')?.value;

  if (!selectedProfesores.length) {
    toast('Selecciona al menos un profesor', 'red');
    return;
  }

  try {
    await apiSend(`/eventos/proyectos/${epId}/evaluadores`, 'POST', {
      profesores: selectedProfesores,
    });

    closeModal('modal-evaluadores');
    toast('Evaluadores asignados ✓');
    loadProyectosEval();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

// ─────────────────────────────────────────────
// GESTIÓN DE PROYECTOS
// ─────────────────────────────────────────────

let profesoresEvalCatalogo = [];

async function loadEventosSelectModeradores() {
  try {
    const data = await apiGet('/eventos');
    const select = $('select-evento-moderadores');
    if (!select) return;

    const current = select.value;
    select.innerHTML =
      '<option value="">Todos los eventos</option>' +
      (Array.isArray(data)
        ? data.map((e) => `<option value="${e.EventoID}">${escapeHtml(e.Nombre)}</option>`).join('')
        : '');

    if (current) select.value = current;
  } catch (e) {}
}

async function loadAulasEval() {
  const eid = $('select-evento-eval')?.value;
  const tbody = $('evaluadores-tbody');

  if (!tbody) return;

  if (!eid) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">
          Selecciona un evento
        </td>
      </tr>`;
    return;
  }

  try {
    const data = await apiGet(`/eventos/${eid}/aulas-resumen`);

    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">
            Este evento aun no tiene aulas con horarios
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = data.map((aula) => `
      <tr>
        <td>
          <div class="td-name">${escapeHtml(aula.NombreAula || 'Aula')}</div>
          <div class="td-subtle">${escapeHtml(aula.Capacidad ? `${aula.Capacidad} lugares` : 'Capacidad sin definir')}</div>
        </td>
        <td>
          <span class="badge ${Number(aula.SlotsDisponibles) > 0 ? 'badge-green' : 'badge-gray'}">
            ${Number(aula.SlotsDisponibles || 0)}/${Number(aula.TotalSlots || 0)} disponibles
          </span>
        </td>
        <td>
          ${aula.Evaluadores
            ? String(aula.Evaluadores).split(',').map((e) => `<span class="badge badge-blue" style="margin-right:4px">${escapeHtml(e.trim())}</span>`).join('')
            : '<span style="color:var(--text-muted);font-size:12px">Sin evaluadores</span>'}
        </td>
        <td>
          ${aula.Moderador
            ? `<span class="badge badge-green">${escapeHtml(aula.Moderador)}</span>`
            : `<span class="badge badge-orange">${Number(aula.PostulacionesPendientes || 0)} pendientes</span>`}
        </td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="openAsignarEval(${eid},${aula.AulaID},'${escapeHtml(aula.NombreAula || '')}')">
            Asignar
          </button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--red);padding:16px">${escapeHtml(e.message || 'Error')}</td></tr>`;
  }
}

Object.assign(window, {
  openNewUsuario,
  editUsuario,
  saveUsuario,
  deleteUsuario,
});

async function openAsignarEval(eventoId, aulaId, nombreAula) {
  if ($('eval-evento-id')) $('eval-evento-id').value = eventoId;
  if ($('eval-aula-id')) $('eval-aula-id').value = aulaId;
  if ($('modal-eval-title')) $('modal-eval-title').textContent = `Evaluadores de aula - ${nombreAula || 'Aula'}`;

  selectedProfesores = [];
  profesoresEvalCatalogo = [];
  updateEvalWarning([]);

  const list = $('profesores-eval-list');
  if (list) list.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Cargando profesores...</div>';

  openModal('modal-evaluadores');

  try {
    const [candidatos, actuales] = await Promise.all([
      apiGet('/profesores/evaluadores-candidatos'),
      apiGet(`/eventos/${eventoId}/aulas/${aulaId}/evaluadores`),
    ]);

    const asignados = actuales?.evaluadores || [];
    selectedProfesores = asignados.map((p) => Number(p.ProfesorID));
    profesoresEvalCatalogo = Array.isArray(candidatos) ? candidatos : [];

    if (!list) return;

    if (!profesoresEvalCatalogo.length) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Sin profesores registrados</div>';
      return;
    }

    list.innerHTML = profesoresEvalCatalogo.map((p) => {
      const checked = selectedProfesores.includes(Number(p.UsuarioID)) ? 'checked' : '';
      return `
        <label class="prof-check-card">
          <input type="checkbox" value="${p.UsuarioID}" ${checked} onchange="toggleProfesorEval(this,${p.UsuarioID})">
          <div>
            <div class="prof-check-name">${escapeHtml(p.Nombre)}</div>
            <div class="prof-check-meta">${escapeHtml(p.Email)}</div>
            <div class="prof-check-meta">${escapeHtml(p.Especialidades || 'Sin especialidad registrada')}</div>
            <div class="prof-check-meta">${escapeHtml(p.Departamentos || 'Departamento sin registrar')}</div>
          </div>
        </label>`;
    }).join('');

    updateEvalWarning(actuales?.especialidadesRepetidas || []);
  } catch (e) {
    if (list) list.innerHTML = `<div style="color:var(--red);font-size:13px">${escapeHtml(e.message || 'Error')}</div>`;
  }
}

function getEspecialidadesSeleccionadasRepetidas() {
  const conteo = new Map();

  selectedProfesores.forEach((id) => {
    const profe = profesoresEvalCatalogo.find((p) => Number(p.UsuarioID) === Number(id));
    String(profe?.Especialidades || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((nombre) => conteo.set(nombre, (conteo.get(nombre) || 0) + 1));
  });

  return Array.from(conteo.entries())
    .filter(([, total]) => total > 1)
    .map(([nombre]) => nombre);
}

function updateEvalWarning(repetidas = null) {
  const warning = $('eval-warning');
  if (!warning) return;

  const duplicadas = Array.isArray(repetidas) ? repetidas : getEspecialidadesSeleccionadasRepetidas();

  if (!duplicadas.length) {
    warning.style.display = 'none';
    warning.textContent = '';
    return;
  }

  warning.style.display = 'block';
  warning.textContent = `Advertencia: especialidad repetida (${duplicadas.join(', ')}). Considera variar los perfiles.`;
}

function toggleProfesorEval(el, id) {
  if (el.checked) {
    if (selectedProfesores.length >= 3) {
      el.checked = false;
      toast('Maximo 3 evaluadores por aula', 'red');
      return;
    }

    selectedProfesores.push(id);
  } else {
    selectedProfesores = selectedProfesores.filter((x) => Number(x) !== Number(id));
  }

  updateEvalWarning();
}

async function saveEvaluadores() {
  const eventoId = $('eval-evento-id')?.value;
  const aulaId = $('eval-aula-id')?.value;

  if (!eventoId || !aulaId) {
    toast('Selecciona un aula valida', 'red');
    return;
  }

  if (!selectedProfesores.length) {
    toast('Selecciona al menos un profesor', 'red');
    return;
  }

  try {
    const data = await apiSend(`/eventos/${eventoId}/aulas/${aulaId}/evaluadores`, 'PUT', {
      profesores: selectedProfesores,
    });

    updateEvalWarning(data.especialidadesRepetidas || []);
    closeModal('modal-evaluadores');
    toast(data.especialidadesRepetidas?.length ? 'Evaluadores guardados con advertencia' : 'Evaluadores asignados');
    loadAulasEval();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

async function loadModeradoresAdmin() {
  const tbody = $('moderadores-tbody');
  if (!tbody) return;

  const eventoId = $('select-evento-moderadores')?.value;
  const query = eventoId ? `?eventoId=${encodeURIComponent(eventoId)}` : '';

  try {
    const data = await apiGet(`/moderadores-aula${query}`);

    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-cell">No hay postulaciones de moderador.</td>
        </tr>`;
      return;
    }

    tbody.innerHTML = data.map((m) => {
      const pendiente = m.Estado === 'pendiente';
      return `
        <tr>
          <td>
            <div class="td-name">${escapeHtml(m.NombreEvento || 'Evento')}</div>
            <div class="td-subtle">${formatDate(m.FechaEvento)}</div>
          </td>
          <td>${escapeHtml(m.NombreAula || '-')}</td>
          <td>
            <div class="td-name">${escapeHtml(m.NombreAlumno || 'Alumno')}</div>
            <div class="td-subtle">${escapeHtml(m.EmailAlumno || '')}</div>
          </td>
          <td>${escapeHtml(m.Semestre || 'No registrado')}</td>
          <td>${badgeEstado(m.Estado)}</td>
          <td>
            <div class="row-actions">
              <button class="btn btn-primary btn-sm" ${pendiente ? '' : 'disabled'} onclick="updateModeradorAdmin(${m.ModeradorID},'aceptado')">Aceptar</button>
              <button class="btn btn-danger btn-sm" ${pendiente ? '' : 'disabled'} onclick="updateModeradorAdmin(${m.ModeradorID},'rechazado')">Rechazar</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red);padding:16px">${escapeHtml(e.message || 'Error')}</td></tr>`;
  }
}

async function updateModeradorAdmin(id, estado) {
  try {
    await apiSend(`/moderadores-aula/${id}/estado`, 'PUT', { Estado: estado });
    toast(estado === 'aceptado' ? 'Moderador aceptado' : 'Postulacion rechazada');
    loadModeradoresAdmin();
    loadAulasEval();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

let allProyectos = [];

async function loadGestionProyectos() {
  const tbody = $('gp-tbody');

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">
          Cargando...
        </td>
      </tr>`;
  }

  try {
    const data = await apiGet('/proyectos');
    allProyectos = Array.isArray(data) ? data : [];
    renderGP();
    renderGPStats();
  } catch (e) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--red);padding:16px">Error al cargar proyectos</td></tr>`;
    }
  }
}

function renderGPStats() {
  const box = $('gp-stats');
  if (!box) return;

  const total = allProyectos.length;

  const buscando = allProyectos.filter((p) => String(p.Estatus || '').toLowerCase() === 'buscando_profesor').length;
  const pendiente = allProyectos.filter((p) => estadoProyectoCanonico(p) === 'pendiente').length;
  const aprobado = allProyectos.filter((p) => estadoProyectoCanonico(p) === 'aceptado').length;
  const evaluado = allProyectos.filter((p) => String(p.Estatus || '').toLowerCase() === 'evaluado').length;

  box.innerHTML = [
    ['Total', total, 'var(--blue)', 'Proyectos registrados'],
    ['Buscando profesor', buscando, 'var(--orange)', 'Aún sin cita'],
    ['Pendiente admin', pendiente, 'var(--orange)', 'Esperando aprobación'],
    ['Aprobados', aprobado, 'var(--green)', 'QR habilitado'],
    ['Evaluados', evaluado, 'var(--blue)', 'Con calificación'],
  ].map(([label, val, color, sub]) => `
    <div class="stat-card" style="--card-color:${color}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${val}</div>
      <div class="stat-sub">${sub}</div>
    </div>
  `).join('');
}

function filterGP(q) {
  const query = String(q || '').toLowerCase();

  const f = allProyectos.filter((p) =>
    String(p.Titulo || '').toLowerCase().includes(query) ||
    String(p.NombreAlumno || '').toLowerCase().includes(query) ||
    String(p.NombreProfesor || '').toLowerCase().includes(query)
  );

  const estatus = $('gp-filter-estatus')?.value;
  renderGPList(estatus ? f.filter((p) => p.Estatus === estatus) : f);
}

function renderGP() {
  const estatus = $('gp-filter-estatus')?.value;
  renderGPList(estatus ? allProyectos.filter((p) => p.Estatus === estatus) : allProyectos);
}

function renderGPList(list) {
  const tbody = $('gp-tbody');
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:32px;color:var(--text-muted)">
          No hay proyectos
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = list.map((p) => {
    const pct = Number(p.Progreso || 0);
    const barColor = pct >= 100 ? 'var(--green)' : pct > 0 ? 'var(--blue)' : 'var(--border)';

    return `
      <tr>
        <td class="td-name">
          <div>${escapeHtml(p.Titulo || '—')}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${escapeHtml(p.Categoria || 'Sin categoría')}</div>
        </td>

        <td>${escapeHtml(p.NombreAlumno || 'Sin asignar')}</td>

        <td>${escapeHtml(p.NombreProfesor || 'Sin profesor')}</td>

        <td>
          ${p.FechaCita
            ? `${formatDate(p.FechaCita)} · ${formatTime(p.HoraCita)} · ${escapeHtml(p.SalaCita || p.Sala || 'Sin sala')}`
            : '<span style="color:var(--text-muted);font-size:12px">Sin cita</span>'}
        </td>

        <td style="min-width:120px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;transition:width .4s"></div>
            </div>
            <span style="font-size:11px;color:var(--text-muted);min-width:28px">${pct}%</span>
          </div>
        </td>

        <td>${badgeEstado(estadoProyectoCanonico(p))}</td>

        <td class="table-actions-cell">
          <div class="row-actions">
            <button class="btn btn-primary btn-sm" onclick="verDetallesProyecto(${p.ProyectoID})">Ver</button>
            <button class="btn btn-ghost btn-sm" onclick="editProyecto(${safeJsonForOnclick(p)})">Editar</button>
            <button class="btn btn-ghost btn-sm" onclick="abrirEtapasProyecto(${p.ProyectoID},'${escapeHtml(p.Titulo || '')}')">Etapas</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProyecto(${p.ProyectoID},'${escapeHtml(p.Titulo || '')}')">Eliminar</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function openModalNuevoProyecto() {
  if ($('modal-proyecto-title')) $('modal-proyecto-title').textContent = 'Nuevo proyecto';
  if ($('proy-id')) $('proy-id').value = '';
  if ($('proy-titulo')) $('proy-titulo').value = '';
  if ($('proy-desc')) $('proy-desc').value = '';
  if ($('proy-categoria')) $('proy-categoria').value = '';
  if ($('proy-inicio')) $('proy-inicio').value = '';
  if ($('proy-fin')) $('proy-fin').value = '';

  await loadUsuariosSelect();
  openModal('modal-proyecto');
}

async function loadUsuariosSelect() {
  try {
    const data = await apiGet('/usuarios');

    const alumnos = data.filter((u) => u.Rol === 'Alumno' && u.Activo);
    const profesores = data.filter((u) => u.Rol === 'Profesor' && u.Activo);

    if ($('proy-alumno')) {
      $('proy-alumno').innerHTML =
        '<option value="">Seleccionar alumno...</option>' +
        alumnos.map((u) => `<option value="${u.UsuarioID}">${escapeHtml(u.Nombre)}</option>`).join('');
    }

    if ($('proy-profesor')) {
      $('proy-profesor').innerHTML =
        '<option value="">Sin asignar</option>' +
        profesores.map((u) => `<option value="${u.UsuarioID}">${escapeHtml(u.Nombre)}</option>`).join('');
    }
  } catch (e) {}
}

function editProyecto(p) {
  if ($('modal-proyecto-title')) $('modal-proyecto-title').textContent = 'Editar proyecto';
  if ($('proy-id')) $('proy-id').value = p.ProyectoID;
  if ($('proy-titulo')) $('proy-titulo').value = p.Titulo || '';
  if ($('proy-desc')) $('proy-desc').value = p.Descripcion || '';
  if ($('proy-categoria')) $('proy-categoria').value = p.Categoria || '';
  if ($('proy-inicio')) $('proy-inicio').value = p.FechaInicio?.split('T')[0] || '';
  if ($('proy-fin')) $('proy-fin').value = p.FechaFin?.split('T')[0] || '';

  loadUsuariosSelect().then(() => {
    if ($('proy-alumno')) $('proy-alumno').value = p.AlumnoID || '';
    if ($('proy-profesor')) $('proy-profesor').value = p.ProfesorID || '';
  });

  openModal('modal-proyecto');
}

async function saveProyecto() {
  const id = $('proy-id')?.value;
  const btn = $('btn-save-proyecto');

  const body = {
    Titulo: $('proy-titulo')?.value?.trim(),
    Descripcion: $('proy-desc')?.value?.trim(),
    Categoria: $('proy-categoria')?.value?.trim(),
    FechaInicio: $('proy-inicio')?.value,
    FechaFin: $('proy-fin')?.value || undefined,
    AlumnoID: $('proy-alumno')?.value,
    ProfesorID: $('proy-profesor')?.value || undefined,
  };

  if (!body.Titulo) return toast('El título es obligatorio', 'red');
  if (!body.Categoria) return toast('La categoria es obligatoria', 'red');
  if (!body.FechaInicio) return toast('La fecha de inicio es obligatoria', 'red');
  if (!body.AlumnoID) return toast('Selecciona un alumno', 'red');

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando...';
    }

    if (id) {
      await apiSend(`/proyectos/${id}`, 'PUT', body);

      if (body.ProfesorID) {
        await apiSend(`/proyectos/${id}/asignar-profesor`, 'PUT', {
          ProfesorID: body.ProfesorID,
        }).catch(() => null);
      }
    } else {
      await apiSend('/proyectos', 'POST', body);
    }

    closeModal('modal-proyecto');
    toast(id ? 'Proyecto actualizado ✓' : 'Proyecto creado ✓');
    loadGestionProyectos();
  } catch (e) {
    toast(e.message || 'Error al guardar', 'red');
  }
}

async function deleteProyecto(id, titulo) {
  if (!confirm(`¿Eliminar el proyecto "${titulo}"?`)) return;

  try {
    await apiSend(`/proyectos/${id}`, 'DELETE');
    toast('Proyecto eliminado');
    loadGestionProyectos();
  } catch (e) {
    toast(e.message || 'Error', 'red');
  }
}

async function abrirEtapasProyecto(proyectoId, titulo = 'Proyecto') {
  if ($('etapas-proy-id')) $('etapas-proy-id').value = proyectoId;
  if ($('modal-etapas-title')) $('modal-etapas-title').textContent = `Etapas — ${titulo}`;
  if ($('nueva-etapa-nombre')) $('nueva-etapa-nombre').value = '';
  if ($('nueva-etapa-desc')) $('nueva-etapa-desc').value = '';
  if ($('nueva-etapa-fecha')) $('nueva-etapa-fecha').value = '';

  openModal('modal-etapas');
  await cargarEtapasProyecto(proyectoId);
}

async function cargarEtapasProyecto(proyectoId) {
  const list = $('etapas-list');
  if (!list) return;

  list.innerHTML = '<div class="empty-text padded">Cargando etapas...</div>';

  try {
    const etapas = await apiGet(`/proyectos/${proyectoId}/etapas`);

    if (!Array.isArray(etapas) || !etapas.length) {
      list.innerHTML = '<div class="empty-text padded">Este proyecto todavía no tiene etapas.</div>';
      return;
    }

    list.innerHTML = etapas.map((etapa) => `
      <div class="stage-row ${etapa.Completada ? 'done' : ''}">
        <div class="stage-check">${etapa.Completada ? '✓' : ''}</div>
        <div class="stage-main">
          <div class="stage-title">${escapeHtml(etapa.Nombre || 'Etapa')}</div>
          <div class="stage-meta">
            ${etapa.Descripcion ? escapeHtml(etapa.Descripcion) : 'Sin descripción'}
            ${etapa.FechaFin ? ` · Fecha límite: ${formatDate(etapa.FechaFin)}` : ''}
          </div>
        </div>
        <span class="badge ${etapa.Completada ? 'badge-green' : 'badge-orange'}">
          ${etapa.Completada ? 'Completada' : 'Pendiente'}
        </span>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty-text padded error">No se pudieron cargar las etapas.</div>';
  }
}

async function agregarEtapa() {
  const proyectoId = $('etapas-proy-id')?.value;
  const Nombre = $('nueva-etapa-nombre')?.value?.trim();
  const Descripcion = $('nueva-etapa-desc')?.value?.trim();
  const FechaFin = $('nueva-etapa-fecha')?.value;

  if (!proyectoId) return toast('No hay proyecto seleccionado', 'red');
  if (!Nombre) return toast('El nombre de la etapa es obligatorio', 'red');

  try {
    await apiSend(`/proyectos/${proyectoId}/etapas`, 'POST', {
      Nombre,
      Descripcion: Descripcion || null,
      FechaFin: FechaFin || null,
    });

    if ($('nueva-etapa-nombre')) $('nueva-etapa-nombre').value = '';
    if ($('nueva-etapa-desc')) $('nueva-etapa-desc').value = '';
    if ($('nueva-etapa-fecha')) $('nueva-etapa-fecha').value = '';

    toast('Etapa agregada');
    cargarEtapasProyecto(proyectoId);
    loadGestionProyectos();
  } catch (e) {
    toast(e.message || 'Error al agregar etapa', 'red');
  }
}

// ─────────────────────────────────────────────
// DETALLES DEL PROYECTO
// ─────────────────────────────────────────────

async function verDetallesProyecto(proyectoId) {
  window.adminProyectoIdActual = proyectoId;

  const body = $('det-modal-body');
  if (body) {
    body.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Cargando...</div>';
  }

  openModal('modal-detalles-proy');

  try {
    let proyecto;
    let documentos = [];
    let disponibilidades = [];

    const data = await apiGet(`/proyectos/${proyectoId}`);

    if (data.proyecto) {
      proyecto = data.proyecto;
      documentos = data.documentos || [];
      disponibilidades = data.disponibilidades || [];
    } else {
      proyecto = data;
      documentos = await apiGet(`/proyectos/${proyectoId}/documentos`).catch(() => []);
    }

    const citas = await apiGet('/citas').catch(() => []);
    const cita = Array.isArray(citas)
      ? citas.find((c) => Number(c.ProyectoID) === Number(proyectoId))
      : null;

    if ($('det-modal-title')) {
      $('det-modal-title').textContent = `Detalles — ${proyecto.Titulo || 'Proyecto'}`;
    }

    if (!body) return;

    body.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${badgeEstado(proyecto.Estatus || proyecto.EstadoAprobacion || 'pendiente')}
        ${cita ? badgeEstado(cita.Estado) : '<span class="badge badge-gray">Sin cita</span>'}
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:20px">
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Alumno</div>
          <div style="font-size:14px;font-weight:500">${escapeHtml(proyecto.NombreAlumno || '—')}</div>
          <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(proyecto.EmailAlumno || '')}</div>
        </div>

        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Profesor elegido</div>
          <div style="font-size:14px;font-weight:500">${escapeHtml(proyecto.NombreProfesor || cita?.NombreProfesor || 'Sin profesor')}</div>
        </div>

        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Categoría</div>
          <div style="font-size:14px;font-weight:500">${escapeHtml(proyecto.Categoria || 'Sin categoría')}</div>
        </div>

        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Progreso</div>
          <div style="font-size:24px;font-weight:800;color:var(--blue)">${proyecto.Progreso || 0}%</div>
        </div>
      </div>

      <div style="margin-bottom:20px">
        <div style="font-size:12px;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Descripción</div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;line-height:1.6">
          ${proyecto.Descripcion
            ? escapeHtml(proyecto.Descripcion).replace(/\n/g, '<br>')
            : '<span style="color:var(--text-muted)">Sin descripción</span>'}
        </div>
      </div>

      ${proyecto.DocumentoTexto
        ? `
          <div style="margin-bottom:20px">
            <div style="font-size:12px;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Documento escrito en app</div>
            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;line-height:1.6">
              ${escapeHtml(proyecto.DocumentoTexto).replace(/\n/g, '<br>')}
            </div>
          </div>`
        : ''}

      <div style="margin-bottom:20px">
        <div style="font-size:12px;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
          Cita seleccionada
        </div>

        ${cita
          ? `
            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;line-height:1.8">
              <div><strong>Profesor:</strong> ${escapeHtml(cita.NombreProfesor || '—')}</div>
              <div><strong>Día:</strong> ${formatDateLong(cita.Fecha)}</div>
              <div><strong>Hora:</strong> ${formatTime(cita.HoraInicio)} - ${formatTime(cita.HoraFin)}</div>
              <div><strong>Sala:</strong> ${escapeHtml(cita.Sala || '—')}</div>
              <div><strong>Estado:</strong> ${badgeEstado(cita.Estado)}</div>
              <div><strong>QR:</strong> ${
                cita.CodigoQR
                  ? `<code style="background:var(--surface);padding:4px 8px;border-radius:6px">${escapeHtml(cita.CodigoQR)}</code>`
                  : '<span style="color:var(--text-muted)">No generado</span>'
              }</div>

              <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                ${String(cita.Estado || '').toLowerCase() === 'pendiente_admin'
                  ? `
                    <button class="btn btn-success btn-sm" onclick="aprobarCita(${cita.CitaID})">Aprobar cita y liberar QR</button>
                    <button class="btn btn-danger btn-sm" onclick="rechazarCita(${cita.CitaID})">Rechazar cita</button>
                  `
                  : ''}

                ${cita.CodigoQR
                  ? `<button class="btn btn-ghost btn-sm" onclick="copiarQR('${escapeHtml(cita.CodigoQR)}')">Copiar QR</button>`
                  : ''}
              </div>
            </div>`
          : `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;color:var(--text-muted)">El alumno todavía no eligió profesor, día, hora y sala.</div>`}
      </div>

      <div style="margin-bottom:20px">
        <div style="font-size:12px;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
          Profesores que ofrecieron disponibilidad (${disponibilidades.length})
        </div>

        ${disponibilidades.length
          ? disponibilidades.map((d) => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;margin-bottom:6px">
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600">${escapeHtml(d.NombreProfesor || 'Profesor')}</div>
                <div style="font-size:11px;color:var(--text-muted)">
                  ${formatDate(d.Fecha)} · ${formatTime(d.HoraInicio)} - ${formatTime(d.HoraFin)} · ${escapeHtml(d.Sala || 'Sin sala')}
                </div>
              </div>
              ${badgeEstado(d.Estado || 'disponible')}
            </div>
          `).join('')
          : `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;color:var(--text-muted)">Ningún profesor ha ofrecido disponibilidad todavía.</div>`}
      </div>

      <div style="margin-bottom:20px">
        <div style="font-size:12px;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">
          Documentos adjuntos (${documentos.length})
        </div>

        ${documentos.length === 0
          ? '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;color:var(--text-muted)">Sin documentos.</div>'
          : documentos.map((d) => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;margin-bottom:6px">
              <div style="width:32px;height:32px;border-radius:6px;background:var(--blue);display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;font-size:13px">📄</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(d.NombreArchivo || d.nombre || 'Documento')}</div>
                <div style="font-size:11px;color:var(--text-muted)">
                  ${formatBytes(d.TamanoBytes)} · ${formatDate(d.CreatedAt)}
                  ${d.Descripcion ? ' · ' + escapeHtml(d.Descripcion) : ''}
                </div>
              </div>
              <a href="${API}/documentos/${d.DocumentoID}/ver" target="_blank" class="btn btn-ghost btn-sm">Ver</a>
              <a href="${API}/documentos/${d.DocumentoID}/descargar" class="btn btn-primary btn-sm">Descargar</a>
            </div>
          `).join('')}
      </div>
    `;

    const foot = $('det-modal-foot');
    if (foot && !foot.querySelector('.admin-upload-btn')) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost btn-sm admin-upload-btn';
      btn.textContent = '📄 Subir análisis';
      btn.style.marginRight = 'auto';
      btn.onclick = abrirSubirDocAdmin;
      foot.insertBefore(btn, foot.firstChild);
    }
  } catch (e) {
    if (body) {
      body.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Error al cargar los detalles</div>';
    }
  }
}

function abrirSubirDocAdmin() {
  openModal('modal-subir-doc-admin');
}

function cerrarSubirDocAdmin() {
  closeModal('modal-subir-doc-admin');

  if ($('doc-file-admin')) $('doc-file-admin').value = '';
  if ($('doc-desc-admin')) $('doc-desc-admin').value = '';
}

async function subirDocumentoAdmin() {
  const file = $('doc-file-admin')?.files?.[0];
  const desc = $('doc-desc-admin')?.value?.trim();
  const proyectoId = window.adminProyectoIdActual;

  if (!file) return toast('Selecciona un archivo', 'red');
  if (file.size > 25 * 1024 * 1024) return toast('El archivo excede 25 MB', 'red');
  if (!proyectoId) return toast('No hay proyecto activo', 'red');

  const btn = $('btn-subir-doc-admin');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Subiendo...';
  }

  try {
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(',')[1]);
      r.onerror = () => reject(new Error('No se pudo leer el archivo'));
      r.readAsDataURL(file);
    });

    await apiSend(`/proyectos/${proyectoId}/documentos`, 'POST', {
      NombreArchivo: file.name,
      MimeType: file.type || 'application/octet-stream',
      ContenidoBase64: base64,
      Descripcion: desc || 'Documento de análisis (Admin)',
      SubidoPorID: user.UsuarioID,
    });

    toast('✓ Documento subido');
    cerrarSubirDocAdmin();

    if (window.adminProyectoIdActual) {
      verDetallesProyecto(window.adminProyectoIdActual);
    }
  } catch (e) {
    toast(e.message || 'Error al subir el documento', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Subir documento';
    }
  }
}

// ─────────────────────────────────────────────
// ANALÍTICAS
// ─────────────────────────────────────────────

async function loadAnaliticas() {
  await Promise.all([
    loadComparativaEventos(),
    loadEventosSelectRanking(),
    loadPodiosAdmin(),
  ]);
}

async function loadPodiosAdmin() {
  const cont = $('admin-podios-content');
  if (!cont) return;

  cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Cargando podios...</div>';

  try {
    const data = await apiGet('/eventos/pasados/podio');

    if (!Array.isArray(data) || !data.length) {
      cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Aun no hay eventos finalizados con podio.</div>';
      return;
    }

    cont.innerHTML = data.map((item) => `
      <div class="podio-row">
        <div class="podio-pos">${item.Posicion}</div>
        <div class="podio-main">
          <div class="podio-title">${escapeHtml(item.Titulo || 'Proyecto')}</div>
          <div class="podio-meta">${escapeHtml(item.NombreEvento || 'Evento')} - ${formatDate(item.FechaEvento)}</div>
          <div class="podio-meta">Integrantes: ${escapeHtml(item.Integrantes || item.NombreAlumno || '-')}</div>
          <div class="podio-meta">Profesor de apoyo: ${escapeHtml(item.NombreProfesorApoyo || 'Sin asignar')}</div>
        </div>
        <div class="podio-score">${Number(item.PromedioFinal || 0).toFixed(2)}</div>
        ${item.EntregaID ? `<a class="btn btn-ghost btn-sm" href="${API}/entregas/${item.EntregaID}/ver" target="_blank">Leer PDF</a>` : ''}
      </div>
    `).join('');
  } catch (e) {
    cont.innerHTML = `<div style="color:var(--red);font-size:13px">${escapeHtml(e.message || 'Error al cargar podios')}</div>`;
  }
}

async function loadComparativaEventos() {
  const cont = $('comparativa-content');
  if (!cont) return;

  cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Cargando...</div>';

  try {
    const data = await apiGet('/eventos/comparativa');

    if (!Array.isArray(data) || !data.length) {
      cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Sin eventos con datos de evaluación aún.</div>';
      return;
    }

    const maxProm = Math.max(...data.map((e) => parseFloat(e.PromedioGeneral) || 0), 1);

    cont.innerHTML = data.map((ev) => {
      const prom = Number(parseFloat(ev.PromedioGeneral) || 0).toFixed(1);
      const pct = Math.round((parseFloat(ev.PromedioGeneral || 0) / maxProm) * 100);

      return `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px 20px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:600;color:var(--text)">${escapeHtml(ev.NombreEvento)}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                📅 ${formatDate(ev.Fecha)} · ${badgeEstado(ev.Estado)}
              </div>
            </div>

            <div style="text-align:right">
              <div style="font-size:24px;font-weight:800;font-family:'Syne',sans-serif;color:var(--blue)">${prom}</div>
              <div style="font-size:11px;color:var(--text-muted)">promedio</div>
            </div>
          </div>

          <div style="height:8px;background:var(--border);border-radius:4px;margin-bottom:10px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--blue);border-radius:4px;transition:width .5s"></div>
          </div>

          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <span style="font-size:12px;color:var(--text-muted)">📊 ${ev.TotalProyectos || 0} proyectos</span>
            <span style="font-size:12px;color:var(--text-muted)">✓ ${ev.TotalEvaluaciones || 0} evaluaciones</span>
            <span style="font-size:12px;color:var(--green)">▲ Mejor: ${ev.MejorPuntaje || 0} pts</span>
            <span style="font-size:12px;color:var(--red)">▼ Peor: ${ev.PeorPuntaje || 0} pts</span>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    cont.innerHTML = '<div style="color:var(--red);font-size:13px">Error al cargar comparativa</div>';
  }
}

async function loadEventosSelectRanking() {
  try {
    const data = await apiGet('/eventos');
    const sel = $('select-evento-ranking');
    if (!sel) return;

    sel.innerHTML = '<option value="">Seleccionar evento...</option>' +
      (Array.isArray(data)
        ? data.map((e) => `<option value="${e.EventoID}">${escapeHtml(e.Nombre)}</option>`).join('')
        : '');
  } catch (e) {}
}

async function loadRankingEvento() {
  const eid = $('select-evento-ranking')?.value;
  const cont = $('ranking-content');

  if (!cont) return;

  if (!eid) {
    cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Selecciona un evento para ver el ranking.</div>';
    return;
  }

  cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Cargando...</div>';

  try {
    const data = await apiGet(`/eventos/${eid}/ranking`);

    if (!Array.isArray(data) || !data.length) {
      cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Sin proyectos evaluados en este evento aún.</div>';
      return;
    }

    const medallas = ['🥇', '🥈', '🥉'];

    cont.innerHTML = `
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--text-muted)">#</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--text-muted)">Proyecto</th>
            <th style="text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--text-muted)">Alumno</th>
            <th style="text-align:center;padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--text-muted)">Evaluaciones</th>
            <th style="text-align:center;padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--text-muted)">Puntaje Total</th>
            <th style="text-align:center;padding:10px 12px;font-size:11px;text-transform:uppercase;color:var(--text-muted)">Promedio</th>
          </tr>
        </thead>
        <tbody>
          ${data.map((p) => `
            <tr style="border-bottom:1px solid var(--border);background:${p.Posicion === 1 ? 'rgba(59,130,246,.05)' : p.Posicion === 2 ? 'rgba(107,114,128,.04)' : p.Posicion === 3 ? 'rgba(217,119,6,.04)' : 'transparent'}">
              <td style="padding:12px;font-size:18px;text-align:center">${medallas[p.Posicion - 1] || p.Posicion}</td>
              <td style="padding:12px">
                <div style="font-size:13px;font-weight:600;color:var(--text)">${escapeHtml(p.Titulo)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Progreso: ${p.Progreso || 0}%</div>
              </td>
              <td style="padding:12px;font-size:13px;color:var(--text-dim)">${escapeHtml(p.NombreAlumno)}</td>
              <td style="padding:12px;text-align:center"><span class="badge badge-blue">${p.TotalEvaluaciones || 0}</span></td>
              <td style="padding:12px;text-align:center"><span style="font-size:18px;font-weight:800;font-family:'Syne',sans-serif;color:var(--blue)">${p.PuntajeTotal || 0}</span></td>
              <td style="padding:12px;text-align:center"><span style="font-size:13px;font-weight:600;color:var(--green)">${p.Promedio || 0}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    cont.innerHTML = '<div style="color:var(--red);font-size:13px">Error al cargar ranking</div>';
  }
}

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────

// ASISTENTE IA ADMIN
// -------------------------------------------------------------

function trimPreview(value, max = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

async function loadIaAdmin() {
  await Promise.all([
    loadIaSelectEventos(),
    loadIaSelectProyectos(),
    loadIaSelectRubricas(),
    loadIaHistorialAdmin(),
  ]);
}

async function loadIaSelectEventos() {
  const select = $('ia-admin-evento');
  if (!select) return;

  try {
    const eventos = await apiGet('/eventos');
    select.innerHTML = '<option value="">Seleccionar evento...</option>' +
      (Array.isArray(eventos)
        ? eventos.map((e) => `<option value="${e.EventoID}">${escapeHtml(e.Nombre)}</option>`).join('')
        : '');
  } catch (error) {
    select.innerHTML = '<option value="">No se pudieron cargar eventos</option>';
  }
}

async function loadIaSelectProyectos() {
  const select = $('ia-admin-proyecto');
  if (!select) return;

  try {
    const proyectos = await apiGet('/proyectos');
    select.innerHTML = '<option value="">Seleccionar proyecto...</option>' +
      (Array.isArray(proyectos)
        ? proyectos.map((p) => `<option value="${p.ProyectoID}">${escapeHtml(p.Titulo || 'Proyecto sin titulo')}</option>`).join('')
        : '');
  } catch (error) {
    select.innerHTML = '<option value="">No se pudieron cargar proyectos</option>';
  }
}

async function loadIaSelectRubricas() {
  const select = $('ia-admin-rubrica');
  if (!select) return;

  try {
    const rubricas = await apiGet('/rubricas');
    select.innerHTML = '<option value="">Seleccionar rubrica...</option>' +
      (Array.isArray(rubricas)
        ? rubricas.map((r) => `<option value="${r.RubricaID}">${escapeHtml(r.Nombre || 'Rubrica sin nombre')}</option>`).join('')
        : '');
  } catch (error) {
    select.innerHTML = '<option value="">No se pudieron cargar rubricas</option>';
  }
}

async function validarProyectoEventoIA() {
  const EventoID = $('ia-admin-evento')?.value;
  const ProyectoID = $('ia-admin-proyecto')?.value;
  const output = $('ia-admin-validacion');
  const btn = $('btn-ia-validar');

  if (!EventoID) return toast('Selecciona un evento', 'red');
  if (!ProyectoID) return toast('Selecciona un proyecto', 'red');

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Validando...';
  }
  if (output) output.value = 'Validando alineacion con IA...';

  try {
    const data = await apiSend('/ia/validar-evento', 'POST', {
      UsuarioID: user?.UsuarioID || user?.id,
      EventoID: Number(EventoID),
      ProyectoID: Number(ProyectoID),
    });

    if (output) output.value = data.data || '';
    toast('Validacion IA generada');
    loadIaHistorialAdmin();
  } catch (error) {
    if (output) output.value = '';
    toast(error.message || 'Error al validar con IA', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Validar con IA';
    }
  }
}

async function mejorarRubricaIA() {
  const RubricaID = $('ia-admin-rubrica')?.value;
  const instrucciones = $('ia-admin-rubrica-input')?.value.trim() || '';
  const preview = $('ia-admin-rubrica-preview');
  const btn = $('btn-ia-rubrica');
  const btnAplicar = $('btn-ia-aplicar-rubrica');

  if (!RubricaID) return toast('Selecciona una rubrica', 'red');

  iaRubricaMejora = null;
  if (btnAplicar) btnAplicar.disabled = true;

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Mejorando...';
  }
  if (preview) preview.value = 'Generando mejora de rubrica...';

  try {
    const data = await apiSend('/ia/mejorar-rubrica', 'POST', {
      UsuarioID: user?.UsuarioID || user?.id,
      RubricaID: Number(RubricaID),
      Texto: instrucciones,
    });

    const payload = data.data || {};
    iaRubricaMejora = payload.estructura
      ? { RubricaID: Number(RubricaID), estructura: payload.estructura }
      : null;

    if (preview) preview.value = payload.texto || data.data || '';
    if (btnAplicar) btnAplicar.disabled = !iaRubricaMejora;
    toast('Mejora IA generada');
    loadIaHistorialAdmin();
  } catch (error) {
    if (preview) preview.value = '';
    toast(error.message || 'Error al mejorar rubrica', 'red');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Mejorar con IA';
    }
  }
}

async function aplicarRubricaIA() {
  if (!iaRubricaMejora) return toast('Primero genera una mejora estructurada', 'red');

  const btn = $('btn-ia-aplicar-rubrica');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Aplicando...';
  }

  try {
    await apiSend('/ia/mejorar-rubrica', 'POST', {
      UsuarioID: user?.UsuarioID || user?.id,
      RubricaID: iaRubricaMejora.RubricaID,
      aplicar: true,
      estructura: iaRubricaMejora.estructura,
    });

    toast('Mejora aplicada a la rubrica');
    iaRubricaMejora = null;
    if ($('ia-admin-rubrica-preview')) $('ia-admin-rubrica-preview').value = '';
    loadRubricas();
    loadIaHistorialAdmin();
  } catch (error) {
    toast(error.message || 'Error al aplicar mejora', 'red');
  } finally {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Aplicar mejora';
    }
  }
}

async function loadIaHistorialAdmin() {
  const tbody = $('ia-admin-historial');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">Cargando historial...</td></tr>';

  try {
    const data = await apiGet('/ia/historial?limit=80');
    const rows = Array.isArray(data.data) ? data.data : [];

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">Aun no hay uso registrado de IA.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((item) => `
      <tr>
        <td>${formatDateTime(item.CreatedAt)}</td>
        <td>${escapeHtml(item.NombreUsuario || 'Usuario')}</td>
        <td>${badgeRol(item.Rol)}</td>
        <td>${escapeHtml(item.TituloProyecto || 'Sin proyecto')}</td>
        <td><span class="badge badge-blue">${escapeHtml(item.Tipo)}</span></td>
        <td class="ai-history-text">${escapeHtml(trimPreview(item.Entrada))}</td>
        <td class="ai-history-text">${escapeHtml(trimPreview(item.Respuesta))}</td>
        <td>${escapeHtml(item.ModeloUsado || '-')}</td>
        <td>${escapeHtml(item.Proveedor || '-')}</td>
      </tr>
    `).join('');
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="9" style="color:var(--red);padding:16px">Error al cargar historial IA</td></tr>`;
  }
}

function logout() {
  sessionStorage.removeItem('user');
  localStorage.removeItem('user');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
}

Object.assign(window, {
  abrirEtapasProyecto,
  abrirModalEvento,
  addCriterio,
  agregarEtapa,
  aprobarCita,
  cambiarEstadoEvento,
  cambiarEstadoProyecto,
  cerrarSubirDocAdmin,
  closeModal,
  copiarQR,
  deleteAula,
  deleteEvento,
  deleteHorario,
  deleteProyecto,
  deleteRubrica,
  deleteUsuario,
  editEvento,
  editProyecto,
  editUsuario,
  filterGP,
  filterUsuarios,
  aplicarRubricaIA,
  loadIaAdmin,
  loadIaHistorialAdmin,
  loadAulasEval,
  loadCitasAdmin,
  loadHorarios,
  loadModeradoresAdmin,
  loadProyectosEvento,
  loadRankingEvento,
  openAsignarEval,
  openModal,
  openModalNuevoProyecto,
  openModalRubrica,
  openNewUsuario,
  rechazarCita,
  rechazarInscripcion,
  mejorarRubricaIA,
  removeCriterio,
  renderGP,
  safeJsonForOnclick,
  saveAula,
  saveEvaluadores,
  saveEvento,
  saveHorario,
  saveProyecto,
  saveRubrica,
  saveUsuario,
  showSection,
  subirDocumentoAdmin,
  switchTab,
  toggleHorario,
  toggleProfesorEval,
  updateCriterioField,
  updateModeradorAdmin,
  updateNivelField,
  validarProyectoEventoIA,
  verDetallesProyecto,
});
