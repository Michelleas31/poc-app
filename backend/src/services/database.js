const mysql = require("mysql2");

const connection = mysql.createConnection({
  host:     process.env.DB_HOST     || "host.docker.internal",
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "MiChElLe310805",
  database: process.env.DB_NAME     || "sistematesis"
});

connection.connect((err) => {
  if (err) {
    console.error("Error conectando a la base:", err);
    return;
  }
  console.log("Conectado a la base sistematesis");
});

module.exports = connection;