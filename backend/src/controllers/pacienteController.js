const { pool } = require('../config/db');

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
          message: 'No tienes permisos para actualizar este perfil'
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

      const { nombre_completo, telefono, fecha_nacimiento, sexo, eps,contacto_emergencia, telefono_emergencia, alergias } = req.body;

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
        SET nombre_completo = ?
        WHERE id_usuario = ?
      `;
      await pool.execute(updateUserQuery, [nombre_completo, requestedId]);

      // Actualizar o insertar pacientes
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
          const insertPatientQuery = `
            INSERT INTO pacientes (id_paciente, fecha_nacimiento, sexo, eps, contacto_emergencia, telefono_emergencia, alergias)
            VALUES (?, ?, ?, ?, ?)
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
      const { estado, fecha_desde, fecha_hasta, page = 1, limit = 10 } = req.query;

      console.log('Debug - id_paciente:', id_paciente);
      console.log('Debug - query params:', req.query);

      if (!id_paciente) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      let whereClause = 'WHERE c.id_paciente = ?';
      let queryParams = [id_paciente];

      if (estado) {
        whereClause += ' AND ec.nombre = ?';
        queryParams.push(estado);
      }

      if (fecha_desde) {
        whereClause += ' AND h.fecha >= ?';
        queryParams.push(fecha_desde);
      }

      if (fecha_hasta) {
        whereClause += ' AND h.fecha <= ?';
        queryParams.push(fecha_hasta);
      }

      const offset = (page - 1) * limit;

      console.log('Debug - whereClause:', whereClause);
      console.log('Debug - queryParams:', queryParams);

      const query = `
        SELECT c.id_cita, c.motivo, c.fecha_creacion,
               h.fecha, h.hora_inicio, h.hora_fin,
               u.nombre_completo as medico_nombre,
               m.registro_profesional, m.consultorio,
               ec.nombre as estado,
               GROUP_CONCAT(e.nombre) as especialidades
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

      const mainQueryParams = [...queryParams, parseInt(limit), offset];

      console.log('Debug - mainQueryParams:', mainQueryParams);

      const [rows] = await pool.execute(query, mainQueryParams);

      const countQuery = `
        SELECT COUNT(DISTINCT c.id_cita) as total
        FROM citas c
        INNER JOIN horarios h ON c.id_horario = h.id_horario
        INNER JOIN estados_cita ec ON c.id_estado = ec.id_estado
        ${whereClause}
      `;

      console.log('Debug - countQuery params:', queryParams);

      const [countRows] = await pool.execute(countQuery, queryParams);
      const total = countRows[0].total;

      res.json({
        success: true,
        data: {
          citas: rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Error al obtener citas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  },

  agendarCita: async (req, res) => {
    const connection = await pool.getConnection();

    try {
      console.log('Iniciando proceso de agendar cita...');
      console.log('Body recibido:', req.body);
      console.log('Usuario:', req.user);

      await connection.beginTransaction();

      const id_paciente = req.user.id_usuario;
      const { id_horario, motivo } = req.body;

      console.log('ID Paciente:', id_paciente);
      console.log('ID Horario:', id_horario);
      console.log('Motivo:', motivo);

      // Validaciones básicas
      if (!id_horario) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'El horario es requerido'
        });
      }

      const horarioId = parseInt(id_horario);
      if (isNaN(horarioId)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'ID de horario inválido'
        });
      }

      // Verificar que el horario existe y está disponible
      console.log('Verificando disponibilidad del horario...');
      const [horarioRows] = await connection.execute(
        'SELECT * FROM horarios WHERE id_horario = ? AND disponible = true AND fecha >= CURDATE()',
        [horarioId]
      );

      console.log('Horarios encontrados:', horarioRows.length);

      if (horarioRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'El horario seleccionado no está disponible'
        });
      }

      // Verificar conflictos de horario para el mismo paciente
      console.log('Verificando conflictos de horario...');
      const [citasConflicto] = await connection.execute(`
        SELECT c.id_cita FROM citas c 
        INNER JOIN horarios h ON c.id_horario = h.id_horario 
        WHERE c.id_paciente = ? AND h.fecha = ? AND h.hora_inicio = ? 
        AND c.id_estado IN (1, 2)
      `, [id_paciente, horarioRows[0].fecha, horarioRows[0].hora_inicio]);

      console.log('Conflictos encontrados:', citasConflicto.length);

      if (citasConflicto.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ya tienes una cita agendada a esta hora'
        });
      }

      // Insertar la nueva cita
      console.log('Insertando nueva cita...');
      const [citaResult] = await connection.execute(`
        INSERT INTO citas (id_paciente, id_horario, id_estado, motivo, fecha_creacion) 
        VALUES (?, ?, 1, ?, NOW())
      `, [id_paciente, horarioId, motivo || null]);

      console.log('Cita insertada con ID:', citaResult.insertId);

      // Marcar horario como no disponible
      console.log('Marcando horario como no disponible...');
      await connection.execute(
        'UPDATE horarios SET disponible = false WHERE id_horario = ?',
        [horarioId]
      );

      // Insertar en auditoría
      console.log('Insertando auditoría...');
      await connection.execute(`
        INSERT INTO auditoria_citas (id_cita, evento, actor_id_usuario, fecha_evento)
        VALUES (?, 'creada', ?, NOW())
      `, [citaResult.insertId, id_paciente]);

      await connection.commit();
      console.log('Transacción completada exitosamente');

      res.status(201).json({
        success: true,
        message: 'Cita agendada exitosamente',
        data: { id_cita: citaResult.insertId }
      });

    } catch (error) {
      await connection.rollback();
      console.error('Error detallado al agendar cita:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } finally {
      connection.release();
    }
  },

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
        return res.status(404).json({
          success: false,
          message: 'Cita no encontrada o no se puede cancelar'
        });
      }

      const cita = citaRows[0];

      if (cita.horas_restantes < 24) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'No se puede cancelar la cita. Debe hacerlo con al menos 24 horas de anticipación'
        });
      }

      await connection.execute(`
        UPDATE citas
        SET id_estado = 4, cancelada_por = ?, fecha_cancelacion = NOW(), fecha_actualizacion = NOW()
        WHERE id_cita = ?
      `, ['paciente', id]);

      await connection.execute(
        'UPDATE horarios SET disponible = true WHERE id_horario = ?',
        [cita.id_horario]
      );

      await connection.execute(`
        INSERT INTO auditoria_citas (id_cita, evento, detalle, actor_id_usuario, fecha_evento)
        VALUES (?, 'cancelada', ?, ?, NOW())
      `, [id, motivo_cancelacion || 'Cancelada por paciente', id_paciente]);

      await connection.commit();

      res.json({
        success: true,
        message: 'Cita cancelada exitosamente'
      });

    } catch (error) {
      await connection.rollback();
      console.error('Error al cancelar cita:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    } finally {
      connection.release();
    }
  },

  buscarMedicosDisponibles: async (req, res) => {
    try {
      const { especialidad, medico, fecha_desde, fecha_hasta } = req.query;

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

      const query = `
        SELECT DISTINCT h.id_horario, h.fecha, h.hora_inicio, h.hora_fin,
               u.nombre_completo as medico_nombre, m.registro_profesional, 
               m.consultorio, m.id_medico,
               GROUP_CONCAT(DISTINCT e.nombre) as especialidades,
               GROUP_CONCAT(DISTINCT e.id_especialidad) as especialidad_ids
        FROM horarios h
        INNER JOIN medicos m ON h.id_medico = m.id_medico
        INNER JOIN usuarios u ON m.id_medico = u.id_usuario
        INNER JOIN medico_especialidad me ON m.id_medico = me.id_medico
        INNER JOIN especialidades e ON me.id_especialidad = e.id_especialidad
        ${whereClause}
        GROUP BY h.id_horario
        ORDER BY h.fecha ASC, h.hora_inicio ASC
      `;

      const [rows] = await pool.execute(query, queryParams);

      res.json({
        success: true,
        data: rows
      });

    } catch (error) {
      console.error('Error al buscar médicos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
};

module.exports = pacienteController;