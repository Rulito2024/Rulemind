document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signupForm');
    //const verifyBtn = document.getElementById('verifyBtn');
    const toast = document.getElementById('toast');

    function showToast(msg, ms = 3000) {
        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(12px)';
        }, ms);
    }

    // 🔹 Validación de contraseña segura
    function validarPassword(password) {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;
        return regex.test(password);
    }

    // El botón de verificar correo no es necesario para el flujo de registro
    // ya que la verificación se hace automáticamente al registrar.
    // verifyBtn.addEventListener('click', () => {
    //     showToast('Se ha enviado un correo de verificación. Revisa tu bandeja.');
    // });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ✅ Cambio: Obtener el valor del nuevo campo de apellido y repassword
        const nombre = form.nombre.value.trim();
        const apellido = form.apellido.value.trim();
        const email = form.email.value.trim();
        const password = form.password.value.trim();
        const repassword = form.repassword.value.trim();

        // Validaciones frontend
        if (!nombre || !apellido || !email || !password || !repassword) {
            showToast('Por favor completa todos los campos.');
            return;
        }

        // ✅ Validación: Las contraseñas deben coincidir
        if (password !== repassword) {
            showToast('Las contraseñas no coinciden.');
            return;
        }

        const nameRegex = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/;
        if (!nameRegex.test(nombre) || !nameRegex.test(apellido)) {
            showToast('El nombre y el apellido deben comenzar con mayúscula.');
            return;
        }

        if (!validarPassword(password)) {
            showToast('La contraseña debe tener mínimo 8 caracteres e incluir al menos: una mayúscula, una minúscula, un número y un carácter especial.');
            return;
        }

        try {
            // 🔗 Conexión al backend Express
            const res = await fetch('http://localhost:4000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, apellido, email, password }),
            });

            const data = await res.json();
            
            if (res.ok) {
            
                showToast(data.message || '¡Registrado con éxito! Revisa tu correo.');
                form.reset();
                // espera 1 segundo y redirigir al login
                setTimeout(() => {
                    window.location.href = 'loguearse.html';
                }, 1000);
            } else {
                //  Muestra el mensaje de error
                showToast("Error: " + (data.error || "No se pudo registrar."));
            }
        } catch (error) {
            console.error(error);
            showToast('Error de conexión con el servidor.');
        }
    });
});