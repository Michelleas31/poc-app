const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "host.docker.internal",
  user: "root",
  password: "MiChElLe310805",
  database: "sistematesis"
});

connection.connect((err) => {
  if (err) {
    console.error("Error conectando a la base:", err);
    return;
  }
  console.log("Conectado a la base sistematesis");
});

module.exports = connection;

module.exports = connection;