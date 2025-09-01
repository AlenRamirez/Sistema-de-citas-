const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Administrador
 *   description: Endpoints exclusivos para administradores del sistema
 */

// Middleware para verificar que el usuario sea administrador
const isAdmin = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Acceso denegado. Se requieren permisos de administrador.'
        });
    }
    next();
};

router.use(authMiddleware);
router.use(isAdmin);

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Obtener datos del dashboard administrativo
 *     tags: [Administrador]
 *     responses:
 *       200:
 *         description: Datos del dashboard obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPacientes:
 *                       type: integer
 *                       example: 150
 *                     totalMedicos:
 *                       type: integer
 *                       example: 25
 *                     citasHoy:
 *                       type: integer
 *                       example: 45
 *                     citasPendientes:
 *                       type: integer
 *                       example: 12
 *                     ingresosMes:
 *                       type: number
 *                       format: float
 *                       example: 125000.50
 *       403:
 *         description: Acceso denegado - No es administrador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/dashboard', adminController.getDashboard);

/**
 * @swagger
 * /admin/usuarios:
 *   get:
 *     summary: Obtener todos los usuarios del sistema
 *     tags: [Administrador]
 *     parameters:
 *       - in: query
 *         name: rol
 *         schema:
 *           type: string
 *           enum: [paciente, medico, admin]
 *         description: Filtrar por rol de usuario
 *       - in: query
 *         name: activo
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo/inactivo
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Cantidad de resultados por página
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 200
 *                     pages:
 *                       type: integer
 *                       example: 10
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 */
router.get('/usuarios', adminController.getAllUsers);

/**
 * @swagger
 * /admin/usuarios/{id}/estado:
 *   put:
 *     summary: Cambiar estado activo/inactivo de un usuario
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - activo
 *             properties:
 *               activo:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Estado del usuario actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/usuarios/:id/estado', adminController.toggleUserStatus);

/**
 * @swagger
 * /admin/usuarios/{id}:
 *   delete:
 *     summary: Eliminar un usuario del sistema
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a eliminar
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: No se puede eliminar el usuario (tiene citas activas)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/usuarios/:id', adminController.deleteUser);

/**
 * @swagger
 * /admin/medicos:
 *   get:
 *     summary: Obtener todos los médicos del sistema
 *     tags: [Administrador]
 *     responses:
 *       200:
 *         description: Lista de médicos obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Medico'
 */
router.get('/medicos', adminController.getAllMedicos);

/**
 * @swagger
 * /admin/especialidades:
 *   get:
 *     summary: Obtener todas las especialidades médicas
 *     tags: [Administrador]
 *     responses:
 *       200:
 *         description: Lista de especialidades obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Especialidad'
 */
router.get('/especialidades', adminController.getEspecialidades);

/**
 * @swagger
 * /admin/medicos/{medicoId}:
 *   delete:
 *     summary: Eliminar un médico del sistema
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: medicoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del médico a eliminar
 *     responses:
 *       200:
 *         description: Médico eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Médico no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/medicos/:medicoId', adminController.deleteMedico);

/**
 * @swagger
 * /admin/medicos/{medicoId}/especialidades:
 *   get:
 *     summary: Obtener especialidades de un médico específico
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: medicoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del médico
 *     responses:
 *       200:
 *         description: Especialidades del médico obtenidas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Especialidad'
 */
router.get('/medicos/:medicoId/especialidades', adminController.getMedicoEspecialidades);

/**
 * @swagger
 * /admin/medicos/{medicoId}/especialidades:
 *   put:
 *     summary: Actualizar especialidades de un médico
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: medicoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del médico
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - especialidadIds
 *             properties:
 *               especialidadIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 3, 5]
 *                 description: Array de IDs de especialidades
 *     responses:
 *       200:
 *         description: Especialidades actualizadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.put('/medicos/:medicoId/especialidades', adminController.updateMedicoEspecialidades);

/**
 * @swagger
 * /admin/medicos/{medicoId}/horarios:
 *   get:
 *     summary: Obtener horarios de un médico específico
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: medicoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del médico
 *     responses:
 *       200:
 *         description: Horarios del médico obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Horario'
 */
router.get('/medicos/:medicoId/horarios', adminController.getMedicoHorarios);

/**
 * @swagger
 * /admin/medicos/{medicoId}/horarios:
 *   post:
 *     summary: Crear un nuevo horario para un médico
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: medicoId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del médico
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - diaSemana
 *               - horaInicio
 *               - horaFin
 *             properties:
 *               diaSemana:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 example: 1
 *                 description: Día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado)
 *               horaInicio:
 *                 type: string
 *                 format: time
 *                 example: "08:00:00"
 *               horaFin:
 *                 type: string
 *                 format: time
 *                 example: "17:00:00"
 *               activo:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Horario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Horario creado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Horario'
 */
