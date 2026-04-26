const API = 'http://localhost:3000/api';
let user = null;

document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('user');
  if (!raw) return window.location.href = 'login.html';
  user = JSON.parse(raw);
  if (user.rol !== 'Profesor') return window.location.href = 'login.html';
  document.getElementById('nav-nombre').textContent = user.nombre;
  document.getElementById('nav-avatar').textContent = user.nombre[0].toUpperCase();
  loadMisProyectos();
});

function logout() { sessionStorage.removeItem('user'); window.location.href = 'login.html'; }

function showSection(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('section-' + id).classList.add('active');
  if (el) el.classList.add('active');
  if (id === 'mis-proyectos') {
    document.getElementById('page-title').textContent    = 'Mis proyectos';
    document.getElementById('page-subtitle').textContent = 'Proyectos asignados a ti';
    loadMisProyectos();
  }
}

async function loadMisProyectos() {
  const grid = document.getElementById('proyectos-grid-prof');
  grid.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Cargando proyectos...</div>';
  try {
    const data      = await fetch(`${API}/proyectos/por-profesor/${user.id}`).then(r => r.json());
    const proyectos = Array.isArray(data) ? data : [];
    renderStats(proyectos);
    if (!proyectos.length) {
      grid.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg><p>No tienes proyectos asignados aún</p></div>';
      return;
    }
    const colores = { 'Pendiente':'badge-orange','En progreso':'badge-blue','Completado':'badge-green' };
    const aprobInfo = {
      aceptado:  { cls:'badge-green',  txt:'Aceptado' },
      rechazado: { cls:'badge-red',    txt:'Rechazado' },
      pendiente: { cls:'badge-orange', txt:'Por revisar' },
    };
    grid.innerHTML = `<div class="proyectos-grid">${proyectos.map(p => {
      const pct      = p.Progreso || 0;
      const barFill  = pct === 100 ? 'var(--green)' : 'var(--blue)';
      const aprob    = aprobInfo[p.EstadoAprobacion || 'pendiente'];
      return `<div class="proyecto-card" onclick="verDetalle(${p.ProyectoID})">
        <div class="proyecto-card-top">
          <div><div class="proyecto-titulo">${p.Titulo}</div><div class="proyecto-alumno">👤 ${p.NombreAlumno || 'Sin alumno'}</div></div>
          <span class="badge ${colores[p.Estatus]||'badge-gray'}">${p.Estatus}</span>
        </div>
        ${p.Descripcion ? `<div class="proyecto-desc">${p.Descripcion.substring(0,100)}${p.Descripcion.length>100?'…':''}</div>` : ''}
        <div class="progress-bar-wrap">
          <div class="progress-bar-label"><span>Progreso</span><span>${pct}% · ${p.EtapasCompletadas||0}/${p.TotalEtapas||0} etapas</span></div>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${pct}%;background:${barFill}"></div></div>
        </div>
        <div class="proyecto-footer">
          <span class="badge ${aprob.cls}">${aprob.txt}</span>
          <span>📅 ${p.FechaInicio ? new Date(p.FechaInicio+'T12:00:00').toLocaleDateString('es-MX') : '—'}</span>
          ${p.FechaFin ? `<span>🏁 ${new Date(p.FechaFin+'T12:00:00').toLocaleDateString('es-MX')}</span>` : ''}
        </div>
        <button class="btn btn-primary btn-sm" style="margin-top:10px;width:100%"
          onclick="event.stopPropagation();revisarProyecto(${p.ProyectoID})">Revisar</button>
      </div>`;
    }).join('')}</div>`;
  } catch(e) {
    grid.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Error al cargar proyectos</div>';
  }
}

