const API = 'http://localhost:3000/api';

const inscripcion = {
  eventoId:      null,
  eventoNombre:  null,
  titulo:        '',
  participantes: [],
  asesores:      [],
  descripcion:   '',
  archivo:       null,
};

let user           = null;
let miProyecto     = null;
let etapasActuales = [];
let pasoActual     = 1;
let proyectoActualId = null;

let todosAlumnos   = [];
let todosProfesores = [];

document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('user');
  if (!raw) return window.location.href = 'login.html';

  user = JSON.parse(raw);
  if (user.rol !== 'Alumno') return window.location.href = 'login.html';

  document.getElementById('nav-nombre').textContent = user.nombre;
  document.getElementById('nav-avatar').textContent = user.nombre[0].toUpperCase();

  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });

  initUploadZone();
  loadMiProyecto();
  precargarUsuarios();
});

function showSection(id, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('section-' + id).classList.add('active');
  if (el) el.classList.add('active');

  const titulos = {
    'mi-proyecto':       ['Mi proyecto',         'Progreso y etapas'],
    'inscribir':         ['Inscribir a evento',   'Registra tu proyecto en un evento'],
    'mis-inscripciones': ['Mis inscripciones',    'Estado de tus solicitudes'],
  };

  const [t, s] = titulos[id] || [id, ''];
  document.getElementById('page-title').textContent    = t;
  document.getElementById('page-subtitle').textContent = s;

  if (id === 'inscribir') {
    loadEventosDisponibles();
    setTimeout(() => {
      const btnPaso2 = document.getElementById('btn-paso-2');
      if (btnPaso2) btnPaso2.disabled = true;
    }, 100);
  }
  if (id === 'mis-inscripciones') loadMisInscripciones();
}

function logout() {
  sessionStorage.removeItem('user');
  window.location.href = 'login.html';
}

function toast(msg, type = 'green') {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  document.getElementById('toast-dot').className   = `toast-dot ${type}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

async function loadMiProyecto() {
  const container = document.getElementById('proyecto-content');
  try {
    const data      = await fetch(`${API}/proyectos/por-alumno/${user.id}`).then(r => r.json());
    const proyectos = Array.isArray(data) ? data : [];

    if (!proyectos.length) {
      container.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/>
          </svg>
          <h3>Sin proyecto asignado</h3>
          <p>Todavía no tienes un proyecto.<br>Contacta a tu profesor o administrador.</p>
        </div>`;
      return;
    }

    miProyecto       = proyectos[0];
    proyectoActualId = miProyecto.ProyectoID;
    const pct  = miProyecto.Progreso || 0;
    const colores = { 'Pendiente':'badge-orange', 'En progreso':'badge-blue', 'Completado':'badge-green' };
    const barFill  = pct === 100 ? 'var(--green)' : pct > 0 ? 'var(--blue)' : 'var(--border)';

    document.getElementById('page-title').textContent    = miProyecto.Titulo;
    document.getElementById('page-subtitle').textContent = miProyecto.Descripcion
      ? miProyecto.Descripcion.substring(0, 80) + '…'
      : 'Sin descripción';

    container.innerHTML = `
      <div class="meta-grid">
        <div class="meta-card">
          <div class="meta-label">Estado</div>
          <div class="meta-value"><span class="badge ${colores[miProyecto.Estatus] || 'badge-gray'}">${miProyecto.Estatus}</span></div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Profesor</div>
          <div class="meta-value">${miProyecto.NombreProfesor || '<span style="color:var(--text-muted)">Sin asignar</span>'}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Fecha inicio</div>
          <div class="meta-value">${miProyecto.FechaInicio ? formatFecha(miProyecto.FechaInicio) : '—'}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Fecha fin</div>
          <div class="meta-value">${miProyecto.FechaFin ? formatFecha(miProyecto.FechaFin) : 'Por definir'}</div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-title">
          <span>Progreso del proyecto</span>
          <span id="pct-display" style="font-size:24px;font-weight:800;font-family:'Syne',sans-serif;color:${pct===100?'var(--green)':'var(--blue)'}">${pct}%</span>
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
        <div class="section-card-title">
          <span>Mis etapas</span>
          <span style="font-size:12px;color:var(--text-muted);font-weight:400">Toca para marcar completada</span>
        </div>
        <div id="etapas-container" style="display:flex;flex-direction:column;gap:10px">
          <div style="color:var(--text-muted);font-size:13px">Cargando...</div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-title">
          <span>Estado de aprobación</span>
        </div>
        <div id="aprob-container">
          <div style="color:var(--text-muted);font-size:13px">Cargando estado...</div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-card-title">
          <span>Documentos de mi proyecto</span>
          <button class="btn btn-primary btn-sm" onclick="abrirSubir()">+ Subir documento</button>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin:-8px 0 14px 0">
          Sube archivos que expliquen de qué trata tu proyecto. Tu profesor los revisará para decidir si lo acepta.
        </p>
        <div id="docs-container">
          <div style="color:var(--text-muted);font-size:13px">Cargando...</div>
        </div>
      </div>`;

    await loadEtapas(miProyecto.ProyectoID);
    cargarEstadoAprobacion(miProyecto.ProyectoID);
    cargarDocumentos(miProyecto.ProyectoID);
  } catch(e) {
    container.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Error al cargar tu proyecto.</div>';
  }
}

