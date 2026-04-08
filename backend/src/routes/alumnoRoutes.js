const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const pool = require("../db");

const router = express.Router();

// 1. Obtener todas las actividades disponibles
router.get("/actividades", authMiddleware(["alumno", "Profesor"]), async (req, res) => {
    try {
        const usuarioId = req.user.id;

        // 1. Obtener actividades con su estado de completado
        const [rows] = await pool.query(
            `SELECT m.*, IF(p.id IS NOT NULL, 1, 0) AS completada 
             FROM materiales m 
             LEFT JOIN progreso_alumnos p ON m.id = p.actividad_id AND p.alumno_id = ?
             WHERE m.tipo = 'actividades' AND m.publicado = 1 
             ORDER BY m.fecha DESC`, 
            [usuarioId]
        );

        // 2. OBTENER EL PUNTAJE REAL DEL USUARIO (Esto es lo que falta)
        const [userRows] = await pool.query("SELECT puntaje FROM users WHERE id = ?", [usuarioId]);
        
        // Si por alguna razón no hay usuario, ponemos 0
        const puntajeActual = userRows.length > 0 ? userRows[0].puntaje : 0;

        // Parsear el contenido JSON de las actividades
        const actividadesParseadas = rows.map(actividad => {
            try {
                if (actividad.contenido) {
                    actividad.contenido = JSON.parse(actividad.contenido);
                }
            } catch (e) {
                console.error(`Error parseando actividad ${actividad.id}`);
            }
            return actividad;
        });

        // 3. ENVIAR LA RESPUESTA COMPLETA
        res.json({ 
            success: true, 
            actividades: actividadesParseadas, 
            puntajeTotal: puntajeActual // <--- ESTO es lo que espera el frontend
        });

    } catch (err) {
        console.error("Error al obtener actividades:", err);
        res.status(500).json({ success: false, message: "Error al obtener actividades" });
    }
});
// 2. Obtener una actividad especifica por ID
router.get("/actividades/:id", authMiddleware(["alumno", "Profesor"]), async (req, res) => {
    try {
        const { id } = req.params;
        const usuarioId = req.user.id; // Obtenemos el ID del usuario desde el middleware de auth

        // Modificamos la consulta para incluir el estado de progreso
        const [rows] = await pool.query(
            `SELECT m.*, 
             IF(p.id IS NOT NULL, 1, 0) AS completada 
             FROM materiales m 
             LEFT JOIN progreso_alumnos p ON m.id = p.actividad_id AND p.alumno_id = ?
             WHERE m.id = ? AND m.tipo = 'actividades' AND m.publicado = 1`, 
            [usuarioId, id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Actividad no encontrada o no publicada" });
        }

        const actividad = rows[0];

        // Si es un alumno y la actividad ya figura como completada, podrías bloquearla aquí mismo
        // o simplemente enviar el flag 'completada' para que el frontend decida qué mostrar.
        if (req.user.rol === "alumno" && actividad.completada === 1) {
            // Opción A: Mandar la info pero avisar que está hecha
            // Opción B: Podrías retornar un error si no quieres que ni siquiera vea el contenido
            // Vamos con la Opción A para que el frontend pueda mostrar el mensaje "Ya la aprobaste"
        }

        // PARSEAR el contenido (LONGTEXT → JSON)
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
// Ejemplo en la ruta de corrección
// 3. Evaluar la respuesta del alumno (Lógica de corrección, bloqueo y puntos)
router.post("/actividades/corregir/:id", authMiddleware(["alumno"]), async (req, res) => {
    const { id } = req.params; // ID de la actividad
    const alumnoId = req.user.id; // ID del alumno desde el token
    const { respuesta_alumno } = req.body;

    try {
        // --- BLOQUEO DE SEGURIDAD (Punto 3) ---
        // Verificamos si ya existe en progreso_alumnos antes de hacer nada
        const [yaHecha] = await pool.query(
            "SELECT id FROM progreso_alumnos WHERE alumno_id = ? AND actividad_id = ?",
            [alumnoId, id]
        );

        if (yaHecha.length > 0) {
            return res.status(403).json({ 
                success: false, 
                message: "Esta actividad ya fue aprobada anteriormente y no suma más puntos." 
            });
        }

        // 1. Obtener la actividad para comparar la respuesta
        const [rows] = await pool.query(
            "SELECT respuesta_correcta FROM materiales WHERE id = ? AND publicado = 1",
            [id]
        );

        if (rows.length === 0) return res.status(404).json({ success: false, message: "Actividad no encontrada" });

        const esCorrecta = (respuesta_alumno.trim().toLowerCase() === rows[0].respuesta_correcta.trim().toLowerCase());

        if (esCorrecta) {
            // 2. GUARDAR PROGRESO
            await pool.query(
                "INSERT IGNORE INTO progreso_alumnos (alumno_id, actividad_id) VALUES (?, ?)",
                [alumnoId, id]
            );

            // 3. SUMAR PUNTOS AL USUARIO EN LA DB
            // Esto asegura que el puntaje no se borre al recargar
            await pool.query(
                "UPDATE users SET puntaje = puntaje + 10 WHERE id = ?",
                [alumnoId]
            );
            
            return res.json({ 
                success: true, 
                message: "¡Correcto! Actividad completada y +10 puntos guardados. ✅" 
            });
        } else {
            return res.json({ success: false, message: "Respuesta incorrecta. Inténtalo de nuevo." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error al procesar la actividad" });
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