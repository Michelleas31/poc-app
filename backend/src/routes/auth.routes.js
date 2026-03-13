const express = require("express");
const router = express.Router();
const db = require("../services/database");

router.post("/login", (req, res) => {

  const { email, password } = req.body;

  const query = `
    SELECT * FROM usuarios
    WHERE Email = ? AND contraseña = ?
  `;

  db.query(query, [email, password], (err, results) => {

    if (err) {
      return res.status(500).json(err);
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    res.json(results[0]);
  });

});

module.exports = router;