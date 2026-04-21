require("dotenv").config();
const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: process.env.DB_HOST || "poc-mariadb",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "sistematesis"
});

function connectWithRetry() {
  connection.connect((err) => {
    if (err) {
      console.error("Error conectando, reintentando en 5s:", err.message);
      setTimeout(connectWithRetry, 5000);
    } else {
      console.log("Conectado a MariaDB correctamente");
    }
  });
}

connectWithRetry();

module.exports = connection;