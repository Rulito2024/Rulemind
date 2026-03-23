let actividades = [];
let paginaActual = 1;
const porPagina = 7;
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("authToken");
    const role = localStorage.getItem("userRole");

    // Hacemos showToast y corregirActividad accesibles globalmente
    window.showToast = showToast;
    window.corregirActividad = corregirActividad;
    window.cerrarSesion = cerrarSesion;
    
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
    
    // Carga las actividades si es alumno
    cargarActividades(token);
});

// Función para mostrar el Toast (Necesaria para dar feedback)
function showToast(msg, ms = 3000) {
    // ASUMIENDO que tienes un elemento con ID="toast" en tu HTML
    const toast = document.getElementById("toast"); 
    if (!toast) {
        console.log(`TOAST: ${msg}`); // Si no hay toast, al menos lo loguea
        return;
    }
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
        
        if (data.success) { 
            actividades = data.actividades;
        mostrarPagina(1);
        } else {
            if (contenedor) {
                contenedor.innerHTML = "<p class='loading-message'> No hay actividades cargadas o ha ocurrido un error.</p>";
            }
            console.error("Error del servidor al cargar actividades:", data.message);
        }
    } catch (error) {
        console.error("Error de red al cargar actividades:", error);
        if (contenedor) {
            contenedor.innerHTML = "<p>Error de conexión al servidor.</p>";
        }
    }
}

function mostrarPagina(pagina) {
    paginaActual = pagina;

    // título nivel
    const titulo = document.getElementById("nivelTitulo");
    if (titulo) {
        titulo.innerText = "Nivel " + pagina;
    }

    // 👉 MOSTRAR REGLAS (no actividades)
    mostrarReglas(pagina);

    renderPaginacion();
}

function renderPaginacion() {
    const contenedor = document.getElementById("paginacion");
    if (!contenedor) return;

    const totalPaginas = 3;

    let html = "";

    // Flecha anterior
    if (paginaActual > 1) {
        html += `<button onclick="mostrarPagina(${paginaActual - 1})">⬅</button>`;
    }

    // Números
    for (let i = 1; i <= totalPaginas; i++) {
        html += `
            <button onclick="mostrarPagina(${i})"
                style="
                    margin:5px;
                    padding:10px;
                    ${i === paginaActual ? "background:#00aaff;color:white;" : ""}
                ">
                ${i}
            </button>
        `;
    }

    // Flecha siguiente
    if (paginaActual < totalPaginas) {
        html += `<button onclick="mostrarPagina(${paginaActual + 1})">➡</button>`;
    }

    contenedor.innerHTML = html;

    // 🔥 CENTRAR
    contenedor.style.textAlign = "center";
}
    
function mostrarReglas(pagina) {
    const contenedor = document.getElementById("activitiesList");

    const reglasPorNivel = {
        1: [
            "Diptongo, triptongo y hiato",
            "Tipos de palabras",
            "Acento prosódico",
            "Tildación de compuestas",
            "Uso del punto y coma",
            "Dos puntos, paréntesis y comillas",
            "Signos de puntuación"
        ],
        2: [
            "Uso de b",
            "Uso de v",
            "Uso de c y s",
            "Uso de c y z",
            "Uso de h",
            "Uso de g y j",
            "Uso de ll y y"
        ],
        3: [
            "Mayúsculas",
            "Homónimos",
            "Por qué / porque",
            "Adonde / donde",
            "Asimismo",
            "Conque / con qué",
            "Otros"
        ]
    };

    contenedor.innerHTML = "";

    reglasPorNivel[pagina].forEach((regla, index) => {
        const div = document.createElement("div");
        div.className = "actividad-card";

    div.innerHTML = `
    <h3>${regla}</h3>
    <div class="card-btn">
        <button onclick="abrirRegla(${index}, ${pagina})">Entrar</button>
    </div>
`;

        contenedor.appendChild(div);
    });
}

function abrirRegla(index, pagina) {
    const reglaId = (pagina - 1) * 7 + (index + 1);

    const filtradas = actividades.filter(a => a.regla_id == reglaId);

    mostrarActividades(filtradas);

    // 🔥 botón volver dinámico
    const contenedor = document.getElementById("activitiesList");

    const volverBtn = document.createElement("button");
    volverBtn.innerText = "⬅ Volver";
    volverBtn.onclick = () => mostrarReglas(pagina);

    contenedor.prepend(volverBtn);
}

