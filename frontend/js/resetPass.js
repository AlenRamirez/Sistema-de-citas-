
    const API_BASE_URL = 'http://localhost:3000';

    // Elementos del DOM
    const resetForm = document.getElementById('resetForm');
    const tokenStatus = document.getElementById('tokenStatus');
    const nuevaInput = document.getElementById('nueva');
    const confirmarInput = document.getElementById('confirmar');
    const submitBtn = document.getElementById('submitBtn');
    const buttonText = document.getElementById('buttonText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const messageContainer = document.getElementById('messageContainer');
    const passwordStrength = document.getElementById('passwordStrength');

    //  Obtener token del query parameter
    function getTokenFromURL() {
            const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
        }

    const resetToken = getTokenFromURL();

    // Función para mostrar mensajes
    function showMessage(message, type) {
        messageContainer.innerHTML = `
                <div class="alert alert-${type}" role="alert">
                    <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'x-circle'}"></i>
                    ${message}
                </div>
            `;
        }

    // Función para mostrar estado de carga
    function setLoadingState(isLoading) {
        submitBtn.disabled = isLoading;
    if (isLoading) {
        buttonText.textContent = 'Procesando...';
    loadingSpinner.classList.remove('d-none');
            } else {
        buttonText.textContent = 'Restablecer';
    loadingSpinner.classList.add('d-none');
            }
        }

    // Validar contraseña y mostrar requisitos
    function validarPassword(password) {
            const requirements = {
        length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{ };':"\\|,.<>/?]/.test(password)
            };

        // Actualizar indicadores visuales
        updateRequirement('req-length', requirements.length);
        updateRequirement('req-uppercase', requirements.uppercase);
        updateRequirement('req-number', requirements.number);
        updateRequirement('req-special', requirements.special);

        // Actualizar barra de fuerza
        updatePasswordStrength(requirements);

            return Object.values(requirements).every(req => req);
        }

        function updateRequirement(elementId, isMet) {
            const element = document.getElementById(elementId);
        const icon = element.querySelector('i');

        if (isMet) {
            element.classList.add('met');
        icon.className = 'bi bi-check-circle-fill';
            } else {
            element.classList.remove('met');
        icon.className = 'bi bi-circle';
            }
        }

        function updatePasswordStrength(requirements) {
            const metCount = Object.values(requirements).filter(req => req).length;

        passwordStrength.className = 'password-strength';
        if (metCount < 2) {
            passwordStrength.classList.add('strength-weak');
            } else if (metCount < 4) {
            passwordStrength.classList.add('strength-medium');
            } else {
            passwordStrength.classList.add('strength-strong');
            }
        }

        // Verificar token 
        async function verificarToken() {
            if (!resetToken) {
            tokenStatus.innerHTML = `
                    <div class="alert alert-danger" role="alert">
                        <i class="bi bi-exclamation-triangle"></i>
                        Token de recuperación no encontrado. 
                        <a href="forgot-password.html">Solicita un nuevo enlace de recuperación</a>
                    </div>
                `;
        return false;
            }

        tokenStatus.innerHTML = `
        <div class="alert alert-success" role="alert">
            <i class="bi bi-check-circle"></i>
            Introduce tu nueva contraseña segura.
        </div>
        `;
        resetForm.style.display = 'block';
        return true;
        }

        // Event listeners
        nuevaInput.addEventListener('input', function () {
            validarPassword(this.value);
        if (messageContainer.innerHTML) {
            messageContainer.innerHTML = '';
            }
        });

        confirmarInput.addEventListener('input', function () {
            if (messageContainer.innerHTML) {
            messageContainer.innerHTML = '';
            }
        });

        // MANEJAR ENVÍO DEL FORMULARIO - CORREGIDO PARA USAR TOKEN EN URL
        resetForm.addEventListener('submit', async function (e) {
            e.preventDefault();

        const nueva = nuevaInput.value;
        const confirmar = confirmarInput.value;

        // Validaciones
        if (!validarPassword(nueva)) {
            showMessage('La contraseña no cumple con todos los requisitos.', 'danger');
        return;
            }

        if (nueva !== confirmar) {
            showMessage('Las contraseñas no coinciden.', 'danger');
        return;
            }

        // Limpiar mensajes y mostrar carga
        messageContainer.innerHTML = '';
        setLoadingState(true);

        try {
                // USAR LA RUTA CORRECTA: /reset-password/:token (POST) - Token en URL
                const url = `${API_BASE_URL}/reset-password/${resetToken}`;
        console.log('Enviando petición a:', url);

        const response = await fetch(url, {
            method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        'Accept': 'application/json'
                    },
        body: JSON.stringify({
            nuevaContrasena: nueva  // Solo enviamos la nueva contraseña en el body
                    })
                });

        console.log('Status de respuesta:', response.status);

        // VERIFICAR SI LA RESPUESTA ES JSON VÁLIDO
        const contentType = response.headers.get('content-type');

        if (!contentType || !contentType.includes('application/json')) {
                    // Si no es JSON, obtener como texto para debugging
                    const textResponse = await response.text();
        console.error('Respuesta no es JSON:', textResponse);
        throw new Error(`El servidor devolvió contenido no válido. Status: ${response.status}`);
                }

        const data = await response.json();
        console.log('Datos de respuesta:', data);

        if (response.ok) {
            // Éxito
            showMessage(
                ` ${data.message || 'Contraseña restablecida correctamente.'}`,
                'success'
            );

        resetForm.reset();

                    // Redirigir al login después de 3 segundos
                    setTimeout(() => {
            showMessage(
                'Redirigiendo al inicio de sesión...',
                'success'
            );
                        setTimeout(() => {
            window.location.href = 'Acceso.html';
                        }, 1500);
                    }, 2000);

                } else {
            // Error del servidor
            let errorMessage = data.message || 'Error al restablecer la contraseña.';

        if (response.status === 400 || response.status === 404) {
            errorMessage = 'Token inválido o expirado. Solicita un nuevo enlace de recuperación.';
                    }

        showMessage(` ${errorMessage}`, 'danger');
                }

            } catch (error) {
            console.error(' Error completo:', error);

        let errorMessage = ' Ocurrió un error inesperado.';

        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = ' No se pudo conectar con el servidor. Verifica que esté ejecutándose.';
                } else if (error.message.includes('JSON')) {
            errorMessage = ' El servidor devolvió una respuesta inválida. Verifica la URL de la API.';
                } else if (error.message.includes('Status:')) {
            errorMessage = ` Error del servidor: ${error.message}`;
                }

        showMessage(errorMessage, 'danger');
            } finally {
            setLoadingState(false);
            }
        });

        // Verificar token al cargar la página
        window.addEventListener('load', verificarToken);