const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const nodemailer = require("nodemailer");
const authMiddleware = require("../middlewares/authMiddleware");
require("dotenv").config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Funciones de validación y formateo
function capitalizar(texto) {
if (!texto) return "";
return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

function validarPassword(password) {
const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;
return regex.test(password);
}

function validarNombreApellido(valor) {
const regex = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/;
return regex.test(valor);
}

// configuración del correo 
const transporter = nodemailer.createTransport({
service: "gmail",
auth: {
    user: process.env.EMAIL_USER, // email de aplicación
    pass: process.env.EMAIL_PASS,  // (contraseña de aplicación)
},
});


// 🔹 Registro
router.post("/register", async (req, res) => {
try {
    let { nombre, apellido, email, password, role } = req.body;

    if (!validarNombreApellido(nombre) || !validarNombreApellido(apellido)) {
    return res.status(400).json({ success: false, message: "El nombre y apellido deben comenzar con mayúscula." });
    }

    nombre = capitalizar(nombre.trim());
    apellido = capitalizar(apellido.trim());
    email = email.trim().toLowerCase();
    role = role || "alumno"; // rol por defecto

    if (!validarPassword(password)) {
    return res.status(400).json({
        success: false,
        message: "La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial.",
    });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
    "INSERT INTO users (full_name, email, password, verified, role) VALUES (?, ?, ?, ?, ?)",
    [`${nombre} ${apellido}`, email, hashedPassword,0, role]
    );

    const verifyToken = Buffer.from(`${result.insertId}:${email}`).toString("base64");
    const verifyLink = `${process.env.BACKEND_URL}/api/auth/verificar/${verifyToken}`;

    // enviar correo de verificación
    await transporter.sendMail({
    from: `"RuleMind" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verifica tu cuenta en RuleMind",
    html: `<h2> Bienvenido a RuleMind </h2> <p> Haz clic en el enlace para verificar tu cuenta: </p><a href="${verifyLink}">${verifyLink}</a>`,
    });

    res.json({ success: true, message: "Usuario registrado. Revisa tu correo para verificar la cuenta." });
} catch (err) {
    console.error(" Error en registro: ",err);

// capturar error de email duplicado
if (err.code === "ER_DUP_ENTRY") {
    return res.status(400).json({ success: false, message: "El email ya está registrado" });
}
    res.status(500).json({ success: false, message: "Error al registrar usuario" });
}
});

// 🔹 Verificación de cuenta
router.get("/verificar/:token", async (req, res) => {
try {
    const { token } = req.params;
    const decoded = Buffer.from(token, "base64").toString("utf8");
    console.log (" Token decodificado: ", decoded)
    
    const [id, email] = decoded.split(":");
    console.log(" ID: ", id, " Email: ", email);
    if (!id || !email) {
    return res.status(400).send("<h1>Token inválido ❌</h1>");
    }

const [result] = await pool.query( "UPDATE users SET verified = 1 WHERE id = ? AND email = ?",
    [id, email]);
console.log(" Resultado UPDATE: ", result);

    if (result.affectedRows === 0) {
    return res.status(400).send("<h1>No se encontró usuario para verificar ❌</h1>");
    }


    // 🔹 Redirigir al login del frontend usando la URL del .env
return res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="refresh" content="3;url=${process.env.FRONTEND_URL}/html/loguearse.html">
            <title>Cuenta Verificada</title>
            <style>
                body { font-family: sans-serif; text-align: center; padding-top: 50px; }
                h1 { color: #28a745; }
            </style>
        </head>
        <body>
            <h1>¡Verificación Exitosa! ✅</h1>
            <p>Tu cuenta ha sido verificada. Serás redirigido a la página de inicio de sesión en 3 segundos.</p>
            <p>Si no eres redirigido, haz clic <a href="${process.env.FRONTEND_URL}/html/loguearse.html">aquí</a>.</p>
        </body>
        </html>
    `);}
    catch (err) {
    console.error(err);
    res.status(500).send("Error al verificar cuenta");

}
});

// 🔹 Login
router.post("/login", async (req, res) => {
try {
    const { email, password } = req.body;
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(400).json({ success: false, message: "Usuario no encontrado" });

    const user = users[0];
    if (!user.verified) return res.status(401).json({ success: false, message: "Debes verificar tu correo antes de iniciar sesión. " });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Contraseña incorrecta" });

    //jWT
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role}, 
    JWT_SECRET, { expiresIn: "1h" }  
    );

    res.json({ 
        success: true, 
        message: "Inicio de sesión exitoso", 
        token, 
        user: { id: user.id, email: user.email, role: user.role },
});

} catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al iniciar sesión" });
}
});


// 🔹 Ruta protegida para perfil de usuario (cualquier rol logueado)
router.get("/perfil", authMiddleware(["alumno", "profesor", "admin"]), (req, res) => {
res.json({ success: true, message: "Perfil del usuario", user: req.user });
});

// 🔹 Ruta solo para profesores
router.get("/profesor-zone", authMiddleware(["profesor"]), (req, res) => {
res.json({ success: true, message: "Bienvenido al panel del profesor " });
});

// 🔹 Ruta solo para admin
router.get("/admin-zone", authMiddleware(["admin"]), (req, res) => {
res.json({ success: true, message: "Bienvenido al panel de administración 🛠️" });
});

module.exports = router;