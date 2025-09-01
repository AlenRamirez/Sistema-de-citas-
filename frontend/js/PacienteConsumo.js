const API_BASE_URL = 'http://localhost:3000';
let currentUser = null;
let currentPage = 1;
let totalPages = 1;
let selectedHorarioElement = null;
let selectedHorarioData = null;
let citaParaCancelar = null; // Variable global para manejar la cita a cancelar

// Utilidades
function getToken() {
  return localStorage.getItem('token');
}

function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

function showLoading(show = true) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
}

function showAlert(message, type = 'info', duration = 5000) {
  const alertContainer = document.getElementById('alertContainer');
  if (!alertContainer) return;

  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  alertContainer.appendChild(alertDiv);

  if (duration > 0) {
    setTimeout(() => {
      if (alertDiv && alertDiv.parentElement) {
        alertDiv.remove();
      }
    }, duration);
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO');
  } catch (error) {
    return '-';
  }
}

function formatDateTime(dateString, timeString) {
  if (!dateString || !timeString) return '-';
  return `${formatDate(dateString)} ${timeString}`;
}

// FUNCIÓN PARA VERIFICAR SI SE PUEDE CANCELAR LA CITA
function canCancelAppointment(fechaCita, horaCita) {
  if (!fechaCita || !horaCita) return false;

  const citaDateTime = new Date(`${fechaCita}T${horaCita}`);
  const now = new Date();
  const diffHours = (citaDateTime - now) / (1000 * 60 * 60);

  return diffHours > 24; // Debe ser más de 24 horas antes
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
    console.log('Usuario autenticado:', currentUser);
    return true;
  } catch (error) {
    console.error('Error verificando token:', error);
    localStorage.removeItem('token');
    window.location.href = '../Acceso.html';
    return false;
  }
}

// Función para generar iniciales del nombre
function generarIniciales(nombreCompleto) {
  if (!nombreCompleto) return 'U';

  const nombres = nombreCompleto.trim().split(' ');
  if (nombres.length === 1) {
    return nombres[0].charAt(0).toUpperCase();
  }

  return (nombres[0].charAt(0) + nombres[nombres.length - 1].charAt(0)).toUpperCase();
}

// Función para actualizar el avatar
function actualizarAvatar(nombreCompleto) {
  const avatar = document.getElementById('avatar');
  if (avatar) {
    const iniciales = generarIniciales(nombreCompleto);
    avatar.textContent = iniciales;
  }
}

