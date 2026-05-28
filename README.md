# ProjectManager

Sistema web para gestion academica de proyectos, eventos y evaluaciones.

ProjectManager es un prototipo funcional desarrollado como proyecto academico para el XIX Concurso de Proyectos de Innovacion. La plataforma centraliza el registro de proyectos, la revision administrativa, la seleccion de evaluadores, la gestion de documentos, la generacion de codigos QR y la evaluacion mediante rubricas.

## Descripcion General

En eventos academicos, ferias de proyectos y concursos institucionales, la informacion suele estar distribuida entre formularios, documentos, mensajes y hojas de calculo. Esto dificulta dar seguimiento al estado de cada proyecto, validar que cumpla con el tema del evento, asignar evaluadores y registrar resultados de forma ordenada.

ProjectManager resuelve ese problema mediante una plataforma web con tres perfiles principales:

- Alumno: registra y documenta su proyecto, se inscribe a eventos, elige evaluador cuando el flujo lo permite, genera su QR de evaluacion y consulta resultados.
- Profesor o evaluador: ofrece disponibilidad, revisa proyectos asignados, consulta documentos, escanea o ingresa codigos QR y evalua con rubricas.
- Administrador: gestiona usuarios, eventos, aulas, horarios, rubricas, aprobaciones, evaluadores, ranking e indicadores.

El sistema esta dirigido a instituciones educativas, docentes, alumnos, coordinadores de eventos academicos y comites organizadores de concursos o ferias de innovacion.

## Objetivos

### Objetivo General

Desarrollar una plataforma web integral que permita administrar el ciclo completo de proyectos academicos: registro, documentacion, revision, asignacion de evaluadores, evaluacion con rubrica y consulta de resultados.

### Objetivos Especificos

- Digitalizar el registro de proyectos, participantes, documentos e inscripciones a eventos.
- Facilitar la revision y aprobacion de proyectos por parte del administrador.
- Organizar la disponibilidad de profesores y la seleccion de citas de evaluacion.
- Generar codigos QR para identificar proyectos aprobados durante la evaluacion.
- Permitir que los evaluadores califiquen proyectos mediante rubricas estructuradas.
- Registrar resultados, historial de desempeno, ranking e indicadores academicos.
- Mantener una interfaz clara para alumnos, profesores y administradores.
- Integrar un asistente de apoyo academico para generar ideas, mejorar textos y apoyar la validacion tematica sin sustituir la decision humana.

## Tecnologias Utilizadas

| Area | Tecnologia |
|---|---|
| Lenguajes | JavaScript, HTML5, CSS3, SQL |
| Backend | Node.js, Express 5 |
| Frontend | HTML, CSS y JavaScript vanilla |
| Base de datos | MariaDB |
| Driver de base de datos | mysql2 |
| Infraestructura | Docker, Docker Compose, nginx |
| Configuracion | dotenv |
| Utilidades backend | cors, express.json |
| Asistente IA | Servicio backend configurable con OpenRouter mediante variables de entorno |
| Control de versiones | Git y GitHub |

## Estructura del Proyecto

