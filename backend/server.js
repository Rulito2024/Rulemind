const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;


// Importar rutas
const profesorRoutes = require("./src/routes/profesorRoutes");
const authRoutes = require("./src/routes/authRoutes");
const alumnoRoutes = require("./src/routes/alumnoRoutes");

// Middlewares
app.use(cors());
app.use(express.json());

// Usar Rutas
app.use("/api/profesor", profesorRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/alumno", alumnoRoutes);

// servir archivos estáticos (frontend) para la redireccion desde el correo
app.use(express.static(path.join(__dirname,"../Frontend")));

// ruta raiz informativa
app.get("/", (req, res) => {
res.send("Servidor backend de RuleMind corriendo correctamente 🚀");});


// Servidor
app.listen(PORT, () => {
console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});

