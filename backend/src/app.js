const express = require("express");
const cors = require("cors");
 
require("./services/database");
 
const authRoutes  = require("./routes/auth.routes");
const apiRoutes   = require("./routes/index");
 
const app = express();
 
app.use(cors());
app.use(express.json());
 
app.use("/api", authRoutes);
app.use("/api", apiRoutes);
 
app.listen(3000, () => {
  console.log("Servidor backend corriendo en puerto 3000");
});