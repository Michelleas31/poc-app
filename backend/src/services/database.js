require("dotenv").config({ path: '/app/.env' });
const mysql = require("mysql2");

console.log("🔧 Variables cargadas:");
console.log("  DB_HOST:", process.env.DB_HOST);
console.log("  DB_PORT:", process.env.DB_PORT);
console.log("  DB_USER:", process.env.DB_USER);
console.log("  DB_NAME:", process.env.DB_NAME);

const connection = mysql.createConnection({
  host: process.env.DB_HOST || "host.docker.internal",
  port: parseInt(process.env.DB_PORT, 10) || 3307,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "sistematesis"
});

connection.connect((err) => {
  if (err) {
    console.error("❌ Error conectando:", err.message);
    process.exit(1);
  }
  console.log("✅ Conectado a sistematesis");
});

module.exports = connection;