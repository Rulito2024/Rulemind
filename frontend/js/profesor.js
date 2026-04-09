let materialesEnMemoria = [];

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
    window.cambiarEstadoPublicacion = cambiarEstadoPublicacion;
    window.prepararEdicion = prepararEdicion;
    window.limpiarFormulario = limpiarFormulario;
    
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
    fetchProtectedData("profesor-data", token);
    cargarReglasGestion(token); 
    cargarMateriales(token); 
    cargarAlumnos(token);

    // --- Escuchar eventos ---
    //1 guardar y editar  reglas en la sección de gestión
const reglaForm = document.getElementById("reglaGramaticalForm");
if (reglaForm) {
    reglaForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("authToken");
        const data = {
            id: document.getElementById('editReglaIdInput').value,
            nombre: document.getElementById('reglaNombre').value,
            teoria: document.getElementById('reglaTeoria').value,
            palabra_clave: document.getElementById('reglaPalabraClave').value
        };
        const res = await fetch('http://localhost:4000/api/profesor/guardar-regla', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast("Regla guardada ✅");
            reglaForm.reset();
            document.getElementById('editReglaIdInput').value = "";
            document.getElementById('reglaSubmitBtn').innerText = "Guardar Regla";
            document.getElementById('cancelReglaEdit').style.display = "none";
            cargarReglasGestion(token);
        }
    });
}

// 1.b Cancelar Edición de Regla <--- AGREGADO AQUÍ
    const btnCancelRegla = document.getElementById("cancelReglaEdit");
    if (btnCancelRegla) {
        btnCancelRegla.addEventListener("click", () => {
            limpiarFormulario();
        });
    }
    
    // 2. Crear o editaR actividad en Linea
    const createActivityOnlineForm = document.getElementById("createActivityOnlineForm");
    if (createActivityOnlineForm) {
        createActivityOnlineForm.addEventListener("submit", async (e) => {
            e.preventDefault();
    const editId = document.getElementById("editActivityId").value;

            if (editId) {
                // Si hay un ID guardado, llamamos a una función de actualizar (la creamos abajo)
                await actualizarActividad(editId, token);
            } else {
                // Si no, es una creación normal
                await createActivityOnline(token);
            }
            
            await cargarMateriales(token); 
        });
    }

    // 2.b Cancelar Edición de Actividad <--- AGREGADO AQUÍ
    const btnCancelAct = document.getElementById("cancelEditBtn");
    if (btnCancelAct) {
        btnCancelAct.addEventListener("click", () => {
            limpiarFormulario();
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
});



// ---  Cargar Alumnos en el Selector ---
async function cargarAlumnos(token) {
    const select = document.getElementById('alumnoSelect');
    if (!select) return;

    try {
        const res = await fetch('http://localhost:4000/api/profesor/alumnos-lista', {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const alumnos = await res.json();
        
        select.innerHTML = '<option value="">-- Seleccione un alumno --</option>';
        alumnos.forEach(alum => {
            const option = document.createElement('option');
            option.value = alum.id;
            option.setAttribute('data-email', alum.email); // Guardamos el mail aquí
            option.textContent = alum.full_name; // O nombre_completo según tu DB
            select.appendChild(option);
        });
    } catch (err) {
        console.error("Error al cargar alumnos:", err);
    }
}

// --- Enviar comentarios con Email ---
async function enviarComentario(token) {
    const select = document.getElementById("alumnoSelect");
    const alumnoId = select.value;
    const comentario = document.getElementById("comentarioTexto").value.trim();
    
    // Obtenemos el email del atributo data que guardamos en el selector
    const emailAlumno = select.options[select.selectedIndex]?.getAttribute('data-email');

    if (!alumnoId || !comentario) {
        showToast("Debes seleccionar un alumno y escribir un comentario.");
        return;
    }

    try {
        const res = await fetch(`http://localhost:4000/api/profesor/enviar-comentario`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ alumnoId, emailAlumno, comentario })
        });

        const data = await res.json();
        if (res.ok) {
            showToast("Comentario enviado y notificado por mail ✅");
            document.getElementById("comentarioTexto").value = "";
            select.value = "";
        } else {
            showToast(`Error: ${data.message}`);
        }
    } catch (err) {
        console.error("Error al enviar comentario:", err);
        showToast("Error al conectar con el servidor.");
    }
}

