const express = require("express");
const multer = require("multer");
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
    // Obtiene 'reglas' o 'actividades' del URL (ej: /upload/reglas)
    const tipoSubida = req.url.split('/').pop(); 

    if (tipoSubida === 'reglas') {
        // Solo permitir PDF para reglas
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error("Solo se permiten archivos PDF (.pdf) para reglas gramaticales."), false);
        }
    } else if (tipoSubida === 'actividades') {
        // Solo permitir Word (DOC o DOCX) para actividades
        if (file.mimetype === 'application/msword' || 
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            cb(null, true);
        } else {
            cb(new Error("Solo se permiten archivos de Word (.doc o .docx) para actividades."), false);
        }
    } else {
        cb(new Error("Ruta de subida no válida o tipo desconocido."), false);
    }
};

// Modificar la inicialización de Multer para usar el filtro
const upload = multer({ 
    storage, 
    fileFilter // Aplicamos el filtro de extensiones
}); 

// NUEVO: Middleware para capturar el error de Multer/fileFilter y devolver una respuesta JSON
router.use((err, req, res, next) => {
    // Captura errores específicos de Multer o errores generados por fileFilter
    if (err instanceof multer.MulterError || err.message.includes("Solo se permiten")) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next(err); // Pasa otros errores al manejador por defecto
});

/* SUBIR ARCHIVOS */

// Subir reglas gramaticales
router.post("/upload/reglas", authMiddleware(["profesor"]), upload.single("file"), async (req, res) => {
    try {
        // CORRECCIÓN: Insertar en la tabla 'materiales' con tipo 'reglas'
        if (!req.file) { // Añadimos una verificación de seguridad en el backend
            return res.status(400).json({ success: false, message: "No se proporcionó ningún archivo" });
        }

        await pool.query("INSERT INTO materiales (tipo, archivo) VALUES (?, ?)", [
            "reglas", 
            req.file.filename,
        ]);
        res.json({ success: true, message: "Reglas subidas correctamente", file: req.file });
    } catch (err) {
        console.error("Error al subir reglas:", err);
        res.status(500).json({ success: false, message: "Error al subir reglas" });
    }
});

//Crear una actividad con contenido y respuesta en línea
router.post("/crear/actividad/online", authMiddleware(["profesor"]), async (req, res) => {
    const { titulo, descripcion, contenido, respuesta_correcta, regla_id } = req.body;

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

// Ver materiales subidos (Reglas y Actividades Subidas por Archivo)
router.get("/materiales", authMiddleware(["profesor"]), async (req, res) => {
    try {
        const [rows] = await pool.query(
            // CONSULTA CORREGIDA: Incluye 'titulo'/'descripcion' y usa 'fecha'.
            "SELECT id, tipo, archivo, titulo, descripcion, fecha, publicado FROM materiales ORDER BY fecha DESC"
        );
        // Devolvemos el array de filas directamente, como acordamos.
        res.json(rows); 
    } catch (err) {
        console.error("Error al obtener materiales:", err);
        res.status(500).json({ success: false, message: "Error al obtener materiales" });
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

// Enviar comentario a un alumno
router.post("/comentario", authMiddleware(["profesor"]), async (req, res) => {
    try {
        const { alumnoId, comentario } = req.body;
        if (!alumnoId || !comentario)
            return res.status(400).json({ success: false, message: "Faltan datos" });

        await pool.query("INSERT INTO comentarios (alumno_id, comentario) VALUES (?, ?)", [
            alumnoId,
            comentario,
        ]);
        res.json({ success: true, message: "Comentario enviado correctamente ✅" });
    } catch (err) {
        console.error("Error al enviar comentario:", err);
        res.status(500).json({ success: false, message: "Error al enviar comentario" });
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