function mostrarActividades(activities) {
    const contenedor = document.getElementById("activitiesList");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    if (!activities || activities.length === 0) {
        contenedor.innerHTML = "<p>No hay actividades disponibles.</p>";
        return;
    }

    activities.forEach(activity => {
        const div = document.createElement("div");
        div.className = "actividad-card";

        let contenidoHTML = "";

        const act = activity.contenido;
        if (!act) {
            contenidoHTML = "<p>Error: actividad sin contenido</p>";
        }

        // 🧠 NUEVO: según tipo de actividad
        else if (act.tipo === "multiple") {
            contenidoHTML = `
                <p><strong>${act.pregunta}</strong></p>
                ${act.opciones.map(op => `
                    <button onclick="responderMultiple(${activity.id}, '${op}')">${op}</button>
                `).join("")}
            `;
        }

        else if (act.tipo === "completar") {
            contenidoHTML = `
                <p><strong>${act.pregunta}</strong></p>
                <input type="text" id="respuesta-${activity.id}">
                <button onclick="responderTexto(${activity.id})">Responder</button>
            `;
        }

         // 🟢 TEXTO
        else if (act.tipo === "texto") {
            contenidoHTML = `
                <p><strong>${act.pregunta}</strong></p>
                <input type="text" id="respuesta-${activity.id}">
                <button onclick="responderTexto(${activity.id})">Responder</button>
            `;
        }

        // 🟢 CLASIFICAR
        else if (act.tipo === "clasificar") {
            contenidoHTML = `<p><strong>Clasificá:</strong></p>`;

            act.palabras.forEach(p => {
                contenidoHTML += `
                    <div>
                        ${p}
                        <select id="${p}-${activity.id}">
                            <option value="">--</option>
                            <option value="diptongo">Diptongo</option>
                            <option value="hiato">Hiato</option>
                            <option value="triptongo">Triptongo</option>
                        </select>
                    </div>
                `;
            });

            contenidoHTML += `<button onclick="validarClasificar(${activity.id})">Validar</button>`;
        }

        else {
            // 👇 TU SISTEMA ORIGINAL (NO LO PERDEMOS)
            contenidoHTML = `
                <p>${activity.contenido || "Sin contenido"}</p>
                <input type="text" id="respuesta-${activity.id}" placeholder="Escribe tu respuesta...">
                <button onclick="corregirActividad('${activity.id}')">Corregir</button>
            `;
        }

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
    const valor = input.value;

    if (!valor) {
        showToast("Escribe una respuesta");
        return;
    }

    validarRespuesta(id, valor);
}

function validarClasificar(id) {
    const actividad = actividades.find(a => a.id == id);
    const act = actividad.contenido;

    let correctas = 0;

    act.palabras.forEach(p => {
        const val = document.getElementById(`${p}-${id}`).value;
        if (val === act.respuestas[p]) correctas++;
    });

    const feedbackDiv = document.getElementById(`resultado-${id}`);

    if (correctas === act.palabras.length) {
        feedbackDiv.innerHTML = "✅ Todo correcto";
    } else {
        feedbackDiv.innerHTML = "❌ Hay errores";
    }
}

//validación inteligente
async function validarRespuesta(id, respuesta) {
    const token = localStorage.getItem("authToken");

    const res = await fetch(`http://localhost:4000/api/alumno/actividades/corregir/${id}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ respuesta_alumno: respuesta })
    });

    const data = await res.json();
    const feedbackDiv = document.getElementById(`resultado-${id}`);

    if (data.success) {
        feedbackDiv.innerHTML = `<p style="color: green;">✅ Correcto</p>`;
        showToast("Correcto");
    } else {
        const teoria = data.errorDetails?.teoria || "Sin explicación";

        feedbackDiv.innerHTML = `
            <p style="color:red;">❌ Incorrecto</p>
            <div style="background:#333;padding:10px;margin-top:5px;">
                <strong>Regla:</strong>
                <p>${teoria}</p>
            </div>
        `;

        showToast("Incorrecto");
    }
}




// Función corregir Actividad // 
async function corregirActividad(actividadId) {
    const token = localStorage.getItem("authToken");
    const inputRespuesta = document.getElementById(`respuesta-${actividadId}`);
    const feedbackDiv = document.getElementById(`resultado-${actividadId}`);
    const respuesta_alumno = inputRespuesta ? inputRespuesta.value : '';

    if (!respuesta_alumno) {
        showToast("Escribe una respuesta primero.");
        return;
    }

    // Limpiar feedback anterior
    feedbackDiv.innerHTML = '<p style="color: #00aaff;">Corrigiendo...</p>';
    
    try {
        const res = await fetch(`http://localhost:4000/api/alumno/actividades/corregir/${actividadId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ respuesta_alumno })
        });

        const data = await res.json();
        
        if (data.success) {
            // Respuesta Correcta
            feedbackDiv.innerHTML = `<p style="color: #4CAF50; font-weight: bold;">${data.message}</p>`; // Verde
            showToast(data.message);
        } else {
            // Respuesta Incorrecta: Muestra el error y la teoría
            const teoria = (data.errorDetails && data.errorDetails.teoria) 
                        ? data.errorDetails.teoria 
                        : "No hay teoría gramatical específica para este error.";
            
            feedbackDiv.innerHTML = `
                <p style="color: #F44336; font-weight: bold;">${data.message}</p> 
                <div style="background: #333; padding: 10px; border-left: 5px solid #F44336; margin-top: 10px; border-radius: 4px;">
                    <strong>📚 Regla Gramatical Asociada:</strong>
                    <p>${teoria}</p>
                </div>
            `;
            showToast("Respuesta incorrecta. Revisa la teoría.");
        }
    } catch (err) {
        console.error("Error de red al corregir:", err);
        feedbackDiv.innerHTML = `<p style="color: #F44336;">Error de conexión con el servidor. (Revisa el backend)</p>`;
        showToast("Error de conexión al servidor.");
    }
}
// 


function cerrarSesion() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    window.location.href = "loguearse.html";
}