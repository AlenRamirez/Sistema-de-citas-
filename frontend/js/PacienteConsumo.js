const API_BASE_URL = 'http://localhost:3000'; // Cambia esta URL por la de tu servidor
let currentUser = null;
let currentPage = 1;
let totalPages = 1;
let selectedHorarioElement = null;

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

  // Tomar la primera letra del primer nombre y primera letra del primer apellido
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

// Modifica la función cargarPerfil existente para incluir la actualización del avatar
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

      // *** NUEVA LÍNEA: Actualizar avatar con iniciales ***
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

// También modifica la función actualizarPerfil para actualizar el avatar después de guardar cambios
actualizarPerfil: async (req, res) => {
  try {
    const { id } = req.params;
    const requestedId = parseInt(id);
    const userId = req.user.id_usuario;
    const userRole = req.user.rol;

    // Verificación de permisos
    if (!(userRole === 'admin' || (userRole === 'paciente' && requestedId === userId))) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar este perfil'
      });
    }

    const {
      nombre_completo,
      telefono,
      fecha_nacimiento,
      sexo,
      eps,
      contacto_emergencia,
      telefono_emergencia,
      alergias
    } = req.body;

    if (!nombre_completo || nombre_completo.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El nombre completo es requerido'
      });
    }

    // VALIDACIÓN DE FECHA DE NACIMIENTO INLINE
    if (fecha_nacimiento !== undefined && fecha_nacimiento) {
      const fechaNac = new Date(fecha_nacimiento);
      const hoy = new Date();

      // Verificar que la fecha sea válida
      if (isNaN(fechaNac.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Fecha de nacimiento inválida'
        });
      }

      // Verificar que no sea una fecha futura
      if (fechaNac > hoy) {
        return res.status(400).json({
          success: false,
          message: 'La fecha de nacimiento no puede ser en el futuro'
        });
      }

      // Calcular edad
      let edad = hoy.getFullYear() - fechaNac.getFullYear();
      const mes = hoy.getMonth() - fechaNac.getMonth();

      if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
        edad--;
      }

      // Verificar edad mínima (18 años)
      if (edad < 18) {
        return res.status(400).json({
          success: false,
          message: 'Debes ser mayor de 18 años para usar este sistema'
        });
      }

      // Verificar edad máxima razonable (120 años)
      if (edad > 120) {
        return res.status(400).json({
          success: false,
          message: 'Por favor verifica la fecha de nacimiento ingresada'
        });
      }

      // Verificar año mínimo razonable (1900)
      if (fechaNac.getFullYear() < 1900) {
        return res.status(400).json({
          success: false,
          message: 'Por favor ingresa un año válido (desde 1900)'
        });
      }
    }

    // Actualizar usuarios - SOLO SI LOS CAMPOS ESTÁN PRESENTES
    const userFieldsToUpdate = [];
    const userValues = [];

    if (nombre_completo !== undefined) {
      userFieldsToUpdate.push('nombre_completo = ?');
      userValues.push(nombre_completo);
    }
    if (telefono !== undefined) {
      userFieldsToUpdate.push('telefono = ?');
      userValues.push(telefono);
    }

    if (userFieldsToUpdate.length > 0) {
      const updateUserQuery = `
        UPDATE usuarios 
        SET ${userFieldsToUpdate.join(', ')}
        WHERE id_usuario = ?
      `;
      await pool.execute(updateUserQuery, [...userValues, requestedId]);
    }

    // Actualizar pacientes - SOLO CAMPOS PRESENTES
    const patientFieldsToUpdate = [];
    const patientValues = [];

    if (fecha_nacimiento !== undefined) {
      patientFieldsToUpdate.push('fecha_nacimiento = ?');
      patientValues.push(fecha_nacimiento || null);
    }
    if (sexo !== undefined) {
      patientFieldsToUpdate.push('sexo = ?');
      patientValues.push(sexo || null);
    }
    if (eps !== undefined) {
      patientFieldsToUpdate.push('eps = ?');
      patientValues.push(eps || null);
    }
    if (contacto_emergencia !== undefined) {
      patientFieldsToUpdate.push('contacto_emergencia = ?');
      patientValues.push(contacto_emergencia || null);
    }
    if (telefono_emergencia !== undefined) {
      patientFieldsToUpdate.push('telefono_emergencia = ?');
      patientValues.push(telefono_emergencia || null);
    }
    if (alergias !== undefined) {
      patientFieldsToUpdate.push('alergias = ?');
      patientValues.push(alergias || null);
    }

    // Solo actualizar tabla pacientes si hay campos para actualizar
    if (patientFieldsToUpdate.length > 0) {
      const checkPatientQuery = `SELECT id_paciente FROM pacientes WHERE id_paciente = ?`;
      const [patientExists] = await pool.execute(checkPatientQuery, [requestedId]);

      if (patientExists.length > 0) {
        // Actualizar registro existente
        const updatePatientQuery = `
          UPDATE pacientes
          SET ${patientFieldsToUpdate.join(', ')}
          WHERE id_paciente = ?
        `;
        await pool.execute(updatePatientQuery, [...patientValues, requestedId]);
      } else {
        // Crear nuevo registro con solo los campos que vienen en el request
        const insertFields = ['id_paciente'];
        const insertValues = [requestedId];
        const insertPlaceholders = ['?'];

        if (fecha_nacimiento !== undefined) {
          insertFields.push('fecha_nacimiento');
          insertValues.push(fecha_nacimiento || null);
          insertPlaceholders.push('?');
        }
        if (sexo !== undefined) {
          insertFields.push('sexo');
          insertValues.push(sexo || null);
          insertPlaceholders.push('?');
        }
        if (eps !== undefined) {
          insertFields.push('eps');
          insertValues.push(eps || null);
          insertPlaceholders.push('?');
        }
        if (contacto_emergencia !== undefined) {
          insertFields.push('contacto_emergencia');
          insertValues.push(contacto_emergencia || null);
          insertPlaceholders.push('?');
        }
        if (telefono_emergencia !== undefined) {
          insertFields.push('telefono_emergencia');
          insertValues.push(telefono_emergencia || null);
          insertPlaceholders.push('?');
        }
        if (alergias !== undefined) {
          insertFields.push('alergias');
          insertValues.push(alergias || null);
          insertPlaceholders.push('?');
        }

        const insertPatientQuery = `
          INSERT INTO pacientes (${insertFields.join(', ')})
          VALUES (${insertPlaceholders.join(', ')})
        `;
        await pool.execute(insertPatientQuery, insertValues);
      }
    }

    res.json({
      success: true,
      message: 'Perfil actualizado correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
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

    console.log('Cargando citas con URL:', `${API_BASE_URL}/pacientes/citas?${params}`);

    const response = await fetch(`${API_BASE_URL}/pacientes/citas?${params}`, {
      headers: getAuthHeaders()
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Citas recibidas:', result);

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

// Mostrar citas en el DOM
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
              </div>
              <div class="text-end">
                <span class="estado-badge ${badgeClass}">${cita.estado.charAt(0).toUpperCase() + cita.estado.slice(1)}</span>
                <div class="cita-actions mt-2">
                  ${cita.estado === 'pendiente' || cita.estado === 'confirmada' ?
        `<button class="btn btn-sm btn-warning me-1" onclick="cancelarCita(${cita.id_cita})">
                      <i class="bi bi-x-circle"></i> Cancelar
                    </button>` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
  });

  container.innerHTML = html;
}

// Actualizar estadísticas en el dashboard
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

  // Botón anterior
  html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
          <a class="page-link" href="#" onclick="cambiarPagina(${currentPage - 1})">Anterior</a>
        </li>
      `;

  // Páginas
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

  // Botón siguiente
  html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
          <a class="page-link" href="#" onclick="cambiarPagina(${currentPage + 1})">Siguiente</a>
        </li>
      `;

  html += '</ul></nav>';
  container.innerHTML = html;
}

// Cambiar página de citas
function cambiarPagina(page) {
  if (page < 1 || page > totalPages || page === currentPage) return;

  const filtros = obtenerFiltrosCitas();
  cargarMisCitas(page, filtros);
}

// Obtener filtros de citas
function obtenerFiltrosCitas() {
  const filtroEstado = document.getElementById('filtroEstado');
  const fechaDesde = document.getElementById('fechaDesde');
  const fechaHasta = document.getElementById('fechaHasta');

  const filtros = {};
  if (filtroEstado?.value) filtros.estado = filtroEstado.value;
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
  const fechaDesde = document.getElementById('fechaDesde');
  const fechaHasta = document.getElementById('fechaHasta');

  if (filtroEstado) filtroEstado.value = '';
  if (fechaDesde) fechaDesde.value = '';
  if (fechaHasta) fechaHasta.value = '';

  cargarMisCitas(1);
}

// Cancelar cita
function cancelarCita(idCita) {
  const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
  document.getElementById('confirmModalTitle').textContent = 'Cancelar Cita';
  document.getElementById('confirmModalBody').innerHTML = `
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

async function ejecutarCancelacionCita(idCita) {
  try {
    showLoading(true);

    const motivo = document.getElementById('motivoCancelacion')?.value || '';

    const response = await fetch(`${API_BASE_URL}/pacientes/citas/${idCita}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ motivo_cancelacion: motivo })
    });

    const result = await response.json();

    if (result.success) {
      showAlert('Cita cancelada exitosamente', 'success');
      const filtros = obtenerFiltrosCitas();
      cargarMisCitas(currentPage, filtros);
    } else {
      showAlert(result.message || 'Error al cancelar la cita', 'danger');
    }
  } catch (error) {
    console.error('Error:', error);
    showAlert('Error al cancelar la cita', 'danger');
  } finally {
    showLoading(false);
  }
}

