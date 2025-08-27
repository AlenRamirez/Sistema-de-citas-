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

            const offset = (page - 1) * limit;

            const users = await pool.query(`
                SELECT u.id_usuario, u.correo, u.nombre_completo, u.documento, 
                       u.telefono, u.activo, u.created_at, r.nombre as rol
                FROM usuarios u
                INNER JOIN roles r ON u.id_rol = r.id_rol
                ${whereClause}
                ORDER BY u.created_at DESC
                LIMIT ? OFFSET ?
            `, [...params, parseInt(limit), offset]);

            const totalCount = await pool.query(`
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

            // Verificar que el usuario no se desactive a sí mismo
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

            // Generar mensaje dinámico
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

            // Verificar que el usuario no se elimine a sí mismo
            if (parseInt(id) === req.user.id_usuario) {
                return res.status(400).json({
                    success: false,
                    message: 'No puedes eliminar tu propia cuenta'
                });
            }

            // Verificar si el usuario tiene citas activas
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

    // Crear médico - CORREGIDO CON MANEJO DE ERRORES MEJORADO
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

            // Validar campos requeridos
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

            // Obtener conexión
            connection = await pool.getConnection();

            // Verificar si ya existe un médico con este registro
            const medicoExistente = await connection.execute(
                "SELECT id_medico FROM medicos WHERE registro_profesional = ?",
                [registro_profesional]
            );

            if (medicoExistente[0].length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Ya existe un médico con este registro profesional"
                });
            }

            // Verificar que todas las especialidades existan
            const especialidadesExistentes = await connection.execute(
                `SELECT id_especialidad FROM especialidades WHERE id_especialidad IN (${especialidades.map(() => '?').join(',')})`,
                especialidades
            );

            if (especialidadesExistentes[0].length !== especialidades.length) {
                return res.status(400).json({
                    success: false,
                    message: "Una o más especialidades no existen"
                });
            }

            await connection.beginTransaction();

            // Insertar en la tabla medicos
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

            // Insertar especialidades del médico
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

            res.status(500).json({
                success: false,
                message: "Error interno del servidor al crear médico",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },

    // Gestión de citas - CORREGIDO
    getAllCitas: async (req, res) => {
        try {
            const { estado, fecha_inicio, fecha_fin, medico, paciente, page = 1, limit = 10 } = req.query;
            let whereClause = 'WHERE 1=1';
            const params = [];

            if (estado && estado !== 'todos') {
                whereClause += ' AND ec.nombre = ?';
                params.push(estado);
            }

            if (fecha_inicio) {
                whereClause += ' AND h.fecha >= ?';
                params.push(fecha_inicio);
            }

            if (fecha_fin) {
                whereClause += ' AND h.fecha <= ?';
                params.push(fecha_fin);
            }

            if (medico) {
                whereClause += ' AND m.nombre_completo LIKE ?';
                params.push(`%${medico}%`);
            }

            if (paciente) {
                whereClause += ' AND up.nombre_completo LIKE ?';
                params.push(`%${paciente}%`);
            }

            const offset = (page - 1) * limit;

            const citas = await pool.query(`
                SELECT c.id_cita, c.motivo, c.fecha_creacion, c.fecha_cancelacion,
                       c.cancelada_por, h.fecha, h.hora_inicio, h.hora_fin,
                       up.nombre_completo as paciente, up.documento as documento_paciente,
                       m.nombre_completo as medico, m.registro_profesional,
                       COALESCE(ec.nombre, 'Pendiente') as estado,
                       GROUP_CONCAT(e.nombre SEPARATOR ', ') as especialidades
                FROM citas c
                INNER JOIN horarios h ON c.id_horario = h.id_horario
                INNER JOIN pacientes p ON c.id_paciente = p.id_paciente
                INNER JOIN usuarios up ON p.id_paciente = up.id_usuario
                INNER JOIN medicos m ON h.id_medico = m.id_medico
                LEFT JOIN estados_cita ec ON c.id_estado = ec.id_estado
                LEFT JOIN medico_especialidad me ON m.id_medico = me.id_medico
                LEFT JOIN especialidades e ON me.id_especialidad = e.id_especialidad
                ${whereClause}
                GROUP BY c.id_cita
                ORDER BY h.fecha DESC, h.hora_inicio DESC
                LIMIT ? OFFSET ?
            `, [...params, parseInt(limit), offset]);

            const totalCount = await pool.query(`
                SELECT COUNT(DISTINCT c.id_cita) as total
                FROM citas c
                INNER JOIN horarios h ON c.id_horario = h.id_horario
                INNER JOIN pacientes p ON c.id_paciente = p.id_paciente
                INNER JOIN usuarios up ON p.id_paciente = up.id_usuario
                INNER JOIN medicos m ON h.id_medico = m.id_medico
                LEFT JOIN estados_cita ec ON c.id_estado = ec.id_estado
                ${whereClause}
            `, params);

            res.json({
                success: true,
                data: {
                    citas,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: totalCount[0].total,
                        pages: Math.ceil(totalCount[0].total / limit)
                    }
                }
            });
        } catch (error) {
            console.error('Error al obtener citas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener citas'
            });
        }
    },

    // Cancelar cita (admin)
    cancelCita: async (req, res) => {
        let connection;
        try {
            const { id } = req.params;
            const { motivo } = req.body;

            connection = await pool.getConnection();

            const [cita] = await connection.execute(`
                SELECT c.id_cita, c.id_estado, h.id_horario
                FROM citas c
                INNER JOIN horarios h ON c.id_horario = h.id_horario
                WHERE c.id_cita = ?
            `, [id]);

            if (cita.length === 0) {
                return res.status(404).json({ success: false, message: 'Cita no encontrada' });
            }

            if (cita[0].id_estado === 4) {
                return res.status(400).json({ success: false, message: 'La cita ya está cancelada' });
            }

            await connection.beginTransaction();

            // Actualizar cita
            await connection.execute(`
                UPDATE citas 
                SET id_estado = 4, cancelada_por = 'admin',
                    motivo_cancelacion = ?, 
                    fecha_cancelacion = NOW(), fecha_actualizacion = NOW()
                WHERE id_cita = ?
            `, [motivo || 'Cancelada por administrador', id]);

            // Liberar horario
            await connection.execute(`
                UPDATE horarios SET disponible = true WHERE id_horario = ?
            `, [cita[0].id_horario]);

            await connection.commit();

            res.json({ success: true, message: 'Cita cancelada correctamente' });

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }
            console.error('Error al cancelar cita:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cancelar cita',
                error: error.message
            });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },

    // Reportes
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
                    reporte = await pool.query(`
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
                    break;

                case 'no_asistencia':
                    reporte = await pool.query(`
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
                    break;

                case 'citas_mensuales':
                    reporte = await pool.query(`
                        SELECT DATE_FORMAT(h.fecha, '%Y-%m') as mes,
                               COUNT(c.id_cita) as total_citas,
                               SUM(CASE WHEN c.id_estado = 3 THEN 1 ELSE 0 END) as realizadas,
                               SUM(CASE WHEN c.id_estado = 4 THEN 1 ELSE 0 END) as canceladas
                        FROM citas c
                        INNER JOIN horarios h ON c.id_horario = h.id_horario
                        WHERE 1=1 ${fechaCondition}
                        GROUP BY DATE_FORMAT(h.fecha, '%Y-%m')
                        ORDER BY mes DESC
                    `, params);
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
        console.log('Usuario autenticado:', req.user);
        console.log('Headers recibidos:', req.headers);

        try {
            console.log('📊 Ejecutando consulta a base de datos...');

            // Primera prueba: consulta más simple
            const result = await pool.query('SELECT COUNT(*) as total FROM especialidades');
            console.log('Total especialidades en BD:', result[0]);

            // Segunda consulta: obtener datos
            const especialidades = await pool.query(`
            SELECT id_especialidad, nombre, descripcion
            FROM especialidades 
            ORDER BY nombre
        `);

            console.log('Especialidades obtenidas:', especialidades.length);
            console.log('Primeros 3 registros:', especialidades.slice(0, 3));

            res.json({
                success: true,
                message: 'Especialidades obtenidas correctamente',
                data: especialidades,
                debug: {
                    total: especialidades.length,
                    query_executed: true,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error detallado en getEspecialidades:', {
                message: error.message,
                code: error.code,
                errno: error.errno,
                sqlState: error.sqlState,
                sqlMessage: error.sqlMessage,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                message: 'Error al obtener especialidades',
                error: {
                    message: error.message,
                    code: error.code,
                    sqlState: error.sqlState
                },
                debug: {
                    timestamp: new Date().toISOString(),
                    query_failed: true
                }
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
            console.log('✅ Nombre a buscar:', `"${nombreLimpio}"`);
            console.log('Longitud del nombre:', nombreLimpio.length);

            // Consultar todos
            const [todos] = await pool.query(
                'SELECT id_especialidad, nombre, LENGTH(nombre) as longitud FROM especialidades'
            );
            console.log('Todos los registros en especialidades:');
            todos.forEach((esp, index) => {
                console.log(`  ${index + 1}. ID: ${esp.id_especialidad}, Nombre: "${esp.nombre}", Longitud: ${esp.longitud}`);
            });

            // Verificar existencia exacta
            const [existing] = await pool.query(
                'SELECT id_especialidad, nombre FROM especialidades WHERE nombre = ?',
                [nombreLimpio]
            );

            // Verificar con TRIM
            const [existingTrim] = await pool.query(
                'SELECT id_especialidad, nombre FROM especialidades WHERE TRIM(nombre) = ?',
                [nombreLimpio]
            );

            // Verificar case insensitive
            const [existingLower] = await pool.query(
                'SELECT id_especialidad, nombre FROM especialidades WHERE LOWER(TRIM(nombre)) = LOWER(?)',
                [nombreLimpio]
            );

            if (existing.length > 0 || existingTrim.length > 0 || existingLower.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La especialidad ya existe',

                });
            }

            // Insertar nueva especialidad
            const [result] = await pool.query(
                'INSERT INTO especialidades (nombre, descripcion) VALUES (?, ?)',
                [nombreLimpio, descripcion?.trim() || null]
            );

            res.status(201).json({
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

            res.status(500).json({
                success: false,
                message: 'Error al crear especialidad',
                error: error.message
            });
        }
    }
};
module.exports = adminController;