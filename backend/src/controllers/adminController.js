const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const { CancelcitascorreoCc } = require("../utils/mailer");

const adminController = {

    // Dashboard con estadísticas actualizadas
    getDashboard: async (req, res) => {
        try {
            const stats = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM usuarios WHERE id_rol = 2) as total_pacientes,
                    (SELECT COUNT(*) FROM medicos WHERE estado = 'activo') as total_medicos,
                    (SELECT COUNT(*) FROM citas) as total_citas,
                    (SELECT COUNT(*) FROM usuarios WHERE activo = 1) as usuarios_activos
            `);

            const citasEspecialidad = await pool.query(`
                SELECT e.nombre, COUNT(c.id_cita) as total
                FROM especialidades e
                LEFT JOIN medico_especialidad me ON e.id_especialidad = me.id_especialidad
                LEFT JOIN medicos m ON me.id_medico = m.id_medico
                LEFT JOIN horarios h ON m.id_medico = h.id_medico
                LEFT JOIN citas c ON h.id_horario = c.id_horario
                GROUP BY e.id_especialidad, e.nombre
                ORDER BY total DESC
            `);

            res.json({
                success: true,
                data: {
                    stats: stats[0],
                    citasEspecialidad
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

    getAllUsers: async (req, res) => {
        try {
            const { tipo, estado, page = 1, limit = 10 } = req.query;
            let whereClause = 'WHERE 1=1';
            const params = [];

            if (tipo && tipo !== 'todos') {
                whereClause += ' AND r.nombre = ?';
                params.push(tipo);
            }

            if (estado && estado !== 'todos') {
                whereClause += ' AND u.activo = ?';
                params.push(estado === 'activo');
            }

            const offset = (parseInt(page) - 1) * parseInt(limit);

            // Query actualizado para incluir información de médicos
            const [users] = await pool.query(`
                SELECT u.id_usuario, u.correo, u.nombre_completo, u.documento, 
                       u.telefono, u.activo, u.created_at, r.nombre as rol,
                       m.id_medico, m.registro_profesional, m.estado as estado_medico
                FROM usuarios u
                INNER JOIN roles r ON u.id_rol = r.id_rol
                LEFT JOIN medicos m ON u.id_usuario = m.id_medico
                ${whereClause}
                ORDER BY u.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, parseInt(limit), offset]);

            const [totalCount] = await pool.query(`
                SELECT COUNT(*) as total
                FROM usuarios u
                INNER JOIN roles r ON u.id_rol = r.id_rol
                LEFT JOIN medicos m ON u.id_usuario = m.id_medico
                ${whereClause}
            `, params);

            res.json({
                success: true,
                data: {
                    users,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount[0].total,
                        pages: Math.ceil(totalCount[0].total / limit)
                    }
                }
            });
        } catch (error) {
            console.error('Error al obtener usuarios:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener usuarios'
            });
        }
    },

    // Activar/desactivar usuario (incluyendo médicos)
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

    // Eliminar usuario
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

    // CU-04: Gestionar especialidades del médico
    getMedicoEspecialidades: async (req, res) => {
        try {
            const { medicoId } = req.params;

            // Validar que el médico existe y está activo
            const [medico] = await pool.query(
                'SELECT id_medico, estado FROM medicos WHERE id_medico = ?',
                [medicoId]
            );

            if (medico.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Médico no encontrado'
                });
            }

            if (medico[0].estado !== 'activo') {
                return res.status(403).json({
                    success: false,
                    message: 'Médico inactivo'
                });
            }

            // Obtener todas las especialidades disponibles
            const [todasEspecialidades] = await pool.query(
                'SELECT id_especialidad, nombre, descripcion FROM especialidades ORDER BY nombre'
            );

            // Obtener especialidades del médico
            const [especialidadesMedico] = await pool.query(`
                SELECT me.id_especialidad 
                FROM medico_especialidad me 
                WHERE me.id_medico = ?
            `, [medicoId]);

            const especialidadesIds = especialidadesMedico.map(esp => esp.id_especialidad);

            res.json({
                success: true,
                data: {
                    especialidades: todasEspecialidades,
                    especialidadesAsignadas: especialidadesIds
                }
            });

        } catch (error) {
            console.error('Error al obtener especialidades del médico:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener especialidades del médico'
            });
        }
    },

    updateMedicoEspecialidades: async (req, res) => {
        let connection;
        try {
            const { medicoId } = req.params;
            const { especialidades } = req.body;

            // Validaciones
            if (!especialidades || !Array.isArray(especialidades)) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe proporcionar un array de especialidades'
                });
            }

            if (especialidades.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe seleccionar al menos una especialidad'
                });
            }

            connection = await pool.getConnection();

            // Validar que el médico existe y está activo
            const [medico] = await connection.execute(
                'SELECT id_medico, estado FROM medicos WHERE id_medico = ?',
                [medicoId]
            );

            if (medico.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Médico no encontrado'
                });
            }

            if (medico[0].estado !== 'activo') {
                return res.status(403).json({
                    success: false,
                    message: 'Médico inactivo'
                });
            }

            // Validar que todas las especialidades existen
            const [especialidadesExistentes] = await connection.execute(
                `SELECT id_especialidad FROM especialidades WHERE id_especialidad IN (${especialidades.map(() => '?').join(',')})`,
                especialidades
            );

            if (especialidadesExistentes.length !== especialidades.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Una o más especialidades no existen'
                });
            }

            await connection.beginTransaction();

            // Eliminar especialidades actuales del médico
            await connection.execute(
                'DELETE FROM medico_especialidad WHERE id_medico = ?',
                [medicoId]
            );

            // Insertar nuevas especialidades (con idempotencia)
            for (const idEspecialidad of especialidades) {
                await connection.execute(
                    'INSERT IGNORE INTO medico_especialidad (id_medico, id_especialidad) VALUES (?, ?)',
                    [medicoId, parseInt(idEspecialidad)]
                );
            }

            await connection.commit();

            res.json({
                success: true,
                message: 'Especialidades del médico actualizadas correctamente',
                data: {
                    medico_id: medicoId,
                    especialidades: especialidades
                }
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

    // FUNCIONES DE CITAS
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

    updateCitaStatus: async (req, res) => {
        let connection;
        try {
            const { id } = req.params;
            const { estado, observaciones = '' } = req.body;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de cita inválido'
                });
            }

            if (!['confirmada', 'realizada', 'no_asistio'].includes(estado)) {
                return res.status(400).json({
                    success: false,
                    message: 'Estado inválido. Debe ser "confirmada", "realizada" o "no_asistio"'
                });
            }

            connection = await pool.getConnection();

            const [citaRows] = await connection.execute(`
                SELECT 
                    c.id_cita, 
                    c.id_estado, 
                    h.fecha,
                    h.hora_inicio,
                    h.id_medico,
                    up.nombre_completo as paciente,
                    m.nombre_completo as medico,
                    ec.nombre as estado_actual
                FROM citas c
                INNER JOIN horarios h ON c.id_horario = h.id_horario
                INNER JOIN pacientes p ON c.id_paciente = p.id_paciente
                INNER JOIN usuarios up ON p.id_paciente = up.id_usuario
                INNER JOIN medicos m ON h.id_medico = m.id_medico
                LEFT JOIN estados_cita ec ON c.id_estado = ec.id_estado
                WHERE c.id_cita = ?
            `, [parseInt(id)]);

            if (citaRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cita no encontrada'
                });
            }

            const cita = citaRows[0];

            // Validaciones según el estado
            if (estado === 'confirmada') {
                if (![1, null].includes(cita.id_estado)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Solo se pueden confirmar citas pendientes'
                    });
                }
            } else if (estado === 'realizada' || estado === 'no_asistio') {
                if (![1, 2, null].includes(cita.id_estado)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Solo se pueden actualizar citas pendientes o confirmadas'
                    });
                }
            }

            await connection.beginTransaction();

            try {
                const estadoMap = {
                    'confirmada': 2,
                    'realizada': 3,
                    'no_asistio': 5
                };

                const nuevoEstadoId = estadoMap[estado];

                await connection.execute(`
                    UPDATE citas 
                    SET 
                        id_estado = ?,
                        observaciones = ?,
                        fecha_actualizacion = NOW()
                    WHERE id_cita = ?
                `, [nuevoEstadoId, observaciones.trim(), parseInt(id)]);

                // Auditoría
                await connection.execute(`
                    INSERT INTO auditoria_citas (id_cita, evento, descripcion, usuario_id, fecha_evento)
                    VALUES (?, ?, ?, ?, NOW())
                `, [parseInt(id), estado, `Cita marcada como ${estado}. Observaciones: ${observaciones.trim()}`, req.user.id_usuario]);

                await connection.commit();

                const mensajeMap = {
                    'confirmada': 'Cita confirmada correctamente',
                    'realizada': 'Cita marcada como realizada correctamente',
                    'no_asistio': 'Cita marcada como no asistió correctamente'
                };

                res.json({
                    success: true,
                    message: mensajeMap[estado],
                    data: {
                        id_cita: cita.id_cita,
                        estado: estado,
                        paciente: cita.paciente,
                        medico: cita.medico
                    }
                });

            } catch (transactionError) {
                await connection.rollback();
                throw transactionError;
            }

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error al actualizar estado de cita:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al actualizar la cita',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },

    cancelCita: async (req, res) => {
        let connection;
        try {
            const { id } = req.params;
            const { motivo, cancelada_por = 'admin' } = req.body;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de cita inválido'
                });
            }

            if (!motivo || motivo.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'El motivo de cancelación es requerido'
                });
            }

            connection = await pool.getConnection();

            // Query mejorado para obtener información completa de la cita
            const [citaRows] = await connection.execute(`
                SELECT 
                    c.id_cita,
                    c.id_estado,
                    h.id_horario,
                    h.fecha,
                    h.hora_inicio,
                    h.hora_fin,
                    up.nombre_completo as paciente,
                    up.correo as paciente_correo,
                    m.nombre_completo as medico,
                    GROUP_CONCAT(DISTINCT e.nombre SEPARATOR ', ') as especialidades
                FROM citas c
                INNER JOIN horarios h ON c.id_horario = h.id_horario
                INNER JOIN pacientes p ON c.id_paciente = p.id_paciente
                INNER JOIN usuarios up ON p.id_paciente = up.id_usuario
                INNER JOIN medicos m ON h.id_medico = m.id_medico
                LEFT JOIN medico_especialidad me ON m.id_medico = me.id_medico
                LEFT JOIN especialidades e ON me.id_especialidad = e.id_especialidad
                WHERE c.id_cita = ?
                GROUP BY c.id_cita, c.id_estado, h.id_horario, h.fecha, h.hora_inicio, 
                         h.hora_fin, up.nombre_completo, up.correo, m.nombre_completo
            `, [parseInt(id)]);

            if (citaRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cita no encontrada'
                });
            }

            const cita = citaRows[0];

            if (cita.id_estado === 4) {
                return res.status(400).json({
                    success: false,
                    message: 'La cita ya está cancelada'
                });
            }

            // Validación de ventana de cancelación (24 horas)
            const fechaHoraCita = new Date(`${cita.fecha.toISOString().split('T')[0]} ${cita.hora_inicio}`);
            const ahora = new Date();
            const horasRestantes = (fechaHoraCita - ahora) / (1000 * 60 * 60);

            if (horasRestantes < 24 && cancelada_por !== 'admin') {
                return res.status(409).json({
                    success: false,
                    message: 'No se puede cancelar la cita. Deben quedar al menos 24 horas para la cita.'
                });
            }

            await connection.beginTransaction();

            try {
                await connection.execute(`
                    UPDATE citas 
                    SET 
                        id_estado = 4,
                        cancelada_por = ?,
                        motivo_cancelacion = ?,
                        fecha_cancelacion = NOW(),
                        fecha_actualizacion = NOW()
                    WHERE id_cita = ?
                `, [cancelada_por, motivo.trim(), parseInt(id)]);

                await connection.execute(`
                    UPDATE horarios 
                    SET disponible = true 
                    WHERE id_horario = ?
                `, [cita.id_horario]);

                // Auditoría
                await connection.execute(`
                    INSERT INTO auditoria_citas (id_cita, evento, descripcion, usuario_id, fecha_evento)
                    VALUES (?, ?, ?, ?, NOW())
                `, [parseInt(id), 'cancelada', `Cita cancelada por ${cancelada_por}. Motivo: ${motivo.trim()}`, req.user.id_usuario]);

                await connection.commit();

                // Enviar correo al paciente
                if (cita.paciente_correo) {
                    try {
                        await CancelcitascorreoCc(cita.paciente_correo, cita.paciente);
                    } catch (emailError) {
                        console.error('Error al enviar correo de cancelación:', emailError);
                        // No fallar la operación por error de correo
                    }
                }

                res.json({
                    success: true,
                    message: `Cita cancelada correctamente. Paciente: ${cita.paciente}, Médico: ${cita.medico}`,
                    data: {
                        id_cita: cita.id_cita,
                        paciente: cita.paciente,
                        medico: cita.medico,
                        motivo: motivo.trim(),
                        cancelada_por: cancelada_por
                    }
                });

            } catch (transactionError) {
                await connection.rollback();
                throw transactionError;
            }

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error al cancelar cita:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor al cancelar la cita'
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },

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
            console.error('Error al obtener estados:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estados de cita'
            });
        }
    },

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
    },

    getEspecialidades: async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT id_especialidad, nombre, descripcion
                FROM especialidades 
                ORDER BY nombre
            `);

            res.json({
                success: true,
                message: 'Especialidades obtenidas correctamente',
                data: rows
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al obtener especialidades',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    createEspecialidad: async (req, res) => {
        try {
            const { nombre, descripcion } = req.body;

            if (!nombre || nombre.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre de la especialidad es obligatorio'
                });
            }

            const nombreLimpio = nombre.trim();

            const [existing] = await pool.query(
                'SELECT id_especialidad FROM especialidades WHERE LOWER(TRIM(nombre)) = LOWER(?)',
                [nombreLimpio]
            );

            if (existing.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'La especialidad ya existe'
                });
            }

            const [result] = await pool.query(
                'INSERT INTO especialidades (nombre, descripcion) VALUES (?, ?)',
                [nombreLimpio, descripcion?.trim() || null]
            );

            return res.status(201).json({
                success: true,
                message: 'Especialidad creada correctamente',
                data: {
                    id_especialidad: result.insertId,
                    nombre: nombreLimpio,
                    descripcion: descripcion?.trim() || null
                }
            });

        } catch (error) {
            console.error('Error detallado en createEspecialidad:', error);

            return res.status(500).json({
                success: false,
                message: 'Error al crear especialidad',
                error: error.message
            });
        }
    },

    // Gestión de estados de cita
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
    }
};

module.exports = adminController;