// --- FUNCIONES DE LÓGICA ---

function prepararEdicion(id) {
    // Buscamos el material en el array que guardamos al cargar
    // IMPORTANTE: materialesEnMemoria debe estar declarada arriba de todo
    const item = materialesEnMemoria.find(m => m.id == id);
    
    if (!item) {
        console.error("No se encontró el material con ID:", id);
        return;
    }

    // 1. Llenamos los campos del formulario con los datos de la actividad
    document.getElementById("editActivityId").value = item.id; 
    document.getElementById("actTitulo").value = item.titulo || "";
    document.getElementById("actDescripcion").value = item.descripcion || "";
    document.getElementById("actRespuesta").value = item.respuesta_correcta || "";
    document.getElementById("actReglaId").value = item.regla_id || "";

    // 2. Manejamos el Contenido (si es objeto lo pasamos a texto JSON)
    const contenidoTexto = typeof item.contenido === 'object' 
        ? JSON.stringify(item.contenido, null, 2) 
        : item.contenido;
    document.getElementById("actContenido").value = contenidoTexto;

    // 3. Cambiamos la interfaz para que el usuario sepa que está editando
    document.getElementById("formTitle").innerText = "Editando Actividad ✏️";
    
    const btnSubmit = document.getElementById("submitBtn");
    if (btnSubmit) {
        btnSubmit.innerText = "Actualizar Actividad 💾";
        btnSubmit.style.background = "#ffa500";
        btnSubmit.style.color = "black";
    }
    
    // 4. Mostramos el botón de cancelar (por si el profe no quiere editar)
    const btnCancel = document.getElementById("cancelEditBtn");
    if (btnCancel) btnCancel.style.display = "inline-block";

    // 5. Scroll suave hacia arriba para ver el formulario lleno
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limpiarFormulario() {
    // --- 1. Resetear Formulario de Actividades (Lo que ya tenías) ---
    const activityForm = document.getElementById("createActivityOnlineForm");
    if (activityForm) activityForm.reset();
    
    document.getElementById("editActivityId").value = "";
    
    const formTitle = document.getElementById("formTitle");
    if (formTitle) formTitle.innerText = "Crear Actividad en Línea ✏️";
    
    const btnSubmit = document.getElementById("submitBtn");
    if (btnSubmit) {
        btnSubmit.innerText = "Crear Actividad";
        btnSubmit.style.background = ""; 
        btnSubmit.style.color = "";
    }

    const btnCancel = document.getElementById("cancelEditBtn");
    if (btnCancel) btnCancel.style.display = "none";

    // --- 2. AGREGAR ESTO: Resetear Formulario de Reglas ---
    const reglaForm = document.getElementById("reglaGramaticalForm");
    if (reglaForm) {
        reglaForm.reset();
        // Limpiamos el ID oculto de la regla para que no intente actualizar una vieja
        const editReglaId = document.getElementById('editReglaIdInput');
        if (editReglaId) editReglaId.value = "";
        
        // Volvemos el botón a su estado original
        const btnRegla = document.getElementById('reglaSubmitBtn');
        if (btnRegla) btnRegla.innerText = "Guardar Regla";
        
        // Escondemos el botón cancelar de la regla
        const btnCancelRegla = document.getElementById('cancelReglaEdit');
        if (btnCancelRegla) btnCancelRegla.style.display = "none";
    }
}


async function actualizarActividad(id, token) {
    const titulo = document.getElementById("actTitulo").value.trim();
    const descripcion = document.getElementById("actDescripcion").value.trim();
    const contenidoStr = document.getElementById("actContenido").value.trim();
    const respuesta_correcta = document.getElementById("actRespuesta").value.trim();
    const regla_id = document.getElementById("actReglaId").value.trim();

    let contenido;
    try {
        contenido = JSON.parse(contenidoStr);
    } catch (e) {
        return showToast("❌ Error: El contenido debe ser un JSON válido.");
    }

    try {
        const res = await fetch(`http://localhost:4000/api/profesor/materiales/${id}`, {
            method: "PUT", // O la ruta que maneje tu edición en el backend
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ titulo, descripcion, contenido, respuesta_correcta, regla_id: regla_id || null })
        });

    if (res.ok) {
            showToast("✅ Actividad actualizada correctamente");
            limpiarFormulario();
        } else {
            showToast("❌ Error al actualizar.");
        }
    } catch (err) {
        showToast("❌ Error de red.");
    }
} 

