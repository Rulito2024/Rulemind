let actividades = [];
let puntaje = 0;

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("authToken");
    const role = localStorage.getItem("userRole");
    
    // Hacemos showToast y corregirActividad accesibles globalmente
    window.showToast = showToast;
    window.cerrarSesion = cerrarSesion;
    window.responderMultiple = responderMultiple;
    window.responderTexto = responderTexto;
    window.validarClasificar = validarClasificar;

    if (!token) {
        // Si no hay token, lo mando de vuelta al login
        window.location.href = "loguearse.html";
        return
    } 

       // Si es profesor o tiene otro rol, redirigir o mostrar advertencia
    if (role !== "alumno") {
        console.warn("No tienes los permisos para ver este contenido.");
        document.body.innerHTML = "<h2> No tienes permisos para acceder a esta sección.</h2>";
        return;
    }

    console.log("Sesión activa: ", role);

    // cargamos las reglas desde la DB
    cargarReglasPaginadas(1);
    
    // 2. Cargamos las actividades y, al terminar, verificamos el estado
    cargarActividades(token).then(() => {
        verificarEstadoRegla();
    });
});
    


function actualizarPuntaje(puntos) {
    puntaje += puntos;
    const puntajeDiv = document.getElementById("puntaje");
    if (puntajeDiv) {
        puntajeDiv.innerText = "Puntaje: " + puntaje;
    }
}

// Función para mostrar el Toast (Necesaria para dar feedback)
function showToast(msg, ms = 3000) {
    const toast = document.getElementById("toast"); 
    if (!toast) return;
    toast.textContent = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(20px)";
    }, ms);
}

