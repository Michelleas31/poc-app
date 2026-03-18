const API = 'http://localhost:3000/api';
 
// ── NAVEGACIÓN ────────────────────────────────────────────────
const pageTitles = {
  dashboard:   ['Dashboard', 'Resumen general del sistema'],
  usuarios:    ['Usuarios', 'Gestión de alumnos, profesores y admins'],
  eventos:     ['Gestionar Eventos', 'Crea, edita y administra los eventos'],
  horarios:    ['Horarios y Aulas', 'Configura espacios y tiempos del evento'],
  rubricas:    ['Rúbricas', 'Criterios de evaluación por evento'],
  proyectos:   ['Aprobar Proyectos', 'Acepta o rechaza inscripciones'],
  evaluadores: ['Asignar Evaluadores', 'Designa profesores por proyecto'],
};
 
function showSection(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  if (el) el.classList.add('active');
  const [t, s] = pageTitles[id] || [id, ''];
  document.getElementById('page-title').textContent = t;
  document.getElementById('page-subtitle').textContent = s;
  loadSection(id);
}
 
function loadSection(id) {
  if (id === 'dashboard')   loadDashboard();
  if (id === 'usuarios')    loadUsuarios();
  if (id === 'eventos')     loadEventos();
  if (id === 'horarios')    { loadEventosSelect(); loadAulas(); }
  if (id === 'rubricas')    loadRubricas();
  if (id === 'proyectos')   { loadEventosSelect2(); loadProyectosEvento(); }
  if (id === 'evaluadores') { loadEventosSelectEval(); }
}
 
// ── TABS ──────────────────────────────────────────────────────
function switchTab(el, tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['tab-horarios', 'tab-aulas'].forEach(id => {
    document.getElementById(id).style.display = id === tabId ? 'block' : 'none';
  });
}
 
// ── MODALES ───────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
 
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });
  loadDashboard();
});
 
// ── TOAST ─────────────────────────────────────────────────────
function toast(msg, type = 'green') {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  document.getElementById('toast-dot').className = `toast-dot ${type}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
 
// ── HELPERS ───────────────────────────────────────────────────
function badgeEstado(estado) {
  const map = {
    proximo: 'badge-blue', activo: 'badge-green', finalizado: 'badge-gray',
    no_disponible: 'badge-red', pendiente: 'badge-orange',
    aceptado: 'badge-green', rechazado: 'badge-red',
  };
  const labels = {
    proximo: 'Próximo', activo: 'Activo', finalizado: 'Finalizado',
    no_disponible: 'No disponible', pendiente: 'Pendiente',
    aceptado: 'Aceptado', rechazado: 'Rechazado',
  };
  return `<span class="badge ${map[estado] || 'badge-gray'}">${labels[estado] || estado}</span>`;
}
 
function badgeRol(rol) {
  const m = { Admin: 'badge-yellow', Profesor: 'badge-blue', Alumno: 'badge-green' };
  return `<span class="badge ${m[rol] || 'badge-gray'}">${rol}</span>`;
}
 
// ── DASHBOARD ─────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [us, ev, pr] = await Promise.all([
      fetch(`${API}/usuarios`).then(r => r.json()).catch(() => []),
      fetch(`${API}/eventos`).then(r => r.json()).catch(() => []),
      fetch(`${API}/eventos/proyectos`).then(r => r.json()).catch(() => []),
    ]);
 
    document.getElementById('stat-usuarios').textContent =
      Array.isArray(us) ? us.filter(u => u.Activo).length : '—';
    document.getElementById('stat-eventos').textContent =
      Array.isArray(ev) ? ev.filter(e => ['proximo', 'activo'].includes(e.Estado)).length : '—';
 
    const pend = Array.isArray(pr) ? pr.filter(p => p.Estado === 'pendiente') : [];
    const acep = Array.isArray(pr) ? pr.filter(p => p.Estado === 'aceptado')  : [];
    document.getElementById('stat-pendientes').textContent = pend.length;
    document.getElementById('stat-aceptados').textContent  = acep.length;
    document.getElementById('badge-proyectos').textContent = pend.length;
 
    const tbody  = document.getElementById('dash-proyectos-tbody');
    const recent = pend.slice(0, 5);
 
    if (!recent.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Sin proyectos pendientes</td></tr>`;
      return;
    }
 
    tbody.innerHTML = recent.map(p => `
      <tr>
        <td class="td-name">${p.TituloProyecto || p.Titulo || '—'}</td>
        <td>${p.NombreAlumno || '—'}</td>
        <td>${p.NombreEvento || '—'}</td>
        <td>${p.CreatedAt ? new Date(p.CreatedAt).toLocaleDateString('es-MX') : '—'}</td>
        <td>${badgeEstado(p.Estado)}</td>
        <td>
          <button class="btn btn-success btn-sm" onclick="cambiarEstadoProyecto(${p.EventoProyectoID},'aceptado')">Aceptar</button>
          <button class="btn btn-danger btn-sm" onclick="cambiarEstadoProyecto(${p.EventoProyectoID},'rechazado')" style="margin-left:6px">Rechazar</button>
        </td>
      </tr>`).join('');
  } catch (e) { console.error(e); }
}
 