// Funciones de Soporte //

// Protege los datos del profesor y verifica el acceso
async function fetchProtectedData(route, token) {
    try {
        const res = await fetch(`http://localhost:4000/api/profesor/${route}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const data = await res.json();

        if (!res.ok) {
            // Si el token expiró o es inválido, mandarlo al login
            showToast("Sesión expirada. Por favor, ingresa de nuevo.");
            localStorage.removeItem("authToken");
            setTimeout(() => window.location.href = "loguearse.html", 2000);
            return null;
        }

        console.log("Datos protegidos cargados:", data);
        return data;
    } catch (err) {
        console.error("Error al verificar datos protegidos:", err);
        return null;
    }
}



//  Crear actividad en línea
async function createActivityOnline(token) {
    const titulo = document.getElementById("actTitulo").value.trim();
    const descripcion = document.getElementById("actDescripcion").value.trim();
    const contenidoStr = document.getElementById("actContenido").value.trim();
    const respuesta_correcta = document.getElementById("actRespuesta").value.trim();
    const regla_id = document.getElementById("actReglaId").value;

    if (!titulo || !contenidoStr || !respuesta_correcta) {
        showToast("Título, Contenido y Respuesta son obligatorios.");
        return;
    }

    let contenido;
    try {
        contenido = JSON.parse(contenidoStr);
    } catch (error) {
        showToast("❌ El contenido no es un JSON válido");
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
                regla_id: regla_id || null 
            })
        });

        if (res.ok) {
            showToast(`Actividad creada correctamente ✅`);
            limpiarFormulario();
        } else {
            const data = await res.json();
            showToast(`Error: ${data.message}`);
        }
    } catch (err) {
        showToast("Error de red al crear la actividad.");
    }
}

// Funciones de Materiales //
async function cargarMateriales(token) {
    const materialList = document.getElementById("materialList");
    materialList.innerHTML = "<li>Cargando material...</li>";

    try {
        const res = await fetch("http://localhost:4000/api/profesor/materiales", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        materialList.innerHTML = "";
        
        const materialesArray = Array.isArray(data) ? data : (data.materiales || []);
        materialesEnMemoria = materialesArray;
        if(materialesArray.length === 0) {
            materialList.innerHTML = "<li>No hay materiales subidos.</li>";
            return;
        }

        materialesArray.forEach(item => {
            const li = document.createElement("li");
            li.style.borderBottom = "1px solid #333";
            li.style.padding = "15px 0";
            li.style.listStyle = "none";

            const nombreMostrar = item.titulo || item.archivo || "Material sin nombre";
            const estadoTexto = item.publicado ? 'Publicado ✅' : 'No Publicado 🔒';
            const botonTexto = item.publicado ? 'Despublicar' : 'Publicar';
            const botonColor = item.publicado ? '#F44336' : '#4CAF50';
            const nombreRegla = item.nombre_regla || (item.regla_id ? `ID: ${item.regla_id}` : 'General');

            li.innerHTML = `
                <div>
                    <strong style="color: #00aaff;">${item.tipo.toUpperCase()}</strong> 
                    <span style="background: #222; color: #00d4ff; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; border: 1px solid #00d4ff; margin-left: 5px; font-weight: bold;">
                        📖 ${nombreRegla.toUpperCase()}
                    </span>
                    <br>
                    <span style="font-size: 1.1em; font-weight: 500;">${nombreMostrar}</span>
                    <br>
                    <small>Estado: <strong>${estadoTexto}</strong></small>
                </div>
                <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                    <button style="background-color: ${botonColor}; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px;"
                        onclick="cambiarEstadoPublicacion('${item.id}', ${!item.publicado}, '${token}')">
                        ${botonTexto}
                    </button>
                    <button style="background-color: #ffa500; color: black; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: bold;"
                        onclick="prepararEdicion('${item.id}')">
                        Editar ✏️
                    </button>
                    <button style="background: crimson; color: white; border: none; padding: 6px 12px; cursor: pointer; border-radius: 4px;"
                        onclick="eliminarMaterial('${item.id}', '${token}')">
                        Eliminar
                    </button>
                </div>
            `;
            materialList.appendChild(li);
        });
    } catch (err) { materialList.innerHTML = "<li>❌ Error de red.</li>"; }
}

// Cambiar Estado de Publicación
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

        if (res.ok) {
            showToast("Estado actualizado");
            cargarMateriales(token);
        }
    } catch (err) { showToast("Error de red."); }
}

// Función para eliminar material subido (Mantenida)
async function eliminarMaterial(id, token) {
    if (!confirm("¿Seguro que deseas eliminar este material?")) return;
    try {
        const res = await fetch(`http://localhost:4000/api/profesor/materiales/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
            showToast("✅ Material eliminado");
            cargarMateriales(token);
        }
    } catch (err) { showToast("Error de red."); }
}


