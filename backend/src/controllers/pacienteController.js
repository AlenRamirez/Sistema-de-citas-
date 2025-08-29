const { pool } = require('../config/db');
const { sendConfirmationcorreoCc } = require("../utils/mailer");

const pacienteController = {
  obtenerPerfil: async (req, res) => {
    try {
      const { id } = req.params;
      const requestedId = parseInt(id);
      const userId = req.user.id_usuario;
      const userRole = req.user.rol;
      // Verificación de permisos
      if (!(userRole === 'admin' || (userRole === 'paciente' && requestedId === userId))) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para acceder a este perfil'
        });
      }
      const query = `
        SELECT u.id_usuario, u.correo, u.nombre_completo, u.documento, 
               u.telefono, u.activo, u.created_at,
               p.fecha_nacimiento, p.sexo, p.eps, p.contacto_emergencia, p.telefono_emergencia, p.alergias
        FROM usuarios u
        LEFT JOIN pacientes p ON u.id_usuario = p.id_paciente
        WHERE u.id_usuario = ? AND u.id_rol = 2
      `;
      const [rows] = await pool.execute(query, [requestedId]);
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Paciente no encontrado'
        });
      }
      const paciente = rows[0];
      delete paciente.password_hash;
      res.json({
        success: true,
        data: paciente
      });
    } catch (error) {
      console.error('Error al obtener perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },
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
      const { nombre_completo, telefono, fecha_nacimiento, sexo, eps, contacto_emergencia, telefono_emergencia, alergias } = req.body;
      if (!nombre_completo || nombre_completo.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'El nombre completo es requerido'
        });
      }
      const toNullIfUndefined = (value) => value !== undefined ? value : null;
      // Actualizar usuarios
      const updateUserQuery = `
        UPDATE usuarios 
        SET nombre_completo = ?, telefono = ?
        WHERE id_usuario = ?
      `;
      await pool.execute(updateUserQuery, [nombre_completo, telefono, requestedId]);
      // Actualizar o insertar pacientes - FIX: Parámetros correctos
      if (fecha_nacimiento !== undefined || sexo !== undefined || eps !== undefined || contacto_emergencia !== undefined || telefono_emergencia !== undefined || alergias !== undefined) {
        const checkPatientQuery = `SELECT id_paciente FROM pacientes WHERE id_paciente = ?`;
        const [patientExists] = await pool.execute(checkPatientQuery, [requestedId]);
        if (patientExists.length > 0) {
          const updatePatientQuery = `
            UPDATE pacientes
            SET fecha_nacimiento = ?, sexo = ?, eps = ?, contacto_emergencia = ?, telefono_emergencia = ?, alergias = ?
            WHERE id_paciente = ?
          `;
          await pool.execute(updatePatientQuery, [
            toNullIfUndefined(fecha_nacimiento),
            toNullIfUndefined(sexo),
            toNullIfUndefined(eps),
            toNullIfUndefined(contacto_emergencia),
            toNullIfUndefined(telefono_emergencia),
            toNullIfUndefined(alergias),
            requestedId
          ]);
        } else {
          // FIX: Query INSERT corregido con todos los parámetros
          const insertPatientQuery = `
            INSERT INTO pacientes (id_paciente, fecha_nacimiento, sexo, eps, contacto_emergencia, telefono_emergencia, alergias)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;
          await pool.execute(insertPatientQuery, [
            requestedId,
            toNullIfUndefined(fecha_nacimiento),
            toNullIfUndefined(sexo),
            toNullIfUndefined(eps),
            toNullIfUndefined(contacto_emergencia),
            toNullIfUndefined(telefono_emergencia),
            toNullIfUndefined(alergias)
          ]);
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
  },
  obtenerMisCitas: async (req, res) => {
    try {
      const id_paciente = req.user.id_usuario;
      const { estado, especialidad, fecha_desde, fecha_hasta, page = 1, limit = 10 } = req.query;
      if (!id_paciente) {
        return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
      }
      // Validaciones
      const safeLimit = Math.max(1, parseInt(limit) || 10);
      const offset = (parseInt(page) - 1) * safeLimit;
      const estadosPermitidos = ['pendiente', 'confirmada', 'realizada', 'cancelada'];
      if (estado && !estadosPermitidos.includes(estado.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Estado inválido' });
      }
      // Construcción dinámica del WHERE
      let whereClause = 'WHERE c.id_paciente = ?';
      let queryParams = [id_paciente];
      if (estado) {
        whereClause += ' AND ec.nombre = ?';
        queryParams.push(estado);
      }
      if (especialidad) {
        whereClause += ' AND e.id_especialidad = ?';
        queryParams.push(especialidad);
      }
      if (fecha_desde) {
        whereClause += ' AND h.fecha >= ?';
        queryParams.push(fecha_desde);
      }
      if (fecha_hasta) {
        whereClause += ' AND h.fecha <= ?';
        queryParams.push(fecha_hasta);
      }
      // Query principal con paginación
      const query = `
        SELECT c.id_cita, c.motivo, c.fecha_creacion,
               h.fecha, h.hora_inicio, h.hora_fin,
               u.nombre_completo as medico_nombre,
               m.registro_profesional, m.consultorio,
               ec.nombre as estado,
               GROUP_CONCAT(DISTINCT e.nombre) as especialidades
        FROM citas c
        INNER JOIN horarios h ON c.id_horario = h.id_horario
        INNER JOIN medicos m ON h.id_medico = m.id_medico
        INNER JOIN usuarios u ON m.id_medico = u.id_usuario
        INNER JOIN estados_cita ec ON c.id_estado = ec.id_estado
        LEFT JOIN medico_especialidad me ON m.id_medico = me.id_medico
        LEFT JOIN especialidades e ON me.id_especialidad = e.id_especialidad
        ${whereClause}
        GROUP BY c.id_cita
        ORDER BY h.fecha DESC, h.hora_inicio DESC
        LIMIT ? OFFSET ?
      `;
      const [rows] = await pool.execute(query, [...queryParams, safeLimit, offset]);
      // Query de conteo
      const countQuery = `
        SELECT COUNT(DISTINCT c.id_cita) as total
        FROM citas c
        INNER JOIN horarios h ON c.id_horario = h.id_horario
        INNER JOIN estados_cita ec ON c.id_estado = ec.id_estado
        LEFT JOIN medico_especialidad me ON h.id_medico = me.id_medico
        LEFT JOIN especialidades e ON me.id_especialidad = e.id_especialidad
        ${whereClause}
      `;
      const [countRows] = await pool.execute(countQuery, queryParams);
      res.json({
        success: true,
        data: {
          citas: rows,
          pagination: {
            page: parseInt(page),
            limit: safeLimit,
            total: countRows[0].total,
            pages: Math.ceil(countRows[0].total / safeLimit)
          }
        }
      });
    } catch (error) {
      console.error('Error al obtener citas:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  },
  // FIX: Nuevo endpoint para obtener una cita específica
  obtenerCita: async (req, res) => {
    try {
      const { id } = req.params;
      const id_paciente = req.user.id_usuario;
      const query = `
        SELECT c.id_cita, c.motivo, c.fecha_creacion,
               h.fecha, h.hora_inicio, h.hora_fin,
               u.nombre_completo as medico_nombre,
               m.registro_profesional, m.consultorio,
               ec.nombre as estado,
               GROUP_CONCAT(DISTINCT e.nombre) as especialidades
        FROM citas c
        INNER JOIN horarios h ON c.id_horario = h.id_horario
        INNER JOIN medicos m ON h.id_medico = m.id_medico
        INNER JOIN usuarios u ON m.id_medico = u.id_usuario
        INNER JOIN estados_cita ec ON c.id_estado = ec.id_estado
        LEFT JOIN medico_especialidad me ON m.id_medico = me.id_medico
        LEFT JOIN especialidades e ON me.id_especialidad = e.id_especialidad
        WHERE c.id_cita = ? AND c.id_paciente = ?
        GROUP BY c.id_cita
      `;
      const [rows] = await pool.execute(query, [id, id_paciente]);
      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Cita no encontrada'
        });
      }
      res.json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      console.error('Error al obtener cita:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  // Agendar cita con bloqueo seguro de horario
  agendarCita: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const id_paciente = req.user.id_usuario;
      const { id_horario, motivo } = req.body;

      if (!id_horario) {
        return res.status(400).json({ success: false, message: 'El horario es requerido' });
      }
      if (!motivo || motivo.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: 'El motivo debe tener al menos 10 caracteres'
        });
      }

      const horarioId = parseInt(id_horario);
      if (isNaN(horarioId)) {
        return res.status(400).json({ success: false, message: 'ID de horario inválido' });
      }

      // SOLUTION 1: Check for existing appointments first
      const [existingCitas] = await connection.execute(
        `SELECT c.id_cita FROM citas c 
       WHERE c.id_horario = ? AND c.id_estado IN (1, 2)`,
        [horarioId]
      );

      if (existingCitas.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Este horario ya está ocupado. Por favor selecciona otro.'
        });
      }

      // Bloqueo seguro del horario con FOR UPDATE
      const [horarioRows] = await connection.execute(
        `SELECT h.*, 
              (SELECT COUNT(*) FROM citas c WHERE c.id_horario = h.id_horario AND c.id_estado IN (1,2)) as citas_activas
       FROM horarios h
       WHERE h.id_horario = ? AND h.disponible = true AND h.fecha >= CURDATE() 
       FOR UPDATE`,
        [horarioId]
      );

      if (horarioRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'El horario no está disponible' });
      }

      // Additional check: verify no active appointments exist
      if (horarioRows[0].citas_activas > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Este horario ya está ocupado. Por favor selecciona otro.'
        });
      }

      // Validar conflictos del paciente
      const [citasConflicto] = await connection.execute(`
      SELECT c.id_cita 
      FROM citas c 
      INNER JOIN horarios h ON c.id_horario = h.id_horario 
      WHERE c.id_paciente = ? AND h.fecha = ? AND h.hora_inicio = ? 
      AND c.id_estado IN (1, 2)
    `, [id_paciente, horarioRows[0].fecha, horarioRows[0].hora_inicio]);

      if (citasConflicto.length > 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Ya tienes una cita a esa hora' });
      }

      // SOLUTION 2: Use INSERT IGNORE or try-catch for constraint violations
      try {
        // Insertar cita
        const [citaResult] = await connection.execute(`
        INSERT INTO citas (id_paciente, id_horario, id_estado, motivo, fecha_creacion) 
        VALUES (?, ?, 1, ?, NOW())
      `, [id_paciente, horarioId, motivo.trim()]);

        // Marcar horario como ocupado
        await connection.execute(
          'UPDATE horarios SET disponible = false WHERE id_horario = ?',
          [horarioId]
        );

        // Auditoría
        await connection.execute(`
        INSERT INTO auditoria_citas (id_cita, evento, actor_id_usuario, fecha_evento)
        VALUES (?, 'creada', ?, NOW())
      `, [citaResult.insertId, id_paciente]);

        await connection.commit();

        // Get patient info for email
        const [pacienteInfo] = await connection.execute(
          `SELECT u.correo, u.nombre_completo 
         FROM usuarios u WHERE u.id_usuario = ?`,
          [id_paciente]
        );

        if (pacienteInfo.length > 0) {
          await sendConfirmationcorreoCc(pacienteInfo[0].correo, pacienteInfo[0].nombre_completo);
        }
        

        res.status(201).json({
          success: true,
          message: 'Cita agendada exitosamente',
          data: { id_cita: citaResult.insertId }
        });

      } catch (insertError) {
        // Handle duplicate entry specifically
        if (insertError.code === 'ER_DUP_ENTRY' && insertError.sqlMessage.includes('unique_horario_cita')) {
          await connection.rollback();
          return res.status(409).json({
            success: false,
            message: 'Este horario ya fue reservado por otro paciente. Por favor selecciona otro horario disponible.'
          });
        }
        throw insertError; // Re-throw if it's not the duplicate error we're handling
      }

    } catch (error) {
      await connection.rollback();
      console.error('Error al agendar cita:', error);

      // Provide specific error messages based on error type
      if (error.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          success: false,
          message: 'Este horario ya está ocupado. Por favor selecciona otro.'
        });
      } else {
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
      }
    } finally {
      connection.release();
    }
  },
  // Cancelar cita (considerando rol)
  cancelarCita: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const { id } = req.params;
      const id_paciente = req.user.id_usuario;
      const { motivo_cancelacion } = req.body;

      let citaQuery = `
      SELECT c.*, h.fecha, h.hora_inicio,
             TIMESTAMPDIFF(HOUR, NOW(), CONCAT(h.fecha, ' ', h.hora_inicio)) as horas_restantes
      FROM citas c
      INNER JOIN horarios h ON c.id_horario = h.id_horario
      WHERE c.id_cita = ?
    `;
      const params = [id];
      if (req.user.rol === 'paciente') {
        citaQuery += ' AND c.id_paciente = ? AND c.id_estado IN (1,2)';
        params.push(id_paciente);
      }

      const [citaRows] = await connection.execute(citaQuery, params);
      if (citaRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Cita no encontrada o no se puede cancelar' });
      }
      const cita = citaRows[0];

      if (cita.horas_restantes < 24 && req.user.rol === 'paciente') {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'No se puede cancelar con menos de 24 horas de anticipación' });
      }

      const cancelador = req.user.rol === 'admin' ? 'admin' : 'paciente';

      await connection.execute(`
      UPDATE citas
      SET id_estado = 4, cancelada_por = ?, fecha_cancelacion = NOW(), fecha_actualizacion = NOW()
      WHERE id_cita = ?
    `, [cancelador, id]);

      await connection.execute(
        'UPDATE horarios SET disponible = true WHERE id_horario = ?',
        [cita.id_horario]
      );

      await connection.execute(`
      INSERT INTO auditoria_citas (id_cita, evento, detalle, actor_id_usuario, fecha_evento)
      VALUES (?, 'cancelada', ?, ?, NOW())
    `, [id, motivo_cancelacion || 'Cancelada', id_paciente]);

      await connection.commit();

      // 🔹 Enviar correo al paciente
      const [pacienteInfo] = await pool.execute(
        `SELECT u.correo, u.nombre_completo 
       FROM usuarios u 
       WHERE u.id_usuario = ?`,
        [id_paciente]
      );

      res.json({ success: true, message: 'Cita cancelada exitosamente' });

    } catch (error) {
      await connection.rollback();
      console.error('Error al cancelar cita:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    } finally {
      connection.release();
    }
  },


  obtenerEspecialidades: async (req, res) => {
    try {
      // Query simple: TODAS las especialidades activas
      const query = `
      SELECT e.id_especialidad, e.nombre, e.descripcion
      FROM especialidades e
      WHERE e.activa = 1
      ORDER BY e.nombre ASC
    `;

      const [rows] = await pool.execute(query);


      res.json({
        success: true,
        data: rows
      });
    } catch (error) {

      // Si el campo 'activa' no existe, intenta sin ese filtro
      if (error.message.includes('activa')) {
        try {
          const querySimple = `
          SELECT e.id_especialidad, e.nombre, e.descripcion
          FROM especialidades e
          ORDER BY e.nombre ASC
        `;
          const [rows] = await pool.execute(querySimple);

          return res.json({
            success: true,
            data: rows
          });
        } catch (secondError) {
         
        }
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Obtener médicos disponibles (con filtro opcional por especialidad)
  // REEMPLAZA tu método obtenerMedicosDisponibles con este:

  obtenerMedicosDisponibles: async (req, res) => {
    try {
      console.log('Obteniendo médicos de la tabla medicos...');

      // Query que obtiene médicos directamente de la tabla medicos
      const query = `
      SELECT DISTINCT 
        m.id_medico, 
        m.nombre_completo as medico_nombre,
        m.registro_profesional, 
        m.consultorio,
        GROUP_CONCAT(DISTINCT e.nombre ORDER BY e.nombre SEPARATOR ', ') as especialidades,
        GROUP_CONCAT(DISTINCT e.id_especialidad ORDER BY e.id_especialidad) as especialidad_ids
      FROM medicos m
      LEFT JOIN medico_especialidad me ON m.id_medico = me.id_medico
      LEFT JOIN especialidades e ON me.id_especialidad = e.id_especialidad
      GROUP BY m.id_medico, m.nombre_completo, m.registro_profesional, m.consultorio
      ORDER BY m.nombre_completo ASC
    `;

      console.log('Ejecutando query para médicos...');
      const [rows] = await pool.execute(query);

      console.log('Médicos encontrados:', rows.length);
      console.log('Datos:', JSON.stringify(rows, null, 2));

      res.json({
        success: true,
        data: rows
      });

    } catch (error) {
      console.error('Error al obtener médicos:', error);

      // Si falla, intenta una query aún más simple
      try {
        console.log('Intentando query simple sin especialidades...');
        const querySimple = `
        SELECT 
          m.id_medico, 
          m.nombre_completo as medico_nombre,
          m.registro_profesional, 
          m.consultorio
        FROM medicos m
        ORDER BY m.nombre_completo ASC
      `;

        const [simpleRows] = await pool.execute(querySimple);
        console.log('Query simple - médicos encontrados:', simpleRows.length);

        return res.json({
          success: true,
          data: simpleRows.map(medico => ({
            ...medico,
            especialidades: 'Sin especialidad asignada'
          }))
        });

      } catch (secondError) {
        console.error('Error en query simple:', secondError);
        return res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: secondError.message
        });
      }
    }
  },
  // FIX: Renombrar función para coincidir con el frontend
  obtenerHorariosDisponibles: async (req, res) => {
    try {
      const { especialidad, medico, fecha_desde, fecha_hasta, disponibles_solamente } = req.query;
      let whereClause = 'WHERE h.disponible = true AND h.fecha >= CURDATE()';
      let queryParams = [];
      if (especialidad) {
        whereClause += ' AND e.id_especialidad = ?';
        queryParams.push(especialidad);
      }
      if (medico) {
        whereClause += ' AND m.id_medico = ?';
        queryParams.push(medico);
      }
      if (fecha_desde) {
        whereClause += ' AND h.fecha >= ?';
        queryParams.push(fecha_desde);
      }
      if (fecha_hasta) {
        whereClause += ' AND h.fecha <= ?';
        queryParams.push(fecha_hasta);
      }
      // FIX: Agregar cupos disponibles simulados
      const query = `
        SELECT h.id_horario, h.fecha, h.hora_inicio, h.hora_fin, h.disponible,
               u.nombre_completo as medico_nombre, m.registro_profesional, 
               m.consultorio, m.id_medico,
               GROUP_CONCAT(DISTINCT e.nombre) as especialidades,
               GROUP_CONCAT(DISTINCT e.id_especialidad) as especialidad_ids,
               1 as cupos_disponibles
        FROM horarios h
        INNER JOIN medicos m ON h.id_medico = m.id_medico
        INNER JOIN usuarios u ON m.id_medico = u.id_usuario
        LEFT JOIN medico_especialidad me ON m.id_medico = me.id_medico
        LEFT JOIN especialidades e ON me.id_especialidad = e.id_especialidad
        ${whereClause}
        GROUP BY h.id_horario
        ORDER BY h.fecha ASC, h.hora_inicio ASC
      `;
      const [rows] = await pool.execute(query, queryParams);
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Error al buscar horarios disponibles:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  }
};
module.exports = pacienteController;