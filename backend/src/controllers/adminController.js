const { pool } = require('../config/db');
const bcrypt = require('bcrypt');

const adminController = {

    // Dashboard con estadísticas
    getDashboard: async (req, res) => {
        try {
            const stats = await pool.query(`
                SELECT 
                    (SELECT COUNT(*) FROM usuarios WHERE id_rol = 2) as total_pacientes,
                    (SELECT COUNT(*) FROM citas WHERE id_estado = 1) as citas_pendientes,
                    (SELECT COUNT(*) FROM citas WHERE DATE(fecha_creacion) = CURDATE()) as citas_hoy,
                    (SELECT COUNT(*) FROM citas WHERE id_estado = 4) as citas_canceladas,
                    (SELECT COUNT(*) FROM citas WHERE id_estado = 3) as citas_realizadas
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

            const [users] = await pool.query(`
            SELECT u.id_usuario, u.correo, u.nombre_completo, u.documento, 
                   u.telefono, u.activo, u.created_at, r.nombre as rol
            FROM usuarios u
            INNER JOIN roles r ON u.id_rol = r.id_rol
            ${whereClause}
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);

            const [totalCount] = await pool.query(`
            SELECT COUNT(*) as total
            FROM usuarios u
            INNER JOIN roles r ON u.id_rol = r.id_rol
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

    // Activar/desactivar usuario
    toggleUserStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { activo } = req.body;

            if (parseInt(id) === req.user.id_usuario) {
                return res.status(400).json({
                    success: false,
                    message: 'No puedes desactivar tu propia cuenta'
                });
            }

            await pool.query(
                'UPDATE usuarios SET activo = ? WHERE id_usuario = ?',
                [activo, id]
            );

            const estado = activo == 1 ? 'activado' : 'desactivado';

            res.json({
                success: true,
                message: `El usuario ha sido ${estado} correctamente`
            });
        } catch (error) {
            console.error('Error al cambiar estado del usuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cambiar estado del usuario'
            });
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

            const citasActivas = await pool.query(`
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

    // Crear médico
    createMedico: async (req, res) => {
        let connection;
        try {
            console.log('Datos recibidos para crear médico:', req.body);

            const {
                nombre_completo,
                correo,
                registro_profesional,
                consultorio,
                telefono,
                estado = 'activo',
                biografia,
                experiencia_anos,
                foto_url,
                especialidades
            } = req.body;

            if (!nombre_completo || !registro_profesional) {
                return res.status(400).json({
                    success: false,
                    message: "El nombre completo y el registro profesional son obligatorios"
                });
            }

            if (!especialidades || !Array.isArray(especialidades) || especialidades.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Debe seleccionar al menos una especialidad válida"
                });
            }

            connection = await pool.getConnection();

            const [medicoExistente] = await connection.execute(
                "SELECT id_medico FROM medicos WHERE registro_profesional = ?",
                [registro_profesional]
            );

            if (medicoExistente.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Ya existe un médico con este registro profesional"
                });
            }

            const [especialidadesExistentes] = await connection.execute(
                `SELECT id_especialidad FROM especialidades WHERE id_especialidad IN (${especialidades.map(() => '?').join(',')})`,
                especialidades
            );

            if (especialidadesExistentes.length !== especialidades.length) {
                return res.status(400).json({
                    success: false,
                    message: "Una o más especialidades no existen"
                });
            }

            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO medicos 
            (nombre_completo, correo, registro_profesional, consultorio, telefono, estado, biografia, experiencia_anos, foto_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nombre_completo.trim(),
                    correo ? correo.trim() : null,
                    registro_profesional.trim(),
                    consultorio ? consultorio.trim() : null,
                    telefono ? telefono.trim() : null,
                    estado,
                    biografia ? biografia.trim() : null,
                    experiencia_anos ? parseInt(experiencia_anos) : null,
                    foto_url ? foto_url.trim() : null
                ]
            );

            const medicoId = result.insertId;
            console.log('Médico creado con ID:', medicoId);

            for (const idEspecialidad of especialidades) {
                await connection.execute(
                    "INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES (?, ?)",
                    [medicoId, parseInt(idEspecialidad)]
                );
            }

            await connection.commit();
            console.log('Transacción completada exitosamente');

            res.status(201).json({
                success: true,
                message: "Médico creado exitosamente",
                data: { id_medico: medicoId }
            });

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }

            console.error("Error detallado al crear médico:", {
                message: error.message,
                code: error.code,
                sqlState: error.sqlState,
                stack: error.stack
            });

            let userMessage = "Error interno del servidor al crear médico";
            if (error.code === 'ER_DUP_ENTRY') {
                userMessage = "El correo ya está registrado para otro médico";
            }

            res.status(500).json({
                success: false,
                message: userMessage,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },

    // Obtener todas las citas con filtros y paginación
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
                         h.hora_fin, up.nombre_completo, up.documento, m.nombre_completo, 
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
                fecha_creacion: cita.fecha_creacion ? new Date(cita.fecha_creacion).toISOString() : null,
                fecha_cancelacion: cita.fecha_cancelacion ? new Date(cita.fecha_cancelacion).toISOString() : null,
                especialidades: cita.especialidades || 'Sin especialidad'
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

    // Cancelar cita (admin)
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

            const [citaRows] = await connection.execute(`
                SELECT 
                    c.id_cita, 
                    c.id_estado, 
                    h.id_horario,
                    h.fecha,
                    h.hora_inicio,
                    up.nombre_completo as paciente,
                    m.nombre_completo as medico,
                    ec.nombre as estado_actual,
                    ec.permite_cancelacion
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

            if (cita.id_estado === 4) {
                return res.status(400).json({
                    success: false,
                    message: 'La cita ya está cancelada'
                });
            }

            // Verificar si el estado permite cancelación
            if (cita.permite_cancelacion === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Esta cita no puede ser cancelada debido a su estado actual'
                });
            }

            const fechaCita = new Date(cita.fecha);
            const fechaActual = new Date();
            fechaActual.setHours(0, 0, 0, 0);

            if (fechaCita < fechaActual) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede cancelar una cita que ya pasó'
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
                    INSERT INTO auditoria_citas (id_cita, evento, usuario_id, fecha_evento, detalles)
                    VALUES (?, 'cancelada', ?, NOW(), ?)
                `, [parseInt(id), req.user?.id_usuario || null, `Cancelada por ${cancelada_por}: ${motivo.trim()}`]);

                await connection.commit();

                res.json({
                    success: true,
                    message: `Cita cancelada correctamente. Paciente: ${cita.paciente}, Médico: ${cita.medico}`,
                    data: {
                        id_cita: cita.id_cita,
                        paciente: cita.paciente,
                        medico: cita.medico,
                        fecha_cancelacion: new Date().toISOString()
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
                message: 'Error interno del servidor al cancelar la cita',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },

    // Marcar cita como realizada o no asistió
    updateCitaStatus: async (req, res) => {
        let connection;
        try {
            const { id } = req.params;
            const { estado, notas = '' } = req.body; // estado: 'realizada' o 'no_asistio'

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de cita inválido'
                });
            }

            if (!['realizada', 'no_asistio'].includes(estado)) {
                return res.status(400).json({
                    success: false,
                    message: 'Estado inválido. Debe ser "realizada" o "no_asistio"'
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

            // Verificar que la cita esté en estado pendiente o confirmada
            if (![1, 2].includes(cita.id_estado)) {
                return res.status(400).json({
                    success: false,
                    message: 'Solo se pueden actualizar citas pendientes o confirmadas'
                });
            }

            // Verificar que la hora de la cita ya pasó
            const fechaHoraCita = new Date(`${cita.fecha}T${cita.hora_inicio}`);
            const ahora = new Date();

            if (fechaHoraCita > ahora) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede actualizar el estado de una cita que aún no ha comenzado'
                });
            }

            // Verificar permisos: solo el médico de la cita o admin puede actualizar
            if (req.user.rol !== 'admin' && req.user.id_medico !== cita.id_medico) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para actualizar esta cita'
                });
            }

            await connection.beginTransaction();

            try {
                const nuevoEstado = estado === 'realizada' ? 3 : 5;

                await connection.execute(`
                    UPDATE citas 
                    SET 
                        id_estado = ?,
                        notas = ?,
                        fecha_actualizacion = NOW()
                    WHERE id_cita = ?
                `, [nuevoEstado, notas.trim(), parseInt(id)]);

                // Auditoría
                await connection.execute(`
                    INSERT INTO auditoria_citas (id_cita, evento, usuario_id, fecha_evento, detalles)
                    VALUES (?, ?, ?, NOW(), ?)
                `, [
                    parseInt(id),
                    estado,
                    req.user?.id_usuario || null,
                    notas.trim() || `Marcada como ${estado === 'realizada' ? 'realizada' : 'no asistió'}`
                ]);

                await connection.commit();

                res.json({
                    success: true,
                    message: `Cita marcada como ${estado === 'realizada' ? 'realizada' : 'no asistió'} correctamente`,
                    data: {
                        id_cita: cita.id_cita,
                        estado: estado === 'realizada' ? 'Realizada' : 'No asistió',
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

    // Obtener estados de cita disponibles
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

    // Reportes mejorados con gráficos
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
        console.log('🔍 GET /admin/especialidades - Iniciando...');
        try {
            const [rows] = await pool.query(`
            SELECT id_especialidad, nombre, descripcion
            FROM especialidades 
            ORDER BY nombre
        `);

            console.log(`Especialidades obtenidas: ${rows.length}`);
            console.log('Primeros registros:', rows.slice(0, 3));

            res.json({
                success: true,
                message: 'Especialidades obtenidas correctamente',
                data: rows
            });

        } catch (error) {
            console.error('❌ Error detallado en getEspecialidades:', error);

            res.status(500).json({
                success: false,
                message: 'Error al obtener especialidades',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    createEspecialidad: async (req, res) => {
        console.log('🔍 POST /admin/especialidades - Iniciando...');
        console.log('Body recibido:', req.body);

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
                'SELECT id_especialidad FROM especialidades WHERE nombre = ?',
                [nombreLimpio]
            );

            const [existingTrim] = await pool.query(
                'SELECT id_especialidad FROM especialidades WHERE TRIM(nombre) = ?',
                [nombreLimpio]
            );

            const [existingLower] = await pool.query(
                'SELECT id_especialidad FROM especialidades WHERE LOWER(TRIM(nombre)) = LOWER(?)',
                [nombreLimpio]
            );

            if (existing.length > 0 || existingTrim.length > 0 || existingLower.length > 0) {
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
            console.error('❌ Error detallado en createEspecialidad:', error);

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

    updateEstadoCita: async (req, res) => {
        try {
            const { id } = req.params;
            const { nombre, descripcion, color, permite_cancelacion } = req.body;

            if (!id || isNaN(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de estado inválido'
                });
            }

            const [estadoExistente] = await pool.query(
                'SELECT * FROM estados_cita WHERE id_estado = ?',
                [parseInt(id)]
            );

            if (estadoExistente.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Estado de cita no encontrado'
                });
            }

            const updates = [];
            const params = [];

            if (nombre && nombre.trim() !== '') {
                updates.push('nombre = ?');
                params.push(nombre.trim());
            }

            if (descripcion !== undefined) {
                updates.push('descripcion = ?');
                params.push(descripcion?.trim() || null);
            }

            if (color && /^#[0-9A-F]{6}$/i.test(color)) {
                updates.push('color = ?');
                params.push(color.toUpperCase());
            }

            if (permite_cancelacion !== undefined) {
                updates.push('permite_cancelacion = ?');
                params.push(permite_cancelacion ? 1 : 0);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionaron campos válidos para actualizar'
                });
            }

            params.push(parseInt(id));

            await pool.query(
                `UPDATE estados_cita SET ${updates.join(', ')} WHERE id_estado = ?`,
                params
            );

            res.json({
                success: true,
                message: 'Estado de cita actualizado correctamente'
            });

        } catch (error) {
            console.error('Error al actualizar estado de cita:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar estado de cita',
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