// ── USUARIOS ──────────────────────────────────────────────────
let allUsuarios = [];
 
async function loadUsuarios() {
  const tbody = document.getElementById('usuarios-tbody');
  try {
    const data = await fetch(`${API}/usuarios`).then(r => r.json());
    allUsuarios = Array.isArray(data) ? data : [];
    renderUsuarios(allUsuarios);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--red)">Error al cargar usuarios</td></tr>`;
  }
}
 
function renderUsuarios(list) {
  const tbody = document.getElementById('usuarios-tbody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Sin usuarios registrados</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => `
    <tr>
      <td class="td-name">${u.Nombre}</td>
      <td>${u.Email}</td>
      <td>${badgeRol(u.Rol)}</td>
      <td>${u.Activo
        ? '<span class="badge badge-green">Activo</span>'
        : '<span class="badge badge-red">Inactivo</span>'}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editUsuario(${JSON.stringify(u).replace(/"/g, '&quot;')})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUsuario(${u.UsuarioID},'${u.Nombre}')" style="margin-left:6px">
          ${u.Activo ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>`).join('');
}
 
function filterUsuarios(q) {
  const f = allUsuarios.filter(u =>
    u.Nombre.toLowerCase().includes(q.toLowerCase()) ||
    u.Email.toLowerCase().includes(q.toLowerCase())
  );
  renderUsuarios(f);
}
 
function editUsuario(u) {
  document.getElementById('modal-usuario-title').textContent = 'Editar usuario';
  document.getElementById('usuario-id').value   = u.UsuarioID;
  document.getElementById('u-nombre').value     = u.Nombre;
  document.getElementById('u-email').value      = u.Email;
  document.getElementById('u-rol').value        = u.Rol;
  document.getElementById('u-password').value   = '';
  document.getElementById('u-pass-hint').style.display = 'inline';
  openModal('modal-usuario');
}
 
async function saveUsuario() {
  const id   = document.getElementById('usuario-id').value;
  const body = {
    Nombre:    document.getElementById('u-nombre').value,
    Email:     document.getElementById('u-email').value,
    Rol:       document.getElementById('u-rol').value,
    Contraseña: document.getElementById('u-password').value || undefined,
  };
  if (!body.Nombre || !body.Email) return toast('Completa nombre y correo', 'red');
  try {
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `${API}/usuarios/${id}` : `${API}/usuarios`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    closeModal('modal-usuario');
    toast(id ? 'Usuario actualizado' : 'Usuario creado');
    document.getElementById('usuario-id').value = '';
    loadUsuarios();
  } catch (e) { toast('Error al guardar', 'red'); }
}
 
async function deleteUsuario(id, nombre) {
  if (!confirm(`¿Cambiar estado de "${nombre}"?`)) return;
  try {
    await fetch(`${API}/usuarios/${id}/toggle`, { method: 'PUT' });
    toast('Estado actualizado');
    loadUsuarios();
  } catch (e) { toast('Error', 'red'); }
}
 
// ── EVENTOS ───────────────────────────────────────────────────
async function loadEventos() {
  const grid = document.getElementById('eventos-grid');
  try {
    const data = await fetch(`${API}/eventos`).then(r => r.json());
    if (!Array.isArray(data) || !data.length) {
      grid.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          <p>No hay eventos registrados aún</p>
        </div>`;
      return;
    }
    grid.innerHTML = data.map(ev => `
        <div class="event-card">
            <div class="event-card-top">
                <div>
                    <div class="event-name">${ev.Nombre}</div>
                    <div class="event-date">📅 ${(() => {
                        const [y,m,d] = (ev.Fecha.split('T')[0]).split('-');
                        return new Date(+y, +m-1, +d).toLocaleDateString('es-MX', {weekday:'long', year:'numeric', month:'long', day:'numeric'});
                    })()}</div>
                </div>
          ${badgeEstado(ev.Estado)}
        </div>
        <div class="event-hours">🕐 ${ev.HoraInicio} – ${ev.HoraFin}</div>
        ${ev.Descripcion ? `<p style="font-size:13px;color:var(--text-muted);line-height:1.5">${ev.Descripcion}</p>` : ''}
        <div class="event-actions">
          <button class="btn btn-ghost btn-sm" onclick="editEvento(${JSON.stringify(ev).replace(/"/g, '&quot;')})">Editar</button>
          <select class="form-control btn-sm" style="padding:5px 10px;font-size:12px;width:auto" onchange="cambiarEstadoEvento(${ev.EventoID},this.value)">
            <option value="">Cambiar estado</option>
            <option value="proximo">Próximo</option>
            <option value="activo">Activo</option>
            <option value="no_disponible">No disponible</option>
            <option value="finalizado">Finalizado</option>
          </select>
          <button class="btn btn-danger btn-sm" onclick="deleteEvento(${ev.EventoID},'${ev.Nombre}')">Eliminar</button>
        </div>
      </div>`).join('');
  } catch (e) {
    grid.innerHTML = `<div style="color:var(--red);font-size:13px">Error al cargar eventos</div>`;
  }
}
 
function editEvento(ev) {
  document.getElementById('modal-evento-title').textContent = 'Editar evento';
  document.getElementById('evento-id').value   = ev.EventoID;
  document.getElementById('ev-nombre').value   = ev.Nombre;
  document.getElementById('ev-desc').value     = ev.Descripcion || '';
  document.getElementById('ev-fecha').value    = ev.Fecha?.split('T')[0] || '';
  document.getElementById('ev-estado').value   = ev.Estado;
  document.getElementById('ev-inicio').value   = ev.HoraInicio;
  document.getElementById('ev-fin').value      = ev.HoraFin;
  openModal('modal-evento');
}
 
async function saveEvento() {
  const id   = document.getElementById('evento-id').value;
  const body = {
    Nombre:      document.getElementById('ev-nombre').value,
    Descripcion: document.getElementById('ev-desc').value,
    Fecha:       document.getElementById('ev-fecha').value,
    HoraInicio:  document.getElementById('ev-inicio').value,
    HoraFin:     document.getElementById('ev-fin').value,
    Estado:      document.getElementById('ev-estado').value,
  };
  if (!body.Nombre || !body.Fecha) return toast('Completa nombre y fecha', 'red');
  try {
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `${API}/eventos/${id}` : `${API}/eventos`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    closeModal('modal-evento');
    document.getElementById('evento-id').value = '';
    toast(id ? 'Evento actualizado' : 'Evento creado');
    loadEventos();
  } catch (e) { toast('Error al guardar', 'red'); }
}
 
async function cambiarEstadoEvento(id, estado) {
  if (!estado) return;
  try {
    await fetch(`${API}/eventos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Estado: estado }) });
    toast('Estado del evento actualizado');
    loadEventos();
  } catch (e) { toast('Error', 'red'); }
}
 
async function deleteEvento(id, nombre) {
  if (!confirm(`¿Eliminar el evento "${nombre}"?`)) return;
  try {
    await fetch(`${API}/eventos/${id}`, { method: 'DELETE' });
    toast('Evento eliminado');
    loadEventos();
  } catch (e) { toast('Error', 'red'); }
}
 
// ── AULAS ─────────────────────────────────────────────────────
async function loadAulas() {
  const tbody = document.getElementById('aulas-tbody');
  try {
    const data = await fetch(`${API}/aulas`).then(r => r.json());
    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:24px;color:var(--text-muted)">Sin aulas registradas</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(a => `
      <tr>
        <td class="td-name">${a.Nombre}</td>
        <td>${a.Capacidad || '—'}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteAula(${a.AulaID},'${a.Nombre}')">Eliminar</button></td>
      </tr>`).join('');
 
    // Llenar select de aula en modal de horario
    document.getElementById('hor-aula').innerHTML =
      data.map(a => `<option value="${a.AulaID}">${a.Nombre}</option>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="3" style="color:var(--red);padding:16px">Error</td></tr>`;
  }
}
 
async function saveAula() {
  const body = {
    Nombre:    document.getElementById('aula-nombre').value,
    Capacidad: document.getElementById('aula-capacidad').value,
  };
  if (!body.Nombre) return toast('Ingresa nombre del aula', 'red');
  try {
    await fetch(`${API}/aulas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    closeModal('modal-aula');
    toast('Aula creada');
    loadAulas();
  } catch (e) { toast('Error', 'red'); }
}
 
async function deleteAula(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  try {
    await fetch(`${API}/aulas/${id}`, { method: 'DELETE' });
    toast('Aula eliminada');
    loadAulas();
  } catch (e) { toast('Error', 'red'); }
}
 
// ── HORARIOS ──────────────────────────────────────────────────
async function loadEventosSelect() {
  try {
    const data = await fetch(`${API}/eventos`).then(r => r.json());
    document.getElementById('select-evento-horario').innerHTML =
      '<option value="">Seleccionar evento...</option>' +
      (Array.isArray(data) ? data.map(e => `<option value="${e.EventoID}">${e.Nombre}</option>`).join('') : '');
  } catch (e) {}
}
 
async function loadHorarios() {
  const eid   = document.getElementById('select-evento-horario').value;
  const tbody = document.getElementById('horarios-tbody');
  if (!eid) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Selecciona un evento</td></tr>`;
    return;
  }
  try {
    const data = await fetch(`${API}/eventos/${eid}/horarios`).then(r => r.json());
    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Sin horarios para este evento</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(h => `
      <tr>
        <td class="td-name">${h.NombreAula || h.AulaID}</td>
        <td>${h.HoraInicio}</td>
        <td>${h.HoraFin}</td>
        <td>${h.Disponible
          ? '<span class="badge badge-green">Sí</span>'
          : '<span class="badge badge-red">No</span>'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="toggleHorario(${h.HorarioID},${h.Disponible})">${h.Disponible ? 'Desactivar' : 'Activar'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteHorario(${h.HorarioID})" style="margin-left:6px">Eliminar</button>
        </td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--red);padding:16px">Error</td></tr>`;
  }
}
 
async function saveHorario() {
  const eid = document.getElementById('select-evento-horario').value;
  if (!eid) return toast('Selecciona un evento primero', 'red');
  const body = {
    EventoID:   eid,
    AulaID:     document.getElementById('hor-aula').value,
    HoraInicio: document.getElementById('hor-inicio').value,
    HoraFin:    document.getElementById('hor-fin').value,
  };
  if (!body.HoraInicio || !body.HoraFin) return toast('Ingresa horas', 'red');
  try {
    await fetch(`${API}/horarios`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    closeModal('modal-horario');
    toast('Horario agregado');
    loadHorarios();
  } catch (e) { toast('Error', 'red'); }
}
 
async function toggleHorario(id, actual) {
  try {
    await fetch(`${API}/horarios/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Disponible: actual ? 0 : 1 }) });
    toast('Horario actualizado');
    loadHorarios();
  } catch (e) { toast('Error', 'red'); }
}
 
async function deleteHorario(id) {
  if (!confirm('¿Eliminar este horario?')) return;
  try {
    await fetch(`${API}/horarios/${id}`, { method: 'DELETE' });
    toast('Horario eliminado');
    loadHorarios();
  } catch (e) { toast('Error', 'red'); }
}
 
// ── RÚBRICAS ──────────────────────────────────────────────────
async function loadRubricas() {
  const tbody = document.getElementById('rubricas-tbody');
  try {
    const data = await fetch(`${API}/rubricas`).then(r => r.json());
    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)">Sin rúbricas creadas</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(r => `
      <tr>
        <td class="td-name">${r.Nombre}</td>
        <td>${r.NombreProfesor || 'Admin'}</td>
        <td><span class="badge badge-blue">${r.TotalCriterios || 0} criterios</span></td>
        <td>${r.Activa
          ? '<span class="badge badge-green">Activa</span>'
          : '<span class="badge badge-gray">Inactiva</span>'}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteRubrica(${r.RubricaID})">Eliminar</button></td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" style="color:var(--red);padding:16px">Error</td></tr>`;
  }
}
 
let criterios = [];
 
function addCriterio() {
  const idx  = criterios.length;
  criterios.push({ nombre: '', puntos: 10 });
  const list = document.getElementById('criterios-list');
  const div  = document.createElement('div');
  div.style.cssText = 'display:flex;gap:8px;align-items:center';
  div.innerHTML = `
    <input class="form-control" placeholder="Nombre del criterio" oninput="criterios[${idx}].nombre=this.value" style="flex:1">
    <input class="form-control" type="number" value="10" min="1" max="100" oninput="criterios[${idx}].puntos=+this.value" style="width:70px">
    <span style="font-size:11px;color:var(--text-muted)">pts</span>
    <button class="btn btn-danger btn-sm" onclick="this.parentElement.remove();criterios.splice(${idx},1)">✕</button>`;
  list.appendChild(div);
}
 
async function saveRubrica() {
  const body = {
    Nombre:      document.getElementById('rub-nombre').value,
    Descripcion: document.getElementById('rub-desc').value,
    criterios,
  };
  if (!body.Nombre)          return toast('Ingresa nombre de rúbrica', 'red');
  if (!criterios.length)     return toast('Agrega al menos un criterio', 'red');
  try {
    await fetch(`${API}/rubricas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    closeModal('modal-rubrica');
    criterios = [];
    document.getElementById('criterios-list').innerHTML = '';
    toast('Rúbrica creada');
    loadRubricas();
  } catch (e) { toast('Error', 'red'); }
}
 
async function deleteRubrica(id) {
  if (!confirm('¿Eliminar esta rúbrica?')) return;
  try {
    await fetch(`${API}/rubricas/${id}`, { method: 'DELETE' });
    toast('Rúbrica eliminada');
    loadRubricas();
  } catch (e) { toast('Error', 'red'); }
}
 
// ── PROYECTOS (APROBAR) ───────────────────────────────────────
async function loadEventosSelect2() {
  try {
    const data = await fetch(`${API}/eventos`).then(r => r.json());
    document.getElementById('select-evento-proyectos').innerHTML =
      '<option value="">Todos los eventos</option>' +
      (Array.isArray(data) ? data.map(e => `<option value="${e.EventoID}">${e.Nombre}</option>`).join('') : '');
  } catch (e) {}
}
 
async function loadProyectosEvento() {
  const eid    = document.getElementById('select-evento-proyectos').value;
  const estado = document.getElementById('filter-estado-proyecto').value;
  const tbody  = document.getElementById('proyectos-tbody');
  try {
    let url = `${API}/eventos/proyectos`;
    const params = [];
    if (eid)    params.push(`eventoId=${eid}`);
    if (estado) params.push(`estado=${estado}`);
    if (params.length) url += '?' + params.join('&');
 
    const data = await fetch(url).then(r => r.json());
    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Sin proyectos</td></tr>`;
      return;
    }
    document.getElementById('badge-proyectos').textContent =
      data.filter(p => p.Estado === 'pendiente').length || '';
 
    tbody.innerHTML = data.map(p => `
      <tr>
        <td class="td-name">${p.TituloProyecto || p.Titulo || '—'}</td>
        <td>${p.NombreAlumno || '—'}</td>
        <td>${p.NombreEvento || '—'}</td>
        <td>${p.CreatedAt ? new Date(p.CreatedAt).toLocaleDateString('es-MX') : '—'}</td>
        <td>${badgeEstado(p.Estado)}</td>
        <td style="display:flex;gap:6px">
          ${p.Estado === 'pendiente' ? `
            <button class="btn btn-success btn-sm" onclick="cambiarEstadoProyecto(${p.EventoProyectoID},'aceptado')">Aceptar</button>
            <button class="btn btn-danger btn-sm"  onclick="cambiarEstadoProyecto(${p.EventoProyectoID},'rechazado')">Rechazar</button>
          ` : `<span style="font-size:12px;color:var(--text-muted)">—</span>`}
        </td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:var(--red);padding:16px">Error al cargar</td></tr>`;
  }
}
 
async function cambiarEstadoProyecto(epId, estado) {
  try {
    await fetch(`${API}/eventos/proyectos/${epId}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Estado: estado }),
    });
    toast(estado === 'aceptado' ? 'Proyecto aceptado ✓' : 'Proyecto rechazado',
          estado === 'aceptado' ? 'green' : 'red');
    loadProyectosEvento();
    loadDashboard();
  } catch (e) { toast('Error', 'red'); }
}
 
// ── EVALUADORES ───────────────────────────────────────────────
async function loadEventosSelectEval() {
  try {
    const data = await fetch(`${API}/eventos`).then(r => r.json());
    document.getElementById('select-evento-eval').innerHTML =
      '<option value="">Seleccionar evento...</option>' +
      (Array.isArray(data) ? data.map(e => `<option value="${e.EventoID}">${e.Nombre}</option>`).join('') : '');
  } catch (e) {}
}
 
async function loadProyectosEval() {
  const eid   = document.getElementById('select-evento-eval').value;
  const tbody = document.getElementById('evaluadores-tbody');
  if (!eid) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">Selecciona un evento</td></tr>`;
    return;
  }
  try {
    const data = await fetch(`${API}/eventos/${eid}/proyectos/aceptados`).then(r => r.json());
    if (!Array.isArray(data) || !data.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">Sin proyectos aceptados en este evento</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(p => `
      <tr>
        <td class="td-name">${p.TituloProyecto || p.Titulo || '—'}</td>
        <td>${p.NombreAula ? `${p.NombreAula} · ${p.HoraInicio || ''}–${p.HoraFin || ''}` : 'Sin asignar'}</td>
        <td>${p.Evaluadores
          ? p.Evaluadores.split(',').map(e => `<span class="badge badge-blue" style="margin-right:4px">${e}</span>`).join('')
          : '<span style="color:var(--text-muted);font-size:12px">Sin asignar</span>'}</td>
        <td><button class="btn btn-primary btn-sm" onclick="openAsignarEval(${p.EventoProyectoID},'${(p.TituloProyecto || '').replace(/'/g, "\\'")}')">Asignar</button></td>
      </tr>`).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:var(--red);padding:16px">Error</td></tr>`;
  }
}
 
let selectedProfesores = [];
 
async function openAsignarEval(epId, titulo) {
  document.getElementById('eval-ep-id').value = epId;
  document.getElementById('modal-eval-title').textContent = `Evaluadores — ${titulo}`;
  selectedProfesores = [];
  const list = document.getElementById('profesores-eval-list');
  list.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Cargando profesores...</div>';
  openModal('modal-evaluadores');
  try {
    const data = await fetch(`${API}/usuarios?rol=Profesor`).then(r => r.json());
    if (!Array.isArray(data) || !data.length) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Sin profesores registrados</div>';
      return;
    }
    list.innerHTML = data.map(p => `
      <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border-radius:8px;cursor:pointer;border:1.5px solid var(--border);transition:border-color .15s"
        onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--border)'">
        <input type="checkbox" value="${p.UsuarioID}" onchange="toggleProfesorEval(this,${p.UsuarioID})" style="accent-color:var(--blue)">
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--text)">${p.Nombre}</div>
          <div style="font-size:11px;color:var(--text-muted)">${p.Email}</div>
        </div>
      </label>`).join('');
  } catch (e) {
    list.innerHTML = '<div style="color:var(--red);font-size:13px">Error</div>';
  }
}
 
function toggleProfesorEval(el, id) {
  if (el.checked) {
    if (selectedProfesores.length >= 3) {
      el.checked = false;
      return toast('Máximo 3 evaluadores por proyecto', 'red');
    }
    selectedProfesores.push(id);
  } else {
    selectedProfesores = selectedProfesores.filter(x => x !== id);
  }
}
 
async function saveEvaluadores() {
  const epId = document.getElementById('eval-ep-id').value;
  if (!selectedProfesores.length) return toast('Selecciona al menos un profesor', 'red');
  try {
    await fetch(`${API}/eventos/proyectos/${epId}/evaluadores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profesores: selectedProfesores }),
    });
    closeModal('modal-evaluadores');
    toast('Evaluadores asignados ✓');
    loadProyectosEval();
  } catch (e) { toast('Error', 'red'); }
}