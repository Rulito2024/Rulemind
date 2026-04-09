const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer")
const pool = require("../db");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// Configuración de Multer
const storage = multer.diskStorage({
destination: function(req, file, cb){
cb(null, "uploads/"); // carpeta de destino
}, 
filename: function (req, file, cb){
cb(null, Date.now() + "-" + file.originalname); // nombre del archivo
}
});

// NUEVO: Función de filtro para Multer
const fileFilter = (req, file, cb) => {
    //  filtro para actividades
    const tipoSubida = req.url.split('/').pop(); 
if (tipoSubida === 'actividades') {
        if (file.mimetype === 'application/msword' || 
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        } else {
            cb(new Error("Solo se permiten archivos de Word (.doc o .docx) para actividades."), false);
        }
    } else {
        cb(null, true);
    }
};
    
// Modificar la inicialización de Multer para usar el filtro
const upload = multer({ 
    storage, 
    fileFilter // Aplicamos el filtro de extensiones
}); 

router.use((err, req, res, next) => {
    // Captura errores de Multer (como archivos muy pesados) o de nuestro filtro (formato incorrecto)
    if (err instanceof multer.MulterError || (err.message && err.message.includes("Solo se permiten"))) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next(err); 
});

/* ============================
   🔹 GESTIÓN DE REGLAS (NUEVO)
   ============================ */

// Obtener todas las reglas para la lista y el selector
router.get("/reglas", authMiddleware(["profesor"]), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM reglas ORDER BY nombre ASC");
        res.json(rows);
    } catch (err) {
        console.error("Error al obtener reglas:", err);
        res.status(500).json({ success: false, message: "Error al obtener reglas" });
    }
});

// Crear o Actualizar Regla (Texto en BD)
router.post("/guardar-regla", authMiddleware(["profesor"]), async (req, res) => {
    const { id, nombre, teoria, palabra_clave } = req.body;
    try {
        if (id) {
            // ACTUALIZAR EXISTENTE
            await pool.query(
                "UPDATE reglas SET nombre = ?, teoria = ?, palabra_clave = ? WHERE id = ?",
                [nombre, teoria, palabra_clave || null, id]
            );
            res.json({ success: true, message: "Regla actualizada correctamente" });
        } else {
            // INSERTAR NUEVA
            await pool.query(
                "INSERT INTO reglas (nombre, teoria, palabra_clave) VALUES (?, ?, ?)",
                [nombre, teoria, palabra_clave || null]
            );
            res.json({ success: true, message: "Regla creada correctamente" });
        }
    } catch (err) {
        console.error("Error al guardar regla:", err);
        res.status(500).json({ success: false, message: "Error al procesar la regla" });
    }
});

// Borrar Regla
router.delete("/borrar-regla/:id", authMiddleware(["profesor"]), async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM reglas WHERE id = ?", [id]);
        res.json({ success: true, message: "Regla eliminada correctamente" });
    } catch (err) {
        console.error("Error al borrar regla:", err);
        res.status(500).json({ success: false, message: "No se puede borrar la regla. Verifique que no esté siendo usada en una actividad." });
    }
});


//Crear una actividad con contenido y respuesta en línea
router.post("/crear/actividad/online", authMiddleware(["profesor"]), async (req, res) => {
    let { titulo, descripcion, contenido, respuesta_correcta, regla_id } = req.body;

    // 🔴 VALIDAR QUE SEA JSON CON TIPO
    if (!contenido || !contenido.tipo) {
        return res.status(400).json({ 
            success: false, 
            message: "El contenido debe ser JSON válido y tener un campo 'tipo'" 
        });
    }

    // 🔴 CONVERTIR A STRING (CLAVE)
    contenido = JSON.stringify(contenido);

    if (!titulo || !contenido || !respuesta_correcta) {
        return res.status(400).json({ success: false, message: "Título, contenido y respuesta correcta son obligatorios." });
    }

    try {
        await pool.query(
            "INSERT INTO materiales (tipo, titulo, descripcion, contenido, respuesta_correcta, regla_id, publicado, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                "actividades",
                titulo,
                descripcion,
                contenido,
                respuesta_correcta,
                regla_id || null, // Permite que sea opcional
                0, // Inicialmente no publicada
                new Date()
            ]
        );
        res.json({ success: true, message: "Actividad creada correctamente. ¡No olvides publicarla!" });
    } catch (err) {
        console.error("Error al crear actividad online:", err);
        res.status(500).json({ success: false, message: "Error al crear la actividad" });
    }
});

// Eliminar una actividad
router.delete("/actividades/:id", authMiddleware(["profesor"]), async (req, res) => {
try {
    const { id } = req.params;
    await pool.query("DELETE FROM materiales WHERE id = ? AND tipo = 'actividades'", [id]);
    res.json({ success: true, message: "Actividad eliminada correctamente" });
} catch (err) {
    console.error("Error al eliminar actividad:", err);
    res.status(500).json({ success: false, message: "Error al eliminar actividad" });
}
});

/* MATERIAL SUBIDO (LISTAR Y ELIMINAR) */