```text
poc-app-michelle/
|-- backend/
|   |-- Dockerfile
|   |-- package.json
|   |-- package-lock.json
|   `-- src/
|       |-- app.js
|       |-- controllers/
|       |-- models/
|       |-- routes/
|       |   |-- auth.routes.js
|       |   |-- citas.routes.js
|       |   |-- disponibilidad.routes.js
|       |   |-- documentos.routes.js
|       |   |-- evaluaciones.routes.js
|       |   |-- ia.routes.js
|       |   |-- index.js
|       |   `-- proyectos.routes.js
|       `-- services/
|           |-- database.js
|           `-- ia.service.js
|-- db/
|   |-- database.sql
|   |-- migracion_documentos_revision.sql
|   |-- migracion_projectmanager_uiux_flujo.sql
|   `-- migrations/
|       |-- 20260502_frontend_flow_fixes.sql
|       |-- 20260507_event_aula_flow.sql
|       |-- 20260512_asistente_ia.sql
|       |-- 20260518_completar_schema_programa.sql
|       |-- 20260518_estado_qr_inscripciones.sql
|       `-- 20260518_moderadores_resultados_compat.sql
|-- frontend/
|   |-- Dockerfile
|   `-- src/
|       |-- components/
|       |-- pages/
|       |   |-- evaluar-qr.html
|       |   |-- login.html
|       |   |-- panel-admin.html
|       |   |-- panel-alumno.html
|       |   `-- panel-profesor.html
|       |-- styles/
|       |   |-- evaluar-qr.css
|       |   |-- global.css
|       |   |-- panel-admin.css
|       |   |-- panel-alumno.css
|       |   `-- panel-profesor.css
|       |-- evaluar-qr.js
|       |-- main.js
|       |-- panel-admin.js
|       |-- panel-alumno.js
|       `-- panel-profesor.js
|-- docker-compose.yml
|-- .gitignore
`-- README.md
```

### Carpetas Principales

- `backend/`: API REST en Node.js y Express. Contiene rutas, servicios, conexion a MariaDB y logica de negocio.
- `frontend/`: interfaz web estatica servida con nginx. Incluye las paginas de login y paneles por rol.
- `db/`: script base de la base de datos y migraciones SQL incrementales.
- `db/migrations/`: ajustes de compatibilidad, flujo de eventos, QR, asistente IA, moderadores y resultados.

## Instalacion y Configuracion

### Requisitos Previos

- Git
- Docker Desktop
- Node.js 18 o superior
- npm
- MariaDB o acceso al contenedor de MariaDB definido en Docker Compose

### 1. Clonar el Repositorio

```bash
git clone https://github.com/Michelleas31/poc-app.git
cd poc-app
git checkout feature/yahir-avance-limpio
```

### 2. Configurar Variables de Entorno

Crear el archivo `backend/.env` a partir de `backend/.env.example`.

```bash
cd backend
copy .env.example .env
cd ..
```

Ejemplo de configuracion para usar MariaDB local o HeidiSQL en el equipo anfitrion:

```env
DB_HOST=host.docker.internal
DB_PORT=3307
DB_USER=root
DB_PASSWORD=123
DB_NAME=sistematesis

AI_PROVIDER=openrouter
AI_MODEL=openai/gpt-oss-20b:free
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1/chat/completions
```

La variable `OPENROUTER_API_KEY` es opcional para levantar el sistema. Si no se configura, el modulo de asistente IA mostrara un mensaje controlado y el resto del sistema continuara funcionando.

### 3. Preparar la Base de Datos

Opcion A: usar MariaDB local o una conexion administrada desde HeidiSQL.

1. Crear una base de datos llamada `sistematesis`.
2. Ejecutar `db/database.sql`.
3. Ejecutar las migraciones de `db/migrations/` en orden cronologico si la base ya existia antes de la version actual.

Opcion B: levantar MariaDB desde Docker Compose.

```bash
docker compose --profile docker-db up -d poc-mariadb
```

Si se usa la base de datos del servicio `poc-mariadb`, ajustar `backend/.env` para apuntar al contenedor:

```env
DB_HOST=poc-mariadb
DB_PORT=3306
DB_USER=poc_user
DB_PASSWORD=poc_password
DB_NAME=sistematesis
```

### 4. Ejecutar con Docker

```bash
docker compose up -d --build
```

Servicios principales:

- Frontend: `http://localhost:8080/pages/login.html`
- Backend: `http://localhost:3000/api/health`

### 5. Ejecutar Backend en Desarrollo Local

```bash
cd backend
npm install
npm start
```

El backend queda disponible en:

```text
http://localhost:3000
```

### 6. Ejecutar Frontend en Desarrollo Local

El frontend no requiere instalacion de dependencias. Puede servirse desde Docker o con un servidor estatico apuntando a `frontend/src`.

```bash
npx live-server frontend/src --port=8080 --entry-file=pages/login.html
```

## Uso del Sistema

### Acceso

Abrir en el navegador:

```text
http://localhost:8080/pages/login.html
```

El login redirige al panel correspondiente segun el rol del usuario autenticado.

### Roles y Funcionalidades

