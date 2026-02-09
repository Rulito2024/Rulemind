const mysql = require("mysql2/promise");

// Ajustá estos valores según tu MySQL local
const pool = mysql.createPool({
host:process.env.DB_HOST,
user:process.env.DB_USER,       // tu usuario de MySQL
password:process.env.DB_PASSWORD , // tu contraseña de MySQL
database:process.env.DB_NAME,   // nombre de la base de datos
});
module.exports = pool;
