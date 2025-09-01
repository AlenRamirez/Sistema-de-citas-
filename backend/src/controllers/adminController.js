const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const { CancelcitascorreoCc } = require("../utils/mailer");

const adminController = {

    // Dashboard con estadísticas actualizadas
    getDashboard: async (req, res) => {
        try {
            const statsQuery = `
            SELECT
                (SELECT COUNT(*) FROM usuarios WHERE id_rol = 2) as total_pacientes,
                (SELECT COUNT(*) FROM medicos WHERE estado = 'activo') as total_medicos,
                (SELECT COUNT(*) FROM citas) as total_citas
        `;

            const [stats] = await pool.query(statsQuery);

            res.json({
                success: true,
                data: {
                    stats: stats
                    // Remover citasEspecialidad de aquí
                }
            });

        } catch (error) {
            console.error('Error al obtener dashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas del dashboard'
            });
        }
    },
    
    // GESTIÓN DE USUARIOS (Pacientes y Médicos)
    getAllUsers: async (req, res) => {
        try {
            const { tipo, estado, page = 1, limit = 10 } = req.query;
            console.log('Parámetros recibidos:', { tipo, estado, page, limit });

            const offset = (parseInt(page) - 1) * parseInt(limit);

            // ENFOQUE SEPARADO: Obtener usuarios y médicos por separado
            let usuarios = [];
            let totalCount = 0;

            if (tipo === 'medico') {
                // Solo médicos
                let whereClauseMedicos = 'WHERE 1=1';
                const paramsMedicos = [];

                if (estado && estado !== 'todos') {
                    whereClauseMedicos += ' AND estado = ?';
                    paramsMedicos.push(estado === 'activo' ? 'activo' : 'inactivo');
                }

                const [medicos] = await pool.query(`
                SELECT 
                    id_medico as id_usuario,
                    correo,
                    nombre_completo,
                    telefono,
                    estado as activo_estado,
                    created_at,
                    'medico' as rol
                FROM medicos 
                ${whereClauseMedicos}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `, [...paramsMedicos, parseInt(limit), offset]);

                const [countMedicos] = await pool.query(`
                SELECT COUNT(*) as total FROM medicos ${whereClauseMedicos}
            `, paramsMedicos);

                usuarios = medicos.map(medico => ({
                    id_usuario: medico.id_usuario,
                    correo: medico.correo,
                    nombre_completo: medico.nombre_completo,
                    telefono: medico.telefono,
                    activo: medico.activo_estado === 'activo',
                    created_at: medico.created_at,
                    rol: 'medico'
                }));

                totalCount = countMedicos[0].total;

            } else if (tipo === 'paciente') {
                // Solo usuarios (pacientes)
                let whereClauseUsuarios = 'WHERE 1=1';
                const paramsUsuarios = [];

                if (estado && estado !== 'todos') {
                    whereClauseUsuarios += ' AND activo = ?';
                    paramsUsuarios.push(estado === 'activo');
                }

                const [usuariosData] = await pool.query(`
                SELECT 
                    id_usuario,
                    correo,
                    nombre_completo,
                    documento,
                    telefono,
                    activo,
                    created_at,
                    'paciente' as rol
                FROM usuarios 
                ${whereClauseUsuarios}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `, [...paramsUsuarios, parseInt(limit), offset]);

                const [countUsuarios] = await pool.query(`
                SELECT COUNT(*) as total FROM usuarios ${whereClauseUsuarios}
            `, paramsUsuarios);

                usuarios = usuariosData.map(usuario => ({
                    id_usuario: usuario.id_usuario,
                    correo: usuario.correo,
                    nombre_completo: usuario.nombre_completo,
                    documento: usuario.documento,
                    telefono: usuario.telefono,
                    activo: usuario.activo,
                    created_at: usuario.created_at,
                    rol: 'paciente'
                }));

                totalCount = countUsuarios[0].total;

            } else {
                // Todos los usuarios - UNION de ambas tablas
                let filtroEstado = '';
                const paramsEstado = [];

                if (estado && estado !== 'todos') {
                    const estadoValue = estado === 'activo';
                    filtroEstado = 'WHERE activo = ?';
                    paramsEstado.push(estadoValue, estadoValue);
                }

                const unionQuery = `
                (SELECT 
                    id_usuario,
                    correo,
                    nombre_completo,
                    telefono,
                    activo,
                    created_at,
                    'paciente' as rol
                FROM usuarios 
                ${estado && estado !== 'todos' ? 'WHERE activo = ?' : ''}
                )
                UNION ALL
                (SELECT 
                    id_medico as id_usuario,
                    correo,
                    nombre_completo,
                    telefono,
                    (estado = 'activo') as activo,
                    created_at,
                    'medico' as rol
                FROM medicos
                ${estado && estado !== 'todos' ? 'WHERE estado = ?' : ''}
                )
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            `;

                const queryParams = [];
                if (estado && estado !== 'todos') {
                    queryParams.push(estado === 'activo'); // Para usuarios
                    queryParams.push(estado === 'activo' ? 'activo' : 'inactivo'); // Para médicos
                }
                queryParams.push(parseInt(limit), offset);

                console.log('Query UNION:', unionQuery);
                console.log('Parámetros UNION:', queryParams);

                const [unionResult] = await pool.query(unionQuery, queryParams);

                // Conteo total
                const countQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM usuarios ${estado && estado !== 'todos' ? 'WHERE activo = ?' : ''}) +
                    (SELECT COUNT(*) FROM medicos ${estado && estado !== 'todos' ? 'WHERE estado = ?' : ''}) as total
            `;

                const countParams = [];
                if (estado && estado !== 'todos') {
                    countParams.push(estado === 'activo');
                    countParams.push(estado === 'activo' ? 'activo' : 'inactivo');
                }

                const [totalResult] = await pool.query(countQuery, countParams);

                usuarios = unionResult;
                totalCount = totalResult[0].total;
            }

            console.log('Usuarios procesados:', usuarios.length);
            console.log('Total count:', totalCount);

            res.json({
                success: true,
                data: {
                    users: usuarios,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount,
                        pages: Math.ceil(totalCount / parseInt(limit))
                    }
                }
            });

        } catch (error) {
            console.error('Error detallado al obtener usuarios:', error);
            console.error('Stack trace:', error.stack);

            res.status(500).json({
                success: false,
                message: 'Error al obtener usuarios',
                error: process.env.NODE_ENV === 'development' ? {
                    message: error.message,
                    stack: error.stack,
                    code: error.code,
                    errno: error.errno,
                    sqlState: error.sqlState,
                    sqlMessage: error.sqlMessage
                } : 'Error interno del servidor'
            });
        }
    },
    
    toggleUserStatus: async (req, res) => {
        let connection;
        try {
            const { id } = req.params;
            const { activo } = req.body;

            if (parseInt(id) === req.user.id_usuario) {
                return res.status(400).json({
                    success: false,
                    message: 'No puedes desactivar tu propia cuenta'
                });
            }

            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Actualizar usuario
            await connection.execute(
                'UPDATE usuarios SET activo = ? WHERE id_usuario = ?',
                [activo, id]
            );

            // Si es médico, también actualizar su estado
            const [medicoExiste] = await connection.execute(
                'SELECT id_medico FROM medicos WHERE id_medico = ?',
                [id]
            );

            if (medicoExiste.length > 0) {
                const estadoMedico = activo == 1 ? 'activo' : 'inactivo';
                await connection.execute(
                    'UPDATE medicos SET estado = ? WHERE id_medico = ?',
                    [estadoMedico, id]
                );
            }

            await connection.commit();

            const estado = activo == 1 ? 'activado' : 'desactivado';

            res.json({
                success: true,
                message: `El usuario ha sido ${estado} correctamente`
            });
        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error al cambiar estado del usuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cambiar estado del usuario'
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
 
    deleteUser: async (req, res) => {
        try {
            const { id } = req.params;

            if (parseInt(id) === req.user.id_usuario) {
                return res.status(400).json({
                    success: false,
                    message: 'No puedes eliminar tu propia cuenta'
                });
            }

            const [citasActivas] = await pool.query(`
                SELECT COUNT(*) as count
                FROM citas c
                INNER JOIN horarios h ON c.id_horario = h.id_horario
                WHERE (c.id_paciente = ? OR h.id_medico = ?) 
                AND c.id_estado IN (1, 2)
            `, [id, id]);

            if (citasActivas[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar el usuario porque tiene citas activas'
                });
            }

            await pool.query('DELETE FROM usuarios WHERE id_usuario = ?', [id]);

            res.json({
                success: true,
                message: 'Usuario eliminado correctamente'
            });
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar usuario'
            });
        }
    },

    // GESTIÓN DE MÉDICOS - HORARIOS Y ESPECIALIDADES

    getAllMedicos: async (req, res) => {
        try {
            const [medicos] = await pool.query(`
            SELECT id_medico, nombre_completo, correo, telefono, estado
            FROM medicos
            ORDER BY nombre_completo
        `);
            res.json({ success: true, data: medicos });
        } catch (error) {
            console.error('Error al obtener médicos:', error);
            res.status(500).json({ success: false, message: 'Error al obtener médicos' });
        }
    },
    // Add these functions to your adminController object:

    // Get specialties for a specific doctor
    getMedicoEspecialidades: async (req, res) => {
        try {
            const { medicoId } = req.params;

            // Validate that the doctor exists
            const [medico] = await pool.query(
                'SELECT id_medico FROM medicos WHERE id_medico = ?',
                [medicoId]
            );

            if (medico.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Médico no encontrado'
                });
            }

            // Get doctor's specialties
            const [especialidades] = await pool.query(`
            SELECT e.id_especialidad, e.nombre, e.descripcion
            FROM especialidades e
            INNER JOIN medico_especialidad me ON e.id_especialidad = me.id_especialidad
            WHERE me.id_medico = ?
            ORDER BY e.nombre
        `, [medicoId]);

            res.json({
                success: true,
                data: especialidades
            });

        } catch (error) {
            console.error('Error al obtener especialidades del médico:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener especialidades del médico'
            });
        }
    },

    // Update doctor's specialties
    updateMedicoEspecialidades: async (req, res) => {
        let connection;
        try {
            const { medicoId } = req.params;
            const { especialidades } = req.body;

            // Validate input
            if (!Array.isArray(especialidades)) {
                return res.status(400).json({
                    success: false,
                    message: 'Las especialidades deben ser un array'
                });
            }

            // Validate that the doctor exists
            const [medico] = await pool.query(
                'SELECT id_medico FROM medicos WHERE id_medico = ?',
                [medicoId]
            );

            if (medico.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Médico no encontrado'
                });
            }

            // Validate that all specialties exist
            if (especialidades.length > 0) {
                const placeholders = especialidades.map(() => '?').join(',');
                const [especialidadesValidas] = await pool.query(
                    `SELECT id_especialidad FROM especialidades WHERE id_especialidad IN (${placeholders})`,
                    especialidades
                );

                if (especialidadesValidas.length !== especialidades.length) {
                    return res.status(400).json({
                        success: false,
                        message: 'Una o más especialidades no son válidas'
                    });
                }
            }

            connection = await pool.getConnection();
            await connection.beginTransaction();

            // Remove all current specialties
            await connection.execute(
                'DELETE FROM medico_especialidad WHERE id_medico = ?',
                [medicoId]
            );

            // Add new specialties
            if (especialidades.length > 0) {
                const values = especialidades.map(espId => [medicoId, espId]);
                await connection.execute(
                    'INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES ?',
                    [values]
                );
            }

            await connection.commit();

            res.json({
                success: true,
                message: 'Especialidades del médico actualizadas correctamente'
            });

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error al actualizar especialidades del médico:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar especialidades del médico'
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
    createMedicoHorario: async (req, res) => {
        try {
            const { medicoId } = req.params;
            const { fecha, hora_inicio, hora_fin } = req.body;

            // Validate input
            if (!fecha || !hora_inicio || !hora_fin) {
                return res.status(400).json({
                    success: false,
                    message: 'Fecha, hora de inicio y hora de fin son obligatorios'
                });
            }

            // Validate time logic
            if (hora_inicio >= hora_fin) {
                return res.status(400).json({
                    success: false,
                    message: 'La hora de inicio debe ser anterior a la hora de fin'
                });
            }

            // Validate that the doctor exists
            const [medico] = await pool.query(
                'SELECT id_medico FROM medicos WHERE id_medico = ? AND estado = "activo"',
                [medicoId]
            );

            if (medico.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Médico no encontrado o inactivo'
                });
            }

            // Check for time conflicts
            const [conflictos] = await pool.query(`
            SELECT id_horario 
            FROM horarios 
            WHERE id_medico = ? 
            AND fecha = ? 
            AND (
                (hora_inicio <= ? AND hora_fin > ?) OR
                (hora_inicio < ? AND hora_fin >= ?) OR
                (hora_inicio >= ? AND hora_fin <= ?)
            )
        `, [medicoId, fecha, hora_inicio, hora_inicio, hora_fin, hora_fin, hora_inicio, hora_fin]);

            if (conflictos.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe un horario que se superpone con el horario especificado'
                });
            }

            // Create the schedule
            const [result] = await pool.query(
                'INSERT INTO horarios (id_medico, fecha, hora_inicio, hora_fin, disponible) VALUES (?, ?, ?, ?, true)',
                [medicoId, fecha, hora_inicio, hora_fin]
            );

            res.status(201).json({
                success: true,
                message: 'Horario creado correctamente',
                data: {
                    id_horario: result.insertId,
                    id_medico: medicoId,
                    fecha,
                    hora_inicio,
                    hora_fin,
                    disponible: true
                }
            });

        } catch (error) {
            console.error('Error al crear horario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear horario'
            });
        }
    },

    // Obtener horarios de un médico
    getMedicoHorarios: async (req, res) => {
        try {
            const { medicoId } = req.params;
            const [horarios] = await pool.query(`
                SELECT id_horario, fecha, hora_inicio, hora_fin, disponible
                FROM horarios
                WHERE id_medico = ?
                ORDER BY fecha, hora_inicio
            `, [medicoId]);
            res.json({ success: true, data: horarios });
        } catch (error) {
            console.error('Error al obtener horarios:', error);
            res.status(500).json({ success: false, message: 'Error al obtener horarios' });
        }
    },

    // Cambiar horario de un médico
    updateMedicoHorario: async (req, res) => {
        try {
            const { horarioId } = req.params;
            const { fecha, hora_inicio, hora_fin } = req.body;

            await pool.query(
                'UPDATE horarios SET fecha = ?, hora_inicio = ?, hora_fin = ? WHERE id_horario = ?',
                [fecha, hora_inicio, hora_fin, horarioId]
            );
            res.json({ success: true, message: 'Horario actualizado correctamente' });
        } catch (error) {
            console.error('Error al actualizar horario:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar horario' });
        }
    },

    // Eliminar horario de un médico
    deleteMedicoHorario: async (req, res) => {
        try {
            const { horarioId } = req.params;
            await pool.query('DELETE FROM horarios WHERE id_horario = ?', [horarioId]);
            res.json({ success: true, message: 'Horario eliminado correctamente' });
        } catch (error) {
            console.error('Error al eliminar horario:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar horario' });
        }
    },

    // Eliminar médico y sus horarios
    deleteMedico: async (req, res) => {
        try {
            const { medicoId } = req.params;

            // Eliminar horarios del médico
            await pool.query('DELETE FROM horarios WHERE id_medico = ?', [medicoId]);
            // Eliminar especialidades del médico
            await pool.query('DELETE FROM medico_especialidad WHERE id_medico = ?', [medicoId]);
            // Eliminar médico
            await pool.query('DELETE FROM medicos WHERE id_medico = ?', [medicoId]);
            // Eliminar usuario
            await pool.query('DELETE FROM usuarios WHERE id_usuario = ?', [medicoId]);

            res.json({ success: true, message: 'Médico y sus horarios eliminados correctamente' });
        } catch (error) {
            console.error('Error al eliminar médico:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar médico' });
        }
    },

    // GESTIÓN DE CITAS
    getAllCitas: async (req, res) => {
        try {
            const {
                estado,
                fecha_inicio,
                fecha_fin,
                medico,
                paciente,
                page = 1,
                limit = 10
            } = req.query;

            let whereClause = 'WHERE 1=1';
            const params = [];

            if (estado && estado !== 'todos') {
                whereClause += ' AND COALESCE(ec.nombre, "Pendiente") = ?';
                params.push(estado);
            }

            if (fecha_inicio) {
                whereClause += ' AND DATE(h.fecha) >= ?';
                params.push(fecha_inicio);
            }

            if (fecha_fin) {
                whereClause += ' AND DATE(h.fecha) <= ?';
                params.push(fecha_fin);
            }

            if (medico && medico.trim() !== '') {
                whereClause += ' AND m.nombre_completo LIKE ?';
                params.push(`%${medico.trim()}%`);
            }

            if (paciente && paciente.trim() !== '') {
                whereClause += ' AND up.nombre_completo LIKE ?';
                params.push(`%${paciente.trim()}%`);
            }

            const offset = (parseInt(page) - 1) * parseInt(limit);

            const citasQuery = `
                SELECT 
                    c.id_cita, 
                    c.motivo, 
                    c.fecha_creacion, 
                    c.fecha_cancelacion,
                    c.cancelada_por, 
                    c.motivo_cancelacion,
                    h.fecha, 
                    h.hora_inicio, 
                    h.hora_fin,
                    up.nombre_completo as paciente, 
                    up.documento as documento_paciente,
                    up.correo as paciente_correo,
                    m.nombre_completo as medico, 
                    m.registro_profesional,
                    COALESCE(ec.nombre, 'Pendiente') as estado,
                    COALESCE(ec.color, '#FFC107') as color_estado,
                    COALESCE(ec.permite_cancelacion, 1) as permite_cancelacion,
                    GROUP_CONCAT(DISTINCT e.nombre SEPARATOR ', ') as especialidades
                FROM citas c
                INNER JOIN horarios h ON c.id_horario = h.id_horario
                INNER JOIN pacientes p ON c.id_paciente = p.id_paciente
                INNER JOIN usuarios up ON p.id_paciente = up.id_usuario
                INNER JOIN medicos m ON h.id_medico = m.id_medico
                LEFT JOIN estados_cita ec ON c.id_estado = ec.id_estado
                LEFT JOIN medico_especialidad me ON m.id_medico = me.id_medico
                LEFT JOIN especialidades e ON me.id_especialidad = e.id_especialidad
                ${whereClause}
                GROUP BY c.id_cita, c.motivo, c.fecha_creacion, c.fecha_cancelacion, 
                         c.cancelada_por, c.motivo_cancelacion, h.fecha, h.hora_inicio, 
                         h.hora_fin, up.nombre_completo, up.documento, up.correo, m.nombre_completo, 
                         m.registro_profesional, ec.nombre, ec.color, ec.permite_cancelacion
                ORDER BY h.fecha DESC, h.hora_inicio DESC
                LIMIT ? OFFSET ?
            `;

            const [citas] = await pool.query(citasQuery, [...params, parseInt(limit), offset]);

            const countQuery = `
                SELECT COUNT(DISTINCT c.id_cita) as total
                FROM citas c
                INNER JOIN horarios h ON c.id_horario = h.id_horario
                INNER JOIN pacientes p ON c.id_paciente = p.id_paciente
                INNER JOIN usuarios up ON p.id_paciente = up.id_usuario
                INNER JOIN medicos m ON h.id_medico = m.id_medico
                LEFT JOIN estados_cita ec ON c.id_estado = ec.id_estado
                ${whereClause}
            `;

            const [totalCount] = await pool.query(countQuery, params);

            const citasFormateadas = citas.map(cita => ({
                ...cita,
                fecha: cita.fecha ? new Date(cita.fecha).toISOString().split('T')[0] : null,
                hora: cita.hora_inicio,
                especialidad: cita.especialidades || 'Sin especialidad'
            }));

            res.json({
                success: true,
                data: {
                    citas: citasFormateadas,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount[0].total,
                        pages: Math.ceil(totalCount[0].total / parseInt(limit))
                    }
                }
            });

        } catch (error) {
            console.error('Error al obtener citas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al obtener citas',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // Admin cambia estado de cita (confirmada, realizada, no asistió)
    updateCitaStatus: async (req, res) => {
        let connection;
        try {
            const { id } = req.params;
            const { estado, motivo = '', observaciones = '' } = req.body;

            // Validación básica
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de cita inválido'
                });
            }

            const citaId = parseInt(id);

            // Validar estados permitidos
            const estadosPermitidos = ['pendiente', 'confirmada', 'realizada', 'cancelada', 'no_asistio'];
            if (!estadosPermitidos.includes(estado)) {
                return res.status(400).json({
                    success: false,
                    message: 'Estado inválido'
                });
            }

            connection = await pool.getConnection();

            // Obtener información actual de la cita
            const [citaRows] = await connection.execute(`
            SELECT 
                c.id_cita,
                c.id_estado,
                c.motivo_cancelacion,
                h.id_horario,
                h.fecha,
                h.hora_inicio,
                h.hora_fin,
                up.nombre_completo as paciente,
                up.correo as paciente_correo,
                m.nombre_completo as medico,
                ec.nombre as estado_actual
            FROM citas c
            INNER JOIN horarios h ON c.id_horario = h.id_horario
            INNER JOIN pacientes p ON c.id_paciente = p.id_paciente
            INNER JOIN usuarios up ON p.id_paciente = up.id_usuario
            INNER JOIN medicos m ON h.id_medico = m.id_medico
            LEFT JOIN estados_cita ec ON c.id_estado = ec.id_estado
            WHERE c.id_cita = ?
        `, [citaId]);

            if (citaRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cita no encontrada'
                });
            }

            const cita = citaRows[0];

            // Mapeo de estados a IDs
            const estadoMap = {
                'pendiente': 1,
                'confirmada': 2,
                'realizada': 3,
                'cancelada': 4,
                'no_asistio': 5
            };

            const nuevoEstadoId = estadoMap[estado];

            // Validaciones de negocio
            if (estado === 'cancelada' && cita.id_estado === 4) {
                return res.status(400).json({
                    success: false,
                    message: 'La cita ya está cancelada'
                });
            }

            if (estado === 'realizada' && cita.id_estado === 3) {
                return res.status(400).json({
                    success: false,
                    message: 'La cita ya está marcada como realizada'
                });
            }

            await connection.beginTransaction();

            // Actualizar el estado de la cita
            let updateQuery = '';
            let updateParams = [];

            if (estado === 'cancelada') {
                updateQuery = `
                UPDATE citas 
                SET 
                    id_estado = ?,
                    cancelada_por = 'admin',
                    motivo_cancelacion = ?,
                    fecha_cancelacion = NOW(),
                    fecha_actualizacion = NOW()
                WHERE id_cita = ?
            `;
                updateParams = [nuevoEstadoId, motivo || 'Cancelada por administrador', citaId];

                // Liberar el horario
                await connection.execute(
                    'UPDATE horarios SET disponible = true WHERE id_horario = ?',
                    [cita.id_horario]
                );

            } else {
                updateQuery = `
                UPDATE citas 
                SET 
                    id_estado = ?,
                    observaciones = ?,
                    fecha_actualizacion = NOW()
                WHERE id_cita = ?
            `;
                updateParams = [nuevoEstadoId, observaciones || motivo, citaId];
            }

            const [updateResult] = await connection.execute(updateQuery, updateParams);

            if (updateResult.affectedRows === 0) {
                throw new Error('No se pudo actualizar la cita');
            }

            // Insertar en auditoría (opcional)
            try {
                await connection.execute(`
                INSERT INTO auditoria_citas (id_cita, evento, descripcion, usuario_id, fecha_evento)
                VALUES (?, ?, ?, ?, NOW())
            `, [
                    citaId,
                    estado,
                    `Cita marcada como ${estado}. ${motivo || observaciones || ''}`,
                    req.user?.id_usuario || 1
                ]);
            } catch (auditError) {
                // No fallar si no existe la tabla
            }

            await connection.commit();

            // Enviar correo si es cancelación
            if (estado === 'cancelada' && cita.paciente_correo) {
                try {
                    await CancelcitascorreoCc(cita.paciente_correo, cita.paciente);
                } catch (emailError) {
                    // No fallar por error de correo
                }
            }

            const mensajeMap = {
                'pendiente': 'Cita marcada como pendiente',
                'confirmada': 'Cita confirmada correctamente',
                'realizada': 'Cita marcada como realizada',
                'cancelada': 'Cita cancelada correctamente',
                'no_asistio': 'Cita marcada como no asistió'
            };

            res.json({
                success: true,
                message: mensajeMap[estado],
                data: {
                    id_cita: cita.id_cita,
                    estado: estado,
                    paciente: cita.paciente,
                    medico: cita.medico,
                    fecha: cita.fecha,
                    hora: cita.hora_inicio
                }
            });

        } catch (error) {
            if (connection) {
                try { await connection.rollback(); } catch { }
            }
            res.status(500).json({
                success: false,
                message: 'Error al actualizar estado de la cita'
            });
        } finally {
            if (connection) connection.release();
        }
    },


    // Solo para cancelar citas - envía correo
    // Fixed cancelCita function with proper error handling and validation
    cancelCita: async (req, res) => {
        console.log('=== CANCEL CITA START ===');
        console.log('Request params:', req.params);
        console.log('Request body:', req.body);

        let connection;
        try {
            const { id } = req.params;
            const { motivo = 'Cancelada por administrador', cancelada_por = 'admin' } = req.body;

            // Validate input
            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de cita inválido'
                });
            }

            const citaId = parseInt(id);
            console.log('Processing cancellation for cita ID:', citaId);

            connection = await pool.getConnection();

            // Get appointment details
            const [citaRows] = await connection.execute(`
            SELECT 
                c.id_cita,
                c.id_estado,
                c.motivo_cancelacion,
                h.id_horario,
                h.fecha,
                h.hora_inicio,
                h.hora_fin,
                up.nombre_completo as paciente,
                up.correo as paciente_correo,
                m.nombre_completo as medico,
                ec.nombre as estado_actual
            FROM citas c
            INNER JOIN horarios h ON c.id_horario = h.id_horario
            INNER JOIN pacientes p ON c.id_paciente = p.id_paciente
            INNER JOIN usuarios up ON p.id_paciente = up.id_usuario
            INNER JOIN medicos m ON h.id_medico = m.id_medico
            LEFT JOIN estados_cita ec ON c.id_estado = ec.id_estado
            WHERE c.id_cita = ?
        `, [citaId]);

            if (citaRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cita no encontrada'
                });
            }

            const cita = citaRows[0];
            console.log('Found appointment:', cita);

            // Check if already cancelled
            if (cita.id_estado === 4) {
                return res.status(400).json({
                    success: false,
                    message: 'La cita ya está cancelada'
                });
            }

            // Check if appointment can be cancelled (business logic)
            if (cita.id_estado === 3) { // Already completed
                return res.status(400).json({
                    success: false,
                    message: 'No se puede cancelar una cita ya realizada'
                });
            }

            // Validate appointment date (optional 24-hour rule for non-admin)
            const fechaHoraCita = new Date(`${cita.fecha.toISOString().split('T')[0]}T${cita.hora_inicio}`);
            const ahora = new Date();
            const horasRestantes = (fechaHoraCita - ahora) / (1000 * 60 * 60);

            console.log('Hours remaining until appointment:', horasRestantes);

            if (horasRestantes < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede cancelar una cita que ya pasó'
                });
            }

            // For non-admin users, enforce 24-hour rule
            if (horasRestantes < 24 && cancelada_por !== 'admin') {
                return res.status(409).json({
                    success: false,
                    message: 'No se puede cancelar la cita. Deben quedar al menos 24 horas para la cita.'
                });
            }

            // All validations passed, proceed with cancellation
            await connection.beginTransaction();
            console.log('Transaction started');

            try {
                // Update appointment status to cancelled (4)
                const [updateResult] = await connection.execute(`
                UPDATE citas 
                SET 
                    id_estado = 4,
                    cancelada_por = ?,
                    motivo_cancelacion = ?,
                    fecha_cancelacion = NOW(),
                    fecha_actualizacion = NOW()
                WHERE id_cita = ?
            `, [cancelada_por, motivo.trim(), citaId]);

                console.log('Update result:', updateResult);

                if (updateResult.affectedRows === 0) {
                    throw new Error('No se pudo actualizar la cita');
                }

                // Free up the time slot
                const [horarioResult] = await connection.execute(`
                UPDATE horarios 
                SET disponible = true 
                WHERE id_horario = ?
            `, [cita.id_horario]);

                console.log('Schedule update result:', horarioResult);

                // Add audit log (optional, don't fail if table doesn't exist)
                try {
                    await connection.execute(`
                    INSERT INTO auditoria_citas (id_cita, evento, descripcion, usuario_id, fecha_evento)
                    VALUES (?, ?, ?, ?, NOW())
                `, [
                        citaId,
                        'cancelada',
                        `Cita cancelada por ${cancelada_por}. Motivo: ${motivo.trim()}`,
                        req.user?.id_usuario || 1
                    ]);
                    console.log('Audit log created');
                } catch (auditError) {
                    console.warn('Warning: Could not log to audit table:', auditError.message);
                    // Continue without failing - audit is not critical
                }

                await connection.commit();
                console.log('Transaction committed successfully');

                // Send notification email (optional, don't fail if it doesn't work)
                if (cita.paciente_correo) {
                    try {
                        await CancelcitascorreoCc(cita.paciente_correo, cita.paciente);
                        console.log('Cancellation email sent');
                    } catch (emailError) {
                        console.error('Error al enviar correo de cancelación:', emailError);
                        // Don't fail the operation due to email error
                    }
                }

                console.log('=== CANCEL CITA SUCCESS ===');

                res.json({
                    success: true,
                    message: `Cita cancelada correctamente.`,
                    data: {
                        id_cita: cita.id_cita,
                        paciente: cita.paciente,
                        medico: cita.medico,
                        fecha: cita.fecha,
                        hora: cita.hora_inicio,
                        motivo: motivo.trim(),
                        cancelada_por: cancelada_por,
                        estado: 'cancelada'
                    }
                });

            } catch (transactionError) {
                await connection.rollback();
                console.log('Transaction rolled back due to error');
                throw transactionError;
            }

        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error('Rollback error:', rollbackError);
                }
            }

            console.log('=== CANCEL CITA ERROR ===');
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                sqlState: error.sqlState,
                stack: process.env.NODE_ENV === 'development' ? error.stack : 'Hidden in production'
            });

            // Return more specific error information
            let errorMessage = 'Error interno del servidor al cancelar la cita';
            let statusCode = 500;

            // Check for specific database errors
            if (error.code === 'ER_NO_SUCH_TABLE') {
                errorMessage = 'Error de configuración de base de datos - tabla no encontrada';
                console.error('Missing table:', error.message);
            } else if (error.code === 'ER_BAD_FIELD_ERROR') {
                errorMessage = 'Error en la estructura de la base de datos - campo no encontrado';
                console.error('Bad field:', error.message);
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Error de conexión a la base de datos';
                console.error('Database connection refused');
            } else if (error.code === 'ER_DUP_ENTRY') {
                errorMessage = 'Error de datos duplicados';
            }

            res.status(statusCode).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? {
                    message: error.message,
                    code: error.code,
                    sqlState: error.sqlState
                } : undefined
            });
        } finally {
            if (connection) {
                connection.release();
                console.log('Database connection released');
            }
            console.log('=== CANCEL CITA END ===');
        }
    },
    // CONFIGURACIÓN DEL SISTEMA
    getEstadosCita: async (req, res) => {
        try {
            const [estados] = await pool.query(`
            SELECT id_estado, nombre, descripcion, color, permite_cancelacion, created_at
            FROM estados_cita 
            ORDER BY id_estado
        `);

            res.json({
                success: true,
                data: estados
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al obtener estados de cita'
            });
        }
    },
    
    createEstadoCita: async (req, res) => {
        try {
            const { nombre, descripcion, color, permite_cancelacion = 1 } = req.body;

            if (!nombre || nombre.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre del estado es obligatorio'
                });
            }

            if (!color || !/^#[0-9A-F]{6}$/i.test(color)) {
                return res.status(400).json({
                    success: false,
                    message: 'El color debe ser un código hexadecimal válido (ej: #FF0000)'
                });
            }

            const [existing] = await pool.query(
                'SELECT id_estado FROM estados_cita WHERE LOWER(TRIM(nombre)) = LOWER(?)',
                [nombre.trim()]
            );

            if (existing.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe un estado con ese nombre'
                });
            }

            const [result] = await pool.query(
                'INSERT INTO estados_cita (nombre, descripcion, color, permite_cancelacion) VALUES (?, ?, ?, ?)',
                [nombre.trim(), descripcion?.trim() || null, color.toUpperCase(), permite_cancelacion ? 1 : 0]
            );

            res.status(201).json({
                success: true,
                message: 'Estado de cita creado correctamente',
                data: {
                    id_estado: result.insertId,
                    nombre: nombre.trim(),
                    descripcion: descripcion?.trim() || null,
                    color: color.toUpperCase(),
                    permite_cancelacion: permite_cancelacion ? 1 : 0
                }
            });

        } catch (error) {
            console.error('Error al crear estado de cita:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear estado de cita',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    deleteEstadoCita: async (req, res) => {
        try {
            const { id } = req.params;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de estado inválido'
                });
            }

            // Verificar si el estado está en uso
            const [citasConEstado] = await pool.query(
                'SELECT COUNT(*) as count FROM citas WHERE id_estado = ?',
                [parseInt(id)]
            );

            if (citasConEstado[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar el estado porque está siendo utilizado por citas existentes'
                });
            }

            const [result] = await pool.query(
                'DELETE FROM estados_cita WHERE id_estado = ?',
                [parseInt(id)]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Estado de cita no encontrado'
                });
            }

            res.json({
                success: true,
                message: 'Estado de cita eliminado correctamente'
            });

        } catch (error) {
            console.error('Error al eliminar estado de cita:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar estado de cita',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    // REPORTES
    getReportes: async (req, res) => {
        try {
            const { tipo, fecha_inicio, fecha_fin } = req.query;

            let fechaCondition = '';
            const params = [];

            if (fecha_inicio && fecha_fin) {
                fechaCondition = 'AND h.fecha BETWEEN ? AND ?';
                params.push(fecha_inicio, fecha_fin);
            }

            let reporte = {};

            switch (tipo) {
                case 'citas_especialidad':
                    const [citasEsp] = await pool.query(`
                        SELECT e.nombre as especialidad, 
                               COUNT(c.id_cita) as total_citas,
                               SUM(CASE WHEN c.id_estado = 3 THEN 1 ELSE 0 END) as realizadas,
                               SUM(CASE WHEN c.id_estado = 4 THEN 1 ELSE 0 END) as canceladas,
                               SUM(CASE WHEN c.id_estado = 5 THEN 1 ELSE 0 END) as no_asistio
                        FROM especialidades e
                        LEFT JOIN medico_especialidad me ON e.id_especialidad = me.id_especialidad
                        LEFT JOIN medicos m ON me.id_medico = m.id_medico
                        LEFT JOIN horarios h ON m.id_medico = h.id_medico
                        LEFT JOIN citas c ON h.id_horario = c.id_horario
                        WHERE 1=1 ${fechaCondition}
                        GROUP BY e.id_especialidad, e.nombre
                        ORDER BY total_citas DESC
                    `, params);
                    reporte = citasEsp;
                    break;

                case 'no_asistencia':
                    const [noAsistencia] = await pool.query(`
                        SELECT m.nombre_completo as medico,
                               COUNT(c.id_cita) as total_citas,
                               SUM(CASE WHEN c.id_estado = 5 THEN 1 ELSE 0 END) as no_asistio,
                               ROUND((SUM(CASE WHEN c.id_estado = 5 THEN 1 ELSE 0 END) * 100.0 / COUNT(c.id_cita)), 2) as tasa_no_asistencia
                        FROM medicos m
                        INNER JOIN horarios h ON m.id_medico = h.id_medico
                        INNER JOIN citas c ON h.id_horario = c.id_horario
                        WHERE 1=1 ${fechaCondition}
                        GROUP BY m.id_medico, m.nombre_completo
                        HAVING total_citas > 0
                        ORDER BY tasa_no_asistencia DESC
                    `, params);
                    reporte = noAsistencia;
                    break;

                case 'citas_mensuales':
                    const [citasMens] = await pool.query(`
                        SELECT DATE_FORMAT(h.fecha, '%Y-%m') as mes,
                               COUNT(c.id_cita) as total_citas,
                               SUM(CASE WHEN c.id_estado = 3 THEN 1 ELSE 0 END) as realizadas,
                               SUM(CASE WHEN c.id_estado = 4 THEN 1 ELSE 0 END) as canceladas,
                               SUM(CASE WHEN c.id_estado = 5 THEN 1 ELSE 0 END) as no_asistio,
                               SUM(CASE WHEN c.id_estado IN (1, 2) THEN 1 ELSE 0 END) as pendientes
                        FROM citas c
                        INNER JOIN horarios h ON c.id_horario = h.id_horario
                        WHERE 1=1 ${fechaCondition}
                        GROUP BY DATE_FORMAT(h.fecha, '%Y-%m')
                        ORDER BY mes DESC
                    `, params);
                    reporte = citasMens;
                    break;

                case 'estados_citas':
                    const [estadosCitas] = await pool.query(`
                        SELECT ec.nombre as estado,
                               ec.color,
                               COUNT(c.id_cita) as total_citas,
                               ROUND((COUNT(c.id_cita) * 100.0 / (SELECT COUNT(*) FROM citas)), 2) as porcentaje
                        FROM estados_cita ec
                        LEFT JOIN citas c ON ec.id_estado = c.id_estado
                        WHERE 1=1 ${fechaCondition ? 'AND EXISTS (SELECT 1 FROM horarios h WHERE h.id_horario = c.id_horario ' + fechaCondition + ')' : ''}
                        GROUP BY ec.id_estado, ec.nombre, ec.color
                        ORDER BY total_citas DESC
                    `, params);
                    reporte = estadosCitas;
                    break;

                case 'eficiencia_medicos':
                    const [eficienciaMed] = await pool.query(`
                        SELECT m.nombre_completo as medico,
                               COUNT(c.id_cita) as total_citas,
                               SUM(CASE WHEN c.id_estado = 3 THEN 1 ELSE 0 END) as realizadas,
                               SUM(CASE WHEN c.id_estado = 4 THEN 1 ELSE 0 END) as canceladas,
                               SUM(CASE WHEN c.id_estado = 5 THEN 1 ELSE 0 END) as no_asistio,
                               ROUND((SUM(CASE WHEN c.id_estado = 3 THEN 1 ELSE 0 END) * 100.0 / COUNT(c.id_cita)), 2) as tasa_exito,
                               AVG(CASE WHEN c.id_estado = 3 THEN 
                                   TIMESTAMPDIFF(MINUTE, CONCAT(h.fecha, ' ', h.hora_inicio), c.fecha_actualizacion)
                                   ELSE NULL END) as tiempo_promedio_consulta
                        FROM medicos m
                        INNER JOIN horarios h ON m.id_medico = h.id_medico
                        INNER JOIN citas c ON h.id_horario = c.id_horario
                        WHERE 1=1 ${fechaCondition}
                        GROUP BY m.id_medico, m.nombre_completo
                        HAVING total_citas > 0
                        ORDER BY tasa_exito DESC, total_citas DESC
                    `, params);
                    reporte = eficienciaMed;
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Tipo de reporte no válido'
                    });
            }

            res.json({
                success: true,
                data: reporte
            });

        } catch (error) {
            console.error('Error al generar reporte:', error);
            res.status(500).json({
                success: false,
                message: 'Error al generar reporte'
            });
        }
    }
};

module.exports = adminController;