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

            res.json({
                success: true,
                message: `Usuario ${activo ? 'activado' : 'desactivado'} correctamente`
            });
        } catch (error) {
            console.error('Error al cambiar estado del usuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al cambiar estado del usuario'
            });
        }
    },


}