| Rol | Funcionalidades principales |
|---|---|
| Administrador | Gestiona usuarios, eventos, aulas, horarios, rubricas, proyectos, aprobaciones, evaluadores, citas, moderadores, analiticas, ranking e historial de uso del asistente IA. |
| Alumno | Registra y edita su proyecto, agrega documentos, usa el asistente IA, inscribe su proyecto a eventos, elige evaluador y cita, genera QR y consulta resultados. |
| Profesor / Evaluador | Consulta proyectos disponibles, ofrece disponibilidad, revisa proyectos asignados, consulta documentos, escanea o ingresa QR, evalua con rubrica y revisa historial. |

### Flujo Principal

1. El alumno inicia sesion y registra su proyecto con titulo, descripcion, categoria y documentos.
2. El profesor ofrece disponibilidad para apoyar o evaluar proyectos.
3. El alumno selecciona profesor, fecha, hora y sala cuando el flujo lo permite.
4. El administrador valida el proyecto, su categoria, documentos y cita.
5. Si el administrador aprueba, el sistema genera o habilita el codigo QR del proyecto.
6. El profesor escanea o ingresa el token QR el dia de la presentacion.
7. El sistema muestra los datos del proyecto, documentos, evento, salon, horario y rubrica.
8. El profesor evalua con rubrica y guarda la calificacion.
9. El alumno consulta su resultado, desempeno, historial y posicion en ranking.

## Modulos Principales

- Autenticacion por rol.
- Panel administrativo.
- Panel de alumno.
- Panel de profesor/evaluador.
- Gestion de usuarios.
- Gestion de eventos, aulas y horarios.
- Registro y seguimiento de proyectos.
- Documentos de proyecto en formato archivo o texto.
- Inscripcion de proyectos a eventos.
- Seleccion de evaluador y cita.
- Aprobacion administrativa.
- Generacion y validacion de QR.
- Evaluacion con rubricas.
- Ranking, podios e indicadores.
- Asistente IA para apoyo academico y administrativo.

## API Backend

Base URL:

```text
http://localhost:3000/api
```

Rutas principales detectadas:

| Modulo | Rutas principales |
|---|---|
| Autenticacion | `POST /login` |
| Usuarios | `GET /usuarios`, `POST /usuarios`, `PUT /usuarios/:id`, `PUT /usuarios/:id/toggle` |
| Eventos | `GET /eventos`, `POST /eventos`, `PUT /eventos/:id`, `DELETE /eventos/:id` |
| Aulas y horarios | `GET /aulas`, `POST /aulas`, `GET /eventos/:id/horarios`, `POST /horarios` |
| Proyectos | `GET /proyectos`, `POST /proyectos`, `GET /proyectos/:id`, `PUT /proyectos/:id`, `DELETE /proyectos/:id` |
| Documentos | `GET /proyectos/:id/documentos`, `POST /proyectos/:id/documentos`, `POST /proyectos/:id/documentos/texto`, `GET /documentos/:id/ver`, `GET /documentos/:id/descargar` |
| Disponibilidad | `GET /disponibilidad`, `POST /disponibilidad`, `PUT /disponibilidad/:id/seleccionar` |
| Citas | `GET /citas`, `GET /citas/alumno/:id`, `GET /citas/profesor/:id`, `PUT /citas/:id/aprobar`, `PUT /citas/:id/rechazar` |
| Rubricas y evaluaciones | `GET /rubricas`, `GET /rubricas/:id`, `POST /rubricas`, `POST /evaluaciones`, `GET /evaluaciones/proyecto/:id`, `GET /ranking` |
| QR | `POST /qr/generar`, `GET /qr/:token` |
| Asistente IA | `POST /ai`, `POST /ia/generar-ideas`, `POST /ia/mejorar-descripcion`, `POST /ia/generar-objetivos`, `POST /ia/generar-justificacion`, `POST /ia/guardar-documento`, `POST /ia/validar-evento`, `POST /ia/mejorar-rubrica`, `GET /ia/historial` |

## Base de Datos

La base de datos principal es `sistematesis`. El esquema base y las migraciones se encuentran en `db/`.

Tablas principales:

| Tabla | Proposito |
|---|---|
| `usuarios` | Almacena alumnos, profesores y administradores. |
| `proyectos` | Registra los proyectos academicos y su estado. |
| `etapasproyecto` | Define etapas internas de seguimiento. |
| `documentos_proyecto` | Guarda documentos, archivos y textos asociados a proyectos. |
| `eventos` | Administra concursos, ferias o eventos academicos. |
| `horariosevento` | Define horarios y aulas para eventos. |
| `eventoproyectos` | Relaciona proyectos inscritos con eventos y QR. |
| `disponibilidad_profesor` | Registra disponibilidad ofrecida por profesores. |
| `citas_evaluacion` | Controla citas de evaluacion. |
| `rubricas` | Define rubricas de evaluacion. |
| `criteriosrubrica` | Registra criterios de rubrica. |
| `nivelescriterio` | Define niveles de desempeno por criterio. |
| `evaluaciones` | Guarda evaluaciones finales. |
| `evaluaciondetalle` | Guarda detalle de puntajes por criterio. |
| `historial_desempeno` | Registra desempeno historico de proyectos. |
| `ia_interacciones` | Guarda historial de interacciones del asistente IA. |

## Capturas de Pantalla

Las capturas deben agregarse en rutas sin espacios, acentos ni simbolos especiales. Rutas sugeridas:

| Vista | Ruta sugerida |
|---|---|
| Login | `docs/screenshots/login.png` |
| Panel administrador | `docs/screenshots/panel-admin.png` |
| Panel alumno | `docs/screenshots/panel-alumno.png` |
| Panel profesor | `docs/screenshots/panel-profesor.png` |
| Evaluacion por QR | `docs/screenshots/evaluar-qr.png` |
| Rubricas | `docs/screenshots/rubricas.png` |
| Ranking | `docs/screenshots/ranking.png` |

No se incluyen imagenes en este README porque el repositorio actual no contiene una carpeta `docs/screenshots/`.

## Metodologia de Trabajo

El proyecto fue desarrollado de forma colaborativa por modulos, separando responsabilidades de frontend, backend, base de datos, documentacion y pruebas funcionales. El control de versiones se realizo con Git y GitHub, utilizando ramas de trabajo para integrar avances sin afectar la estabilidad del proyecto principal.

Para la entrega final se trabajo en la limpieza de estructura, revision de rutas, documentacion tecnica, correccion de flujo por roles y preparacion del repositorio en la rama `feature/yahir-avance-limpio`. Esta metodologia permite presentar un prototipo funcional, comprensible y mantenible para evaluacion academica.

## Colaboradores

| Nombre | Rol | Grupo | Carrera | Institucion |
|---|---|---|---|---|
| Yahir Antonio Valenzuela | Desarrollo frontend/backend, base de datos, documentacion y limpieza final del repositorio. | Grupo: Pendiente por completar | Ingenieria en Sistemas Computacionales | Tecnologico Superior de Jalisco, Unidad Academica Zapopan |
| Michelle Ambriz | Desarrollo del proyecto, colaboracion tecnica y gestion del repositorio. | Grupo: Pendiente por completar | Ingenieria en Sistemas Computacionales | Tecnologico Superior de Jalisco, Unidad Academica Zapopan |

## Estado del Proyecto

ProjectManager es un prototipo funcional y proyecto academico en fase de presentacion y mejora. El sistema cuenta con los modulos principales para demostrar el flujo completo de gestion de proyectos, eventos y evaluaciones, pero todavia puede evolucionar en seguridad, despliegue productivo, validacion avanzada y experiencia de usuario.

## Licencia

Este repositorio no contiene un archivo `LICENSE`. Por lo tanto, el proyecto se presenta bajo una licencia academica y educativa de uso restringido:

- Uso permitido con fines educativos, demostrativos y de evaluacion academica.
- No se autoriza su uso comercial sin permiso de los colaboradores.
- La reutilizacion del codigo debe citar a los autores y a la institucion cuando aplique.

## Agradecimientos

Se agradece al docente LEON MIGUEL RAMOS por el acompanamiento academico durante el desarrollo del proyecto.

Tambien se agradece al Tecnologico Superior de Jalisco, Unidad Academica Zapopan, por el espacio de formacion y apoyo institucional.

Finalmente, se reconoce al comite organizador del XIX Concurso de Proyectos de Innovacion por impulsar la participacion estudiantil, la creatividad tecnica y la presentacion de soluciones aplicadas.