// --- NUEVA: Gestión de Reglas en Texto ---

async function cargarReglasGestion(token) {
    const lista = document.getElementById('listaReglasAdmin');
    const selectAct = document.getElementById('actReglaId');
    if (!lista || !selectAct) return;

    try {
        const res = await fetch('http://localhost:4000/api/profesor/reglas', {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const reglas = await res.json();

        // Llenar el SELECT de la tarjeta de Actividades
        selectAct.innerHTML = '<option value="">-- Seleccione una regla --</option>' + 
            reglas.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');

        // Llenar la LISTA de gestión
        lista.innerHTML = reglas.map(r => `
            <li style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #444;">
                <span><strong>${r.nombre}</strong></span>
                <div>
                    <button onclick="prepararEdicionRegla(${r.id}, '${r.nombre.replace(/'/g, "\\'")}', '${r.teoria.replace(/\n/g, '\\n').replace(/'/g, "\\'")}', '${r.palabra_clave || ''}')" style="background: #ffa500; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Editar</button>
                    <button onclick="borrarRegla(${r.id})" style="background: crimson; border: none; padding: 5px 10px; border-radius: 4px; color: white; cursor: pointer;">Borrar</button>
                </div>
            </li>
        `).join('');
    } catch (err) {
        console.error("Error al cargar reglas:", err);
    }
}

// Globales para que funcionen los onclick de arriba
window.prepararEdicionRegla = (id, nombre, teoria, palabraClave) => {
    document.getElementById('editReglaIdInput').value = id;
    document.getElementById('reglaNombre').value = nombre;
    document.getElementById('reglaTeoria').value = teoria;
    document.getElementById('reglaPalabraClave').value = palabraClave;
    document.getElementById('reglaSubmitBtn').innerText = "Actualizar Regla 💾";
    document.getElementById('cancelReglaEdit').style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.borrarRegla = async (id) => {
    const token = localStorage.getItem("authToken");
    if (!confirm("¿Borrar esta regla? Asegúrate de que no esté en uso.")) return;
    try {
        const res = await fetch(`http://localhost:4000/api/profesor/borrar-regla/${id}`, {
            method: 'DELETE',
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) { showToast("Regla eliminada"); cargarReglasGestion(token); }
        else { showToast("No se pudo borrar (posiblemente está en uso)"); }
    } catch (err) { showToast("Error de conexión"); }
};

