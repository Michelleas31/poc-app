# ProjectManager — Sistema de Gestión de Proyectos de Tesis

Sistema web para la gestión integral de proyectos de tesis universitarios. Permite a administradores crear proyectos y eventos, profesores revisar y aprobar proyectos de sus alumnos, y alumnos registrar su avance, subir documentos e inscribirse a eventos de presentación.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express 5 (CommonJS) |
| Base de datos | MariaDB 11.7 |
| ORM/Driver | mysql2 3.x (callback + promise API) |
| Infraestructura | Docker Compose |
| Frontend | HTML5 + CSS3 + JavaScript (vanilla, sin frameworks) |
| Fuentes | Google Fonts (Syne + DM Sans) |

---

## Requisitos previos

- Node.js 18 o superior
- Docker Desktop (para MariaDB en contenedor)
- npm 9 o superior

---

## Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone <url-del-repo>
cd poc-app-michelle
```

### 2. Levantar la base de datos con Docker

```bash
docker compose up -d
```

Espera ~10 segundos a que MariaDB pase el health check.

### 3. Aplicar el esquema inicial

```bash
docker exec -i poc-mariadb mysql -u root -p sistematesis < db/database.sql
```

### 4. Aplicar la migración de documentos (v1.1.0)

```bash
docker exec -i poc-mariadb mysql -u root -p sistematesis < db/migracion_documentos_revision.sql
```

### 5. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 6. Iniciar el backend

```bash
npm start
# El servidor queda en http://localhost:3000
```

### 7. Servir el frontend

Usa cualquier servidor estático apuntando a `frontend/src/`. Ejemplo con live-server:

```bash
npx live-server frontend/src --port=8080 --entry-file=pages/login.html
```

---

## Variables de entorno

Crea `backend/.env` (o ajusta `docker-compose.yml`). Todos los valores tienen fallback en `database.js`:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DB_HOST` | `poc-mariadb` | Host de MariaDB (nombre del servicio Docker) |
| `DB_PORT` | `3306` | Puerto de MariaDB |
| `DB_USER` | `root` | Usuario de la base de datos |
| `DB_PASSWORD` | *(vacío)* | Contraseña |
| `DB_NAME` | `sistematesis` | Nombre de la base de datos |

Para desarrollo local sin Docker usa `DB_HOST=localhost DB_PORT=3307` (si expones ese puerto en compose).

---

## Estructura del proyecto

```
poc-app-michelle/
├── backend/
│   ├── src/
│   │   ├── app.js                    # Entry point Express, registra rutas
│   │   ├── routes/
│   │   │   ├── auth.routes.js        # POST /api/login
│   │   │   ├── index.js              # Usuarios, Eventos, Aulas, Horarios, Rúbricas, EventoProyectos
│   │   │   ├── proyectos.routes.js   # CRUD Proyectos + Etapas + rutas de revisión
│   │   │   └── documentos.routes.js  # Documentos (BLOB), revisión profesor, detalles
│   │   └── services/
│   │       └── database.js           # Conexión mysql2 con reconnect
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── login.html
│       │   ├── panel-admin.html
│       │   ├── panel-profesor.html
│       │   └── panel-alumno.html
│       ├── styles/
│       │   ├── panel-admin.css
│       │   └── panel-alumno.css
│       ├── main.js          # Login, guarda sesión en sessionStorage
│       ├── panel-admin.js
│       ├── panel-profesor.js
│       └── panel-alumno.js
├── db/
│   ├── database.sql                        # Esquema inicial completo
│   └── migracion_documentos_revision.sql   # Migración v1.1.0
├── docker-compose.yml
└── README.md
```

---

## Endpoints de la API

Base URL: `http://localhost:3000/api`

### Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/login` | Login. Body: `{Email, Contraseña}`. Devuelve datos del usuario. |

### Usuarios

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/usuarios` | Lista todos los usuarios. `?rol=Profesor` para filtrar. |
| POST | `/usuarios` | Crear usuario. Body: `{Nombre, Email, Contraseña, Rol}` |
| PUT | `/usuarios/:id` | Editar usuario. |
| PUT | `/usuarios/:id/toggle` | Activar / desactivar (soft delete). |

### Eventos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/eventos` | Lista todos los eventos. |
| POST | `/eventos` | Crear evento. Body: `{Nombre, Fecha, HoraInicio, HoraFin, Estado?}` |
| PUT | `/eventos/:id` | Editar evento. |
| DELETE | `/eventos/:id` | Eliminar evento. |

