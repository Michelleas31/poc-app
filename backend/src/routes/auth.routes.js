const express = require("express");
const router = express.Router();
const db = require("../services/database");

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const query = `
    SELECT UsuarioID, Nombre, Email, Rol
    FROM usuarios
    WHERE Email = ? AND Contraseña = ?
    LIMIT 1
  `;

  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error("Error en login:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    res.json(results[0]);
  });
});

module.exports = router;
