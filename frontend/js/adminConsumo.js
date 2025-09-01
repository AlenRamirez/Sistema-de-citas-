const API_BASE_URL = 'http://localhost:3000';
let currentUser = null;
let citaCambiarEstado = null;
let medicoActual = null;

// Función para obtener token
function getToken() {
    return localStorage.getItem('token');
}

// Headers para las peticiones
function getHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Verificar autenticación
function verificarAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = '../Acceso.html';
        return false;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
            localStorage.removeItem('token');
            window.location.href = '../Acceso.html';
            return false;
        }

        currentUser = payload;

        if (currentUser.nombre_completo) {
            document.getElementById('nombreAdmin').textContent = currentUser.nombre_completo;
        }

        return true;
    } catch (error) {
        console.error('Error verificando token:', error);
        localStorage.removeItem('token');
        window.location.href = '../Acceso.html';
        return false;
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', function () {
    if (!verificarAuth()) return;
    inicializarPanel();
});

function inicializarPanel() {
    actualizarFechaActual();
    cargarDashboard();
    configurarNavegacion();
}

// Navegación entre secciones
function configurarNavegacion() {
    const links = document.querySelectorAll('.nav-link[data-section]');
    const sections = document.querySelectorAll('.content-section');

    links.forEach(link => {
        link.addEventListener('click', async e => {
            e.preventDefault();
            const target = link.dataset.section;

            // Ocultar todas las secciones
            sections.forEach(sec => {
                sec.classList.remove('active');
                sec.style.display = 'none';
            });

            // Mostrar sección objetivo
            const targetSection = document.getElementById(target);
            if (targetSection) {
                targetSection.style.display = 'block';
                targetSection.classList.add('active');
            }

            // Actualizar navegación activa
            links.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            try {
                switch (target) {
                    case 'usuarios':
                        await cargarUsuarios();
                        break;
                    case 'medicos':
                        await cargarMedicos();
                        break;
                    case 'citas':
                        await cargarCitas();
                        break;
                    case 'dashboard':
                        await cargarDashboard();
                        break;
                    case 'reportes':
                        // Limpiar reportes anteriores
                        document.getElementById('reporteContainer').innerHTML = '';
                        break;
                }
            } catch (error) {
                mostrarAlerta(`Error al cargar la sección ${target}: ${error.message}`, 'danger');
            }
        });
    });
}

// Dashboard functions
async function cargarDashboard() {
    const loading = document.getElementById('dashboardLoading');
    const statsContainer = document.getElementById('dashboardStats');

    try {
        if (loading) loading.style.display = 'block';
        if (statsContainer) statsContainer.style.display = 'none';

        // Cargar estadísticas de la API
        const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
            headers: getHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.stats) {
                const stats = data.data.stats[0] || {};
                actualizarElementoStats('totalPacientes', stats.total_pacientes || 0);
                actualizarElementoStats('totalMedicos', stats.total_medicos || 0);

                // Calcular usuarios activos/inactivos por separado
                await cargarEstadisticasUsuarios();
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }

        if (loading) loading.style.display = 'none';
        if (statsContainer) statsContainer.style.display = 'block';

    } catch (error) {
        console.error('Error al cargar dashboard:', error);
        mostrarAlerta('Error al cargar las estadísticas del sistema', 'danger');
        if (loading) loading.style.display = 'none';
    }
}

// Función auxiliar para actualizar elementos de estadísticas
function actualizarElementoStats(elementId, valor) {
    const elemento = document.getElementById(elementId);
    if (elemento) {
        const valorActual = parseInt(elemento.textContent) || 0;
        const valorFinal = parseInt(valor) || 0;

        if (valorActual !== valorFinal) {
            animarContador(elemento, valorActual, valorFinal, 1000);
        }
    }
}

// Animación de contador
function animarContador(elemento, desde, hasta, duracion) {
    const inicio = performance.now();
    const diferencia = hasta - desde;

    function actualizar(tiempoActual) {
        const tiempoTranscurrido = tiempoActual - inicio;
        const progreso = Math.min(tiempoTranscurrido / duracion, 1);

        const valorActual = Math.round(desde + (diferencia * progreso));
        elemento.textContent = valorActual;

        if (progreso < 1) {
            requestAnimationFrame(actualizar);
        }
    }

    requestAnimationFrame(actualizar);
}

