require("dotenv").config();
const mysql = require("mysql2");

<<<<<<< HEAD
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
=======
const pool = mysql.createPool({
  host: "database",
  user: "root",
  password: "root",
  database: "sistematesis",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
>>>>>>> cc7e552 (feat: avances de Yahir)
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