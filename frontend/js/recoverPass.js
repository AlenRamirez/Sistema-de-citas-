const API_BASE_URL = 'http://localhost:3000';

// Elementos del DOM
const form = document.getElementById('forgotPasswordForm');
const correoInput = document.getElementById('correo');
const submitBtn = document.getElementById('submitBtn');
const buttonText = document.getElementById('buttonText');
const loadingSpinner = document.getElementById('loadingSpinner');
const messageContainer = document.getElementById('messageContainer');

// Función para mostrar mensajes
function showMessage(message, type) {
    messageContainer.innerHTML = `
            <div class="alert alert-${type}" role="alert">
                <i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
                ${message}
            </div>
        `;
}

// Función para mostrar estado de carga
function setLoadingState(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
        buttonText.textContent = 'Enviando...';
        loadingSpinner.classList.remove('d-none');
    } else {
        buttonText.textContent = 'Enviar';
        loadingSpinner.classList.add('d-none');
    }
}

// Validar formato de email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Manejar el envío del formulario
form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const correo = correoInput.value.trim();

    // Validaciones
    if (!correo) {
        showMessage('Por favor, ingresa tu correo electrónico.', 'danger');
        return;
    }

    if (!isValidEmail(correo)) {
        showMessage('Por favor, ingresa un correo electrónico válido.', 'danger');
        return;
    }

    // Limpiar mensajes anteriores
    messageContainer.innerHTML = '';
    setLoadingState(true);

    try {
        // ✅ CORRECCIÓN: URL correcta para tu backend
        const response = await fetch(`${API_BASE_URL}/forgot-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ correo })
        });

        const data = await response.json();

        if (response.ok) {
            // Éxito
            showMessage(
                ` ${data.message || 'Se envió un enlace a tu correo para restablecer la contraseña.'}`,
                'success'
            );
            form.reset(); // Limpiar el formulario

            // Opcional: Redirigir después de unos segundos
            setTimeout(() => {
                showMessage(
                    'Revisa tu correo electrónico (incluyendo la carpeta de spam) y sigue las instrucciones.',
                    'success'
                );
            }, 2000);

        } else {
            // Error del servidor
            let errorMessage = data.message || 'Error al procesar la solicitud.';

            // Personalizar mensajes de error específicos
            if (response.status === 404) {
                errorMessage = 'No existe una cuenta con ese correo electrónico.';
            } else if (response.status === 500) {
                errorMessage = 'Error interno del servidor. Inténtalo más tarde.';
            }

            showMessage(` ${errorMessage}`, 'danger');
        }

    } catch (error) {
        console.error('Error completo:', error);

        // Error de red o conexión
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showMessage(
                ' No se pudo conectar con el servidor. Verifica que el servidor esté ejecutándose en http://localhost:3000',
                'danger'
            );
        } else {
            showMessage(
                ' Ocurrió un error inesperado. Inténtalo de nuevo.',
                'danger'
            );
        }
    } finally {
        setLoadingState(false);
    }
});

// Limpiar mensajes cuando el usuario comience a escribir
correoInput.addEventListener('input', function () {
    if (messageContainer.innerHTML) {
        messageContainer.innerHTML = '';
    }
});

window.addEventListener('load', async function () {
    try {
        const response = await fetch(`${API_BASE_URL}/`, {
            method: 'GET',
        });

        if (response.ok) {
            console.log('Conexión con el servidor establecida correctamente');
        }
    } catch (error) {
        console.warn('No se pudo conectar con el servidor:', error);
        showMessage(
            'Advertencia: No se puede conectar con el servidor. Asegúrate de que esté ejecutándose.',
            'danger'
        );
    }
});