function renderStats(proyectos) {
  const total = proyectos.length;
  const comp  = proyectos.filter(p => p.Estatus === 'Completado').length;
  const prog  = proyectos.filter(p => p.Estatus === 'En progreso').length;
  const pend  = proyectos.filter(p => p.Estatus === 'Pendiente').length;
  document.getElementById('prof-stats').innerHTML = [
    ['Proyectos',   'Asignados',   total, 'var(--blue)'],
    ['En progreso', 'Activos',     prog,  'var(--blue)'],
    ['Pendientes',  'Sin iniciar', pend,  'var(--orange)'],
    ['Completados', 'Finalizados', comp,  'var(--green)'],
  ].map(([lbl, sub, val, color]) => `
    <div class="stat-card" style="--card-color:${color}">
      <div class="stat-label">${lbl}</div>
      <div class="stat-value">${val}</div>
      <div class="stat-sub">${sub}</div>
    </div>`).join('');
}

async function verDetalle(proyectoId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-detalle').classList.add('active');
  document.getElementById('page-title').textContent    = 'Detalle del proyecto';
  document.getElementById('page-subtitle').textContent = 'Etapas y progreso del alumno';
  try {
    const p      = await fetch(`${API}/proyectos/${proyectoId}`).then(r => r.json());
    const colores = { 'Pendiente':'badge-orange','En progreso':'badge-blue','Completado':'badge-green' };
    document.getElementById('det-titulo').textContent  = p.Titulo;
    document.getElementById('det-alumno').textContent  = `Alumno: ${p.NombreAlumno || '—'}`;
    const badge = document.getElementById('det-badge');
    badge.textContent = p.Estatus;
    badge.className   = `badge ${colores[p.Estatus]||'badge-gray'}`;
    const pct = p.Progreso || 0;
    document.getElementById('det-progreso-pct').textContent = `${pct}%`;
    const bar = document.getElementById('det-progreso-bar');
    bar.style.width      = `${pct}%`;
    bar.style.background = pct === 100 ? 'var(--green)' : pct > 0 ? 'var(--blue)' : 'var(--border)';
    document.getElementById('det-meta').innerHTML = [
      ['Alumno',       p.NombreAlumno || '—'],
      ['Fecha inicio', p.FechaInicio ? new Date(p.FechaInicio+'T12:00:00').toLocaleDateString('es-MX') : '—'],
      ['Fecha fin',    p.FechaFin    ? new Date(p.FechaFin+'T12:00:00').toLocaleDateString('es-MX')    : 'Sin definir'],
      ['Progreso',     `${pct}%`],
    ].map(([lbl, val]) => `<div class="meta-card"><div class="meta-label">${lbl}</div><div class="meta-value">${val}</div></div>`).join('');
    await loadDetEtapas(proyectoId);
  } catch(e) { toast('Error al cargar proyecto', 'red'); }
}