async function loadEtapas(proyectoId) {
  const container = document.getElementById('etapas-container');
  const label     = document.getElementById('etapas-label');
  try {
    const etapas    = await fetch(`${API}/proyectos/${proyectoId}/etapas`).then(r => r.json());
    etapasActuales  = Array.isArray(etapas) ? etapas : [];
    const comp      = etapasActuales.filter(e => e.Completada).length;

    if (label) label.textContent = `${comp} de ${etapasActuales.length} etapas`;

    if (!etapasActuales.length) {
      if (container) container.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Tu profesor aún no ha definido etapas.</div>';
      return;
    }

    renderEtapas(proyectoId);
  } catch(e) {
    if (container) container.innerHTML = '<div style="color:var(--red);font-size:13px">Error al cargar etapas</div>';
  }
}

function renderEtapas(proyectoId) {
  const container = document.getElementById('etapas-container');
  if (!container) return;

  container.innerHTML = etapasActuales.map((e, i) => `
    <div class="etapa-row ${e.Completada ? 'done' : ''}"
         onclick="toggleEtapa(${e.EtapaID}, ${!e.Completada}, ${proyectoId})"
         id="row-${e.EtapaID}">
      <div class="etapa-checkbox">
        ${e.Completada
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><polyline points="20,6 9,17 4,12"/></svg>'
          : ''}
      </div>
      <div style="flex:1;min-width:0">
        <div class="etapa-nombre">${e.Nombre}</div>
        ${e.Descripcion ? `<div style="font-size:12px;color:var(--text-muted);margin-top:3px">${e.Descripcion}</div>` : ''}
        ${e.FechaFin    ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">📅 Límite: ${formatFecha(e.FechaFin)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        <span class="badge ${e.Completada ? 'badge-green' : 'badge-gray'}">${e.Completada ? '✓ Completada' : 'Pendiente'}</span>
        <span style="font-size:11px;color:var(--text-muted)">${i+1}/${etapasActuales.length}</span>
      </div>
    </div>`).join('');
}

