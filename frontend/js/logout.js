document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            // Borrar token y rol
            localStorage.removeItem("authToken");
            localStorage.removeItem("userRole");

            // Opcional: limpiar todo el localStorage
            // localStorage.clear();

            // Redirigir al login
            window.location.href = "loguearse.html";
        });
    }
});
