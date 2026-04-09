const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const pool = require("../db");

const router = express.Router();

// ============================================================
// Obtener reglas gramaticales paginadas (6 por página)
// ============================================================
router.get("/reglas-paginadas", authMiddleware(["alumno"]), async (req, res) => {
    try {
        // Capturamos la página (ej: ?page=1). Si no existe, por defecto es 1.
        const pagina = parseInt(req.query.page) || 1;
        const limite = 6; 
        const offset = (pagina - 1) * limite;

        // Consulta a la tabla 'reglas' usando el orden que creamos
        const [rows] = await pool.query(
            "SELECT id, nombre, teoria, palabra_clave FROM reglas ORDER BY orden ASC, id ASC LIMIT ? OFFSET ?",
            [limite, offset]
        );

        // Obtenemos el total para informar al frontend
        const [[{ total }]] = await pool.query("SELECT COUNT(*) as total FROM reglas");

        res.json({
            success: true,
            reglas: rows,
            paginaActual: pagina,
            totalPaginas: Math.ceil(total / limite) || 11,
            totalReglas: total
        });

    } catch (err) {
        console.error("Error al obtener reglas paginadas:", err);
        res.status(500).json({ 
            success: false, 
            message: "Error al cargar el panel de reglas" 
        });
    }
});


//  Obtener todas las actividades disponibles
router.get("/actividades", authMiddleware(["alumno", "Profesor"]), async (req, res) => {
    try {
        // Selecciona actividades que estén publicadas (publicado = 1/TRUE)
        const [rows] = await pool.query(
            "SELECT id, titulo, descripcion, contenido, archivo, regla_id FROM materiales WHERE tipo = 'actividades' AND publicado = 1 ORDER BY fecha DESC"
        );

        //  PARSEAR el contenido de cada actividad (LONGTEXT → JSON)
        const actividadesParseadas = rows.map(actividad => {
        if (actividad.contenido && typeof actividad.contenido === 'string') {
                try {
                    actividad.contenido = JSON.parse(actividad.contenido);
                } catch (e) {
                    console.error(`Error parseando actividad ID ${actividad.id}`);
                }
            }
            return actividad;
        });

        res.json({ success: true, actividades: actividadesParseadas });
    } catch (err) {
        console.error("Error al obtener actividades:", err);
        res.status(500).json({ success: false, message: "Error al obtener actividades" });
    }
});   

// Obtener una actividad especifica por ID
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

        // PARSEAR el contenido (LONGTEXT → JSON)
    if (actividad.contenido && typeof actividad.contenido === 'string') {
            try {
                actividad.contenido = JSON.parse(actividad.contenido);
            } catch (e) {
                console.error("Error al parsear contenido");
            }
        }

        res.json({ success: true, actividad });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error al obtener la actividad" });
    }
});

// Evaluar la respuesta del alumno (Lógica de corrección y regla gramatical)
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
            "SELECT respuesta_correcta, regla_id, contenido FROM materiales WHERE id = ? AND tipo = 'actividades' AND publicado = 1", 
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Actividad no encontrada o no publicada" });
        }

        const actividad = rows[0];
        const respuesta_correcta = (actividad.respuesta_correcta || '').trim().toLowerCase();
        const respuesta_enviada = respuesta_alumno.trim().toLowerCase();

        // Utilidades de validación
        const contarSilabas = (palabra) => (palabra.match(/[^aeiouáéíóúü]*[aeiouáéíóúü]+/g) || []).length;
        const tieneDiptongo = (palabra) => /(ai|au|ei|eu|oi|ou|ia|ie|io|ua|ue|uo|iu|ui)/i.test(palabra);

