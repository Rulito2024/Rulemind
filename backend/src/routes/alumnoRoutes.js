const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const pool = require("../db");

const router = express.Router();

// 1. Obtener todas las actividades disponibles
router.get("/actividades", authMiddleware(["alumno", "Profesor"]), async (req, res) => {
    try {
        // Selecciona actividades que estén publicadas (publicado = 1/TRUE)
        const [rows] = await pool.query(
            "SELECT id, titulo, descripcion, contenido, archivo, regla_id FROM materiales WHERE tipo = 'actividades' AND publicado = 1 ORDER BY fecha DESC"
        );

        // ⭐ PARSEAR el contenido de cada actividad (LONGTEXT → JSON)
        const actividadesParseadas = rows.map(actividad => {
            try {
                // Solo parsear si contenido no está vacío
                if (actividad.contenido) {
                    actividad.contenido = JSON.parse(actividad.contenido);
                }
            } catch (e) {
                console.error(`Error al parsear contenido de actividad ID ${actividad.id}:`, e);
                // Mantener el contenido original si falla el parsing
            }
            return actividad;
        });

        res.json({ success: true, actividades: actividadesParseadas });
    } catch (err) {
        console.error("Error al obtener actividades:", err);
        res.status(500).json({ success: false, message: "Error al obtener actividades" });
    }
});

// 2. Obtener una actividad especifica por ID
router.get("/actividades/:id", authMiddleware(["alumno", "Profesor"]), async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            "SELECT * FROM materiales WHERE id = ? AND tipo = 'actividades' AND publicado = 1", 
            [id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Actividad no encontrada o no publicada" });
        }

        const actividad = rows[0];

        // ⭐ PARSEAR el contenido (LONGTEXT → JSON) - ESTO ES LO VITAL
        try {
            if (actividad.contenido) {
                actividad.contenido = JSON.parse(actividad.contenido);
            }
        } catch (e) {
            console.error(`Error al parsear contenido de actividad ID ${id}:`, e);
            return res.status(500).json({ 
                success: false, 
                message: "Error en el formato del contenido de la actividad" 
            });
        }

        res.json({ success: true, actividad });
    } catch (err) {
        console.error("Error al obtener actividad:", err);
        res.status(500).json({ success: false, message: "Error al obtener la actividad" });
    }
});

// 3. Evaluar la respuesta del alumno (Lógica de corrección y regla gramatical)
router.post("/actividades/corregir/:id", authMiddleware(["alumno"]), async (req, res) => {
    const { id } = req.params;
    const { respuesta_alumno } = req.body;

    if (!respuesta_alumno) {
        return res.status(400).json({ success: false, message: "La respuesta no puede estar vacía" });
    }

    try {
        let teoriaTexto = null;
        // Obtener la respuesta correcta y la regla asociada
        const [rows] = await pool.query(
            "SELECT respuesta_correcta, regla_id FROM materiales WHERE id = ? AND tipo = 'actividades' AND publicado = 1", 
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Actividad no encontrada o no publicada" });
        }

        const actividad = rows[0];
        // Normalización: elimina espacios extra y convierte a minúsculas
        const respuesta_correcta = actividad.respuesta_correcta ? actividad.respuesta_correcta.trim().toLowerCase() : '';
        const respuesta_enviada = respuesta_alumno.trim().toLowerCase();

        // Evaluación de la respuesta
        if (respuesta_enviada === respuesta_correcta && respuesta_correcta !== '') {
            return res.json({ success: true, message: "¡Respuesta Correcta! ✅" });
        }

        // Respuesta Incorrecta: Obtener la teoría si existe un regla_id
        if (actividad.regla_id) {
            const [reglaRows] = await pool.query(
                "SELECT teoria FROM reglas WHERE id = ?", 
                [actividad.regla_id]
            );
            if (reglaRows.length > 0) {
                teoriaTexto = reglaRows[0].teoria;
            }
        }

        // Enviar respuesta de error con la teoría
        res.json({ 
            success: false, 
            message: "Respuesta Incorrecta. Vuelve a intentarlo.",
            errorDetails: {
                teoria: teoriaTexto || "No hay teoría gramatical específica para este error."
            }
        });

    } catch (err) {
        console.error("Error al corregir actividad:", err);
        res.status(500).json({ success: false, message: "Error interno al corregir la actividad" });
    }
});

router.post("/responder", async (req, res) => {
    const { actividad_id, respuesta } = req.body;
    const alumno_id = req.user.id; // si usás auth

    try {
        // 1. Obtener actividad
        const [rows] = await pool.query(
            "SELECT respuesta_correcta FROM materiales WHERE id = ?",
            [actividad_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Actividad no encontrada" });
        }

        const correcta = rows[0].respuesta_correcta;

        // 2. Validar
        const esCorrecta = respuesta === correcta;

        // 3. Puntaje
        const puntaje = esCorrecta ? 10 : 0;

        // 4. Guardar resultado
        await pool.query(
            "INSERT INTO resultados (alumno_id, actividad_id, respuesta_usuario, es_correcta, puntaje) VALUES (?, ?, ?, ?, ?)",
            [alumno_id, actividad_id, respuesta, esCorrecta, puntaje]
        );

        res.json({
            success: true,
            esCorrecta,
            puntaje
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al responder" });
    }
});

router.get("/puntaje", async (req, res) => {
    const alumno_id = req.user.id; // si usás auth

    try {
        const [rows] = await pool.query(
            "SELECT SUM(puntaje) AS total FROM resultados WHERE alumno_id = ?",
            [alumno_id]
        );

        res.json({
            total: rows[0].total || 0
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error al obtener puntaje" });
    }
});

module.exports = router;