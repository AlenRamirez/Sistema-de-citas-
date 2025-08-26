const API_BASE = 'http://localhost:3000';

function togglePassword(inputId, iconId) {
    const passwordInput = document.getElementById(inputId);
    const toggleIcon = document.getElementById(iconId);
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.replace('bi-eye', 'bi-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.replace('bi-eye-slash', 'bi-eye');
    }
}

function showMessage(elementId, message, type) {
    const messageDiv = document.getElementById(elementId);
    messageDiv.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>`;
}

function toggleLoading(button, loading) {
    const loadingSpan = button.querySelector('.loading');
    if (loading) {
        loadingSpan.style.display = 'inline';
        button.disabled = true;
    } else {
        loadingSpan.style.display = 'none';
        button.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // LOGIN
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type="submit"]');
        const correo = document.getElementById('correoLogin').value;
        const password = document.getElementById('passwordLogin').value;

        toggleLoading(button, true);

        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, password })
            });
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);

                // Decodificar token para obtener rol
                const tokenPayload = JSON.parse(atob(data.token.split('.')[1]));
                const userRole = tokenPayload.rol;

                showMessage('loginMessage', '✅ Login exitoso. Redirigiendo...', 'success');

                setTimeout(() => {
                    if (userRole === 'admin') window.location.href = 'admin/dashboardA.html';
                    else window.location.href = 'paciente/dashboardP.html';
                }, 1200);
            } else {
                showMessage('loginMessage', `❌ ${data.message}`, 'danger');
            }
        } catch (error) {
            showMessage('loginMessage', '❌ Error de conexión al servidor', 'danger');
        } finally {
            toggleLoading(button, false);
        }
    });

    // REGISTRO
    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = e.target.querySelector('button[type="submit"]');
        const nombre_completo = document.getElementById('nombre').value;
        const documento = document.getElementById('documento').value;
        const correo = document.getElementById('correoRegistro').value;
        const telefono = document.getElementById('telefono').value;
        const password = document.getElementById('passwordRegistro').value;

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
        if (!passwordRegex.test(password)) {
            showMessage('registerMessage', '❌ Contraseña inválida', 'danger');
            return;
        }

        toggleLoading(button, true);

        try {
            const response = await fetch(`${API_BASE}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_completo, documento, correo, telefono, password })
            });
            const data = await response.json();

            if (response.ok) {
                showMessage('registerMessage', '✅ ' + data.message, 'success');
                registerForm.reset();
                setTimeout(() => document.getElementById('login-tab').click(), 1500);
            } else {
                showMessage('registerMessage', `❌ ${data.message}`, 'danger');
            }
        } catch (error) {
            showMessage('registerMessage', '❌ Error de conexión al servidor', 'danger');
        } finally {
            toggleLoading(button, false);
        }
    });
});