// =========================================
        // 🔹 BLOQUE DE VALIDACIONES DE ÉXITO (Completo)
        // =========================================
        
        let esCorrecto = false;

        // 1. VALIDACIÓN "CONTIENE:"
        if (respuesta_correcta.startsWith("contiene:")) {
            const patron = respuesta_correcta.split(":")[1].trim();
            if (respuesta_enviada.includes(patron)) esCorrecto = true;
        } 
        
        // 2. VALIDACIÓN FLEXIBLE PARA DIPTONGOS
        else if (respuesta_correcta === "flexible_diptongo") {
            if (contarSilabas(respuesta_enviada) === 3 && tieneDiptongo(respuesta_enviada)) esCorrecto = true;
        }
        
        // 3. VALIDACIÓN FLEXIBLE PARA TIPO DE PALABRAS (auto:)
        else if (respuesta_correcta.startsWith("auto:")) {
            const tipo = respuesta_correcta.split(":")[1];
            const n = contarSilabas(respuesta_enviada);
            if ((tipo === "bisilaba" && n === 2) || 
                (tipo === "monosilaba" && n === 1) || 
                (tipo === "trisilaba" && n === 3) || 
                (tipo === "polisilaba" && n >= 4)) esCorrecto = true;
        }
        
        // 4. VALIDACIÓN DESDE JSON EN CONTENIDO
        else if (actividad.contenido) {
            try {
                const cont = typeof actividad.contenido === 'string' ? JSON.parse(actividad.contenido) : actividad.contenido;
                if (cont.validacion === "polisilaba" && contarSilabas(respuesta_enviada) >= 4) {
                    esCorrecto = true;
                }
            } catch (e) { /* Error silencioso en el parseo */ }
        }

        // 5. VALIDACIÓN NORMAL (Igualdad directa)
        // Se ejecuta si ninguna de las anteriores marcó éxito o si no tienen prefijos
        if (!esCorrecto && respuesta_enviada === respuesta_correcta && respuesta_correcta !== '') {
            esCorrecto = true;
        }

        // Si después de pasar por todos los filtros esCorrecto es true, enviamos respuesta
        if (esCorrecto) {
            return res.json({ success: true, message: "¡Respuesta Correcta! ✅" });
        }

        // =========================================
        // 🔹 BLOQUE DE ERROR (Si llega aquí es porque falló)
        // =========================================
        
        // 2. LÓGICA PARA EL ID 3 (Mensaje corto)
        if (id == "3") {
            teoriaTexto = "Incorrecto ya que las vocales se clasifican en: abiertas y son la a, e y la o y cerradas las cuales son la i y la u.";
        }

        // --- MENSAJE PARA ACTIVIDAD ID: 4 (La de la nueva imagen) ---
        else if (id == "4") {
            teoriaTexto = "Es incorrecto ya que el diptongo es la unión de dos vocales en una misma sílaba y porque las vocales se clasifican en: abiertas y son la a, e y la o y cerradas las cuales son la i y la u.";
        }

        // Obtener teoría si hay regla asociada
        else if (actividad.regla_id) {
            const [reglaRows] = await pool.query(
                "SELECT teoria FROM reglas WHERE id = ?", 
                [actividad.regla_id]
            );
            if (reglaRows.length > 0) {
                teoriaTexto = reglaRows[0].teoria;
            }
        }

        res.json({ 
            success: false, 
            message: "Respuesta Incorrecta. Vuelve a intentarlo.",
            errorDetails: {
                teoria: teoriaTexto || "Revise la regla gramatical."
            }
        });

    } catch (err) {
        console.error("Error al corregir actividad:", err);
        res.status(500).json({ success: false, message: "Error interno al corregir la actividad" });
    }
});

router.post ("/responder", authMiddleware(["alumno"]), async (req, res) => {
const { actividad_id, respuesta } = req.body;
    try {
        const [rows] = await pool.query("SELECT respuesta_correcta FROM materiales WHERE id = ?", [actividad_id]);
        if (rows.length === 0) return res.status(404).json({ message: "Actividad no encontrada" });

        const esCorrecta = respuesta.trim().toLowerCase() === rows[0].respuesta_correcta.trim().toLowerCase();
        const puntaje = esCorrecta ? 10 : 0;

        await pool.query(
            "INSERT INTO resultados (alumno_id, actividad_id, respuesta_usuario, es_correcta, puntaje) VALUES (?, ?, ?, ?, ?)",
            [req.user.id, actividad_id, respuesta, esCorrecta, puntaje]
        );

        res.json({ success: true, esCorrecta, puntaje });
    } catch (err) {
        res.status(500).json({ message: "Error al responder" });
    }
}); 

router.get("/puntaje", authMiddleware(["alumno"]), async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT SUM(puntaje) AS total FROM resultados WHERE alumno_id = ?", [req.user.id]);
        res.json({ total: rows[0].total || 0 });
    } catch (err) {
        res.status(500).json({ message: "Error al obtener puntaje" });
    }
});

module.exports = router;