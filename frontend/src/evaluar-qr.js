const API = 'http://localhost:3000/api';

let user = null;
let tokenActual = '';
let evalData = null;

document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('user');

  if (!raw) {
    window.location.href = 'login.html';
    return;
  }

  user = normalizarUsuario(raw);

  if (!user || user.rol !== 'Profesor') {
    window.location.href = 'login.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  tokenActual = normalizarTokenQR(params.get('token') || sessionStorage.getItem('qr_eval_token') || '');

  if (document.getElementById('token-manual')) {
    document.getElementById('token-manual').value = tokenActual;
  }

  cargarEvaluacionQR();
});

function normalizarUsuario(raw) {
  try {
    const parsed = JSON.parse(raw);
    return {
      id: parsed.id || parsed.UsuarioID,
      nombre: parsed.nombre || parsed.Nombre,
      rol: parsed.rol || parsed.Rol,
    };
  } catch (_) {
    return null;
  }
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeDate(value) {
  if (!value) return 'Sin fecha';
  const str = String(value);
  const dateOnly = str.includes('T') ? str.split('T')[0] : str.split(' ')[0];
  const [y, m, d] = dateOnly.split('-').map(Number);
  if (!y || !m || !d) return 'Sin fecha';
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function safeTime(value) {
  if (!value) return 'Sin hora';
  return String(value).substring(0, 5);
}

function toast(message, type = 'green') {
  const t = document.getElementById('toast');
  const msg = document.getElementById('toast-msg');
  const dot = document.getElementById('toast-dot');

  if (!t || !msg || !dot) {
    alert(message);
    return;
  }

  msg.textContent = message;
  dot.style.background =
    type === 'red' ? 'var(--red)' :
    type === 'orange' ? 'var(--orange)' :
    'var(--green)';

  t.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('show'), 3200);
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

function cambiarTokenManual() {
  const manual = normalizarTokenQR(document.getElementById('token-manual')?.value || '');
  if (!manual) return toast('Pega un token QR valido', 'orange');

  tokenActual = manual;
  sessionStorage.setItem('qr_eval_token', tokenActual);
  const url = new URL(window.location.href);
  url.searchParams.set('token', tokenActual);
  window.history.replaceState({}, '', url);
  cargarEvaluacionQR();
}

async function cargarEvaluacionQR() {
  const tokenValue = document.getElementById('token-value');
  const projectSummary = document.getElementById('project-summary');
  const rubricContent = document.getElementById('rubric-content');
  const rubricTitle = document.getElementById('rubric-title');
  const saveBtn = document.getElementById('btn-save-eval');

  if (tokenValue) tokenValue.textContent = tokenActual || 'Sin token';
  if (saveBtn) saveBtn.disabled = true;

  if (!tokenActual) {
    if (projectSummary) projectSummary.innerHTML = '<div class="empty-state">Escanea un QR o pega el token para comenzar.</div>';
    if (rubricContent) rubricContent.innerHTML = '<div class="empty-state">Sin token cargado.</div>';
    if (rubricTitle) rubricTitle.textContent = 'Sin rubrica';
    actualizarPuntaje();
    return;
  }

  if (projectSummary) {
    projectSummary.innerHTML = `
      <div class="loader-line"></div>
      <div class="loader-line short"></div>
      <div class="loader-line tiny"></div>
    `;
  }

  if (rubricContent) rubricContent.innerHTML = '<div class="empty-state">Cargando criterios...</div>';

  try {
    const res = await fetch(`${API}/qr/${encodeURIComponent(tokenActual)}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'No se pudo cargar el QR');
    }

    evalData = data;
    sessionStorage.setItem('qr_eval_preview', JSON.stringify(data));

    renderProyecto(data);
    renderRubrica(data.rubrica);
    cargarDocumentos(data.proyecto?.ProyectoID);
    toast('QR cargado. Puedes evaluar el proyecto.');
  } catch (error) {
    console.error(error);
    evalData = null;

    if (projectSummary) {
      projectSummary.innerHTML = `<div class="empty-state error">${escapeHTML(error.message || 'Error al cargar QR')}</div>`;
    }
    if (rubricContent) rubricContent.innerHTML = '<div class="empty-state">No hay rubrica cargada.</div>';
    if (rubricTitle) rubricTitle.textContent = 'QR no disponible';
    actualizarPuntaje();
    toast(error.message || 'Error al cargar QR', 'red');
  }
}

function renderProyecto(data) {
  const project = data.proyecto || {};
  const event = data.evento || {};
  const horario = data.horario || {};
  const summary = document.getElementById('project-summary');

  if (!summary) return;

  summary.innerHTML = `
    <div class="project-hero">
      <div class="project-icon">${escapeHTML((project.Titulo || 'P').charAt(0).toUpperCase())}</div>
      <div>
        <div class="mini-label">Proyecto a evaluar</div>
        <h2>${escapeHTML(project.Titulo || 'Proyecto sin titulo')}</h2>
        <div class="project-tags">
          ${project.Categoria ? `<span class="badge badge-blue">${escapeHTML(project.Categoria)}</span>` : ''}
          <span class="badge badge-green">QR valido</span>
        </div>
      </div>
    </div>

    <p class="project-description">${escapeHTML(project.Descripcion || 'Sin descripcion registrada.')}</p>

    <div class="meta-grid">
      <div>
        <span>Alumno / equipo</span>
        <strong>${escapeHTML(project.NombreAlumno || 'Sin alumno')}</strong>
      </div>
      <div>
        <span>Evento</span>
        <strong>${escapeHTML(event.Nombre || 'Sin evento')}</strong>
      </div>
      <div>
        <span>Fecha</span>
        <strong>${safeDate(event.Fecha)}</strong>
      </div>
      <div>
        <span>Horario</span>
        <strong>${safeTime(horario.HoraInicio)} - ${safeTime(horario.HoraFin)}</strong>
      </div>
      <div>
        <span>Salon</span>
        <strong>${escapeHTML(horario.NombreAula || 'Sin sala')}</strong>
      </div>
      <div>
        <span>Evaluador</span>
        <strong>${escapeHTML(user.nombre || 'Profesor')}</strong>
      </div>
    </div>
  `;
}

function renderRubrica(rubrica) {
  const rubricTitle = document.getElementById('rubric-title');
  const content = document.getElementById('rubric-content');
  const saveBtn = document.getElementById('btn-save-eval');

  if (rubricTitle) rubricTitle.textContent = rubrica?.Nombre || 'Rubrica no asignada';

  if (!content) return;

  if (!rubrica || !Array.isArray(rubrica.criterios) || !rubrica.criterios.length) {
    content.innerHTML = '<div class="empty-state">Este proyecto no tiene rubrica asignada. Asignala desde Admin antes de evaluar.</div>';
    if (saveBtn) saveBtn.disabled = true;
    actualizarPuntaje();
    return;
  }

  content.innerHTML = rubrica.criterios.map((criterio, index) => {
    const niveles = [...(criterio.niveles || [])].sort((a, b) => Number(b.Puntaje || 0) - Number(a.Puntaje || 0));

    return `
      <article class="criterion-card">
        <header class="criterion-head">
          <div>
            <span class="criterion-index">Criterio ${index + 1}</span>
            <h3>${escapeHTML(criterio.Nombre || 'Criterio')}</h3>
            ${criterio.Descripcion ? `<p>${escapeHTML(criterio.Descripcion)}</p>` : ''}
          </div>
          <strong>${Number(criterio.PuntosMax || 0)} pts</strong>
        </header>

        <div class="levels-grid">
          ${niveles.map((nivel) => `
            <label class="level-option">
              <input
                type="radio"
                name="crit-${criterio.CriterioID}"
                value="${Number(nivel.Puntaje || 0)}"
                data-criterio="${criterio.CriterioID}"
                data-nivel="${nivel.NivelID}"
                data-max="${Number(criterio.PuntosMax || 0)}"
                onchange="actualizarPuntaje()"
              >
              <span class="level-name">${escapeHTML(nivel.Nombre || 'Nivel')}</span>
              <span class="level-desc">${escapeHTML(nivel.Descripcion || '')}</span>
              <span class="level-score">${Number(nivel.Puntaje || 0)} pts</span>
            </label>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');

  actualizarPuntaje();
}

async function cargarDocumentos(proyectoId) {
  const list = document.getElementById('docs-list');
  if (!list) return;

  if (!proyectoId) {
    list.innerHTML = '<div class="muted">Sin proyecto cargado.</div>';
    return;
  }

  try {
    const res = await fetch(`${API}/proyectos/${proyectoId}/documentos`);
    const docs = await res.json();

    if (!res.ok || !Array.isArray(docs) || !docs.length) {
      list.innerHTML = '<div class="muted">Sin documentos registrados.</div>';
      return;
    }

    list.innerHTML = docs.map((doc) => `
      <div class="doc-row">
        <div>
          <strong>${escapeHTML(doc.Titulo || doc.NombreArchivo || 'Documento')}</strong>
          <span>${escapeHTML(doc.MimeType || 'archivo')}</span>
        </div>
        <div class="doc-actions">
          <a class="btn btn-ghost btn-sm" href="${API}/documentos/${doc.DocumentoID}/ver" target="_blank" rel="noopener">Ver</a>
          <a class="btn btn-ghost btn-sm" href="${API}/documentos/${doc.DocumentoID}/descargar">Descargar</a>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error(error);
    list.innerHTML = '<div class="muted error">No se pudieron cargar documentos.</div>';
  }
}

function actualizarPuntaje() {
  const criterios = evalData?.rubrica?.criterios || [];
  const maximo = criterios.reduce((sum, c) => sum + Number(c.PuntosMax || 0), 0);
  let total = 0;
  let completos = criterios.length > 0;

  criterios.forEach((c) => {
    const selected = document.querySelector(`input[name="crit-${c.CriterioID}"]:checked`);
    if (!selected) completos = false;
    if (selected) total += Number(selected.value || 0);
  });

  const pct = maximo > 0 ? Math.round((total / maximo) * 100) : 0;
  const totalEl = document.getElementById('score-total');
  const pctEl = document.getElementById('score-percent');
  const saveBtn = document.getElementById('btn-save-eval');
  const hint = document.getElementById('save-hint');

  if (totalEl) totalEl.textContent = `${total} / ${maximo}`;
  if (pctEl) pctEl.textContent = `${pct}%`;
  if (saveBtn) saveBtn.disabled = !completos;

  if (hint) {
    hint.textContent = completos
      ? 'Rubrica completa. Lista para guardar.'
      : 'Selecciona un nivel por cada criterio.';
    hint.className = completos ? 'save-hint ready' : 'save-hint';
  }
}

async function guardarEvaluacionQR() {
  if (!evalData?.proyecto || !evalData?.rubrica) {
    return toast('No hay evaluacion cargada', 'red');
  }

  const criterios = evalData.rubrica.criterios || [];
  const detalles = [];

  for (const criterio of criterios) {
    const selected = document.querySelector(`input[name="crit-${criterio.CriterioID}"]:checked`);
    if (!selected) return toast('Falta calificar un criterio', 'orange');

    detalles.push({
      CriterioID: Number(selected.dataset.criterio),
      NivelID: Number(selected.dataset.nivel),
      PuntajeObtenido: Number(selected.value || 0),
      PuntajeMaximo: Number(selected.dataset.max || 0),
    });
  }

  const btn = document.getElementById('btn-save-eval');
  const observaciones = (document.getElementById('eval-observaciones')?.value || '').trim();

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Guardando...';
  }

  try {
    const res = await fetch(`${API}/proyectos/${evalData.proyecto.ProyectoID}/evaluacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ProfesorID: user.id,
        RubricaID: evalData.rubrica.RubricaID,
        Observaciones: observaciones,
        Comentarios: observaciones,
        detalles,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'No se pudo guardar la evaluacion');
    }

    sessionStorage.removeItem('qr_eval_token');
    sessionStorage.removeItem('qr_eval_preview');
    renderGuardado(data);
    toast(`Evaluacion guardada: ${data.PuntajeTotal}/${data.PuntajeMaximo} (${data.Porcentaje}%)`);
  } catch (error) {
    console.error(error);
    toast(error.message || 'Error al guardar evaluacion', 'red');
    actualizarPuntaje();
  } finally {
    if (btn) {
      btn.textContent = 'Guardar evaluacion';
    }
  }
}

function renderGuardado(resultado) {
  const content = document.getElementById('rubric-content');
  const saveBtn = document.getElementById('btn-save-eval');
  const hint = document.getElementById('save-hint');

  if (content) {
    content.innerHTML = `
      <div class="success-state">
        <div class="success-icon">OK</div>
        <h3>Evaluacion guardada</h3>
        <p>El alumno ya puede consultar su resultado en Mi desempeno. El admin vera este puntaje en ranking y analiticas.</p>
        <div class="final-score">${Number(resultado.PuntajeTotal || 0)} / ${Number(resultado.PuntajeMaximo || 0)} pts</div>
        <button class="btn btn-primary" onclick="window.location.href='panel-profesor.html'">Volver al panel</button>
      </div>
    `;
  }

  if (saveBtn) saveBtn.disabled = true;
  if (hint) {
    hint.textContent = 'Resultado guardado en la base de datos.';
    hint.className = 'save-hint ready';
  }
}