// Cargar especialidades y médicos para agendar
async function cargarDatosAgendar() {
  try {
    console.log('Cargando datos para agendar...');

    // Cargar médicos
    const respMedicos = await fetch(`${API_BASE_URL}/pacientes/medicos-disponibles`, {
      headers: getAuthHeaders()
    });

    console.log('Response médicos status:', respMedicos.status);

    if (respMedicos.ok) {
      const medicos = await respMedicos.json();
      console.log('Médicos recibidos:', medicos);

      const select = document.getElementById('medicoSelect');
      if (select && medicos.success) {
        // Limpiar opciones existentes excepto la primera
        select.innerHTML = '<option value="">-- Todos los médicos --</option>';

        medicos.data.forEach(med => {
          const option = document.createElement('option');
          option.value = med.id_medico;
          option.textContent = `Dr. ${med.medico_nombre}`;
          select.appendChild(option);
        });
      }
    } else {
      console.error('Error al cargar médicos:', respMedicos.status);
    }
  } catch (error) {
    console.error('Error al cargar datos para agendar:', error);
  }
}

// Buscar horarios disponibles
async function buscarHorariosDisponibles() {
  try {
    const fechaDesde = document.getElementById('fechaDesdeAgendar')?.value;
    const fechaHasta = document.getElementById('fechaHastaAgendar')?.value;

    console.log('Buscando horarios desde:', fechaDesde, 'hasta:', fechaHasta);

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
      fecha_hasta: fechaHasta
    };

    if (especialidadSelect?.value) filtros.especialidad = especialidadSelect.value;
    if (medicoSelect?.value) filtros.medico = medicoSelect.value;

    console.log('Filtros de búsqueda:', filtros);

    const params = new URLSearchParams(filtros);
    const url = `${API_BASE_URL}/pacientes/medicos-disponibles?${params}`;

    console.log('URL de búsqueda:', url);

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('Horarios recibidos:', result);

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
    return;
  }

  let html = '';
  horarios.forEach(horario => {
    html += `
          <div class="card mb-2 horario-card" onclick="seleccionarHorario(this, ${horario.id_horario})">
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
                </div>
                <div class="text-primary">
                  <i class="bi bi-check-circle fs-5"></i>
                </div>
              </div>
            </div>
          </div>
        `;
  });

  container.innerHTML = html;
  section.style.display = 'block';
}