// Ver materiales subidos con el NOMBRE de la regla asociada
router.get("/materiales", authMiddleware(["profesor"]), async (req, res) => {
    try {
        const query = `
            SELECT 
                m.id, 
                m.tipo, 
                m.archivo, 
                m.titulo, 
                m.descripcion, 
                m.contenido, 
                m.respuesta_correcta, 
                m.regla_id, 
                m.fecha, 
                m.publicado,
                r.nombre AS nombre_regla -- Buscamos 'nombre' en la tabla 'reglas'
            FROM materiales m
            LEFT JOIN reglas r ON m.regla_id = r.id
            ORDER BY m.fecha DESC
        `;
        
        const [rows] = await pool.query(query);
        res.json(rows); 
    } catch (err) {
        console.error("Error al obtener materiales:", err);
        res.status(500).json({ success: false, message: "Error al obtener materiales" });
    }
});

// EDITAR una actividad o material existente
router.put("/materiales/:id", authMiddleware(["profesor"]), async (req, res) => {
    try {
        const { id } = req.params;
        let { titulo, descripcion, contenido, respuesta_correcta, regla_id } = req.body;

        // Validar que el contenido sea un objeto antes de convertirlo a string
        if (contenido && typeof contenido === 'object') {
            contenido = JSON.stringify(contenido);
        }

        const query = `
            UPDATE materiales 
            SET titulo = ?, descripcion = ?, contenido = ?, respuesta_correcta = ?, regla_id = ? 
            WHERE id = ?
        `;

        await pool.query(query, [
            titulo, 
            descripcion, 
            contenido, 
            respuesta_correcta, 
            regla_id || null, 
            id
        ]);

        res.json({ success: true, message: "Material actualizado correctamente ✅" });
    } catch (err) {
        console.error("Error al actualizar material:", err);
        res.status(500).json({ success: false, message: "Error al actualizar el material" });
    }
});

//  Eliminar cualquier material subido por ID
router.delete("/materiales/:id", authMiddleware(["profesor"]), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM materiales WHERE id = ?", [id]);
        
        res.json({ success: true, message: "Material eliminado correctamente" });
    } catch (err) {
        console.error("Error al eliminar material:", err);
        res.status(500).json({ success: false, message: "Error al eliminar material" });
    }
});

// Publicar/Despublicar material
router.put("/materiales/publicar/:id", authMiddleware(["profesor"]), async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body; // 'true' o 'false'

        if (typeof estado !== 'boolean') {
            return res.status(400).json({ success: false, message: "El estado de publicación debe ser true o false." });
        }

        await pool.query("UPDATE materiales SET publicado = ? WHERE id = ?", [
            estado,
            id
        ]);
        
        res.json({ 
            success: true, 
            message: `Material ${estado ? 'publicado' : 'despublicado'} correctamente.` 
        });
    } catch (err) {
        console.error("Error al cambiar estado de publicación:", err);
        res.status(500).json({ success: false, message: "Error al cambiar estado de publicación" });
    }
});

/* COMENTARIOS Y LISTADOS */

// Enviar comentario a un alumno y NOTIFICAR por Mail
router.post("/enviar-comentario", authMiddleware(["profesor"]), async (req, res) => {
    const { alumnoId, emailAlumno, comentario } = req.body;

    if (!alumnoId || !comentario || !emailAlumno) {
        return res.status(400).json({ success: false, message: "Faltan datos obligatorios (ID, Email o Mensaje)." });
    }

    try {
        // 1. Guardar en la base de datos (en la tabla 'comentarios')
        await pool.query("INSERT INTO comentarios (alumno_id, comentario, fecha) VALUES (?, ?, NOW())", 
            [alumnoId, comentario]
        ); 

        // 2. Configurar el transporte de Gmail
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { 
                user: 'castagnanicolas08@gmail.com', // <---  GMAIL 
                pass: 'kdezptznxyenfxdf'  // <---  CONTRASEÑA DE APLICACIÓN 
            }
        });

        // 3. Definir el contenido del correo
        const mailOptions = {
            from: '"RuleMind - Plataforma Educativa" <castagnanicolas08@gmail.com>', // <---  GMAIL DEVUELTA
            to: emailAlumno,
            subject: '📝 Tienes un nuevo comentario de tu profesor',
            html: `
                <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #007bff;">¡Hola!</h2>
                    <p>Tu profesor ha corregido una de tus actividades y te ha dejado un mensaje:</p>
                    <blockquote style="background: #f9f9f9; padding: 15px; border-left: 5px solid #007bff;">
                        "${comentario}"
                    </blockquote>
                    <p>Ingresa a la plataforma para ver más detalles.</p>
                    <hr>
                    <small>Este es un mensaje automático de RuleMind.</small>
                </div>
            `
        };

        // 4. Enviar el mail
        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "Comentario guardado y mail enviado ✅" });

    } catch (err) {
        console.error("Error en el proceso de comentario/mail:", err);
        res.status(500).json({ success: false, message: "Error al procesar el envío." });
    }
});

// Obtener lista de alumnos para el selector del comentario
router.get("/alumnos-lista", authMiddleware(["profesor", "admin"]), async (req, res) => {
    try {
        // Traemos solo usuarios con rol 'alumno'
        const [alumnos] = await pool.query(
            "SELECT id, full_name, email FROM users WHERE role = 'alumno' ORDER BY full_name ASC"
        );
        res.json(alumnos);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener alumnos" });
    }
});

/* ============================
🔹 VERIFICACIÓN DE PROFESOR
=============================== */
router.get("/profesor-data", authMiddleware(["profesor"]), (req, res) => {
res.json({
    message: "Bienvenido profesor",
    user: req.user,
});
});

module.exports = router;