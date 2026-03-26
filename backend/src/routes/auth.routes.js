const express = require("express");
const router = express.Router();
const db = require("../services/database");

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const query = `
    SELECT * FROM usuarios
    WHERE Email = ? AND Contraseña = ?
  `;

  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error("Error en login:", err);
      return res.status(500).json({ message: "Error del servidor" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    const user = results[0];

    res.json({
      UsuarioID: user.UsuarioID,
      Nombre: user.Nombre,
      Email: user.Email,
      Rol: user.Rol
    });
  });
});

module.exports = router;