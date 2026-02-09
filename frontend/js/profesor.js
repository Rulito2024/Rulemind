document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("authToken");
    const role = localStorage.getItem("userRole");

    // Función para mostrar el Toast
    function showToast(msg, ms = 3000) {
        const toast = document.getElementById("toast");
        if (!toast) return console.log(`TOAST: ${msg}`); 
        toast.textContent = msg;
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateX(-50%) translateY(20px)";
        }, ms);
    }

    // Hacemos funciones necesarias accesibles globalmente
    window.showToast = showToast; 
    window.eliminarMaterial = eliminarMaterial; 
    window.cambiarEstadoPublicacion = cambiarEstadoPublicacion; // ¡NUEVA!
    
    // --- Verificación y redirección ---
    if (!token) {
        window.location.href = "loguearse.html";
        return;
    } else if (role !== "profesor") {
        alert("Acceso denegado. Solo los profesores pueden entrar aquí.");
        window.location.href = "loguearse.html";
        return;
    }

    console.log("Sesión activa con rol:", role);

    // --- Carga inicial de datos ---
    //fetchProtectedData("profesor-data", token); // Asumiendo que esta función existe
    cargarMateriales(token); 
    // ¡YA NO LLAMA A cargarActividades!

    // --- Escuchar eventos (Unificado) ---

    // 1. Subir Reglas Gramaticales
    const reglasForm = document.getElementById("uploadReglasForm");
    if (reglasForm) {
        reglasForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await uploadFile("reglas", token);
            await cargarMateriales(token); 
        });
    }

    // 2. Crear actividad en Linea
    const createActivityOnlineForm = document.getElementById("createActivityOnlineForm");
    if (createActivityOnlineForm) {
        createActivityOnlineForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await createActivityOnline(token);
            await cargarMateriales(token); // Recarga la lista de materiales
        });
    }

    // 3. Enviar comentario
    const comentarioForm = document.getElementById("comentarioForm");
    if (comentarioForm) {
        comentarioForm.addEventListener("submit", (e) => {
            e.preventDefault();
            enviarComentario(token);
        });
    }
    
    // Las funciones de actividades eliminadas: eliminarActividad, editarActividad.
});

// Funciones de Soporte //

// Protege los datos del profesor (Asumiendo que existe)
async function fetchProtectedData(route, token) {
     // ... Tu código de fetchProtectedData ...
}

// 🔹 Subir archivos (reglas) 
async function uploadFile(type, token) {
    const input = document.getElementById(`${type}File`);
    if (!input || !input.files[0]) {
        showToast("Debes seleccionar un archivo.");
        return;
    }

    const formData = new FormData();
    formData.append("file", input.files[0]);

    try {
        const res = await fetch(`http://localhost:4000/api/profesor/upload/${type}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(`Error al subir ${type}: ${data.message}`);
        } else {
            showToast(`${type} subido correctamente ✅`);
        }
    } catch (err) {
        console.error("Error al subir archivo:", err);
        showToast("Error al subir el archivo.");
    }
}


// 🔹 Enviar comentarios a un alumno
async function enviarComentario(token) {
    const alumnoId = document.getElementById("alumnoId").value.trim();
    const comentario = document.getElementById("comentarioTexto").value.trim();

    if (!alumnoId || !comentario) {
        showToast("Debes completar los campos.");
        return;
    }

    try {
        const res = await fetch(`http://localhost:4000/api/profesor/comentario`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ alumnoId, comentario })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(`Error al enviar comentario: ${data.message}`);
        } else {
            showToast("Comentario enviado al alumno ✅");
            document.getElementById("alumnoId").value = "";
            document.getElementById("comentarioTexto").value = "";
        }
    } catch (err) {
        console.error("Error al enviar comentario:", err);
        alert("Error al enviar el comentario.");
    }
}

