const { pool } = require('../config/db');
const { sendConfirmationcorreoCc, CancelcitascorreoCc } = require("../utils/mailer");

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
               m.nombre_completo as medico_nombre,
               m.registro_profesional, 
               m.consultorio,
               m.id_medico,
               ec.nombre as estado,
               GROUP_CONCAT(DISTINCT e.nombre) as especialidades
        FROM citas c
        INNER JOIN horarios h ON c.id_horario = h.id_horario
        INNER JOIN medicos m ON h.id_medico = m.id_medico
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

  // Obtener una cita específica
  obtenerCita: async (req, res) => {
    try {
      const { id } = req.params;
      const id_paciente = req.user.id_usuario;

      const query = `
        SELECT c.id_cita, c.motivo, c.fecha_creacion,
               h.fecha, h.hora_inicio, h.hora_fin,
               m.nombre_completo as medico_nombre,
               m.registro_profesional, 
               m.consultorio,
               m.id_medico,
               ec.nombre as estado,
               GROUP_CONCAT(DISTINCT e.nombre) as especialidades
        FROM citas c
        INNER JOIN horarios h ON c.id_horario = h.id_horario
        INNER JOIN medicos m ON h.id_medico = m.id_medico
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

  agendarCita: async (req, res) => {
    const connection = await pool.getConnection();
    try {
      const { horarioId, motivo } = req.body;
      const id_paciente = req.user.id_usuario;

      if (!horarioId) {
        return res.status(400).json({
          success: false,
          message: "horarioId es requerido",
          debug: { received: req.body }
        });
      }
      
      const [checkExisting] = await connection.execute(
        "SELECT * FROM citas WHERE id_horario = ?",
        [horarioId]
      );

      const [horarioState] = await connection.execute(
        "SELECT * FROM horarios WHERE id_horario = ?",
        [horarioId]
      );
      try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
          `INSERT INTO citas (id_paciente, id_horario, motivo, id_estado, fecha_creacion, fecha_actualizacion)
         VALUES (?, ?, ?, 1, NOW(), NOW())`,
          [id_paciente, horarioId, motivo || null]
        );

        await connection.commit();

        const [pacienteInfo] = await pool.execute(
          `SELECT u.correo, u.nombre_completo 
       FROM usuarios u 
       WHERE u.id_usuario = ?`,
          [id_paciente]
        );

        if (pacienteInfo.length > 0) {
          await sendConfirmationcorreoCc(pacienteInfo[0].correo, pacienteInfo[0].nombre_completo);
        }

        res.json({
          success: true,
          message: "Cita agendada con éxito",
          id_cita: result.insertId
        });

      } catch (insertError) {
        await connection.rollback();
        console.error("=== INSERT ERROR ===");
        console.error("Error code:", insertError.code);
        console.error("Error message:", insertError.message);
        console.error("SQL:", insertError.sql);
        console.error("Full error:", insertError);

        return res.status(409).json({
          success: false,
          message: "Este horario acaba de ser tomado por otro paciente. Por favor selecciona otro horario disponible.",
          debug: {
            error_code: insertError.code,
            error_message: insertError.message,
            horario_id: horarioId,
            paciente_id: id_paciente
          }
        });
      }

    } catch (error) {
      console.error("=== GENERAL ERROR ===", error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
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

      citaQuery += ' FOR UPDATE';

      const [citaRows] = await connection.execute(citaQuery, params);
      if (citaRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Cita no encontrada o no se puede cancelar'
        });
      }

      const cita = citaRows[0];
  

      if (cita.horas_restantes < 24 && req.user.rol === 'paciente') {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: 'No se puede cancelar con menos de 24 horas de anticipación'
        });
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

      const [pacienteInfo] = await pool.execute(
        `SELECT u.correo, u.nombre_completo 
       FROM usuarios u 
       WHERE u.id_usuario = ?`,
        [id_paciente]
      );

      if (pacienteInfo.length > 0) {
        await CancelcitascorreoCc(pacienteInfo[0].correo, pacienteInfo[0].nombre_completo);
      }

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
          console.error('Error en query simple de especialidades:', secondError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // Obtener médicos disponibles
  obtenerMedicosDisponibles: async (req, res) => {
    try {
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

      const [rows] = await pool.execute(query);

      res.json({
        success: true,
        data: rows
      });

    } catch (error) {
      console.error('Error al obtener médicos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // Obtener horarios disponibles - VERSIÓN MEJORADA
  obtenerHorariosDisponibles: async (req, res) => {
    try {
      const { especialidad, medico, fecha_desde, fecha_hasta } = req.query;

      // CONDICIÓN BASE: horarios futuros, disponibles
      let whereClause = `WHERE h.disponible = true 
                       AND h.fecha >= CURDATE()`;
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
      SELECT 
        h.id_horario, 
        h.fecha, 
        h.hora_inicio, 
        h.hora_fin, 
        h.disponible,
        m.nombre_completo as medico_nombre, 
        m.registro_profesional, 
        m.consultorio, 
        m.id_medico,
        GROUP_CONCAT(DISTINCT e.nombre) as especialidades,
        GROUP_CONCAT(DISTINCT e.id_especialidad) as especialidad_ids,
        CASE 
          WHEN NOT EXISTS (
            SELECT 1 FROM citas c 
            WHERE c.id_horario = h.id_horario 
              AND c.id_estado IN (1,2)
          ) THEN 1
          ELSE 0
        END as cupos_disponibles
      FROM horarios h
      INNER JOIN medicos m ON h.id_medico = m.id_medico
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