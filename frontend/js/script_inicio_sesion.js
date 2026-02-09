document.addEventListener("DOMContentLoaded", () => {
const form = document.getElementById("loginForm");
const toast = document.getElementById("toast");

function showToast(msg, ms = 3000){
    toast.textContent = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
    setTimeout(()=> {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(12px)";
    }, ms);
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value.trim();

    if(!email || !password){
    showToast("Por favor completa todos los campos.");
    return;
    }

    try {
    const res = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if(data.success){
        //Accede a data.user.role y valida
                const userRole = data.user && data.user.role ? data.user.role : 'alumno';
                
                // Guardamos el token y rol en localStorage
                localStorage.setItem("authToken", data.token);
                localStorage.setItem("userRole", userRole);

                showToast(`Bienvenido, rol: ${userRole}`);
                
                // Redirigir según el rol
                if(userRole === "alumno"){
                    window.location.href = "alumno.html";
                } else if(userRole === "profesor" || userRole === "secretaria"){
                    window.location.href = "profesor.html";
                } else if(userRole === "admin"){
                    window.location.href = "admin.html";
                }
            } else {
                showToast(data.message || "Credenciales incorrectas");
            }

        } catch (err) {
            console.error(err);
            showToast("Error de conexión con el servidor.");
        }
    });
});