//  Crear actividad en línea
async function createActivityOnline(token) {
    const titulo = document.getElementById("actTitulo").value.trim();
    const descripcion = document.getElementById("actDescripcion").value.trim();
    const contenido = document.getElementById("actContenido").value.trim();
    const respuesta_correcta = document.getElementById("actRespuesta").value.trim();
    const regla_id = document.getElementById("actReglaId").value.trim();

    if (!titulo || !contenido || !respuesta_correcta) {
        showToast("Título, Contenido y Respuesta son obligatorios.");
        return;
    }

    try {
        const res = await fetch(`http://localhost:4000/api/profesor/crear/actividad/online`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ 
                titulo, 
                descripcion, 
                contenido, 
                respuesta_correcta,
                regla_id: regla_id ? parseInt(regla_id) : null // Si no hay valor, lo manda como null
            })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(`Error al crear actividad: ${data.message}`);
        } else {
            showToast(`Actividad creada correctamente. ¡No olvides publicarla! ✅`);
            // Limpiar formulario después del éxito (opcional)
            document.getElementById("actTitulo").value = "";
            document.getElementById("actDescripcion").value = "";
            document.getElementById("actContenido").value = "";
            document.getElementById("actRespuesta").value = "";
            document.getElementById("actReglaId").value = "";
        }
    } catch (err) {
        console.error("Error al crear actividad:", err);
        showToast("Error de red al crear la actividad.");
    }
}

// Funciones de Materiales //

// Cargar lista de materiales subidos (ACTUALIZADA con estado de publicación)
async function cargarMateriales(token) {
    const materialList = document.getElementById("materialList");
    materialList.innerHTML = "<li>Cargando material...</li>";

    try {
        // Asume que el backend devuelve el campo 'publicado'
        const res = await fetch("http://localhost:4000/api/profesor/materiales", {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) {
            // ... manejo de errores ...
            return;
        }

        const data = await res.json(); // Data ahora es el ARRAY de materiales
        materialList.innerHTML = "";
        
        const materialesArray = Array.isArray(data) ? data : (data.materiales || []);

        if(materialesArray.length === 0) {
            materialList.innerHTML = "<li>No hay materiales subidos.</li>";
            return;
        }

        materialesArray.forEach(item => {
            const li = document.createElement("li");
            const nombreMostrar = item.titulo ? item.titulo : (item.archivo || "Material sin nombre");
            
            // Lógica de Publicación
            const estadoTexto = item.publicado ? 'Publicado ✅' : 'No Publicado 🔒';
            const nuevoEstado = !item.publicado; // Estado al que queremos cambiar
            const botonTexto = item.publicado ? 'Despublicar' : 'Publicar';
            const botonColor = item.publicado ? '#F44336' : '#4CAF50'; // Rojo / Verde

            li.innerHTML = `
                ${item.tipo.toUpperCase()} → ${nombreMostrar} | Estado: <strong>${estadoTexto}</strong>
                
                <button 
                    style="margin-left: 10px; background-color: ${botonColor}; color: white; border: none; padding: 5px 10px; cursor: pointer;"
                    onclick="cambiarEstadoPublicacion('${item.id}', ${nuevoEstado}, '${token}')"
                >
                    ${botonTexto}
                </button>
                <button 
                    class="btn-eliminar-material" 
                    onclick="eliminarMaterial('${item.id}', '${token}')"
                >
                    Eliminar
                </button>
            `;
            materialList.appendChild(li);
        });

    } catch (err) {
        console.error("Error de red al cargar materiales:", err);
        materialList.innerHTML = "<li>❌ Error al cargar materiales del servidor. (Verifica si el servidor está encendido)</li>";
    }
}


// NUEVA FUNCIÓN: Cambiar Estado de Publicación
async function cambiarEstadoPublicacion(id, nuevoEstado, token) {
    if (!confirm(`¿Seguro que deseas ${nuevoEstado ? 'PUBLICAR' : 'DESPUBLICAR'} este material?`)) {
        return;
    }

    try {
        const res = await fetch(`http://localhost:4000/api/profesor/materiales/publicar/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ estado: nuevoEstado })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            showToast(data.message);
            cargarMateriales(token); // Refresca la lista
        } else {
            showToast("❌ Error al cambiar estado: " + (data.message || "Fallo desconocido."));
        }
    } catch (err) {
        console.error("Error de red al cambiar estado:", err);
        showToast("Error de red al intentar cambiar el estado del material.");
    }
}

// Función para eliminar material subido (Mantenida)
async function eliminarMaterial(id, token) {
    if (!confirm("¿Seguro que deseas eliminar este material?")) {
        return;
    }

    try {
        // ASUMO que la ruta de eliminación ha sido cambiada a /materiales/:id en el backend.
        const res = await fetch(`http://localhost:4000/api/profesor/materiales/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await res.json();

        if (res.ok && data.success) {
            showToast("✅ Material eliminado correctamente");
            cargarMateriales(token); // Refresca la lista
        } else {
            showToast("❌ Error al eliminar material: " + (data.message || "Fallo desconocido."));
        }
    } catch (err) {
        console.error("Error de red al eliminar material:", err);
        showToast("Error de red al intentar eliminar el material.");
    }
}