// Cargar estadísticas específicas de usuarios
async function cargarEstadisticasUsuarios() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/usuarios`, {
            headers: getHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.users) {
                const usuarios = data.data.users;
                const activos = usuarios.filter(u => u.activo).length;
                const inactivos = usuarios.filter(u => !u.activo).length;

                actualizarElementoStats('totalUsuariosActivos', activos);
                actualizarElementoStats('totalUsuariosInactivos', inactivos);
            }
        }
    } catch (error) {
        console.error('Error al cargar estadísticas de usuarios:', error);
    }
}

// Actualizar fecha actual
function actualizarFechaActual() {
    const fechaElement = document.getElementById('fechaActual');
    if (fechaElement) {
        const ahora = new Date();
        const opciones = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        fechaElement.textContent = ahora.toLocaleDateString('es-ES', opciones);
    }
}

// GESTIÓN DE USUARIOS
async function cargarUsuarios(page = 1, tipoFiltro = null) {
    const loading = document.getElementById('usuariosLoading');
    if (loading) loading.style.display = 'block';

    try {
        const tipo = tipoFiltro || document.getElementById('filtroTipoUsuario')?.value || 'todos';
        const estado = document.getElementById('filtroEstadoUsuario')?.value || 'todos';

        const params = new URLSearchParams({
            page: page.toString(),
            limit: '10',
            tipo,
            estado
        });

        const response = await fetch(`${API_BASE_URL}/admin/usuarios?${params}`, {
            headers: getHeaders()
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success) {
            renderizarUsuarios(data.data.users);
            renderizarPaginacion(data.data.pagination, 'paginacionUsuarios', cargarUsuarios);
        } else {
            throw new Error(data.message || 'Error en la respuesta');
        }
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        mostrarAlerta('Error al cargar usuarios: ' + error.message, 'danger');

        const tbody = document.getElementById('tablaUsuarios');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error al cargar usuarios</td></tr>';
        }
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderizarUsuarios(usuarios) {
    const tbody = document.getElementById('tablaUsuarios');
    tbody.innerHTML = '';

    if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron usuarios</td></tr>';
        return;
    }

    usuarios.forEach(usuario => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
                <td>${usuario.nombre_completo || 'N/A'}</td>
                <td>${usuario.correo}</td>
                <td>${usuario.telefono || 'N/A'}</td>
                <td><span class="badge bg-info">${usuario.rol}</span></td>
                <td><span class="status-${usuario.activo ? 'activo' : 'inactivo'}">${usuario.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>${new Date(usuario.created_at).toLocaleDateString('es-ES')}</td>
                <td>
                    <button class="btn btn-sm btn-${usuario.activo ? 'warning' : 'success'}" 
                            onclick="toggleUsuario(${usuario.id_usuario}, ${!usuario.activo})">
                        ${usuario.activo ? 'Desactivar' : 'Activar'}
                    </button>
                </td>
            `;
        tbody.appendChild(tr);
    });
}

async function toggleUsuario(id, activar) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/usuarios/${id}/estado`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ activo: activar })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success) {
            mostrarAlerta(data.message, 'success');
            cargarUsuarios();
        } else {
            throw new Error(data.message || 'Error en la respuesta');
        }
    } catch (error) {
        console.error('Error al cambiar estado:', error);
        mostrarAlerta('Error al cambiar estado del usuario: ' + error.message, 'danger');
    }
}

// GESTIÓN DE MÉDICOS
async function cargarMedicos() {
    const loading = document.getElementById('medicosLoading');
    const tabla = document.getElementById('tablaMedicos');

    if (loading) loading.style.display = 'block';

    try {
        console.log('Cargando médicos...');
        const response = await fetch(`${API_BASE_URL}/admin/medicos`, {
            headers: getHeaders()
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Data received:', data);

        if (data.success) {
            await renderizarMedicos(data.data);
        } else {
            throw new Error(data.message || 'Error en la respuesta del servidor');
        }
    } catch (error) {
        console.error('Error al cargar médicos:', error);
        mostrarAlerta('Error al cargar médicos: ' + error.message, 'danger');
        if (tabla) {
            tabla.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error al cargar médicos</td></tr>';
        }
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

async function renderizarMedicos(medicos) {
    const tbody = document.getElementById('tablaMedicos');
    tbody.innerHTML = '';

    if (!medicos || medicos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No se encontraron médicos</td></tr>';
        return;
    }

    // Cargar especialidades para cada médico
    for (const medico of medicos) {
        try {
            const espResponse = await fetch(`${API_BASE_URL}/admin/medicos/${medico.id_medico}/especialidades`, {
                headers: getHeaders()
            });

            let especialidadesTexto = 'Sin especialidades';
            if (espResponse.ok) {
                const espData = await espResponse.json();
                if (espData.success && espData.data.length > 0) {
                    especialidadesTexto = espData.data.map(esp => esp.nombre).join(', ');
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                    <td>${medico.nombre_completo || 'N/A'}</td>
                    <td>${medico.correo || 'N/A'}</td>
                    <td>${medico.telefono || 'N/A'}</td>
                    <td><span class="status-${medico.estado === 'activo' ? 'activo' : 'inactivo'}">${medico.estado}</span></td>
                    <td><small class="text-muted">${especialidadesTexto}</small></td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-info" onclick="verHorariosMedico(${medico.id_medico})" title="Gestionar Horarios">
                                <i class="fas fa-clock"></i>
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="gestionarEspecialidades(${medico.id_medico})" title="Gestionar Especialidades">
                                <i class="fas fa-stethoscope"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="eliminarMedico(${medico.id_medico})" title="Eliminar Médico">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
            tbody.appendChild(tr);
        } catch (error) {
            console.error(`Error al cargar especialidades para médico ${medico.id_medico}:`, error);
            // Continuar con el siguiente médico si hay error
            const tr = document.createElement('tr');
            tr.innerHTML = `
                    <td>${medico.nombre_completo || 'N/A'}</td>
                    <td>${medico.correo || 'N/A'}</td>
                    <td>${medico.telefono || 'N/A'}</td>
                    <td><span class="status-${medico.estado === 'activo' ? 'activo' : 'inactivo'}">${medico.estado}</span></td>
                    <td><small class="text-danger">Error al cargar</small></td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-info" onclick="verHorariosMedico(${medico.id_medico})">
                                <i class="fas fa-clock"></i>
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="gestionarEspecialidades(${medico.id_medico})">
                                <i class="fas fa-stethoscope"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="eliminarMedico(${medico.id_medico})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
            tbody.appendChild(tr);
        }
    }
}