async function cargarActividades(token) {
const contenedor = document.getElementById("activitiesList");
    
    // Mantenemos el mensaje de carga inicial
    if (contenedor) {
        contenedor.innerHTML = "<p class='loading-message'>Cargando actividades disponibles...</p>";
    }

    try {
        const res = await fetch("http://localhost:4000/api/alumno/actividades", { 
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await res.json();
        console.log("Respuesta completa del servidor:", data); // DEBUG original

        if (data.success) { 
            actividades = data.actividades;
            console.log("Actividades cargadas:", actividades); // DEBUG original
            
            // Sincronización de puntaje con el backend
            if (data.hasOwnProperty('puntajeTotal')) {
                puntaje = data.puntajeTotal;
                console.log("Puntaje actualizado a:", puntaje);
            } else {
                console.warn("El backend NO envió puntajeTotal. Revisa alumnoRoutes.js");
                puntaje = 0; 
            }

            // Actualización del DOM del puntaje
            const puntajeDiv = document.getElementById("puntaje");
            if (puntajeDiv) {
                puntajeDiv.innerText = "Puntaje: " + puntaje;
            }

            // Limpiamos el mensaje de carga si hay éxito
            if (contenedor) {
                contenedor.innerHTML = ""; 
            }

        } else {
            // Este es el bloque que recuperamos de tu código
            if (contenedor) {
                contenedor.innerHTML = "<p class='loading-message'> No hay actividades cargadas o ha ocurrido un error.</p>";
            }
            console.error("Error del servidor:", data.message);
        }
    } catch (error) {
        console.error("Error de red:", error);
        if (contenedor) {
            contenedor.innerHTML = "<p class='loading-message'>Error de conexión al servidor.</p>";
        }
    }
}

//  función para traer las reglas reales de la DB
async function cargarReglasPaginadas(pagina) {
    const token = localStorage.getItem("authToken");
    try {
        const res = await fetch(`http://localhost:4000/api/alumno/reglas-paginadas?page=${pagina}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            // Dibujamos las cartas de reglas
            renderizarReglasDB(data.reglas);
            // Dibujamos la paginación de las reglas
            renderPaginacionReglas(data.paginaActual, data.totalPaginas);
        }
    } catch (error) {
        console.error("Error al cargar reglas:", error);
    }
}

function renderizarReglasDB(reglas) {
    const contenedor = document.getElementById("contenedor-reglas");
    contenedor.innerHTML = "";

    reglas.forEach(regla => {
        const div = document.createElement("div");
        div.className = "card-regla";
        div.innerHTML = `
            <h3>${regla.nombre}</h3>
            <div class="card-btn">
                <button onclick="seleccionarRegla(${regla.id}, '${regla.nombre}')">Entrar</button>
            </div>
        `;
        contenedor.appendChild(div);
    });
}

function renderPaginacionReglas(actual, total) {
    const contenedor = document.getElementById("paginacion-reglas");
    if (!contenedor) return;
    contenedor.innerHTML = `
        <button onclick="cargarReglasPaginadas(${actual - 1})" ${actual === 1 ? 'disabled' : ''}>⬅</button>
        <span>Página ${actual} de ${total}</span>
        <button onclick="cargarReglasPaginadas(${actual + 1})" ${actual === total ? 'disabled' : ''}>➡</button>
    `;
}

function seleccionarRegla(id, nombre) {
    // GUARDAR EN STORAGE para que aguante el F5
    localStorage.setItem("reglaActualId", id);
    localStorage.setItem("reglaActualNombre", nombre);
    // 1. Ocultamos el bloque completo de reglas (grilla + paginación + subtítulo)
    const seccionReglas = document.getElementById("seccion-seleccion-reglas");
    if (seccionReglas) seccionReglas.style.display = "none";
    
    // 2. Mostramos el bloque completo de actividades
    const seccionActividades = document.getElementById("seccion-actividades-dinamicas");
    if (seccionActividades) seccionActividades.style.display = "block";
    
    // 3. Actualizamos el título con el nombre de la regla elegida
    const titulo = document.getElementById("nivelTitulo");
    if (titulo) titulo.innerText = nombre;

    // 4. Filtramos las actividades que pertenecen a esta regla
    const filtradas = actividades.filter(a => a.regla_id == id);
    
    // 5. Renderizamos las actividades en el contenedor
    mostrarActividades(filtradas);

    // 6. Creamos el botón "Volver" dinámicamente
    const contenedor = document.getElementById("activitiesList");
    
    // Limpiamos cualquier botón de volver previo si existiera (por seguridad)
    const viejoBtn = document.querySelector(".btn-volver-dinamico");
    if (viejoBtn) viejoBtn.remove();

    const btnVolver = document.createElement("button");
    btnVolver.innerHTML = "⬅ Volver a las reglas";
    btnVolver.className = "btn-nav btn-volver-dinamico"; 
    btnVolver.style.marginBottom = "20px";
    
    btnVolver.onclick = () => {
        localStorage.removeItem("reglaActualId");
        localStorage.removeItem("reglaActualNombre");
        // PROCESO INVERSO: Volver a la grilla 3x3
        if (seccionReglas) seccionReglas.style.display = "block";
        if (seccionActividades) seccionActividades.style.display = "none";
        window.scrollTo(0, 0);
    };

    // Lo ponemos arriba de todo en la lista de actividades
    contenedor.prepend(btnVolver);
    
    // 7. Scroll al inicio para que el alumno vea la actividad desde arriba
    window.scrollTo(0, 0);
}

function mostrarActividades(activities) {
    const contenedor = document.getElementById("activitiesList");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    if (!activities || activities.length === 0) {
        contenedor.innerHTML = "<p>No hay actividades disponibles para esta regla.</p>";
        return;
    }

    activities.forEach(activity => {
        const div = document.createElement("div");
        div.className = "actividad-card";

        // --- LÓGICA DE BLOQUEO SI YA ESTÁ COMPLETADA ---
        if (activity.completada === 1) {
            div.innerHTML = `
                <h3>${activity.titulo || "Actividad"}</h3>
                <p style="color: #4CAF50; font-weight: bold; background: rgba(76, 175, 80, 0.1); padding: 10px; border-radius: 5px; border-left: 5px solid #4CAF50;">
                    ✅ Ya has aprobado esta actividad.
                </p>
                <button disabled style="background: #555; cursor: not-allowed; opacity: 0.7;">Completada</button>
            `;
            contenedor.appendChild(div);
            return; // Saltamos el resto de la lógica para esta tarjeta
        }

        // --- LÓGICA NORMAL (Si no está completada) ---
        let contenidoHTML = "";
        const act = activity.contenido;

        if (!act) {
            contenidoHTML = "<p>Error: actividad sin contenido</p>";
        } else if (act.tipo === "multiple") {

            contenidoHTML = `
                <p><strong>${act.pregunta}</strong></p>
                ${act.opciones.map(op => `
                    <button onclick="responderMultiple(${activity.id}, '${op}')">${op}</button>
                `).join("")}
            `;
        } else if (act.tipo === "completar" || act.tipo === "texto") {
            contenidoHTML = `
                <p><strong>${act.pregunta}</strong></p>
                <input type="text" id="respuesta-${activity.id}">
                <button onclick="responderTexto(${activity.id})">Responder</button>
            `;

        }

        //  CLASIFICAR
        else if (act.tipo === "clasificar") {
            contenidoHTML = `<p><strong>Clasificá:</strong></p>`;
        
            //Detecta automáticamente las opciones desde las respuestas
        const opcionesUnicas = [...new Set(Object.values(act.respuestas))];
        act.palabras.forEach(p => {
                contenidoHTML += `
                    <div style="margin-bottom: 8px;">
                        <span>${p}</span>
                        <select id="${p}-${activity.id}">
                            <option value="">--</option>
                            ${opcionesUnicas.map(op => `
                                <option value="${op}">${op}</option>
                            `).join("")}
                        </select>
                    </div>
                `;
            });

            contenidoHTML += `<button onclick="validarClasificar(${activity.id})">Validar</button>`;
        } 
        
        // --- CASO POR DEFECTO (Si no coincide ningún tipo) ---
        else {
            contenidoHTML = `
                <p>${activity.descripcion || "Sin descripción"}</p>
                <input type="text" id="respuesta-${activity.id}" placeholder="Escribe tu respuesta...">
                <button onclick="responderTexto(${activity.id})">Responder</button>
            `;
        }

        // --- ARMADO FINAL DE LA CARD (Sin bloques huérfanos) ---
        div.innerHTML = `
            <h3>${activity.titulo || "Actividad"}</h3>
            <p>${activity.descripcion || ""}</p>
            ${contenidoHTML}
            <div id="resultado-${activity.id}"></div>
        `;

        contenedor.appendChild(div);
    });
}

//multiple choice
function responderMultiple(id, opcion) {
    validarRespuesta(id, opcion);
}

//texto/completar
function responderTexto(id) {
    const input = document.getElementById(`respuesta-${id}`);
    if (!input || !input.value.trim()) {
        showToast("Escribe una respuesta");
        return;
    }
    validarRespuesta(id, input.value.trim());
}

function validarClasificar(id) {
    const actividad = actividades.find(a => a.id == id);
    const act = actividad.contenido;
    const feedbackDiv = document.getElementById(`resultado-${id}`);

    let aciertos = 0;
    let errorPorExceso = false;  // Marcó Diptongo donde no hay
    let errorPorDefecto = false; // No marcó Diptongo donde sí hay

    act.palabras.forEach(p => {
        const selectElement = document.getElementById(`${p}-${id}`);
        const respuestaAlumno = selectElement.value;
        const respuestaCorrecta = act.respuestas[p];

        if (respuestaAlumno === respuestaCorrecta) {
            aciertos++;
    } else {
            // NUEVO: Lógica de pistas refinada
            if (respuestaAlumno !== "No" && respuestaAlumno !== "" && respuestaCorrecta === "No") {
                errorPorExceso = true;
            } 
            else if ((respuestaAlumno === "No" || respuestaAlumno === "") && respuestaCorrecta !== "No") {
                errorPorDefecto = true;
            }
        }
    });

    if (aciertos === act.palabras.length) {
        validarRespuesta(id, "clasificacion_correcta_trigger");
        showToast("¡Excelente!");
    } else {
        actualizarPuntaje(-5);
        
        // Construimos el mensaje de pistas pedagógicas
        let mensajePista = `<div style="background: #222; padding: 15px; border-left: 5px solid #F44336; margin-top: 10px; border-radius: 8px;">
                                <strong style="color: #F44336;">Hay errores en la clasificación:</strong><br><br>`;
        
        if (errorPorExceso) {
            mensajePista += `<p style="color: #ccc; font-size: 0.95em; margin-bottom: 8px;">⚠️ <strong>Pista:</strong> Una de las palabras que marcaste NO tiene diptongo. Recordá que el diptongo es la unión de dos vocales en una misma sílaba.</p>`;
        }
        
        if (errorPorDefecto) {
            mensajePista += `<p style="color: #ccc; font-size: 0.95em;">⚠️ <strong>Pista:</strong> Te olvidaste de marcar una palabra que SÍ tiene diptongo. Buscá dónde hay vocales juntas que no se separan.</p>`;
        }

        mensajePista += `</div>`;
        
        feedbackDiv.innerHTML = mensajePista;
        showToast("Revisa las pistas y vuelve a intentarlo.");
    }
}

async function validarRespuesta(id, respuesta) {
    const token = localStorage.getItem("authToken");
    const feedbackDiv = document.getElementById(`resultado-${id}`);

    // SEGURIDAD, Validación de entrada vacía
    if (!respuesta || (typeof respuesta === "string" && respuesta.trim() === "")) {
        showToast("Escribe o selecciona una respuesta.");
        return; 
    }

    // 2. Feedback visual inmediato de "Cargando"
    if (feedbackDiv) {
        feedbackDiv.innerHTML = '<p style="color: #00aaff;">Verificando respuesta...</p>';
    }

    try {
        const res = await fetch(`http://localhost:4000/api/alumno/actividades/corregir/${id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ respuesta_alumno: respuesta })
        });

        const data = await res.json();

        if (data.success) {
            feedbackDiv.innerHTML = `<p style="color: #4CAF50; font-weight: bold;">✅ ¡Correcto!</p>`;
            showToast("¡Correcto! Actividad guardada.");
            actualizarPuntaje(10);

            //  ACTUALIZACIÓN LOCAL:
            // Buscamos la actividad en el array global y la marcamos como completada
            const index = actividades.findIndex(a => a.id == id);
            if (index !== -1) {
                actividades[index].completada = 1;
            }

            // Podés hacer que después de 2 segundos se bloquee la tarjeta automáticamente
            setTimeout(() => {
                // Volvemos a filtrar las actividades de la regla actual para que se redibuje la lista bloqueada
                const reglaId = actividades[index].regla_id;
                const filtradas = actividades.filter(a => a.regla_id == reglaId);
                mostrarActividades(filtradas);
            }, 2000);

        } else {
            const teoria = data.errorDetails?.teoria || "Revisa la regla ortográfica e intenta de nuevo.";
            feedbackDiv.innerHTML = `
            <div style="background: #222; padding: 12px; margin-top: 10px; border-radius: 8px; border-left: 4px solid #F44336;">
                    <strong style="color: #F44336;">❌ Incorrecto</strong>
                    <p style="color: #ccc; font-size: 0.9em; margin-top: 5px;"><strong>Recordá:</strong> ${teoria}</p>
                </div>
            `;
            showToast("Incorrecto");
            actualizarPuntaje(-5);
        }
    } catch (error) {
        console.error("Error al validar:", error);
        showToast("Error de conexión");
    }
}

function verificarEstadoRegla() {
    const guardadoId = localStorage.getItem("reglaActualId");
    const guardadoNombre = localStorage.getItem("reglaActualNombre");

    if (guardadoId && guardadoNombre) {
        seleccionarRegla(guardadoId, guardadoNombre);
    }
}

function cerrarSesion() {
    // NUEVO: Limpia absolutamente todo el almacenamiento local por seguridad
    localStorage.clear(); 
    // SE MANTIENE: Redirección al login
    window.location.href = "loguearse.html";
}