// Seleccionar horario
function seleccionarHorario(element, idHorario) {
  console.log('Seleccionando horario:', idHorario);

  // Remover selección anterior
  if (selectedHorarioElement) {
    selectedHorarioElement.classList.remove('selected');
  }

  // Seleccionar nuevo elemento
  element.classList.add('selected');
  selectedHorarioElement = element;

  // Guardar ID del horario
  const horarioSeleccionado = document.getElementById('horarioSeleccionado');
  if (horarioSeleccionado) {
    horarioSeleccionado.value = idHorario;
    console.log('Horario guardado en input:', horarioSeleccionado.value);
  }

  showAlert('Horario seleccionado correctamente', 'success', 2000);
}

// Agendar cita
async function agendarCita(event) {
  event.preventDefault();

  console.log('Iniciando proceso de agendar cita...');

  const horarioSeleccionado = document.getElementById('horarioSeleccionado');
  const motivoCita = document.getElementById('motivoCita');
  const confirmarBtn = document.getElementById('confirmarCitaBtn');

  const idHorario = horarioSeleccionado?.value;
  const motivo = motivoCita?.value;

  console.log('Datos del formulario:');
  console.log('- ID Horario:', idHorario);
  console.log('- Motivo:', motivo);

  if (!idHorario) {
    showAlert('Por favor selecciona un horario', 'warning');
    return;
  }

  try {
    showLoading(true);
    confirmarBtn.disabled = true;
    confirmarBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Procesando...';

    const requestData = {
      id_horario: parseInt(idHorario),
      motivo: motivo || undefined
    };

    console.log('Datos a enviar:', requestData);
    console.log('Headers:', getAuthHeaders());

    const response = await fetch(`${API_BASE_URL}/pacientes/citas`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(requestData)
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);

    let result;
    const responseText = await response.text();
    console.log('Response text:', responseText);

    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      throw new Error(`Error en el servidor: ${responseText}`);
    }

    console.log('Response parsed:', result);

    if (response.ok && result.success) {
      showAlert('Cita agendada exitosamente', 'success');

      // Limpiar formulario
      const citaForm = document.getElementById('citaForm');
      const horariosDisponibles = document.getElementById('horariosDisponibles');

      if (citaForm) {
        citaForm.reset();
        // Restaurar fechas por defecto
        const today = new Date().toISOString().split('T')[0];
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);

        document.getElementById('fechaDesdeAgendar').value = today;
        document.getElementById('fechaHastaAgendar').value = futureDate.toISOString().split('T')[0];
      }

      if (horariosDisponibles) horariosDisponibles.style.display = 'none';
      if (horarioSeleccionado) horarioSeleccionado.value = '';

      selectedHorarioElement = null;

      // Recargar citas si estamos en esa sección
      const citasSection = document.getElementById('mis-citas');
      if (citasSection && citasSection.classList.contains('active')) {
        cargarMisCitas(1);
      }
    } else {
      console.error('Error en la respuesta:', result);
      showAlert(result.message || 'Error al agendar la cita', 'danger');
    }
  } catch (error) {
    console.error('Error completo:', error);
    showAlert(`Error al agendar la cita: ${error.message}`, 'danger');
  } finally {
    showLoading(false);
    confirmarBtn.disabled = false;
    confirmarBtn.innerHTML = '<i class="bi bi-calendar-plus me-2"></i>Confirmar Cita';
  }
}

