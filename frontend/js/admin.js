document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("authToken");
    const role = localStorage.getItem("userRole");

    if (!token) {
        // Si no hay token, lo mando de vuelta al login
        window.location.href = "loguearse.html";
    } else {
        console.log("Sesión activa con rol:", role);
        fetchAdminData(token);
    }
});

async function fetchAdminData(token) {
    try {
        const res = await fetch(`http://localhost:4000/api/${route}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await res.json();
        console.log(data);

        if (!res.ok) {
            // Si la respuesta no es exitosa (ej. 401, 403)
            console.error("Error al obtener datos:", data.message);
            if (res.status === 401 || res.status === 403) {
                // Si el token es inválido o expiró, o el usuario no tiene permisos
                localStorage.removeItem("authToken"); // Elimina el token del localStorage
                localStorage.removeItem("userRole");
                window.location.href = "loguearse.html"; // Redirige al login
            }
        } else {
            // Si la respuesta es exitosa
            console.log(`Datos de la página del usuario ${route}:`, data);
        }

    } catch (err) {
        console.error("Error de red:", err);
    }
}
document.addEventListener("DOMContentLoaded", () => {
    const anuncioForm = document.getElementById("anuncioForm");

    if (anuncioForm) {
        anuncioForm.addEventListener("submit", crearAnuncio);
    }
});

async function crearAnuncio(e) {
    e.preventDefault();

    const token = localStorage.getItem("authToken");

    const titulo = document.getElementById("anuncioTitulo").value.trim();
    const mensaje = document.getElementById("anuncioMensaje").value.trim();
    const rol = document.getElementById("anuncioRol").value;

    if (!titulo || !mensaje) {
        alert("Completa todos los campos del anuncio.");
        return;
    }

    try {
        const res = await fetch("http://localhost:4000/api/admin/anuncios", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                titulo,
                mensaje,
                rol_destino: rol
            })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.message || "Error al crear el anuncio");
            return;
        }

        alert("✅ Anuncio publicado correctamente");
        e.target.reset();

    } catch (err) {
        console.error("Error al publicar anuncio:", err);
        alert("Error de conexión con el servidor");
    }
}