// Cargar perfil
async function cargarPerfil() {
  try {
    showLoading(true);

    const response = await fetch(`${API_BASE_URL}/pacientes/perfil/${currentUser.id_usuario}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Error al cargar el perfil');
    }

    const result = await response.json();
    if (result.success) {
      const perfil = result.data;

      // Actualizar información en la sidebar
      const nombrePaciente = document.getElementById('nombrePaciente');
      if (nombrePaciente) {
        nombrePaciente.textContent = perfil.nombre_completo || 'Usuario';
      }

      actualizarAvatar(perfil.nombre_completo);

      // Actualizar información en el perfil
      const elementos = {
        nombreDisplay: perfil.nombre_completo || '-',
        correoDisplay: perfil.correo || '-',
        documentoDisplay: perfil.documento || '-',
        telefonoDisplay: perfil.telefono || '-',
        fechaDisplay: formatDate(perfil.fecha_nacimiento),
        sexoDisplay: perfil.sexo === 'M' ? 'Masculino' : perfil.sexo === 'F' ? 'Femenino' : '-',
        epsDisplay: perfil.eps || '-',
        contactoeDisplay: perfil.contacto_emergencia || '-',
        telefonoeDisplay: perfil.telefono_emergencia || '-',
        alergiasDisplay: perfil.alergias || '-'
      };

      Object.entries(elementos).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
        }
      });

      // Llenar formulario de edición
      const inputs = {
        nombreInput: perfil.nombre_completo || '',
        telefonoInput: perfil.telefono || '',
        fechaInput: perfil.fecha_nacimiento || '',
        sexoInput: perfil.sexo || '',
        epsInput: perfil.eps || '',
        contactoeInput: perfil.contacto_emergencia || '',
        telefonoeInput: perfil.telefono_emergencia || '',
        alergiasInput: perfil.alergias || ''
      };

      Object.entries(inputs).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
          element.value = value;
        }
      });
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error al cargar el perfil', 'danger');
  } finally {
    showLoading(false);
  }
}

// Actualizar perfil
async function actualizarPerfil() {
  try {
    showLoading(true);

    const data = {
      nombre_completo: document.getElementById('nombreInput')?.value,
      telefono: document.getElementById('telefonoInput')?.value,
      fecha_nacimiento: document.getElementById('fechaInput')?.value || undefined,
      sexo: document.getElementById('sexoInput')?.value || undefined,
      eps: document.getElementById('epsInput')?.value || undefined,
      contacto_emergencia: document.getElementById('contactoeInput')?.value || undefined,
      telefono_emergencia: document.getElementById('telefonoeInput')?.value || undefined,
      alergias: document.getElementById('alergiasInput')?.value || undefined
    };

    const response = await fetch(`${API_BASE_URL}/pacientes/perfil/${currentUser.id_usuario}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      showAlert('Perfil actualizado correctamente', 'success');
      actualizarAvatar(data.nombre_completo);

      const nombrePaciente = document.getElementById('nombrePaciente');
      if (nombrePaciente && data.nombre_completo) {
        nombrePaciente.textContent = data.nombre_completo;
      }

      await cargarPerfil();
      const editForm = document.getElementById('editForm');
      const editarBtn = document.getElementById('editarBtn');
      if (editForm) editForm.style.display = 'none';
      if (editarBtn) editarBtn.style.display = 'block';
    } else {
      showAlert(result.message || 'Error al actualizar perfil', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error al actualizar perfil', 'danger');
  } finally {
    showLoading(false);
  }
}

// Cargar especialidades
async function cargarEspecialidades() {
  try {
    const response = await fetch(`${API_BASE_URL}/pacientes/especialidades`, {
      headers: getAuthHeaders()
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        const especialidadSelects = ['especialidadSelect', 'filtroEspecialidad'];

        especialidadSelects.forEach(selectId => {
          const select = document.getElementById(selectId);
          if (select) {
            const defaultOption = '<option value="">Todas las especialidades</option>';
            select.innerHTML = defaultOption;

            result.data.forEach(esp => {
              const option = document.createElement('option');
              option.value = esp.id_especialidad;
              option.textContent = esp.nombre;
              select.appendChild(option);
            });
          }
        });
      }
    } else {
      console.error('Error al cargar especialidades:', response.status);
    }
  } catch (error) {
    console.error('Error al cargar especialidades:', error);
  }
}

// Cargar médicos
async function cargarMedicos() {
  try {
    const response = await fetch(`${API_BASE_URL}/pacientes/medicos-disponibles`, {
      headers: getAuthHeaders()
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        const medicoSelect = document.getElementById('medicoSelect');
        if (medicoSelect) {
          medicoSelect.innerHTML = '<option value="">Todos los médicos</option>';

          result.data.forEach(med => {
            const option = document.createElement('option');
            option.value = med.id_medico;
            option.textContent = med.medico_nombre;
            medicoSelect.appendChild(option);
          });
        }
      }
    } else {
      console.error('Error al cargar médicos:', response.status);
    }
  } catch (error) {
    console.error('Error al cargar médicos:', error);
  }
}

// Cargar mis citas
async function cargarMisCitas(page = 1, filtros = {}) {
  try {
    showLoading(true);

    const params = new URLSearchParams({
      page: page,
      limit: 10,
      ...filtros
    });

    const response = await fetch(`${API_BASE_URL}/pacientes/mis-citas?${params}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.success) {
      mostrarCitas(result.data.citas);
      if (result.data.pagination) {
        actualizarPaginacion(result.data.pagination);
      }
      actualizarEstadisticas(result.data.citas);
    } else {
      showAlert(result.message || 'Error al cargar citas', 'warning');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert(`Error al cargar las citas: ${error.message}`, 'danger');
  } finally {
    showLoading(false);
  }
}

// MOSTRAR CITAS - AQUÍ SE INTEGRA EL BOTÓN DE CANCELAR
function mostrarCitas(citas) {
  const container = document.getElementById('citasContainer');
  if (!container) return;

  if (!citas || citas.length === 0) {
    container.innerHTML = '<div class="alert alert-info">No se encontraron citas</div>';
    return;
  }

  let html = '';
  citas.forEach(cita => {
    const estadoClass = `item-${cita.estado.toLowerCase()}`;
    const badgeClass = `estado-${cita.estado.toLowerCase()}`;
    const puedeCancel = canCancelAppointment(cita.fecha, cita.hora_inicio);

    html += `
      <div class="item-card ${estadoClass}">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <h6><strong>${cita.motivo || 'Consulta Médica'}</strong></h6>
            <p class="mb-1">
              <i class="bi bi-calendar3 me-2"></i>
              ${formatDateTime(cita.fecha, cita.hora_inicio)} - ${cita.hora_fin}
            </p>
            <p class="mb-1">
              <i class="bi bi-person-badge me-2"></i>
              Dr. ${cita.medico_nombre}
            </p>
            <p class="mb-1">
              <i class="bi bi-hospital me-2"></i>
              ${cita.especialidades || 'Consulta General'}
            </p>
            ${cita.consultorio ? `<p class="mb-1"><i class="bi bi-geo-alt me-2"></i>${cita.consultorio}</p>` : ''}
            ${!puedeCancel && (cita.estado === 'pendiente' || cita.estado === 'confirmada') ?
        '<div class="time-restriction-warning"><i class="bi bi-exclamation-triangle me-1"></i>No se puede cancelar (menos de 24h)</div>' : ''}
          </div>
          <div class="text-end">
            <span class="estado-badge ${badgeClass}">${cita.estado.charAt(0).toUpperCase() + cita.estado.slice(1)}</span>
            <div class="cita-actions mt-2">
              <button class="btn btn-sm btn-info" onclick="descargarComprobante(${cita.id_cita})">
                <i class="bi bi-download"></i> PDF
              </button>
              ${(cita.estado === 'pendiente' || cita.estado === 'confirmada') ?
        `<button type="button"
      class="btn btn-cancel btn-sm"
      ${!puedeCancel ? " title='No se puede cancelar (menos de 24h)'" : ""}
      onclick="cancelarCita(${cita.id_cita}, '${cita.fecha}', '${cita.hora_inicio}')">
      <i class="bi bi-x-circle me-1"></i>
      Cancelar
  </button>` : ''}

            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// FUNCIÓN PRINCIPAL PARA CANCELAR CITA
function cancelarCita(idCita, fechaCita, horaCita) {
  // Verificar si se puede cancelar
  if (!canCancelAppointment(fechaCita, horaCita)) {
    showAlert(
      'No se puede cancelar esta cita porque faltan menos de 24 horas para la fecha programada.',
      'warning'
    );
    return;
  }

  // Guardar datos de la cita para cancelar
  citaParaCancelar = {
    id: idCita,
    fecha: fechaCita,
    hora: horaCita
  };

  // Llenar detalles en el modal
  const citaDetails = document.getElementById('citaDetails');
  if (citaDetails) {
    citaDetails.innerHTML = `
      <div class="row">
        <div class="col-6">
          <strong>Fecha:</strong><br>
          ${new Date(fechaCita).toLocaleDateString('es-CO')}
        </div>
        <div class="col-6">
          <strong>Hora:</strong><br>
          ${horaCita}
        </div>
      </div>
      <div class="mt-2">
        <strong>ID Cita:</strong> #${idCita}
      </div>
    `;
  }

  // Limpiar campos
  const motivoCancelacion = document.getElementById('motivoCancelacion');
  const confirmCheckbox = document.getElementById('confirmCancellation');

  if (motivoCancelacion) motivoCancelacion.value = '';
  if (confirmCheckbox) confirmCheckbox.checked = false;

  // Mostrar modal
  const modal = new bootstrap.Modal(document.getElementById('cancelModal'));
  modal.show();
}

// FUNCIÓN PARA EJECUTAR LA CANCELACIÓN
// FUNCIÓN PARA EJECUTAR LA CANCELACIÓN
async function ejecutarCancelacionCita() {
  try {
    // Validaciones del formulario
    const motivoCancelacion = document.getElementById('motivoCancelacion')?.value?.trim() || '';
    const confirmCheckbox = document.getElementById('confirmCancellation');
    const confirmarBtn = document.getElementById('confirmarCancelacionBtn');

    if (!confirmCheckbox?.checked) {
      showAlert('Debes confirmar que deseas cancelar la cita', 'warning');
      return;
    }

    if (motivoCancelacion.length < 10) {
      showAlert('Por favor proporciona un motivo de al menos 10 caracteres', 'warning');
      document.getElementById('motivoCancelacion')?.focus();
      return;
    }

    // Deshabilitar botón y mostrar loading
    if (confirmarBtn) {
      confirmarBtn.disabled = true;
      confirmarBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Cancelando...';
    }

    showLoading(true);

    // FIX: Add '/pacientes' to the URL path to match backend route
    const response = await fetch(`${API_BASE_URL}/pacientes/citas/${citaParaCancelar.id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        motivo_cancelacion: motivoCancelacion
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      showAlert('Cita cancelada exitosamente. Se ha notificado al médico correspondiente.', 'success');

      // Cerrar modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('cancelModal'));
      if (modal) modal.hide();

      // Actualizar la interfaz (recargar citas)
      setTimeout(() => {
        // Recargar citas con filtros actuales
        const filtros = obtenerFiltrosCitas();
        cargarMisCitas(currentPage, filtros);
      }, 1000);

    } else {
      showAlert(result.message || 'Error al cancelar la cita', 'danger');
    }

  } catch (error) {
    console.error('Error al cancelar la cita:', error);
    showAlert('Error de conexión. Por favor intenta nuevamente.', 'danger');
  } finally {
    // Restaurar botón
    const confirmarBtn = document.getElementById('confirmarCancelacionBtn');
    if (confirmarBtn) {
      confirmarBtn.disabled = false;
      confirmarBtn.innerHTML = '<i class="bi bi-x-circle me-2"></i>Cancelar Cita';
    }
    showLoading(false);
  }
}
// Actualizar estadísticas
function actualizarEstadisticas(citas = []) {
  const activas = citas.filter(c => ['pendiente', 'confirmada'].includes(c.estado)).length;
  const proximas = citas.filter(c => {
    if (c.estado !== 'pendiente' && c.estado !== 'confirmada') return false;
    const citaDate = new Date(c.fecha);
    const today = new Date();
    const diffTime = citaDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }).length;
  const realizadas = citas.filter(c => c.estado === 'realizada').length;
  const canceladas = citas.filter(c => c.estado === 'cancelada').length;

  const elementos = {
    totalCitasActivas: activas,
    citasProximas: proximas,
    citasRealizadas: realizadas,
    citasCanceladas: canceladas
  };

  Object.entries(elementos).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
}

// Actualizar paginación
function actualizarPaginacion(pagination) {
  currentPage = pagination.page;
  totalPages = pagination.pages;

  const container = document.getElementById('paginacionCitas');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '<nav><ul class="pagination">';

  html += `
    <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="cambiarPagina(${currentPage - 1})">Anterior</a>
    </li>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `
        <li class="page-item ${i === currentPage ? 'active' : ''}">
          <a class="page-link" href="#" onclick="cambiarPagina(${i})">${i}</a>
        </li>
      `;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }
  }

  html += `
    <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
      <a class="page-link" href="#" onclick="cambiarPagina(${currentPage + 1})">Siguiente</a>
    </li>
  `;

  html += '</ul></nav>';
  container.innerHTML = html;
}

// Cambiar página
function cambiarPagina(page) {
  if (page < 1 || page > totalPages || page === currentPage) return;
  const filtros = obtenerFiltrosCitas();
  cargarMisCitas(page, filtros);
}

// Obtener filtros de citas
function obtenerFiltrosCitas() {
  const filtroEstado = document.getElementById('filtroEstado');
  const filtroEspecialidad = document.getElementById('filtroEspecialidad');
  const fechaDesde = document.getElementById('fechaDesde');
  const fechaHasta = document.getElementById('fechaHasta');

  const filtros = {};
  if (filtroEstado?.value) filtros.estado = filtroEstado.value;
  if (filtroEspecialidad?.value) filtros.especialidad = filtroEspecialidad.value;
  if (fechaDesde?.value) filtros.fecha_desde = fechaDesde.value;
  if (fechaHasta?.value) filtros.fecha_hasta = fechaHasta.value;

  return filtros;
}

// Filtrar citas
function filtrarCitas() {
  const filtros = obtenerFiltrosCitas();
  cargarMisCitas(1, filtros);
}

// Limpiar filtros
function limpiarFiltros() {
  const filtroEstado = document.getElementById('filtroEstado');
  const filtroEspecialidad = document.getElementById('filtroEspecialidad');
  const fechaDesde = document.getElementById('fechaDesde');
  const fechaHasta = document.getElementById('fechaHasta');

  if (filtroEstado) filtroEstado.value = '';
  if (filtroEspecialidad) filtroEspecialidad.value = '';
  if (fechaDesde) fechaDesde.value = '';
  if (fechaHasta) fechaHasta.value = '';

  cargarMisCitas(1);
}

// EVENT LISTENERS - AQUÍ SE CONFIGURAN LOS EVENTOS DE CANCELACIÓN
document.addEventListener('DOMContentLoaded', function () {
  console.log('Inicializando sistema...');

  // Verificar autenticación
  if (!verificarAuth()) return;

  // Cargar datos iniciales
  cargarPerfil();
  cargarEspecialidades();
  cargarMedicos();
  cargarMisCitas();

  // CONFIGURAR EVENTOS DEL SISTEMA DE CANCELACIÓN

  // Configurar botón de confirmación de cancelación
  const confirmarBtn = document.getElementById('confirmarCancelacionBtn');
  if (confirmarBtn) {
    confirmarBtn.addEventListener('click', ejecutarCancelacionCita);
  }

  // Validación en tiempo real del motivo
  const motivoCancelacion = document.getElementById('motivoCancelacion');
  if (motivoCancelacion) {
    motivoCancelacion.addEventListener('input', function () {
      const confirmarBtn = document.getElementById('confirmarCancelacionBtn');
      const confirmCheckbox = document.getElementById('confirmCancellation');

      if (confirmarBtn) {
        const motivoValido = this.value.trim().length >= 10;
        const checkboxMarcado = confirmCheckbox?.checked || false;

        confirmarBtn.disabled = !(motivoValido && checkboxMarcado);
      }
    });
  }

  // Validación del checkbox
  const confirmCheckbox = document.getElementById('confirmCancellation');
  if (confirmCheckbox) {
    confirmCheckbox.addEventListener('change', function () {
      const confirmarBtn = document.getElementById('confirmarCancelacionBtn');
      const motivoCancelacion = document.getElementById('motivoCancelacion');

      if (confirmarBtn) {
        const motivoValido = motivoCancelacion?.value?.trim()?.length >= 10 || false;
        const checkboxMarcado = this.checked;

        confirmarBtn.disabled = !(motivoValido && checkboxMarcado);
      }
    });
  }

  // Configurar otros eventos existentes
  configurarEventosAdicionales();

  console.log('Sistema de cancelación inicializado');
});

// Función para configurar eventos adicionales (puedes agregar aquí otros eventos)
function configurarEventosAdicionales() {
  // Aquí puedes agregar otros event listeners que necesites

  // Ejemplo: botón de editar perfil
  const editarBtn = document.getElementById('editarBtn');
  if (editarBtn) {
    editarBtn.addEventListener('click', function () {
      const editForm = document.getElementById('editForm');
      if (editForm) {
        editForm.style.display = editForm.style.display === 'none' ? 'block' : 'none';
        this.style.display = 'none';
      }
    });
  }

  // Ejemplo: botón de actualizar perfil
  const actualizarBtn = document.getElementById('actualizarBtn');
  if (actualizarBtn) {
    actualizarBtn.addEventListener('click', actualizarPerfil);
  }

  // Ejemplo: filtros de citas
  const filtrarBtn = document.getElementById('filtrarBtn');
  if (filtrarBtn) {
    filtrarBtn.addEventListener('click', filtrarCitas);
  }

  const limpiarBtn = document.getElementById('limpiarBtn');
  if (limpiarBtn) {
    limpiarBtn.addEventListener('click', limpiarFiltros);
  }
}

// Buscar horarios disponibles
async function buscarHorariosDisponibles() {
  try {
    const fechaDesde = document.getElementById('fechaDesdeAgendar')?.value;
    const fechaHasta = document.getElementById('fechaHastaAgendar')?.value;

    if (!fechaDesde || !fechaHasta) {
      showAlert('Por favor selecciona las fechas de búsqueda', 'warning');
      return;
    }
    if (new Date(fechaDesde) > new Date(fechaHasta)) {
      showAlert('La fecha desde no puede ser mayor a la fecha hasta', 'warning');
      return;
    }

    showLoading(true);

    const especialidadSelect = document.getElementById('especialidadSelect');
    const medicoSelect = document.getElementById('medicoSelect');

    const filtros = {
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      disponibles_solamente: true
    };
    if (especialidadSelect?.value) filtros.especialidad = especialidadSelect.value;
    if (medicoSelect?.value) filtros.medico = medicoSelect.value;

    const params = new URLSearchParams(filtros);
    const url = `${API_BASE_URL}/pacientes/horarios-disponibles?${params}`;

    const response = await fetch(url, { headers: getAuthHeaders() });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    if (result.success) {
      mostrarHorariosDisponibles(result.data);
    } else {
      showAlert(result.message || 'Error al buscar horarios', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error al buscar horarios disponibles', 'danger');
  } finally {
    showLoading(false);
  }
}

// Mostrar horarios disponibles
function mostrarHorariosDisponibles(horarios) {
  const container = document.getElementById('horariosContainer');
  const section = document.getElementById('horariosDisponibles');
  if (!container || !section) return;

  if (!horarios || horarios.length === 0) {
    container.innerHTML = '<div class="alert alert-info">No se encontraron horarios disponibles con los criterios seleccionados</div>';
    section.style.display = 'block';
    // 👉 limpiamos selección y SÍ ocultamos el formulario en este caso
    cancelarSeleccion({ ocultarFormulario: true });
    return;
  }

  const horarioSeleccionadoActual = selectedHorarioData?.id_horario;
  let horarioSeleccionadoSigueDisponible = false;

  let html = '';
  horarios.forEach(horario => {
    const availabilityClass = horario.cupos_disponibles > 3 ? 'available'
      : horario.cupos_disponibles > 0 ? 'limited' : 'unavailable';

    if (horario.cupos_disponibles > 0) {
      const isSelected = horarioSeleccionadoActual === horario.id_horario;
      if (isSelected) horarioSeleccionadoSigueDisponible = true;

      html += `
          <div class="card mb-2 horario-card ${isSelected ? 'selected' : ''}"
               onclick="seleccionarHorario(this, ${horario.id_horario}, ${JSON.stringify(horario).replace(/"/g, '&quot;')})">
            <div class="card-body p-3">
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <h6 class="mb-1">Dr. ${horario.medico_nombre}</h6>
                  <small class="text-muted">${horario.especialidades || 'Consulta General'}</small>
                  <div class="mt-1">
                    <i class="bi bi-calendar3 me-1"></i>${formatDate(horario.fecha)}
                    <i class="bi bi-clock ms-3 me-1"></i>${horario.hora_inicio} - ${horario.hora_fin}
                    ${horario.consultorio ? `<i class="bi bi-geo-alt ms-3 me-1"></i>${horario.consultorio}` : ''}
                  </div>
                  <div class="mt-1">
                    <span class="availability-indicator ${availabilityClass}"></span>
                    <small class="text-muted">${horario.cupos_disponibles} cupo${horario.cupos_disponibles > 1 ? 's' : ''} disponible${horario.cupos_disponibles > 1 ? 's' : ''}</small>
                    ${horario.cupos_disponibles <= 3 && horario.cupos_disponibles > 0 ? '<span class="badge bg-warning ms-2">¡Pocos cupos!</span>' : ''}
                  </div>
                </div>
                <div class="text-primary">
                  <i class="bi bi-check-circle fs-5"></i>
                </div>
              </div>
            </div>
          </div>
        `;
    }
  });

  container.innerHTML = html || '<div class="alert alert-warning">No hay horarios con cupos disponibles</div>';
  section.style.display = 'block';

  // Si el seleccionado ya no está disponible, limpiamos selección y (opcional) mantenemos el form visible
  if (horarioSeleccionadoActual && !horarioSeleccionadoSigueDisponible) {
    cancelarSeleccion({ ocultarFormulario: true }); // si prefieres mantener visible el form, pon false aquí
    showAlert('El horario seleccionado ya no está disponible. Por favor selecciona otro.', 'warning');
  } else if (horarioSeleccionadoSigueDisponible) {
    selectedHorarioElement = container.querySelector('.horario-card.selected');
  }
}

// Seleccionar horario
function seleccionarHorario(element, idHorario, horarioData) {
  if (!horarioData.cupos_disponibles || horarioData.cupos_disponibles <= 0) {
    showAlert('Este horario ya no tiene cupos disponibles.', 'warning');
    return;
  }

  if (selectedHorarioElement) {
    selectedHorarioElement.classList.remove('selected');
  }

  element.classList.add('selected');
  selectedHorarioElement = element;
  selectedHorarioData = horarioData;

  const horarioSeleccionado = document.getElementById('horarioSeleccionado');
  if (horarioSeleccionado) horarioSeleccionado.value = idHorario;

  mostrarResumenCita(horarioData);

  const citaConfirmForm = document.getElementById('citaConfirmForm');
  if (citaConfirmForm) {
    // 👉 aquí aseguramos que el formulario se muestre siempre que se seleccione un horario
    citaConfirmForm.style.display = 'block';
    citaConfirmForm.scrollIntoView({ behavior: 'smooth' });
  }

  let mensaje = 'Horario seleccionado. Complete los datos para confirmar.';
  if (horarioData.cupos_disponibles <= 3) {
    mensaje = `Horario seleccionado (${horarioData.cupos_disponibles} cupo${horarioData.cupos_disponibles > 1 ? 's' : ''} restante${horarioData.cupos_disponibles > 1 ? 's' : ''}). Complete los datos rápidamente.`;
  }
  showAlert(mensaje, 'success', 3000);
}

// Resumen de la cita
function mostrarResumenCita(horario) {
  const resumen = document.getElementById('resumenCita');
  if (!resumen || !horario) return;

  resumen.innerHTML = `
      <div class="row">
        <div class="col-md-6">
          <strong>Médico:</strong> Dr. ${horario.medico_nombre}<br>
          <strong>Especialidad:</strong> ${horario.especialidades || 'Consulta General'}
        </div>
        <div class="col-md-6">
          <strong>Fecha:</strong> ${formatDate(horario.fecha)}<br>
          <strong>Hora:</strong> ${horario.hora_inicio} - ${horario.hora_fin}
        </div>
      </div>
      ${horario.consultorio ? `<div class="mt-2"><strong>Consultorio:</strong> ${horario.consultorio}</div>` : ''}
    `;
}

// ✅ Cancelar selección SIN romper el formulario
function cancelarSeleccion({ ocultarFormulario = false } = {}) {
  if (selectedHorarioElement) {
    selectedHorarioElement.classList.remove('selected');
    selectedHorarioElement = null;
  }
  selectedHorarioData = null;

  const horarioSeleccionado = document.getElementById('horarioSeleccionado');
  if (horarioSeleccionado) horarioSeleccionado.value = '';

  const resumen = document.getElementById('resumenCita');
  if (resumen) resumen.innerHTML = '';

  const citaConfirmForm = document.getElementById('citaConfirmForm');
  if (citaConfirmForm) {
    // Si solo limpiamos, lo dejamos visible (por si tu layout lo necesita),
    // pero si el caller lo pide, lo ocultamos.
    citaConfirmForm.style.display = ocultarFormulario ? 'none' : 'block';
  }
}

// Confirmar agendar cita
async function confirmarAgendarCita() {
  const horarioSeleccionado = document.getElementById('horarioSeleccionado');
  const motivoCita = document.getElementById('motivoCita');
  const aceptarTerminos = document.getElementById('aceptarTerminos');
  const confirmarBtn = document.getElementById('confirmarCitaBtn');

  const idHorario = horarioSeleccionado?.value;
  const motivo = motivoCita?.value;
  const terminos = aceptarTerminos?.checked;

  if (!idHorario) {
    showAlert('Por favor selecciona un horario', 'warning');
    return;
  }
  if (!motivo || motivo.trim().length < 10) {
    showAlert('Por favor describe el motivo de la consulta (mínimo 10 caracteres)', 'warning');
    motivoCita?.focus();
    return;
  }
  if (!terminos) {
    showAlert('Debes aceptar los términos y condiciones', 'warning');
    return;
  }

  try {
    showLoading(true);
    confirmarBtn.disabled = true;
    confirmarBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

    // FIX: Change id_horario to horarioId to match backend expectation
    const requestData = {
      horarioId: parseInt(idHorario),  // ← Changed from id_horario to horarioId
      motivo: motivo.trim()
    };

    const response = await fetch(`${API_BASE_URL}/pacientes/citas`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(requestData)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      showAlert('Cita agendada exitosamente. Se ha enviado confirmación por correo electrónico.', 'success');

      // Limpia y ahora SÍ oculta el formulario tras agendar
      cancelarSeleccion({ ocultarFormulario: true });

      // Refresca horarios para reflejar cupos
      await buscarHorariosDisponibles();

      // (Opcional) ocultar lista de horarios
      const horariosDisponibles = document.getElementById('horariosDisponibles');
      if (horariosDisponibles) horariosDisponibles.style.display = 'none';

      // Reset de filtros/fechas
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 30);
      document.getElementById('fechaDesdeAgendar').value = today;
      document.getElementById('fechaHastaAgendar').value = futureDate.toISOString().split('T')[0];

      const especialidadSelect = document.getElementById('especialidadSelect');
      const medicoSelect = document.getElementById('medicoSelect');
      if (especialidadSelect) especialidadSelect.value = '';
      if (medicoSelect) medicoSelect.value = '';

      const citasSection = document.getElementById('mis-citas');
      if (citasSection && citasSection.classList.contains('active')) {
        cargarMisCitas(1);
      }
    } else {
      if (response.status === 409) {
        showAlert('Este horario ya no está disponible. Por favor selecciona otro horario.', 'warning');
        await buscarHorariosDisponibles();
      } else {
        showAlert(result.message || 'Error al agendar la cita', 'danger');
      }
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert(`Error al agendar la cita: ${error.message}`, 'danger');
    try { await buscarHorariosDisponibles(); } catch (e) { console.error('Error al recargar horarios:', e); }
  } finally {
    showLoading(false);
    confirmarBtn.disabled = false;
    confirmarBtn.innerHTML = '<i class="bi bi-calendar-plus me-2"></i>Confirmar Cita';
  }
}

// Cancelar cita (modal de confirmación)
function cancelarCita(idCita) {
  const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
  document.getElementById('confirmModalTitle').textContent = 'Cancelar Cita';
  document.getElementById('confirmModalBody').innerHTML = `
      <p><strong>Atención:</strong> Una vez cancelada, esta cita no se puede recuperar.</p>
      <p>¿Está seguro que desea cancelar esta cita?</p>
      <div class="mb-3">
        <label for="motivoCancelacion" class="form-label">Motivo de cancelación (opcional):</label>
        <textarea class="form-control" id="motivoCancelacion" rows="3" placeholder="Ingrese el motivo de la cancelación..."></textarea>
      </div>
    `;

  document.getElementById('confirmModalBtn').onclick = async () => {
    modal.hide();
    await ejecutarCancelacionCita(idCita);
  };

  modal.show();
}

// Ejecutar cancelación de cita
async function ejecutarCancelacionCita(idCita) {
  try {
    showLoading(true);
    const motivoCancelacion = document.getElementById('motivoCancelacion')?.value || '';
    const url = `${API_BASE_URL}/pacientes/citas/${idCita}`;
    console.log("DELETE URL:", url);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ motivo_cancelacion: motivoCancelacion })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    if (result.success) {
      showAlert('Cita cancelada exitosamente.', 'success');
      cargarMisCitas(currentPage, obtenerFiltrosCitas());
    } else {
      showAlert(result.message || 'Error al cancelar la cita.', 'danger');
    }
  } catch (error) {
    console.error('Error al cancelar la cita:', error);
    showAlert(error.message || 'Ocurrió un error en la conexión.', 'danger');
  } finally {
    showLoading(false);
  }
}

// SOLUCIÓN 1: Modificar descargarComprobante para obtener datos del paciente
async function descargarComprobante(idCita) {
  // Añade esto al inicio de tu función generarPDFComprobante
  const nombreDelDOM = document.getElementById('nombrePaciente')?.textContent ||
    document.getElementById('nombreDisplay')?.textContent;

  try {
    showLoading(true);

    // 1. Obtener datos de la cita
    const urlCita = `${API_BASE_URL}/pacientes/citas/${idCita}`;

    const responseCita = await fetch(urlCita, {
      headers: getAuthHeaders()
    });

    if (!responseCita.ok) {
      throw new Error(`Error al obtener la cita: ${responseCita.status}`);
    }

    const resultCita = await responseCita.json();


    if (!resultCita.success) {
      throw new Error(resultCita.message || 'Error al obtener datos de la cita');
    }

    // 2. Obtener datos del paciente usando la función que ya tienes

    const datosPaciente = await obtenerDatosPaciente();

    // 3. Combinar datos de cita y paciente
    const datosCompletos = {
      ...resultCita.data,
      paciente_nombre: datosPaciente?.nombre_completo || 'N/A',
      paciente_documento: datosPaciente?.documento || 'N/A',
      paciente_telefono: datosPaciente?.telefono || 'N/A',
      paciente_correo: datosPaciente?.correo || 'N/A'
    };

    // 4. Generar PDF
    generarPDFComprobante(datosCompletos);

  } catch (error) {
    console.error('❌ Error completo:', error);
    showAlert(`Error al descargar el comprobante: ${error.message}`, 'danger');
  } finally {
    showLoading(false);
  }
}

// FUNCIÓN AUXILIAR: Obtener datos del paciente actual
async function obtenerDatosPaciente() {
  try {


    if (!currentUser || !currentUser.id_usuario) {
      ;
      return obtenerDatosPacienteDelDOM();
    }

    const response = await fetch(`${API_BASE_URL}/pacientes/perfil/${currentUser.id_usuario}`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      return obtenerDatosPacienteDelDOM();
    }

    const result = await response.json();
    if (result.success) {
      return result.data;
    }

    return obtenerDatosPacienteDelDOM();

  } catch (error) {

    return obtenerDatosPacienteDelDOM();
  }
}

// FUNCIÓN AUXILIAR: Obtener datos del DOM (fallback)
function obtenerDatosPacienteDelDOM() {


  const datos = {
    nombre_completo: document.getElementById('nombreDisplay')?.textContent?.trim() ||
      document.getElementById('nombrePaciente')?.textContent?.trim() ||
      currentUser?.nombre_completo ||
      null,
    documento: document.getElementById('documentoDisplay')?.textContent?.trim() ||
      currentUser?.documento ||
      null,
    telefono: document.getElementById('telefonoDisplay')?.textContent?.trim() ||
      currentUser?.telefono ||
      null,
    correo: document.getElementById('correoDisplay')?.textContent?.trim() ||
      currentUser?.correo ||
      null
  };

  // Limpiar datos que sean '-' o vacíos
  Object.keys(datos).forEach(key => {
    if (datos[key] === '-' || datos[key] === '' || datos[key] === 'undefined') {
      datos[key] = null;
    }
  });

  return datos;
}

// SOLUCIÓN 2: Función PDF mejorada
function generarPDFComprobante(cita) {

  try {
    if (typeof window.jspdf === 'undefined') {
      console.error('❌ jsPDF no está disponible');
      showAlert('Error: jsPDF no está cargado', 'danger');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 60, 114);
    doc.text('COMPROBANTE DE CITA MÉDICA', 105, 20, null, null, 'center');

    // Logo o línea decorativa
    doc.setDrawColor(30, 60, 114);
    doc.setLineWidth(0.5);
    doc.line(20, 25, 190, 25);

    let yPosition = 40;

    // Estado de la cita
    const estadoColor = {
      'pendiente': [255, 193, 7],
      'confirmada': [40, 167, 69],
      'realizada': [108, 117, 125],
      'cancelada': [220, 53, 69]
    };

    doc.setFillColor(...(estadoColor[cita.estado] || [108, 117, 125]));
    doc.roundedRect(150, yPosition - 5, 35, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text((cita.estado || 'N/A').toUpperCase(), 167.5, yPosition, null, null, 'center');

    // Información del paciente
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    yPosition += 15;

    doc.setFont(undefined, 'bold');
    doc.text('INFORMACIÓN DEL PACIENTE:', 20, yPosition);
    yPosition += 8;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);


    // Obtener datos del paciente con múltiples fallbacks
    const nombrePaciente = cita.paciente_nombre ||
      cita.nombre_paciente ||
      cita.nombre_completo ||
      cita.paciente?.nombre_completo ||
      currentUser?.nombre_completo ||
      'NOMBRE NO DISPONIBLE';

    const documentoPaciente = cita.paciente_documento ||
      cita.documento_paciente ||
      cita.documento ||
      cita.paciente?.documento ||
      currentUser?.documento ||
      'DOCUMENTO NO DISPONIBLE';

    const telefonoPaciente = cita.paciente_telefono ||
      cita.telefono_paciente ||
      cita.telefono ||
      cita.paciente?.telefono ||
      currentUser?.telefono ||
      'N/A';

    const correoPaciente = cita.paciente_correo ||
      cita.correo_paciente ||
      cita.correo ||
      cita.paciente?.correo ||
      currentUser?.correo ||
      'N/A';


    // Mostrar información del paciente
    doc.text(`Nombre: ${nombrePaciente}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Documento: ${documentoPaciente}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Teléfono: ${telefonoPaciente}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Correo: ${correoPaciente}`, 20, yPosition);
    yPosition += 10;

    // Resto del PDF (detalles de la cita)
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('DETALLES DE LA CITA:', 20, yPosition);
    yPosition += 8;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Fecha: ${typeof formatDate === 'function' ? formatDate(cita.fecha) : cita.fecha}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Hora: ${cita.hora_inicio} - ${cita.hora_fin}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Médico: Dr. ${cita.medico_nombre}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Especialidad: ${cita.especialidades || 'Consulta General'}`, 20, yPosition);
    yPosition += 6;

    if (cita.consultorio) {
      doc.text(`Consultorio: ${cita.consultorio}`, 20, yPosition);
      yPosition += 6;
    }

    if (cita.motivo) {
      yPosition += 4;
      doc.text(`Motivo: ${cita.motivo}`, 20, yPosition);
    }

    // Footer
    yPosition = 260;
    doc.setDrawColor(30, 60, 114);
    doc.line(20, yPosition, 190, yPosition);
    yPosition += 8;
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text('MediCitas - Sistema de Gestión de Citas Médicas', 105, yPosition, null, null, 'center');

    // Descargar
    const fileName = `comprobante-cita-${cita.id_cita || 'sin-id'}-${cita.fecha || 'sin-fecha'}.pdf`;
    doc.save(fileName);



  } catch (error) {
    console.error('❌ Error en generarPDFComprobante:', error);
    showAlert(`Error al generar el PDF: ${error.message}`, 'danger');
  }
}

// SOLUCIÓN 3: Función de emergencia - usar solo datos del DOM/currentUser
function generarPDFComprobanteSimple(cita) {

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('COMPROBANTE DE CITA MÉDICA', 105, 20, null, null, 'center');

    let yPosition = 40;

    // Información del paciente desde currentUser o DOM
    doc.setFont(undefined, 'bold');
    doc.text('INFORMACIÓN DEL PACIENTE:', 20, yPosition);
    yPosition += 10;

    doc.setFont(undefined, 'normal');

    // Forzar obtener datos actuales
    const nombre = currentUser?.nombre_completo || 'USUARIO ACTUAL';
    const documento = currentUser?.documento || 'DOCUMENTO NO DISPONIBLE';



    doc.text(`Nombre: ${nombre}`, 20, yPosition);
    yPosition += 6;
    doc.text(`Documento: ${documento}`, 20, yPosition);
    yPosition += 10;

    // Detalles básicos de la cita
    doc.setFont(undefined, 'bold');
    doc.text('DETALLES DE LA CITA:', 20, yPosition);
    yPosition += 10;

    doc.setFont(undefined, 'normal');
    doc.text(`Fecha: ${cita.fecha || 'N/A'}`, 20, yPosition);
    yPosition += 6;
    doc.text(`ID Cita: ${cita.id_cita || 'N/A'}`, 20, yPosition);

    doc.save(`comprobante-${Date.now()}.pdf`);
    showAlert('PDF generado con datos básicos', 'success');

  } catch (error) {
    console.error('❌ Error en PDF simple:', error);
    showAlert('Error al generar PDF básico', 'danger');
  }
}

// Cerrar sesión
function cerrarSesion() {
  localStorage.removeItem('token');
  showAlert('Tu sesión ha sido cerrada', 'info', 2000);
  setTimeout(() => {
    window.location.href = '../Acceso.html';
  }, 1000);
}

// Event listeners y inicialización
document.addEventListener('DOMContentLoaded', function () {


  // Verificar autenticación
  if (!verificarAuth()) {

    return;
  }



  // Configurar fechas mínimas
  const today = new Date().toISOString().split('T')[0];
  const fechaDesdeAgendar = document.getElementById('fechaDesdeAgendar');
  const fechaHastaAgendar = document.getElementById('fechaHastaAgendar');

  if (fechaDesdeAgendar) {
    fechaDesdeAgendar.min = today;
    fechaDesdeAgendar.value = today;
  }
  if (fechaHastaAgendar) {
    fechaHastaAgendar.min = today;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    fechaHastaAgendar.value = futureDate.toISOString().split('T')[0];
  }

  // Configurar fecha hasta cuando cambie fecha desde
  if (fechaDesdeAgendar && fechaHastaAgendar) {
    fechaDesdeAgendar.addEventListener('change', function () {
      fechaHastaAgendar.min = this.value;
      if (fechaHastaAgendar.value < this.value) {
        const futureDate = new Date(this.value);
        futureDate.setDate(futureDate.getDate() + 7);
        fechaHastaAgendar.value = futureDate.toISOString().split('T')[0];
      }
    });
  }

  // Navegación entre secciones
  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      const section = this.dataset.section;

      // Actualizar navegación
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      this.classList.add('active');

      // Mostrar sección
      document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
      const targetSection = document.getElementById(section);
      if (targetSection) {
        targetSection.classList.add('active');
      }

      // Cargar datos específicos de la sección
      if (section === 'mis-citas') {
        cargarMisCitas(1);
        cargarEspecialidades(); // Para filtros
      } else if (section === 'perfil') {
        cargarPerfil();
      } else if (section === 'dashboard') {
        cargarMisCitas(1); // Para actualizar estadísticas
      } else if (section === 'agendar') {
        cargarEspecialidades();
        cargarMedicos();
        // Limpiar formulario anterior
        cancelarSeleccion();
      }
    });
  });

  // Eventos del perfil
  const editarBtn = document.getElementById('editarBtn');
  const cancelarBtn = document.getElementById('cancelarBtn');
  const guardarBtn = document.getElementById('guardarBtn');
  const editForm = document.getElementById('editForm');

  if (editarBtn && editForm) {
    editarBtn.addEventListener('click', function () {
      editForm.style.display = 'block';
      this.style.display = 'none';
    });
  }

  if (cancelarBtn && editForm && editarBtn) {
    cancelarBtn.addEventListener('click', function () {
      editForm.style.display = 'none';
      editarBtn.style.display = 'block';
    });
  }

  if (guardarBtn) {
    guardarBtn.addEventListener('click', actualizarPerfil);
  }

  // Eventos de filtros para especialidad y médico
  const especialidadSelect = document.getElementById('especialidadSelect');
  const medicoSelect = document.getElementById('medicoSelect');

  if (especialidadSelect) {
    especialidadSelect.addEventListener('change', async function () {
      if (medicoSelect) {
        medicoSelect.innerHTML = '<option value="">Todos los médicos</option>';

        if (this.value) {
          try {
            // Asumir que existe el endpoint para médicos por especialidad
            const response = await fetch(`${API_BASE_URL}/medicos/por-especialidad/${this.value}`, {
              headers: getAuthHeaders()
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                result.data.forEach(med => {
                  const option = document.createElement('option');
                  option.value = med.id_medico;
                  option.textContent = `Dr. ${med.nombre_completo}`;
                  medicoSelect.appendChild(option);
                });
              }
            }
          } catch (error) {
            console.error('Error al cargar médicos por especialidad:', error);
          }
        }
      }
    });
  }

  // Cargar datos iniciales
  cargarPerfil();
  cargarMisCitas(1);
  cargarEspecialidades();
  cargarMedicos();

  console.log('Panel de paciente inicializado correctamente');
});