async function loadDetEtapas(proyectoId) {
  const container = document.getElementById('det-etapas');
  try {
    const etapas = await fetch(`${API}/proyectos/${proyectoId}/etapas`).then(r => r.json());
    if (!Array.isArray(etapas) || !etapas.length) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Este proyecto no tiene etapas definidas.</div>';
      return;
    }
    container.innerHTML = etapas.map(e => `
      <div class="etapa-item">
        <div style="width:20px;height:20px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;${e.Completada ? 'background:var(--green);border-color:var(--green)' : ''}">
          ${e.Completada ? '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><polyline points="20,6 9,17 4,12"/></svg>' : ''}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;color:${e.Completada ? 'var(--text-muted)':'var(--text)'};text-decoration:${e.Completada?'line-through':'none'}">${e.Nombre}</div>
          ${e.Descripcion ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">${e.Descripcion}</div>` : ''}
          ${e.FechaFin    ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px">📅 ${new Date(e.FechaFin+'T12:00:00').toLocaleDateString('es-MX')}</div>` : ''}
        </div>
        <span class="badge ${e.Completada ? 'badge-green' : 'badge-gray'}">${e.Completada ? 'Completada' : 'Pendiente'}</span>
      </div>`).join('');
  } catch(e) {
    container.innerHTML = '<div style="color:var(--red);font-size:13px">Error al cargar etapas</div>';
  }
}

function toast(msg, type='green') {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  document.getElementById('toast-dot').className   = `toast-dot ${type}`;
  t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000);
}

function openModalRev()  { document.getElementById('modal-revisar').classList.add('open'); }
function cerrarRevisar() { document.getElementById('modal-revisar').classList.remove('open'); }

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

async function revisarProyecto(proyectoId) {
  const body = document.getElementById('rev-body');
  const foot = document.getElementById('rev-foot');
  body.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Cargando...</div>';
  openModalRev();

  try {
    const data = await fetch(`${API}/proyectos/${proyectoId}/detalles`).then(r => r.json());
    const p    = data.proyecto;
    const docs = data.documentos || [];

    document.getElementById('rev-title').textContent = `Revisar — ${p.Titulo}`;

    const aprobBadge = {
      aceptado:  '<span class="badge badge-green">Ya aceptado</span>',
      rechazado: '<span class="badge badge-red">Ya rechazado</span>',
      pendiente: '<span class="badge badge-orange">Pendiente de tu revisión</span>',
    }[p.EstadoAprobacion || 'pendiente'];

    body.innerHTML = `
      <div style="margin-bottom:16px">${aprobBadge}</div>

      <div style="margin-bottom:20px">
        <div style="font-size:12px;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">De qué trata el proyecto</div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;line-height:1.6;color:var(--text)">
          ${p.Descripcion ? p.Descripcion.replace(/\n/g,'<br>') : '<span style="color:var(--text-muted)">El alumno no incluyó descripción</span>'}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:20px">
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Alumno</div>
          <div style="font-size:14px;font-weight:500">${p.NombreAlumno || '—'}</div>
          <div style="font-size:11px;color:var(--text-muted)">${p.EmailAlumno || ''}</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Fecha inicio</div>
          <div style="font-size:14px;font-weight:500">${p.FechaInicio ? new Date(p.FechaInicio).toLocaleDateString('es-MX') : '—'}</div>
        </div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Fecha fin</div>
          <div style="font-size:14px;font-weight:500">${p.FechaFin ? new Date(p.FechaFin).toLocaleDateString('es-MX') : 'Por definir'}</div>
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.NombreArchivo}</div>
                <div style="font-size:11px;color:var(--text-muted)">${formatBytes(d.TamanoBytes)} · ${new Date(d.CreatedAt).toLocaleDateString('es-MX')}</div>
              </div>
              <a href="${API}/documentos/${d.DocumentoID}/ver" target="_blank" class="btn btn-ghost btn-sm">Ver</a>
              <a href="${API}/documentos/${d.DocumentoID}/descargar" class="btn btn-primary btn-sm">Descargar</a>
            </div>`).join('')
        }
      </div>

      <div>
        <div style="font-size:12px;color:var(--text-dim);font-weight:500;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Tu comentario (obligatorio para rechazar)</div>
        <textarea id="rev-comentario" class="form-control" rows="4" style="resize:vertical;width:100%" placeholder="Escribe tu retroalimentación al alumno...">${p.ComentarioRevision || ''}</textarea>
      </div>`;

    foot.innerHTML = `
      <button class="btn btn-ghost" onclick="cerrarRevisar()">Cancelar</button>
      <button class="btn btn-danger" onclick="enviarRevision(${proyectoId},'rechazado')">Rechazar</button>
      <button class="btn btn-primary" onclick="enviarRevision(${proyectoId},'aceptado')">Aceptar proyecto</button>`;
  } catch(e) {
    body.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Error al cargar</div>';
  }
}

async function enviarRevision(proyectoId, estado) {
  const comentario = (document.getElementById('rev-comentario')?.value || '').trim();
  if (estado === 'rechazado' && !comentario) {
    return toast('Para rechazar necesitas dejar un comentario', 'red');
  }
  try {
    await fetch(`${API}/proyectos/${proyectoId}/revisar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ EstadoAprobacion: estado, ComentarioRevision: comentario })
    });
    toast(estado === 'aceptado' ? '✓ Proyecto aceptado' : 'Proyecto rechazado');
    cerrarRevisar();
    loadMisProyectos();
  } catch(e) {
    toast('Error al guardar la revisión', 'red');
  }
}