async function toggleEtapa(etapaId, completada, proyectoId) {
  const etapa = etapasActuales.find(e => e.EtapaID === etapaId);
  if (!etapa) return;
  etapa.Completada = completada;
  renderEtapas(proyectoId);

  try {
    const res  = await fetch(`${API}/etapas/${etapaId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Completada: completada })
    });
    const data = await res.json();
    const pct  = data.progreso ?? 0;

    const bar  = document.getElementById('main-bar');
    const disp = document.getElementById('pct-display');
    const lbl  = document.getElementById('etapas-label');
    const comp = etapasActuales.filter(e => e.Completada).length;

    if (bar)  { bar.style.width = `${pct}%`; bar.style.background = pct===100?'var(--green)':pct>0?'var(--blue)':'var(--border)'; }
    if (disp) { disp.textContent = `${pct}%`; disp.style.color = pct===100?'var(--green)':'var(--blue)'; }
    if (lbl)  { lbl.textContent  = `${comp} de ${etapasActuales.length} etapas`; }

    toast(completada ? '✓ Etapa completada' : 'Marcada como pendiente');

    if (pct === 100) setTimeout(() => document.getElementById('celebracion').classList.add('show'), 600);

  } catch(err) {
    etapa.Completada = !completada;
    renderEtapas(proyectoId);
    toast('Error al actualizar', 'red');
  }
}

function irPaso(num) {
  if (num === 2 && !inscripcion.eventoId) {
    return toast('Selecciona un evento primero', 'orange');
  }

  if (num === 4) {
    const titulo = document.getElementById('inscripcion-titulo').value.trim();
    const desc   = document.getElementById('inscripcion-descripcion').value.trim();

    if (!titulo) return toast('Escribe el nombre del proyecto', 'orange');
    if (!desc)   return toast('Escribe la descripción del proyecto', 'orange');

    inscripcion.titulo       = titulo;
    inscripcion.descripcion  = desc;
    renderResumen();
  }

  [1, 2, 3, 4].forEach(n => {
    const el = document.getElementById(`paso-${n}`);
    if (el) el.style.display = 'none';
  });

  const target = document.getElementById(`paso-${num}`);
  if (target) target.style.display = 'block';

  pasoActual = num;
  actualizarSteps(num);
}

function actualizarSteps(actual) {
  [1,2,3,4].forEach(n => {
    const el = document.getElementById(`step-${n}`);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (n < actual)  el.classList.add('done');
    if (n === actual) el.classList.add('active');
  });
}

async function loadEventosDisponibles() {
  const grid = document.getElementById('eventos-disponibles');
  try {
    const data = await fetch(`${API}/eventos`).then(r => r.json());
    const disponibles = Array.isArray(data)
      ? data.filter(e => ['proximo','activo'].includes(e.Estado))
      : [];

    if (!disponibles.length) {
      grid.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          <h3>Sin eventos disponibles</h3>
          <p>No hay eventos activos o próximos en este momento.</p>
        </div>`;
      return;
    }

    grid.innerHTML = disponibles.map(ev => {
      const [y,m,d] = (ev.Fecha.split('T')[0]).split('-');
      const fecha   = new Date(+y,+m-1,+d).toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
      const selected = inscripcion.eventoId === ev.EventoID;
      return `
        <div class="evento-card ${selected ? 'selected' : ''}" onclick="seleccionarEvento(${ev.EventoID}, '${ev.Nombre.replace(/'/g,"\\'")}', this)">
          <div class="evento-card-nombre">${ev.Nombre}</div>
          <div class="evento-card-fecha">📅 ${fecha}</div>
          <div class="evento-card-hora">🕐 ${ev.HoraInicio} – ${ev.HoraFin}</div>
          ${ev.Descripcion ? `<p style="font-size:12px;color:var(--text-muted);margin-top:8px;line-height:1.5">${ev.Descripcion}</p>` : ''}
          <div style="margin-top:12px">
            <span class="badge ${ev.Estado==='activo'?'badge-green':'badge-blue'}">${ev.Estado==='activo'?'Activo':'Próximo'}</span>
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    grid.innerHTML = '<div style="color:var(--red);font-size:13px">Error al cargar eventos</div>';
  }
}

function seleccionarEvento(id, nombre, el) {
  inscripcion.eventoId     = id;
  inscripcion.eventoNombre = nombre;

  document.querySelectorAll('.evento-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  const btnPaso2 = document.getElementById('btn-paso-2');
  if (btnPaso2) {
    btnPaso2.disabled       = false;
    btnPaso2.style.opacity  = '1';
    btnPaso2.style.cursor   = 'pointer';
  }

  toast(`Evento seleccionado: ${nombre}`);
}

async function precargarUsuarios() {
  try {
    const data = await fetch(`${API}/usuarios`).then(r => r.json());
    if (!Array.isArray(data)) return;
    todosAlumnos    = data.filter(u => u.Rol === 'Alumno'   && u.Activo && u.UsuarioID !== user.id);
    todosProfesores = data.filter(u => u.Rol === 'Profesor' && u.Activo);
  } catch(e) {}
}

function buscarAlumnos(q) {
  const container = document.getElementById('resultados-participante');
  if (!q.trim()) { container.innerHTML = ''; return; }

  const results = todosAlumnos.filter(u =>
    u.Nombre.toLowerCase().includes(q.toLowerCase()) ||
    u.Email.toLowerCase().includes(q.toLowerCase())
  );

  if (!results.length) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:8px">Sin resultados</div>';
    return;
  }

  container.innerHTML = results.map(u => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:border-color .15s"
         onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--border)'"
         onclick="agregarParticipante(${u.UsuarioID},'${u.Nombre.replace(/'/g,"\\'")}')">
      <div class="participante-avatar">${u.Nombre[0].toUpperCase()}</div>
      <div>
        <div style="font-size:13px;font-weight:500;color:var(--text)">${u.Nombre}</div>
        <div style="font-size:11px;color:var(--text-muted)">${u.Email}</div>
      </div>
    </div>`).join('');
}

function buscarProfesores(q) {
  const container = document.getElementById('resultados-asesor');
  if (!q.trim()) { container.innerHTML = ''; return; }

  const results = todosProfesores.filter(u =>
    u.Nombre.toLowerCase().includes(q.toLowerCase()) ||
    u.Email.toLowerCase().includes(q.toLowerCase())
  );

  if (!results.length) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:8px">Sin resultados</div>';
    return;
  }

  container.innerHTML = results.map(u => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:border-color .15s"
         onmouseover="this.style.borderColor='var(--blue)'" onmouseout="this.style.borderColor='var(--border)'"
         onclick="agregarAsesor(${u.UsuarioID},'${u.Nombre.replace(/'/g,"\\'")}')">
      <div class="participante-avatar" style="background:var(--green)">${u.Nombre[0].toUpperCase()}</div>
      <div>
        <div style="font-size:13px;font-weight:500;color:var(--text)">${u.Nombre}</div>
        <div style="font-size:11px;color:var(--text-muted)">${u.Email}</div>
      </div>
    </div>`).join('');
}

function agregarParticipante(id, nombre) {
  if (inscripcion.participantes.find(p => p.id === id)) {
    return toast('Este alumno ya está en la lista', 'orange');
  }
  inscripcion.participantes.push({ id, nombre, rol: 'Participante' });
  renderListaParticipantes();
  closeModal('modal-agregar-participante');
  document.getElementById('buscar-participante').value = '';
  document.getElementById('resultados-participante').innerHTML = '';
  toast(`${nombre} agregado como participante`);
}

function agregarAsesor(id, nombre) {
  if (inscripcion.asesores.find(a => a.id === id)) {
    return toast('Este profesor ya está en la lista', 'orange');
  }
  inscripcion.asesores.push({ id, nombre });
  renderListaAsesores();
  closeModal('modal-agregar-asesor');
  document.getElementById('buscar-asesor').value = '';
  document.getElementById('resultados-asesor').innerHTML = '';
  toast(`${nombre} agregado como asesor`);
}

function renderListaParticipantes() {
  const lista = document.getElementById('lista-participantes');

  const lider = `
    <div class="participante-item">
      <div class="participante-avatar">${user.nombre[0].toUpperCase()}</div>
      <div class="participante-info">
        <div class="participante-nombre">${user.nombre}</div>
        <div class="participante-rol">Líder del proyecto</div>
      </div>
      <span class="badge badge-green">Tú</span>
    </div>`;

  const resto = inscripcion.participantes.map((p, i) => `
    <div class="participante-item">
      <div class="participante-avatar">${p.nombre[0].toUpperCase()}</div>
      <div class="participante-info">
        <div class="participante-nombre">${p.nombre}</div>
        <div class="participante-rol">Participante</div>
      </div>
      <button class="participante-remove" onclick="quitarParticipante(${i})" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');

  lista.innerHTML = lider + resto;
}

function renderListaAsesores() {
  const lista = document.getElementById('lista-asesores');
  if (!inscripcion.asesores.length) {
    lista.innerHTML = '<div style="font-size:13px;color:var(--text-muted);padding:8px 0">Sin asesores agregados.</div>';
    return;
  }
  lista.innerHTML = inscripcion.asesores.map((a, i) => `
    <div class="participante-item">
      <div class="participante-avatar" style="background:var(--green)">${a.nombre[0].toUpperCase()}</div>
      <div class="participante-info">
        <div class="participante-nombre">${a.nombre}</div>
        <div class="participante-rol">Asesor</div>
      </div>
      <button class="participante-remove" onclick="quitarAsesor(${i})" title="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');
}

function quitarParticipante(i) {
  inscripcion.participantes.splice(i, 1);
  renderListaParticipantes();
}

function quitarAsesor(i) {
  inscripcion.asesores.splice(i, 1);
  renderListaAsesores();
}

function initUploadZone() {
  const zone  = document.getElementById('upload-zone');
  const input = document.getElementById('file-input');
  if (!zone || !input) return;

  zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) handleFile(input.files[0]);
  });
}

function handleFile(file) {
  if (file.type !== 'application/pdf') {
    return toast('Solo se permiten archivos PDF', 'red');
  }
  if (file.size > 10 * 1024 * 1024) {
    return toast('El archivo no debe superar 10 MB', 'red');
  }
  inscripcion.archivo = file;
  const display = document.getElementById('file-name-display');
  display.textContent    = `📎 ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
  display.style.display  = 'block';
  toast(`Archivo cargado: ${file.name}`);
}

function renderResumen() {
  const container = document.getElementById('resumen-inscripcion');

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">

      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Evento</div>
          <div style="font-size:14px;font-weight:500">${inscripcion.eventoNombre || '—'}</div>
        </div>

        <div style="flex:1;min-width:200px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Proyecto</div>
          <div style="font-size:14px;font-weight:500">${inscripcion.titulo || '—'}</div>
        </div>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
          Participantes (${inscripcion.participantes.length + 1})
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="font-size:13px;color:var(--text)">👑 ${user.nombre} <span style="color:var(--text-muted)">(Líder)</span></div>
          ${inscripcion.participantes.map(p => `
            <div style="font-size:13px;color:var(--text)">• ${p.nombre}</div>
          `).join('')}
        </div>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
          Asesores
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${
            inscripcion.asesores.length
              ? inscripcion.asesores.map(a => `<div style="font-size:13px;color:var(--text)">• ${a.nombre}</div>`).join('')
              : '<div style="font-size:13px;color:var(--text-muted)">Sin asesores registrados</div>'
          }
        </div>
      </div>

      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Descripción</div>
        <div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap">${inscripcion.descripcion || '—'}</div>
      </div>

      ${
        inscripcion.archivo
          ? `
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Documento</div>
            <div style="font-size:13px;color:var(--green)">📎 ${inscripcion.archivo.name}</div>
          </div>
          `
          : ''
      }
    </div>
  `;
}

async function confirmarInscripcion() {
  if (!inscripcion.eventoId)    return toast('Selecciona un evento', 'orange');
  if (!inscripcion.titulo)      return toast('Falta el nombre del proyecto', 'orange');
  if (!inscripcion.descripcion) return toast('Falta la descripción del proyecto', 'orange');

  const btn = document.getElementById('btn-confirmar');
  btn.disabled    = true;
  btn.textContent = 'Enviando...';

  try {
    let proyectoId = miProyecto?.ProyectoID || null;
    const profesorPrincipalId = inscripcion.asesores.length ? inscripcion.asesores[0].id : null;

    if (!proyectoId) {
      const hoy = new Date().toISOString().slice(0, 10);

      const resProyecto = await fetch(`${API}/proyectos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Titulo:      inscripcion.titulo,
          Descripcion: inscripcion.descripcion,
          FechaInicio: hoy,
          AlumnoID:    user.id,
          ProfesorID:  profesorPrincipalId
        })
      });

      const dataProyecto = await resProyecto.json();
      if (!resProyecto.ok) throw new Error(dataProyecto.message || 'Error al crear el proyecto');

      proyectoId = dataProyecto.ProyectoID;
      miProyecto = {
        ProyectoID:  proyectoId,
        Titulo:      inscripcion.titulo,
        Descripcion: inscripcion.descripcion,
        AlumnoID:    user.id,
        ProfesorID:  profesorPrincipalId,
        Estatus:     'Pendiente',
        Progreso:    0
      };
    } else {
      const resUpdate = await fetch(`${API}/proyectos/${proyectoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Titulo: inscripcion.titulo, Descripcion: inscripcion.descripcion })
      });
      const dataUpdate = await resUpdate.json().catch(() => ({}));
      if (!resUpdate.ok) throw new Error(dataUpdate.message || 'Error al actualizar el proyecto');

      if (profesorPrincipalId) {
        await fetch(`${API}/proyectos/${proyectoId}/asignar-profesor`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ProfesorID: profesorPrincipalId })
        });
      }
    }

    const participantesPayload = [
      { id: user.id, rol: 'Lider' },
      ...inscripcion.participantes.map(p => ({ id: p.id, rol: 'Participante' }))
    ].filter((p, index, arr) =>
      p.id && arr.findIndex(x => x.id === p.id) === index
    );

    const resInscripcion = await fetch(`${API}/eventos/proyectos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        EventoID:     inscripcion.eventoId,
        ProyectoID:   proyectoId,
        Descripcion:  inscripcion.descripcion,
        Participantes: participantesPayload,
        Asesores:     inscripcion.asesores.map(a => a.id)
      })
    });

    const dataInscripcion = await resInscripcion.json();
    if (!resInscripcion.ok) throw new Error(dataInscripcion.message || 'Error al inscribir el proyecto');

    inscripcion.eventoId      = null;
    inscripcion.eventoNombre  = null;
    inscripcion.titulo        = '';
    inscripcion.participantes = [];
    inscripcion.asesores      = [];
    inscripcion.descripcion   = '';
    inscripcion.archivo       = null;

    document.getElementById('inscripcion-titulo').value      = '';
    document.getElementById('inscripcion-descripcion').value = '';
    document.getElementById('file-input').value              = '';

    const fileName = document.getElementById('file-name-display');
    if (fileName) { fileName.textContent = ''; fileName.style.display = 'none'; }

    irPaso(1);
    actualizarSteps(1);

    toast('¡Inscripción enviada! El administrador la revisará pronto. 🎉');

    setTimeout(() => {
      showSection('mis-inscripciones', document.querySelector('[onclick*="mis-inscripciones"]'));
    }, 1200);

  } catch(e) {
    toast(e.message || 'Error al enviar la inscripción', 'red');
  } finally {
    btn.disabled    = false;
    btn.innerHTML   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg> Enviar inscripción';
  }
}