// Ver horarios de médico
async function verHorariosMedico(idMedico) {
    medicoActual = idMedico;
    console.log('Abriendo gestión de horarios para médico:', idMedico);

    try {
        const response = await fetch(`${API_BASE_URL}/admin/medicos/${idMedico}/horarios`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Horarios recibidos:', data);

        if (data.success) {
            renderizarHorariosMedico(data.data);
            // Limpiar formulario
            document.getElementById('formNuevoHorario').reset();
            // Mostrar modal
            const modal = new bootstrap.Modal(document.getElementById('modalHorariosMedico'));
            modal.show();
        } else {
            throw new Error(data.message || 'Error al obtener horarios');
        }
    } catch (error) {
        console.error('Error al cargar horarios del médico:', error);
        mostrarAlerta('Error al cargar horarios del médico: ' + error.message, 'danger');
    }
}

function renderizarHorariosMedico(horarios) {
    const tbody = document.getElementById('tablaHorariosMedico');
    tbody.innerHTML = '';

    if (!horarios || horarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay horarios registrados</td></tr>';
        return;
    }

    horarios.forEach(horario => {
        const fecha = new Date(horario.fecha);
        const fechaFormateada = fecha.toLocaleDateString('es-ES');

        const tr = document.createElement('tr');
        tr.innerHTML = `
                <td>${fechaFormateada}</td>
                <td>${horario.hora_inicio}</td>
                <td>${horario.hora_fin}</td>
                <td><span class="badge bg-${horario.disponible ? 'success' : 'danger'}">${horario.disponible ? 'Disponible' : 'Ocupado'}</span></td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="eliminarHorario(${horario.id_horario})" title="Eliminar horario">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        tbody.appendChild(tr);
    });
}

// Crear nuevo horario - FIXED FUNCTION
async function crearHorario() {
    const fecha = document.getElementById('fechaHorario').value;
    const horaInicio = document.getElementById('horaInicio').value;
    const horaFin = document.getElementById('horaFin').value;

    console.log('Creando horario:', { fecha, horaInicio, horaFin, medicoActual });

    if (!fecha || !horaInicio || !horaFin) {
        mostrarAlerta('Todos los campos son obligatorios', 'warning');
        return;
    }

    if (horaInicio >= horaFin) {
        mostrarAlerta('La hora de inicio debe ser anterior a la hora de fin', 'warning');
        return;
    }

    if (!medicoActual) {
        mostrarAlerta('Error: No se ha seleccionado ningún médico', 'danger');
        return;
    }

    const boton = document.querySelector('#modalHorariosMedico .btn-success');
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';

    try {
        const response = await fetch(`${API_BASE_URL}/admin/medicos/${medicoActual}/horarios`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                fecha: fecha,
                hora_inicio: horaInicio,
                hora_fin: horaFin
            })
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            mostrarAlerta(data.message || 'Horario creado correctamente', 'success');
            document.getElementById('formNuevoHorario').reset();
            // Recargar horarios
            verHorariosMedico(medicoActual);
        } else {
            throw new Error(data.message || 'Error al crear horario');
        }
    } catch (error) {
        console.error('Error al crear horario:', error);
        mostrarAlerta('Error al crear horario: ' + error.message, 'danger');
    } finally {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
    }
}

// Eliminar horario
async function eliminarHorario(idHorario) {
    if (!confirm('¿Está seguro de eliminar este horario?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/horarios/${idHorario}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        const data = await response.json();

        if (data.success) {
            mostrarAlerta(data.message || 'Horario eliminado correctamente', 'success');
            verHorariosMedico(medicoActual);
        } else {
            throw new Error(data.message || 'Error al eliminar horario');
        }
    } catch (error) {
        console.error('Error al eliminar horario:', error);
        mostrarAlerta('Error al eliminar horario: ' + error.message, 'danger');
    }
}

// Gestionar especialidades - FIXED FUNCTION
async function gestionarEspecialidades(idMedico) {
    medicoActual = idMedico;
    console.log('Gestionando especialidades para médico:', idMedico);

    try {
        // Cargar todas las especialidades disponibles
        console.log('Cargando todas las especialidades...');
        const especialidadesResponse = await fetch(`${API_BASE_URL}/admin/especialidades`, {
            headers: getHeaders()
        });

        // Cargar especialidades del médico
        console.log('Cargando especialidades del médico...');
        const medicoEspResponse = await fetch(`${API_BASE_URL}/admin/medicos/${idMedico}/especialidades`, {
            headers: getHeaders()
        });

        if (!especialidadesResponse.ok) {
            throw new Error(`Error al cargar especialidades: HTTP ${especialidadesResponse.status}`);
        }

        if (!medicoEspResponse.ok) {
            throw new Error(`Error al cargar especialidades del médico: HTTP ${medicoEspResponse.status}`);
        }

        const todasEspecialidades = await especialidadesResponse.json();
        const especialidadesMedico = await medicoEspResponse.json();

        console.log('Todas las especialidades:', todasEspecialidades);
        console.log('Especialidades del médico:', especialidadesMedico);

        if (todasEspecialidades.success && especialidadesMedico.success) {
            renderizarEspecialidadesCheckboxes(todasEspecialidades.data, especialidadesMedico.data);
            const modal = new bootstrap.Modal(document.getElementById('modalEspecialidadesMedico'));
            modal.show();
        } else {
            throw new Error('Error en la respuesta del servidor');
        }
    } catch (error) {
        console.error('Error al cargar especialidades:', error);
        mostrarAlerta('Error al cargar especialidades: ' + error.message, 'danger');
    }
}

function renderizarEspecialidadesCheckboxes(todasEspecialidades, especialidadesMedico) {
    const container = document.getElementById('especialidadesCheckboxes');
    container.innerHTML = '';

    if (!todasEspecialidades || todasEspecialidades.length === 0) {
        container.innerHTML = '<p class="text-warning">No hay especialidades disponibles</p>';
        return;
    }

    const especialidadesMedicoIds = especialidadesMedico.map(esp => esp.id_especialidad);
    console.log('IDs de especialidades del médico:', especialidadesMedicoIds);

    todasEspecialidades.forEach(especialidad => {
        const isChecked = especialidadesMedicoIds.includes(especialidad.id_especialidad);
        const div = document.createElement('div');
        div.className = 'form-check mb-2';
        div.innerHTML = `
                <input class="form-check-input" type="checkbox" value="${especialidad.id_especialidad}" 
                       id="esp${especialidad.id_especialidad}" 
                       ${isChecked ? 'checked' : ''}>
                <label class="form-check-label" for="esp${especialidad.id_especialidad}">
                    <strong>${especialidad.nombre}</strong>
                    ${especialidad.descripcion ? `<br><small class="text-muted">${especialidad.descripcion}</small>` : ''}
                </label>
            `;
        container.appendChild(div);
    });
}

// Guardar especialidades del médico - FIXED FUNCTION
async function guardarEspecialidadesMedico() {
    if (!medicoActual) {
        mostrarAlerta('Error: No se ha seleccionado ningún médico', 'danger');
        return;
    }

    const checkboxes = document.querySelectorAll('#especialidadesCheckboxes input[type="checkbox"]:checked');
    const especialidades = Array.from(checkboxes).map(cb => parseInt(cb.value));

    console.log('Especialidades seleccionadas:', especialidades);

    const boton = document.querySelector('#modalEspecialidadesMedico .btn-primary');
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const response = await fetch(`${API_BASE_URL}/admin/medicos/${medicoActual}/especialidades`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ especialidades })
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            mostrarAlerta(data.message || 'Especialidades guardadas correctamente', 'success');
            bootstrap.Modal.getInstance(document.getElementById('modalEspecialidadesMedico')).hide();
            // Recargar la tabla de médicos para mostrar las nuevas especialidades
            await cargarMedicos();
        } else {
            throw new Error(data.message || 'Error al guardar especialidades');
        }
    } catch (error) {
        console.error('Error al guardar especialidades:', error);
        mostrarAlerta('Error al guardar especialidades: ' + error.message, 'danger');
    } finally {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
    }
}

// Eliminar médico
async function eliminarMedico(idMedico) {
    if (!confirm('¿Está seguro de eliminar este médico? Esta acción eliminará también todos sus horarios y no se puede deshacer.')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/medicos/${idMedico}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success) {
            mostrarAlerta(data.message || 'Médico eliminado correctamente', 'success');
            cargarMedicos();
        } else {
            throw new Error(data.message || 'Error al eliminar médico');
        }
    } catch (error) {
        console.error('Error al eliminar médico:', error);
        mostrarAlerta('Error al eliminar médico: ' + error.message, 'danger');
    }
}

// GESTIÓN DE CITAS
async function cargarCitas(page = 1) {
    const loading = document.getElementById('citasLoading');
    if (loading) loading.style.display = 'block';

    try {
        const estado = document.getElementById('filtroEstadoCita')?.value || 'todos';
        const fechaInicio = document.getElementById('fechaInicioCitas')?.value || '';
        const fechaFin = document.getElementById('fechaFinCitas')?.value || '';
        const medico = document.getElementById('filtroMedicoCita')?.value || '';
        const paciente = document.getElementById('filtroPacienteCita')?.value || '';

        const params = new URLSearchParams({
            page: page.toString(),
            limit: '10'
        });

        if (estado && estado !== 'todos') params.append('estado', estado);
        if (fechaInicio) params.append('fecha_inicio', fechaInicio);
        if (fechaFin) params.append('fecha_fin', fechaFin);
        if (medico.trim()) params.append('medico', medico);
        if (paciente.trim()) params.append('paciente', paciente);

        const response = await fetch(`${API_BASE_URL}/admin/citas?${params}`, {
            headers: getHeaders()
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success) {
            renderizarCitas(data.data.citas);
            renderizarPaginacion(data.data.pagination, 'paginacionCitas', cargarCitas);
        } else {
            throw new Error(data.message || 'Error en la respuesta');
        }
    } catch (error) {
        console.error('Error al cargar citas:', error);
        mostrarAlerta('Error al cargar citas: ' + error.message, 'danger');
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderizarCitas(citas) {
    const tabla = document.getElementById("tablaCitas");
    tabla.innerHTML = "";

    if (!citas || citas.length === 0) {
        tabla.innerHTML = '<tr><td colspan="8" class="text-center">No se encontraron citas</td></tr>';
        return;
    }

    citas.forEach((cita) => {
        const fila = document.createElement("tr");
        const estadoNormalizado = cita.estado.toLowerCase();

        fila.innerHTML = `
                <td>${cita.paciente}</td>
                <td>${cita.medico}</td>
                <td>${cita.fecha}</td>
                <td>${cita.hora}</td>
                <td>${cita.especialidad}</td>
                <td>${cita.motivo}</td>
                <td>
                    <span class="badge bg-${getEstadoBadgeClass(estadoNormalizado)}">
                        ${cita.estado}
                    </span>
                </td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline-primary dropdown-toggle" 
                                type="button" data-bs-toggle="dropdown">
                            Acciones
                        </button>
                        <ul class="dropdown-menu">
                            ${getAccionesCita(cita.id_cita, estadoNormalizado)}
                        </ul>
                    </div>
                </td>
            `;
        tabla.appendChild(fila);
    });
}

function getEstadoBadgeClass(estado) {
    const estadoMap = {
        'pendiente': 'warning',
        'confirmada': 'success',
        'realizada': 'info',
        'cancelada': 'danger',
        'no_asistio': 'dark',
        'no asistió': 'dark'
    };
    return estadoMap[estado] || 'secondary';
}

function getAccionesCita(idCita, estado) {
    if (estado === 'pendiente') {
        return `
                <li><a class="dropdown-item text-success" href="#" onclick="confirmarCita(${idCita})">
                    <i class="fas fa-check"></i> Confirmar
                </a></li>
                <li><a class="dropdown-item text-danger" href="#" onclick="cancelarCita(${idCita})">
                    <i class="fas fa-times"></i> Cancelar
                </a></li>
            `;
    } else if (estado === 'confirmada') {
        return `
                <li><a class="dropdown-item text-success" href="#" onclick="marcarComoRealizada(${idCita})">
                    <i class="fas fa-check-circle"></i> Marcar como Realizada
                </a></li>
                <li><a class="dropdown-item text-warning" href="#" onclick="marcarComoNoAsistio(${idCita})">
                    <i class="fas fa-user-times"></i> Marcar como No Asistió
                </a></li>
                <li><a class="dropdown-item text-danger" href="#" onclick="cancelarCita(${idCita})">
                    <i class="fas fa-times"></i> Cancelar
                </a></li>
            `;
    } else if (estado === 'realizada') {
        return '<li><a class="dropdown-item disabled" href="#"><i class="fas fa-check-double"></i> Cita Completada</a></li>';
    } else {
        return '<li><a class="dropdown-item disabled" href="#"><i class="fas fa-lock"></i> Sin acciones</a></li>';
    }
}

// Funciones para cambiar estado de citas
function cancelarCita(idCita) {
    citaCambiarEstado = idCita;
    document.getElementById('motivoCancelacion').value = '';
    const modal = new bootstrap.Modal(document.getElementById('modalCancelarCita'));
    modal.show();
}

function confirmarCita(idCita) {
    citaCambiarEstado = idCita;
    document.getElementById('nuevoEstadoCita').value = 'confirmada';
    document.getElementById('notasEstado').value = '';
    const modal = new bootstrap.Modal(document.getElementById('modalCambiarEstado'));
    modal.show();
}

function marcarComoRealizada(idCita) {
    citaCambiarEstado = idCita;
    document.getElementById('nuevoEstadoCita').value = 'realizada';
    document.getElementById('notasEstado').value = '';
    const modal = new bootstrap.Modal(document.getElementById('modalCambiarEstado'));
    modal.show();
}

function marcarComoNoAsistio(idCita) {
    citaCambiarEstado = idCita;
    document.getElementById('nuevoEstadoCita').value = 'no_asistio';
    document.getElementById('notasEstado').value = '';
    const modal = new bootstrap.Modal(document.getElementById('modalCambiarEstado'));
    modal.show();
}

// Confirmar cancelación de cita
async function confirmarCancelacionCita() {
    const motivo = document.getElementById('motivoCancelacion').value.trim();

    if (!motivo) {
        mostrarAlerta('Por favor ingrese un motivo para la cancelación', 'warning');
        return;
    }

    const botonConfirmar = document.querySelector('#modalCancelarCita .btn-danger');
    const textoOriginal = botonConfirmar.innerHTML;
    botonConfirmar.disabled = true;
    botonConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelando...';

    try {
        const response = await fetch(`${API_BASE_URL}/admin/citas/${citaCambiarEstado}/cancel`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({
                motivo: motivo,
                cancelada_por: 'admin'
            })
        });

        const data = await response.json();

        if (data.success) {
            mostrarAlerta(data.message || 'Cita cancelada exitosamente', 'success');
            cargarCitas();
            bootstrap.Modal.getInstance(document.getElementById('modalCancelarCita')).hide();
        } else {
            throw new Error(data.message || 'Error al cancelar cita');
        }
    } catch (error) {
        console.error('Error al cancelar cita:', error);
        mostrarAlerta('Error al cancelar cita: ' + error.message, 'danger');
    } finally {
        botonConfirmar.disabled = false;
        botonConfirmar.innerHTML = textoOriginal;
    }
}

// Confirmar cambio de estado
async function confirmarCambioEstado() {
    const estado = document.getElementById('nuevoEstadoCita').value;
    const notas = document.getElementById('notasEstado').value.trim();

    const botonConfirmar = document.querySelector('#modalCambiarEstado .btn-primary');
    const textoOriginal = botonConfirmar.innerHTML;
    botonConfirmar.disabled = true;
    botonConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const response = await fetch(`${API_BASE_URL}/admin/citas/${citaCambiarEstado}/status`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({
                estado: estado,
                observaciones: notas || `Marcada como ${estado} desde panel administrativo`
            })
        });

        const data = await response.json();

        if (data.success) {
            mostrarAlerta(data.message || 'Estado actualizado exitosamente', 'success');
            cargarCitas();
            bootstrap.Modal.getInstance(document.getElementById('modalCambiarEstado')).hide();
        } else {
            throw new Error(data.message || 'Error al actualizar estado');
        }
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        mostrarAlerta('Error al actualizar estado: ' + error.message, 'danger');
    } finally {
        botonConfirmar.disabled = false;
        botonConfirmar.innerHTML = textoOriginal;
    }
}

// REPORTES
async function generarReporte() {
    const loading = document.getElementById('reportesLoading');
    const container = document.getElementById('reporteContainer');

    loading.style.display = 'block';
    container.innerHTML = '';

    const tipo = document.getElementById('tipoReporte').value;
    const fechaInicio = document.getElementById('fechaInicioReporte').value;
    const fechaFin = document.getElementById('fechaFinReporte').value;

    try {
        const params = new URLSearchParams({ tipo });
        if (fechaInicio) params.append('fecha_inicio', fechaInicio);
        if (fechaFin) params.append('fecha_fin', fechaFin);

        const response = await fetch(`${API_BASE_URL}/admin/reportes?${params}`, {
            headers: getHeaders()
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (data.success) {
            renderizarReporte(data.data, tipo);
        } else {
            throw new Error(data.message || 'Error en la respuesta');
        }
    } catch (error) {
        console.error('Error al generar reporte:', error);
        mostrarAlerta('Error al generar reporte: ' + error.message, 'danger');
    } finally {
        loading.style.display = 'none';
    }
}

function renderizarReporte(datos, tipo) {
    const container = document.getElementById('reporteContainer');

    if (!datos || datos.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No hay datos disponibles para el reporte seleccionado.</div>';
        return;
    }

    let html = '<div class="card"><div class="card-body"><div class="table-responsive"><table class="table table-striped">';

    const reportTemplates = {
        'citas_especialidad': {
            headers: ['Especialidad', 'Total Citas', 'Realizadas', 'Canceladas', 'No Asistió'],
            rows: datos.map(item => [
                item.especialidad || 'Sin especialidad',
                item.total_citas || 0,
                `<span class="text-success">${item.realizadas || 0}</span>`,
                `<span class="text-danger">${item.canceladas || 0}</span>`,
                `<span class="text-warning">${item.no_asistio || 0}</span>`
            ])
        },
        'no_asistencia': {
            headers: ['Médico', 'Total Citas', 'No Asistió', 'Tasa No Asistencia (%)'],
            rows: datos.map(item => [
                item.medico || 'N/A',
                item.total_citas || 0,
                `<span class="text-warning">${item.no_asistio || 0}</span>`,
                `<span class="text-danger">${parseFloat(item.tasa_no_asistencia || 0).toFixed(2)}%</span>`
            ])
        },
        'citas_mensuales': {
            headers: ['Mes', 'Total Citas', 'Realizadas', 'Canceladas', 'No Asistió', 'Pendientes'],
            rows: datos.map(item => {
                const fechaMes = item.mes ? new Date(item.mes + '-01').toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }) : 'N/A';
                return [
                    fechaMes,
                    item.total_citas || 0,
                    `<span class="text-success">${item.realizadas || 0}</span>`,
                    `<span class="text-danger">${item.canceladas || 0}</span>`,
                    `<span class="text-warning">${item.no_asistio || 0}</span>`,
                    `<span class="text-info">${item.pendientes || 0}</span>`
                ];
            })
        },
        'estados_citas': {
            headers: ['Estado', 'Total Citas', 'Porcentaje'],
            rows: datos.map(item => [
                `<span class="badge" style="background-color: ${item.color}; color: white;">${item.estado}</span>`,
                item.total_citas || 0,
                `${parseFloat(item.porcentaje || 0).toFixed(2)}%`
            ])
        },
        'eficiencia_medicos': {
            headers: ['Médico', 'Total Citas', 'Realizadas', 'Canceladas', 'No Asistió', 'Tasa Éxito (%)', 'Tiempo Promedio (min)'],
            rows: datos.map(item => [
                item.medico || 'N/A',
                item.total_citas || 0,
                `<span class="text-success">${item.realizadas || 0}</span>`,
                `<span class="text-danger">${item.canceladas || 0}</span>`,
                `<span class="text-warning">${item.no_asistio || 0}</span>`,
                `<span class="text-primary">${parseFloat(item.tasa_exito || 0).toFixed(2)}%</span>`,
                `${parseFloat(item.tiempo_promedio_consulta || 0).toFixed(0)} min`
            ])
        }
    };

    const template = reportTemplates[tipo];
    if (template) {
        html += '<thead class="table-dark"><tr>';
        template.headers.forEach(header => html += `<th>${header}</th>`);
        html += '</tr></thead><tbody>';

        template.rows.forEach(row => {
            html += '<tr>';
            row.forEach(cell => html += `<td>${cell}</td>`);
            html += '</tr>';
        });
    } else {
        html += '<tbody><tr><td colspan="100%" class="text-center">Tipo de reporte no reconocido</td></tr></tbody>';
    }

    html += '</tbody></table></div></div></div>';
    container.innerHTML = html;
}

// Paginación
function renderizarPaginacion(pagination, containerId, callback) {
    const container = document.getElementById(containerId);
    if (!container || !pagination || pagination.pages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }

    let html = '<ul class="pagination">';

    html += `
            <li class="page-item ${pagination.page === 1 ? 'disabled' : ''}">
                <button class="page-link" onclick="${callback.name}(${pagination.page - 1})" ${pagination.page === 1 ? 'disabled' : ''}>
                    Anterior
                </button>
            </li>
        `;

    const maxPagesToShow = 5;
    const startPage = Math.max(1, pagination.page - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(pagination.pages, startPage + maxPagesToShow - 1);

    if (startPage > 1) {
        html += `<li class="page-item"><button class="page-link" onclick="${callback.name}(1)">1</button></li>`;
        if (startPage > 2) html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `
                <li class="page-item ${i === pagination.page ? 'active' : ''}">
                    <button class="page-link" onclick="${callback.name}(${i})">${i}</button>
                </li>
            `;
    }

    if (endPage < pagination.pages) {
        if (endPage < pagination.pages - 1) html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        html += `<li class="page-item"><button class="page-link" onclick="${callback.name}(${pagination.pages})">${pagination.pages}</button></li>`;
    }

    html += `
            <li class="page-item ${pagination.page === pagination.pages ? 'disabled' : ''}">
                <button class="page-link" onclick="${callback.name}(${pagination.page + 1})" ${pagination.page === pagination.pages ? 'disabled' : ''}>
                    Siguiente
                </button>
            </li>
        `;

    html += '</ul>';
    container.innerHTML = html;
}

// Utilidades
function mostrarAlerta(mensaje, tipo = 'info') {
    // Remover alertas anteriores
    document.querySelectorAll('.alert-dismissible').forEach(alert => alert.remove());

    const alertContainer = document.createElement('div');
    alertContainer.className = `alert alert-${tipo} alert-dismissible fade show`;
    alertContainer.innerHTML = `
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.insertBefore(alertContainer, mainContent.firstChild);
    }

    setTimeout(() => {
        if (alertContainer.parentNode) alertContainer.remove();
    }, 5000);
}

function cerrarSesion() {
    if (confirm('¿Estás seguro de cerrar sesión?')) {
        localStorage.removeItem('token');
        window.location.href = '../Acceso.html';
    }
}

// Event listeners específicos
document.addEventListener('DOMContentLoaded', function () {
    // Validación de formulario de nuevo horario
    const formNuevoHorario = document.getElementById('formNuevoHorario');
    if (formNuevoHorario) {
        formNuevoHorario.addEventListener('submit', function (e) {
            e.preventDefault();
            crearHorario();
        });
    }

    // Configurar fecha mínima para horarios (hoy)
    const fechaHorario = document.getElementById('fechaHorario');
    if (fechaHorario) {
        const today = new Date().toISOString().split('T')[0];
        fechaHorario.min = today;
    }

    // Configurar fechas para reportes
    const fechaInicioReporte = document.getElementById('fechaInicioReporte');
    const fechaFinReporte = document.getElementById('fechaFinReporte');
    if (fechaInicioReporte && fechaFinReporte) {
        const hoy = new Date();
        const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
        const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

        fechaInicioReporte.value = primerDiaMes;
        fechaFinReporte.value = ultimoDiaMes;
    }
});

// Auto-refresh del dashboard cada 5 minutos
setInterval(() => {
    const dashboardSection = document.getElementById('dashboard');
    if (dashboardSection && dashboardSection.classList.contains('active')) {
        cargarDashboard();
    }
}, 300000);

// Manejo de conexión
window.addEventListener('online', function () {
    mostrarAlerta('Conexión restaurada', 'success');
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection && activeSection.id === 'dashboard') {
        cargarDashboard();
    }
});

window.addEventListener('offline', function () {
    mostrarAlerta('Conexión perdida. Algunas funciones pueden no estar disponibles.', 'warning');
});

// Función auxiliar para manejar errores de red
function manejarErrorRed(error, mensaje) {
    console.error(mensaje, error);

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        mostrarAlerta('Error de conexión. Verifique su conexión a internet.', 'danger');
    } else if (error.message.includes('401')) {
        mostrarAlerta('Sesión expirada. Redirigiendo al login...', 'warning');
        setTimeout(() => {
            localStorage.removeItem('token');
            window.location.href = '../Acceso.html';
        }, 2000);
    } else if (error.message.includes('403')) {
        mostrarAlerta('No tiene permisos para realizar esta acción.', 'danger');
    } else if (error.message.includes('404')) {
        mostrarAlerta('Recurso no encontrado.', 'warning');
    } else if (error.message.includes('500')) {
        mostrarAlerta('Error interno del servidor. Inténtelo más tarde.', 'danger');
    } else {
        mostrarAlerta(mensaje + ': ' + error.message, 'danger');
    }
}

// Función de utilidad para formatear fechas
function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    try {
        return new Date(fecha).toLocaleDateString('es-ES');
    } catch {
        return 'Fecha inválida';
    }
}

// Función de utilidad para formatear hora
function formatearHora(hora) {
    if (!hora) return 'N/A';
    try {
        return hora.substring(0, 5); // HH:MM
    } catch {
        return 'Hora inválida';
    }
}

// Log para debugging
console.log('Admin panel script loaded successfully');
console.log('API Base URL:', API_BASE_URL);