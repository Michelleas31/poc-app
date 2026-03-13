const express = require("express");
const router = express.Router();
const db = require("../services/database");

router.get("/usuarios", (req, res) => {
  db.query("SELECT * FROM usuarios", (err, results) => {
    if (err) {
      return res.status(500).json(err);
    }
    res.json(results);
  });
});

module.exports = router;