### Aulas y Horarios

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/aulas` | Lista aulas. |
| POST | `/aulas` | Crear aula. Body: `{Nombre, Capacidad?}` |
| DELETE | `/aulas/:id` | Eliminar aula. |
| GET | `/eventos/:id/horarios` | Horarios de un evento con nombre de aula. |
| POST | `/horarios` | Crear horario. Body: `{EventoID, AulaID, HoraInicio, HoraFin}` |
| PUT | `/horarios/:id` | Cambiar disponibilidad. Body: `{Disponible: 0|1}` |
| DELETE | `/horarios/:id` | Eliminar horario. |

### Proyectos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/proyectos` | Lista todos los proyectos activos. |
| GET | `/proyectos/por-alumno/:id` | Proyectos del alumno (con conteo de etapas). |
| GET | `/proyectos/por-profesor/:id` | Proyectos asignados al profesor. |
| GET | `/proyectos/revision/pendientes` | Proyectos pendientes de revisión (Admin). |
| GET | `/proyectos/revision/profesor/:id` | Proyectos del profesor para revisar. |
| GET | `/proyectos/:id` | Detalle de un proyecto. |
| POST | `/proyectos` | Crear proyecto. Body: `{Titulo, FechaInicio, AlumnoID, ProfesorID?, Descripcion?, FechaFin?}` |
| PUT | `/proyectos/:id` | Editar proyecto. |
| PUT | `/proyectos/:id/asignar-profesor` | Asignar/cambiar profesor. Body: `{ProfesorID}` |
| DELETE | `/proyectos/:id` | Soft delete (Activo = 0). |

### Etapas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/proyectos/:id/etapas` | Lista etapas ordenadas. |
| POST | `/proyectos/:id/etapas` | Agregar etapa. Body: `{Nombre, Descripcion?, FechaFin?}` |
| PUT | `/etapas/:id` | Actualizar etapa. Recalcula Progreso del proyecto automáticamente. |
| DELETE | `/etapas/:id` | Eliminar etapa. Recalcula Progreso. |

### Documentos del proyecto

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/proyectos/:id/documentos` | Lista documentos (sin binario). |
| POST | `/proyectos/:id/documentos` | Subir documento como base64. Body: `{NombreArchivo, ContenidoBase64, SubidoPorID, MimeType?, Descripcion?}` |
| GET | `/documentos/:id/ver` | Sirve el binario inline (para previsualizar en navegador). |
| GET | `/documentos/:id/descargar` | Sirve el binario como attachment. |
| DELETE | `/documentos/:id` | Eliminar documento. |
| GET | `/proyectos/:id/detalles` | Proyecto + documentos + etapas en una sola respuesta. |
| PUT | `/proyectos/:id/revisar` | Profesor registra decisión. Body: `{EstadoAprobacion, ComentarioRevision?, ProfesorID?}` |
| GET | `/proyectos/:id/aprobacion` | Estado de aprobación del proyecto (alumno lo consulta). |

### Proyectos en Eventos (inscripciones)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/eventos/proyectos` | Lista inscripciones. `?eventoId=&estado=&proyectoId=` |
| POST | `/eventos/proyectos` | Inscribir proyecto. Body: `{EventoID, ProyectoID, Descripcion?, Participantes[], Asesores[]}` |
| PUT | `/eventos/proyectos/:id/estado` | Admin cambia estado. Body: `{Estado: pendiente|aceptado|rechazado}` |
| GET | `/eventos/:id/proyectos/aceptados` | Proyectos aceptados con horario/evaluadores. |
| POST | `/eventos/proyectos/:id/evaluadores` | Asignar evaluadores. Body: `{profesores: [UsuarioID...]}` |

