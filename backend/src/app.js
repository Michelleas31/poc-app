const express = require('express');
const cors = require('cors');

require('./services/database');

const authRoutes = require('./routes/auth.routes');
const apiRoutes = require('./routes/index');
const proyectosRoutes = require('./routes/proyectos.routes');
const disponibilidadRoutes = require('./routes/disponibilidad.routes');
const documentosRoutes = require('./routes/documentos.routes');
const evaluacionesRoutes = require('./routes/evaluaciones.routes');
const citasRoutes = require('./routes/citas.routes');
const iaRoutes = require('./routes/ia.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'ProjectManager API' });
});

app.use('/api', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', proyectosRoutes);
app.use('/api', disponibilidadRoutes);
app.use('/api', documentosRoutes);
app.use('/api', evaluacionesRoutes);
app.use('/api', citasRoutes);
app.use('/api', iaRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

app.listen(3000, () => {
  console.log('Servidor backend corriendo en puerto 3000');
});
