
async function cargarPerfil() {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Debes iniciar sesión primero.");
        window.location.href = "loguearse.html";
        return;
    }

    try {
        const res = await fetch("http://localhost:4000/api/perfil", {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + token
        }
        });

        const data = await res.json();
        document.getElementById("perfilData").textContent = JSON.stringify(data, null, 2);

    } catch (err) {
        console.error(err);
        document.getElementById("perfilData").textContent = "Error cargando perfil.";
    }
    }
    cargarPerfil();