### Rúbricas

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/rubricas` | Lista rúbricas con resumen (criterios, puntaje máximo). |
| GET | `/rubricas/:id` | Detalle completo con criterios y niveles. |
| POST | `/rubricas` | Crear rúbrica. Body: `{Nombre, Descripcion?, ProfesorID, criterios[]}` |
| DELETE | `/rubricas/:id` | Eliminar (bloqueado si tiene evaluaciones). |

---

## Esquema de base de datos

Tablas principales en la base de datos `sistematesis`:

| Tabla | Descripción |
|-------|-------------|
| `Usuarios` | Alumnos, profesores y admins. Campo `Rol ENUM('Alumno','Profesor','Admin')`. |
| `Proyectos` | Proyectos de tesis. Campos clave: `AlumnoID`, `ProfesorID`, `Progreso`, `EstadoAprobacion ENUM('pendiente','aceptado','rechazado')`. |
| `EtapasProyecto` | Etapas de un proyecto. `Completada` recalcula `Progreso` en `Proyectos`. |
| `ProyectoDocumentos` | Archivos subidos como `LONGBLOB`. Se crea en `migracion_documentos_revision.sql`. |
| `Eventos` | Eventos de presentación. `Estado ENUM('proximo','activo','finalizado','no_disponible')`. |
| `EventoProyectos` | Inscripciones de proyectos a eventos. `Estado ENUM('pendiente','aceptado','rechazado')`. |
| `HorariosEvento` | Slots de horario por evento y aula. |
| `Aulas` | Salas disponibles para presentaciones. |
| `Rubricas` | Rúbricas de evaluación. Relacionada con `CriteriosRubrica` y `NivelesCriterio`. |
| `CriteriosRubrica` | Criterios de una rúbrica (N por rúbrica). |
| `NivelesCriterio` | 4 niveles por criterio (Sobresaliente/Bien/Suficiente/Insuficiente). |
| `EvaluadoresEvento` | Profesores evaluadores asignados a un proyecto-evento. |
| `ProyectoParticipantes` | Co-integrantes del proyecto (además del líder). |

---

## Flujo de usuario por rol

### Alumno
1. Inicia sesión → panel-alumno.html
2. Ve su proyecto asignado (metadatos, progreso, etapas).
3. Marca etapas como completadas → el progreso se recalcula automáticamente.
4. Sube documentos (PDF, Word, imágenes) para que su profesor los revise.
5. Consulta el estado de aprobación del proyecto (pendiente / aceptado / rechazado) y el comentario del profesor.
6. Se inscribe a un evento de presentación (flujo de 4 pasos: evento → participantes → documento → confirmar).
7. Revisa el estado de sus inscripciones.

### Profesor
1. Inicia sesión → panel-profesor.html
2. Ve todos los proyectos asignados (tarjetas con progreso y estado de aprobación).
3. Abre el modal **Revisar** de cualquier proyecto:
   - Consulta descripción, datos del alumno, documentos adjuntos.
   - Escribe un comentario.
   - Acepta o rechaza el proyecto.
4. Navega al detalle de etapas de un proyecto.

### Administrador
1. Inicia sesión → panel-admin.html
2. **Dashboard**: resumen de usuarios, eventos activos y proyectos pendientes.
3. **Usuarios**: crear, editar, activar/desactivar alumnos, profesores y admins.
4. **Eventos**: crear y gestionar eventos de presentación.
5. **Horarios y Aulas**: definir salas y slots de tiempo.
6. **Rúbricas**: crear rúbricas con criterios y 4 niveles de calificación.
7. **Gestión de Proyectos**: crear proyectos, asignar alumnos y profesores, gestionar etapas, ver documentos adjuntos, subir análisis propios.
8. **Aprobar Proyectos**: aceptar/rechazar inscripciones de proyectos a eventos.
9. **Asignar Evaluadores**: designar hasta 3 profesores evaluadores por proyecto aceptado.

---

## Funcionalidades por rol

| Funcionalidad | Alumno | Profesor | Admin |
|---------------|:------:|:--------:|:-----:|
| Ver su proyecto y etapas | ✓ | — | — |
| Marcar etapas completadas | ✓ | — | ✓ |
| Subir documentos al proyecto | ✓ | — | ✓ |
| Ver estado de aprobación | ✓ | — | — |
| Inscribirse a eventos | ✓ | — | — |
| Ver proyectos asignados | — | ✓ | — |
| Revisar y aprobar/rechazar proyectos | — | ✓ | — |
| Gestión completa de proyectos | — | — | ✓ |
| Gestión de usuarios | — | — | ✓ |
| Gestión de eventos | — | — | ✓ |
| Aulas y horarios | — | — | ✓ |
| Rúbricas | — | — | ✓ |
| Aprobar inscripciones a eventos | — | — | ✓ |
| Asignar evaluadores | — | — | ✓ |

---

## Guía de desarrollo local

### Levantar solo la base de datos

```bash
docker compose up -d poc-mariadb
```

### Backend con recarga automática

```bash
cd backend
npm install -g nodemon   # primera vez
nodemon src/app.js
```

### Frontend

El frontend es HTML/CSS/JS puro. Cualquier servidor estático funciona:

```bash
# Opción A — live-server
npx live-server frontend/src --port=8080 --entry-file=pages/login.html