router.post('/medicos/:medicoId/horarios', adminController.createMedicoHorario);

/**
 * @swagger
 * /admin/horarios/{horarioId}:
 *   put:
 *     summary: Actualizar un horario específico
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: horarioId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del horario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               diaSemana:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 example: 2
 *               horaInicio:
 *                 type: string
 *                 format: time
 *                 example: "09:00:00"
 *               horaFin:
 *                 type: string
 *                 format: time
 *                 example: "18:00:00"
 *               activo:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Horario actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.put('/horarios/:horarioId', adminController.updateMedicoHorario);

/**
 * @swagger
 * /admin/horarios/{horarioId}:
 *   delete:
 *     summary: Eliminar un horario específico
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: horarioId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del horario a eliminar
 *     responses:
 *       200:
 *         description: Horario eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.delete('/horarios/:horarioId', adminController.deleteMedicoHorario);

/**
 * @swagger
 * /admin/citas:
 *   get:
 *     summary: Obtener todas las citas del sistema
 *     tags: [Administrador]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [programada, completada, cancelada]
 *         description: Filtrar por estado de la cita
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtrar por fecha específica
 *       - in: query
 *         name: medicoId
 *         schema:
 *           type: integer
 *         description: Filtrar por médico
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Cantidad de resultados por página
 *     responses:
 *       200:
 *         description: Lista de citas obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Cita'
 */
router.get('/citas', adminController.getAllCitas);

/**
 * @swagger
 * /admin/citas/{id}/cancel:
 *   put:
 *     summary: Cancelar una cita específica
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cita
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *                 example: "Cancelada por el administrador"
 *     responses:
 *       200:
 *         description: Cita cancelada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.put('/citas/:id/cancel', adminController.cancelCita);

/**
 * @swagger
 * /admin/citas/{id}/status:
 *   put:
 *     summary: Actualizar el estado de una cita
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cita
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [programada, completada, cancelada]
 *                 example: "completada"
 *               observaciones:
 *                 type: string
 *                 example: "Cita completada satisfactoriamente"
 *     responses:
 *       200:
 *         description: Estado de la cita actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.put('/citas/:id/status', adminController.updateCitaStatus);

/**
 * @swagger
 * /admin/estados-cita:
 *   get:
 *     summary: Obtener todos los estados de cita disponibles
 *     tags: [Administrador]
 *     responses:
 *       200:
 *         description: Lista de estados obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       nombre:
 *                         type: string
 *                         example: "programada"
 *                       descripcion:
 *                         type: string
 *                         example: "Cita programada y confirmada"
 */
router.get('/estados-cita', adminController.getEstadosCita);

/**
 * @swagger
 * /admin/estados-cita:
 *   post:
 *     summary: Crear un nuevo estado de cita
 *     tags: [Administrador]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "en_espera"
 *               descripcion:
 *                 type: string
 *                 example: "Paciente en sala de espera"
 *     responses:
 *       201:
 *         description: Estado creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.post('/estados-cita', adminController.createEstadoCita);

/**
 * @swagger
 * /admin/estados-cita/{id}:
 *   delete:
 *     summary: Eliminar un estado de cita
 *     tags: [Administrador]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del estado a eliminar
 *     responses:
 *       200:
 *         description: Estado eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.delete('/estados-cita/:id', adminController.deleteEstadoCita);

/**
 * @swagger
 * /admin/reportes:
 *   get:
 *     summary: Obtener reportes estadísticos del sistema
 *     tags: [Administrador]
 *     parameters:
 *       - in: query
 *         name: fechaInicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio para el reporte
 *       - in: query
 *         name: fechaFin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin para el reporte
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [citas, ingresos, medicos, pacientes]
 *         description: Tipo de reporte a generar
 *     responses:
 *       200:
 *         description: Reportes obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     citasPorMes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           mes:
 *                             type: string
 *                             example: "2024-01"
 *                           total:
 *                             type: integer
 *                             example: 150
 *                     ingresosPorMes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           mes:
 *                             type: string
 *                             example: "2024-01"
 *                           total:
 *                             type: number
 *                             format: float
 *                             example: 75000.50
 *                     medicosMasActivos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           medico:
 *                             $ref: '#/components/schemas/Medico'
 *                           totalCitas:
 *                             type: integer
 *                             example: 89
 */
router.get('/reportes', adminController.getReportes);

module.exports = router;