// Cerrar sesión
function cerrarSesion() {
  localStorage.removeItem('token');
  alert('Tu sesión ha sido cerrada');
  window.location.href = '../Acceso.html';
}

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
  console.log('DOM loaded, iniciando aplicación...');

  // Verificar autenticación
  if (!verificarAuth()) {
    console.log('Usuario no autenticado, redirigiendo...');
    return;
  }

  console.log('Usuario autenticado, configurando aplicación...');

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
    // Establecer fecha hasta como 30 días después de hoy por defecto
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
      console.log('Navegando a sección:', section);

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
      } else if (section === 'perfil') {
        cargarPerfil();
      } else if (section === 'dashboard') {
        cargarMisCitas(1); // Para actualizar estadísticas
      } else if (section === 'agendar') {
        cargarDatosAgendar();
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

  // Evento del formulario de citas
  const citaForm = document.getElementById('citaForm');
  if (citaForm) {
    citaForm.addEventListener('submit', agendarCita);
    console.log('Event listener agregado al formulario de citas');
  }

  // Cargar datos iniciales
  console.log('Cargando datos iniciales...');
  cargarPerfil();
  cargarMisCitas(1);
  cargarDatosAgendar();
  cargarPerfil();

  console.log('Panel de paciente inicializado correctamente');
});