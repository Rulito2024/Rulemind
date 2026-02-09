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
            mostrarActividades(data.actividades); 
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

function mostrarActividades(activities) {
    const contenedor = document.getElementById("activitiesList");
    if (!contenedor) return;

    contenedor.innerHTML = ""; // Limpiar contenido previo

    if (!activities || activities.length === 0){
        contenedor.innerHTML = "<p class= 'loading-message'>No hay actividades disponibles por ahora.</p>";
        return;
    }

    activities.forEach(activity => { 
        const div = document.createElement("div");
        div.className = "actividad-card";
        
        // Muestra el contenido o el archivo
        const contenidoHTML = activity.contenido 
            ? `<p><strong>Tarea:</strong> ${activity.contenido}</p>` 
            : `<p>Archivo: ${activity.archivo || 'N/A'} (Descargar para responder)</p>`;

        div.innerHTML = `
            <h3>${activity.titulo || "Actividad sin Título"}</h3>
            <p>${activity.descripcion || "Sin descripción"}</p>
            ${contenidoHTML}
            
            <hr>
            
            <input type="text" id="respuesta-${activity.id}" placeholder="Escribe tu respuesta aquí..." class="respuesta-input">
            <button onclick="corregirActividad('${activity.id}')"> Corregir Respuesta </button>
            <div id="resultado-${activity.id}" class="resultado-feedback" style="margin-top: 10px;"></div>
        `;
        contenedor.appendChild(div);
    });
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