async function loadMisInscripciones() {
  const container = document.getElementById('inscripciones-content');
  if (!miProyecto) await loadMiProyecto();
  if (!miProyecto) {
    container.innerHTML = `
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
        <h3>Sin proyecto</h3>
        <p>Necesitas tener un proyecto asignado para ver inscripciones.</p>
      </div>`;
    return;
  }

  container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px">Cargando...</div>';

  try {
    const data = await fetch(`${API}/eventos/proyectos?proyectoId=${miProyecto.ProyectoID}`).then(r => r.json());
    const inscripciones = Array.isArray(data) ? data : [];

    const pendientes = inscripciones.filter(i => i.Estado === 'pendiente').length;
    const badge = document.getElementById('badge-inscripciones');
    if (pendientes > 0) {
      badge.textContent   = pendientes;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }

    if (!inscripciones.length) {
      container.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <h3>Sin inscripciones</h3>
          <p>Aún no has inscrito tu proyecto a ningún evento.<br>
             <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="showSection('inscribir', document.querySelector('[onclick*=inscribir]'))">Inscribir a evento</button>
          </p>
        </div>`;
      return;
    }

    const colores = { pendiente:'badge-orange', aceptado:'badge-green', rechazado:'badge-red' };
    const iconos  = { pendiente:'⏳', aceptado:'✅', rechazado:'❌' };

    container.innerHTML = inscripciones.map(i => `
      <div class="inscripcion-card">
        <div class="inscripcion-header">
          <div>
            <div class="inscripcion-titulo">${i.NombreEvento || '—'}</div>
            <div class="inscripcion-evento">Proyecto: ${i.TituloProyecto || miProyecto.Titulo}</div>
          </div>
          <span class="badge ${colores[i.Estado] || 'badge-gray'}">
            ${iconos[i.Estado] || ''} ${i.Estado.charAt(0).toUpperCase() + i.Estado.slice(1)}
          </span>
        </div>

        ${i.Estado === 'aceptado' ? `
          <div style="background:rgba(34,197,160,.08);border:1px solid rgba(34,197,160,.2);border-radius:8px;padding:12px 14px;font-size:13px;color:var(--green);margin-bottom:12px">
            🎉 Tu proyecto fue aceptado. El administrador asignará horario y sala próximamente.
          </div>` : ''}

        ${i.Estado === 'rechazado' ? `
          <div style="background:rgba(232,64,64,.08);border:1px solid rgba(232,64,64,.2);border-radius:8px;padding:12px 14px;font-size:13px;color:var(--red);margin-bottom:12px">
            Tu inscripción fue rechazada. Puedes volver a intentarlo en otro evento.
          </div>` : ''}

        <div class="inscripcion-meta">
          <span>📅 Inscrito: ${i.CreatedAt ? new Date(i.CreatedAt).toLocaleDateString('es-MX') : '—'}</span>
          ${i.NombreAula  ? `<span>🏫 Aula: ${i.NombreAula}</span>`           : ''}
          ${i.HoraInicio  ? `<span>🕐 ${i.HoraInicio} – ${i.HoraFin}</span>` : ''}
          ${i.Evaluadores ? `<span>👨‍🏫 Evaluadores: ${i.Evaluadores}</span>` : ''}
        </div>
      </div>`).join('');

  } catch(e) {
    container.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Error al cargar inscripciones</div>';
  }
}

function formatFecha(fecha) {
  const [y,m,d] = (fecha.split('T')[0]).split('-');
  return new Date(+y,+m-1,+d).toLocaleDateString('es-MX');
}

function abrirSubir()  { document.getElementById('modal-subir-doc').classList.add('open'); }
function cerrarSubir() {
  document.getElementById('modal-subir-doc').classList.remove('open');
  document.getElementById('doc-file').value = '';
  document.getElementById('doc-desc').value = '';
}

function formatBytesDoc(bytes) {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

async function subirDocumento() {
  const file = document.getElementById('doc-file').files[0];
  const desc = document.getElementById('doc-desc').value.trim();

  if (!file)  return toast('Selecciona un archivo', 'red');
  if (file.size > 25 * 1024 * 1024) return toast('El archivo excede 25 MB', 'red');
  if (!proyectoActualId) return toast('No hay proyecto activo', 'red');

  const btn = document.getElementById('btn-subir-doc');
  btn.disabled    = true;
  btn.textContent = 'Subiendo...';

  try {
    const base64 = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result.split(',')[1]);
      r.onerror = () => reject(new Error('No se pudo leer el archivo'));
      r.readAsDataURL(file);
    });

    const res = await fetch(`${API}/proyectos/${proyectoActualId}/documentos`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        NombreArchivo:   file.name,
        MimeType:        file.type || 'application/octet-stream',
        ContenidoBase64: base64,
        Descripcion:     desc,
        SubidoPorID:     user.id
      })
    });
    if (!res.ok) throw new Error('Fallo al subir');
    toast('✓ Documento subido');
    cerrarSubir();
    cargarDocumentos(proyectoActualId);
  } catch(e) {
    toast('Error al subir el documento', 'red');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Subir';
  }
}

async function eliminarDocumento(docId) {
  if (!confirm('¿Eliminar este documento?')) return;
  try {
    await fetch(`${API}/documentos/${docId}`, { method: 'DELETE' });
    toast('Documento eliminado');
    cargarDocumentos(proyectoActualId);
  } catch(e) { toast('Error', 'red'); }
}

async function cargarDocumentos(proyectoId) {
  const cont = document.getElementById('docs-container');
  if (!cont) return;
  try {
    const docs = await fetch(`${API}/proyectos/${proyectoId}/documentos`).then(r => r.json());
    if (!Array.isArray(docs) || !docs.length) {
      cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Aún no has subido documentos. Sube al menos uno para que tu profesor pueda revisar tu proyecto.</div>';
      return;
    }
    cont.innerHTML = docs.map(d => `
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">
        <div style="width:36px;height:36px;border-radius:8px;background:var(--blue);display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.NombreArchivo}</div>
          <div style="font-size:11px;color:var(--text-muted)">
            ${formatBytesDoc(d.TamanoBytes)} · ${new Date(d.CreatedAt).toLocaleDateString('es-MX')}
            ${d.Descripcion ? ' · ' + d.Descripcion : ''}
          </div>
        </div>
        <a href="${API}/documentos/${d.DocumentoID}/ver" target="_blank" class="btn btn-ghost btn-sm">Ver</a>
        <a href="${API}/documentos/${d.DocumentoID}/descargar" class="btn btn-ghost btn-sm">Descargar</a>
        <button class="btn btn-danger btn-sm" onclick="eliminarDocumento(${d.DocumentoID})">✕</button>
      </div>`).join('');
  } catch(e) {
    cont.innerHTML = '<div style="color:var(--red);font-size:13px">Error al cargar documentos</div>';
  }
}

async function cargarEstadoAprobacion(proyectoId) {
  const cont = document.getElementById('aprob-container');
  if (!cont) return;
  try {
    const data   = await fetch(`${API}/proyectos/${proyectoId}/aprobacion`).then(r => r.json());
    const estado = data.EstadoAprobacion || 'pendiente';

    const config = {
      aceptado: {
        bg:    'rgba(34,197,160,.08)',
        border:'rgba(34,197,160,.35)',
        color: 'var(--green)',
        icon:  '✓',
        titulo:'Proyecto aceptado',
        sub:   `Tu profesor ${data.NombreProfesor || ''} aceptó tu proyecto. ¡Puedes continuar trabajando en las etapas!`
      },
      rechazado: {
        bg:    'rgba(239,68,68,.08)',
        border:'rgba(239,68,68,.35)',
        color: 'var(--red)',
        icon:  '✗',
        titulo:'Proyecto rechazado',
        sub:   `Tu profesor ${data.NombreProfesor || ''} rechazó tu proyecto. Revisa el comentario abajo.`
      },
      pendiente: {
        bg:    'rgba(245,158,11,.08)',
        border:'rgba(245,158,11,.35)',
        color: 'var(--orange)',
        icon:  '⏳',
        titulo:'Esperando revisión',
        sub:   data.NombreProfesor
          ? `Tu profesor ${data.NombreProfesor} aún no ha revisado tu proyecto.`
          : 'Aún no tienes un profesor asignado.'
      }
    }[estado];

    cont.innerHTML = `
      <div style="background:${config.bg};border:1.5px solid ${config.border};border-radius:12px;padding:18px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:${data.ComentarioRevision ? '12px':'0'}">
          <div style="width:40px;height:40px;border-radius:50%;background:${config.color};color:white;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;flex-shrink:0">${config.icon}</div>
          <div style="flex:1">
            <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:16px;color:${config.color}">${config.titulo}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:2px">${config.sub}</div>
          </div>
        </div>
        ${data.ComentarioRevision ? `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;line-height:1.5;color:var(--text)">
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Comentario del profesor</div>
            ${data.ComentarioRevision.replace(/\n/g,'<br>')}
            ${data.FechaRevision ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px">📅 ${new Date(data.FechaRevision).toLocaleString('es-MX')}</div>` : ''}
          </div>` : ''}
      </div>`;
  } catch(e) {}
}
