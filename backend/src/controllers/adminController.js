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
                LEFT JOIN horarios h ON me.id_medico = h.id_medico
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
            if (parseInt(id) === req.userId) {
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


    // Crear médico
    // Crear un médico
    createMedico: async (req, res) => {
        const connection = await pool.getConnection();
        try {
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

            // 🔹 Validar si ya existe antes de insertar
            const [medicoExistente] = await connection.query(
                "SELECT id_medico FROM medicos WHERE registro_profesional = ?",
                [registro_profesional]
            );

            if (medicoExistente.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Ya existe un médico con este registro profesional"
                });
            }

            await connection.beginTransaction();

            // Insertar en la tabla medicos
            const [result] = await connection.query(
                `INSERT INTO medicos 
                (nombre_completo, correo, registro_profesional, consultorio, telefono, estado, biografia, experiencia_anos, foto_url) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [nombre_completo, correo, registro_profesional, consultorio, telefono, estado, biografia, experiencia_anos, foto_url]
            );

            const medicoId = result.insertId;

            // Insertar especialidades del médico si existen
            if (especialidades && especialidades.length > 0) {
                const values = especialidades.map(idEspecialidad => [medicoId, idEspecialidad]);
                await connection.query(
                    "INSERT INTO medico_especialidad (id_medico, id_especialidad) VALUES ?",
                    [values]
                );
            }

            await connection.commit();
            res.status(201).json({ success: true, message: "Médico creado exitosamente", id_medico: medicoId });
        } catch (error) {
            await connection.rollback();
            console.error("Error al crear médico:", error);
            res.status(500).json({ success: false, message: "Error interno del servidor" });
        } finally {
            connection.release();
        }
    },



    // Gestión de citas
}