# Opción B — Python (sin instalación)
python -m http.server 8080 --directory frontend/src
```

### Variables para desarrollo sin Docker

```env
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=
DB_NAME=sistematesis
```

### Usuarios de prueba (insertar manualmente)

```sql
INSERT INTO Usuarios (Nombre, Email, Contraseña, Rol) VALUES
('Admin Sistema', 'admin@test.com',   'admin123',   'Admin'),
('Profesor Demo', 'profe@test.com',   'profe123',   'Profesor'),
('Alumno Demo',   'alumno@test.com',  'alumno123',  'Alumno');
```

---

## Changelog v1.1.0 — 2026-04-26

### Correcciones de backend

- **#15** Límite de `express.json` subido de 50 MB a 200 MB para soportar archivos base64 de hasta 25 MB.
- **#15** Eliminado `router.use(express.json())` redundante en `documentos.routes.js`.
- **#14** `PUT /proyectos/:id/revisar` verifica que el `ProfesorID` del body coincida con el asignado al proyecto.
- **#4** Rutas `/revision/pendientes` y `/revision/profesor/:id` registradas **antes** de `/:id` en `proyectos.routes.js` para evitar colisión con Express.
- **#2** Dependencia `dotenv` agregada a `package.json` (era requerida por `database.js` pero no estaba declarada).
- **EXTRA20 / #5** Creada la tabla `ProyectoDocumentos` mediante `migracion_documentos_revision.sql` (con patrón idempotente). Sin esta tabla todos los endpoints de documentos fallaban con error de tabla no encontrada.

### Correcciones de frontend

- **#17** Extraído todo el JavaScript inline de `panel-profesor.html` a `panel-profesor.js` (nuevo archivo). Eliminadas las dos definiciones duplicadas de `revisarProyecto` y el monkey-patching de `loadMisProyectos`.
- **#9 / EXTRA24** Eliminado bloque `DOMContentLoaded` duplicado al final de `panel-alumno.js` que registraba los mismos listeners de cierre de modal ya registrados en el bloque principal.
- **EXTRA21** Agregado botón **Ver** en `renderGPList()` del panel admin (llamaba a `verDetallesProyecto` pero el botón nunca se renderizaba en la tabla).
- **EXTRA22** Consolidadas las dos definiciones de `verDetallesProyecto` en `panel-admin.js` en una sola función limpia. Eliminado monkey-patching mediante reasignación de variable.
- **EXTRA23** Integrado `gestion-proyectos` directamente en `pageTitles` y `loadSection` en `panel-admin.js`. Eliminado IIFE que parcheaba estas funciones en tiempo de ejecución.
- Integrado badge de estado de aprobación y botón "Revisar" directamente en las tarjetas de `loadMisProyectos()` del panel profesor (eliminando dependencia de monkey-patching).
- Integradas secciones "Estado de aprobación" y "Documentos de mi proyecto" directamente en `loadMiProyecto()` del panel alumno (eliminando monkey-patching).

---

## Problemas conocidos

| ID | Descripción | Impacto | Workaround |
|----|-------------|---------|------------|
| #1 | `database.js` usa `mysql2.createConnection` que no reconecta automáticamente tras caída de la BD. | Si el contenedor MariaDB se reinicia, el backend requiere reinicio manual. | Reiniciar el proceso Node: `npm start`. |
| — | Archivos se almacenan como BLOB en la BD (no en disco). | Archivos grandes (>25 MB) pueden afectar rendimiento de consultas. | Considerar migrar a almacenamiento en disco o S3 en producción. |
| — | Sin autenticación JWT/sesiones en el backend; la sesión vive solo en `sessionStorage` del navegador. | Sin protección real de endpoints. | Aceptable para POC; agregar middleware de auth antes de producción. |
| — | Las contraseñas se guardan en texto plano en la base de datos. | Riesgo de seguridad grave en producción. | Implementar bcrypt antes de cualquier despliegue real. |

---

## Licencia

Proyecto de demostración (POC). Sin licencia de distribución definida.
