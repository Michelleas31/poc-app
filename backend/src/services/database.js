const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "database",
  user: "root",
  password: "root",
  database: "sistematesis",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error conectando a la base:", err);
    return;
  }
  console.log("Conectado a la base sistematesis");
  connection.release();
});

module.exports = pool;