// ✅ CORREGIDO v1.1 — 2026-04-26
// Cambios: #15 límite JSON subido a 200mb para soportar base64 de archivos grandes
const express = require("express");
const cors    = require("cors");

require("./services/database");

const authRoutes       = require("./routes/auth.routes");
const apiRoutes        = require("./routes/index");
const proyectosRoutes  = require("./routes/proyectos.routes");
const documentosRoutes = require("./routes/documentos.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "200mb" }));

app.use("/api", authRoutes);
app.use("/api", apiRoutes);
app.use("/api", proyectosRoutes);
app.use("/api", documentosRoutes);

app.listen(3000, () => {
  console.log("Servidor backend corriendo en puerto 3000");
});
