const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');
const authMiddleware = require('../middleware/authMiddleware');

const verificarPaciente = (req, res, next) => {
  if (req.user.rol !== 'paciente' && req.user.rol !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado. Se requiere rol de paciente'
    });
  }
  next();
};

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Pacientes
 *   description: Endpoints para gestión de pacientes y sus funcionalidades
 */

/**
 * @swagger
 * /pacientes/perfil/{id}:
 *   get:
 *     summary: Obtener perfil de paciente
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del paciente
 *     responses:
 *       200:
 *         description: Perfil del paciente obtenido exitosamente
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
 *                   example: "Perfil obtenido exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Paciente'
 *       403:
 *         description: Acceso denegado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Paciente no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token no válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/perfil/:id', verificarPaciente, pacienteController.obtenerPerfil);

/**
 * @swagger
 * /pacientes/perfil/{id}:
 *   put:
 *     summary: Actualizar perfil de paciente
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del paciente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Juan Pérez"
 *               telefono:
 *                 type: string
 *                 example: "+57 300 123 4567"
 *               fechaNacimiento:
 *                 type: string
 *                 format: date
 *                 example: "1990-05-15"
 *               direccion:
 *                 type: string
 *                 example: "Calle 123 # 45-67"
 *               tipoSangre:
 *                 type: string
 *                 example: "O+"
 *               alergias:
 *                 type: string
 *                 example: "Penicilina, Polen"
 *               enfermedadesCronicas:
 *                 type: string
 *                 example: "Diabetes tipo 2"
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
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
 *                   example: "Perfil actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Paciente'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Paciente no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/perfil/:id', verificarPaciente, pacienteController.actualizarPerfil);

/**
 * @swagger
 * /pacientes/mis-citas:
 *   get:
 *     summary: Obtener las citas del paciente autenticado
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [pendiente, confirmada, completada, cancelada]
 *         description: Filtrar citas por estado
 *       - in: query
 *         name: fechaInicio
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de inicio para filtrar citas
 *       - in: query
 *         name: fechaFin
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de fin para filtrar citas
 *     responses:
 *       200:
 *         description: Citas obtenidas exitosamente
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
 *                   example: "Citas obtenidas exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Cita'
 *       401:
 *         description: Token no válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/mis-citas', pacienteController.obtenerMisCitas);

/**
 * @swagger
 * /pacientes/citas:
 *   post:
 *     summary: Agendar una nueva cita
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - medicoId
 *               - fecha
 *               - hora
 *               - motivo
 *             properties:
 *               medicoId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               fecha:
 *                 type: string
 *                 format: date
 *                 example: "2024-12-15"
 *               hora:
 *                 type: string
 *                 example: "10:00"
 *               motivo:
 *                 type: string
 *                 example: "Consulta general"
 *               observaciones:
 *                 type: string
 *                 example: "Dolor de cabeza recurrente"
 *     responses:
 *       201:
 *         description: Cita agendada exitosamente
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
 *                   example: "Cita agendada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Cita'
 *       400:
 *         description: Datos inválidos o horario no disponible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Médico no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/citas', verificarPaciente, pacienteController.agendarCita);

/**
 * @swagger
 * /pacientes/citas/{id}:
 *   get:
 *     summary: Obtener detalles de una cita específica
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la cita
 *     responses:
 *       200:
 *         description: Detalles de la cita obtenidos exitosamente
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
 *                   example: "Cita obtenida exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Cita'
 *       404:
 *         description: Cita no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token no válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/citas/:id', authMiddleware, pacienteController.obtenerCita);

/**
 * @swagger
 * /pacientes/citas/{id}:
 *   delete:
 *     summary: Cancelar una cita
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la cita a cancelar
 *     responses:
 *       200:
 *         description: Cita cancelada exitosamente
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
 *                   example: "Cita cancelada exitosamente"
 *       400:
 *         description: No se puede cancelar la cita
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acceso denegado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Cita no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/citas/:id', verificarPaciente, pacienteController.cancelarCita);

/**
 * @swagger
 * /pacientes/horarios-disponibles:
 *   get:
 *     summary: Obtener horarios disponibles para agendar citas
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: medicoId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del médico
 *       - in: query
 *         name: fecha
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha para consultar disponibilidad
 *     responses:
 *       200:
 *         description: Horarios disponibles obtenidos exitosamente
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
 *                   example: "Horarios disponibles obtenidos exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       hora:
 *                         type: string
 *                         example: "09:00"
 *                       disponible:
 *                         type: boolean
 *                         example: true
 *       400:
 *         description: Parámetros faltantes o inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Médico no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/horarios-disponibles', pacienteController.obtenerHorariosDisponibles);

/**
 * @swagger
 * /pacientes/medicos-disponibles:
 *   get:
 *     summary: Obtener lista de médicos disponibles
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: especialidad
 *         schema:
 *           type: string
 *         description: Filtrar médicos por especialidad
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha para verificar disponibilidad
 *     responses:
 *       200:
 *         description: Médicos disponibles obtenidos exitosamente
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
 *                   example: "Médicos disponibles obtenidos exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Medico'
 *       401:
 *         description: Token no válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/medicos-disponibles', pacienteController.obtenerMedicosDisponibles);

/**
 * @swagger
 * /pacientes/especialidades:
 *   get:
 *     summary: Obtener lista de especialidades médicas disponibles
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Especialidades obtenidas exitosamente
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
 *                   example: "Especialidades obtenidas exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       nombre:
 *                         type: string
 *                         example: "Cardiología"
 *                       descripcion:
 *                         type: string
 *                         example: "Especialidad médica que se encarga del estudio, diagnóstico y tratamiento de las enfermedades del corazón"
 *       401:
 *         description: Token no válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/especialidades', pacienteController.obtenerEspecialidades);

module.exports = router;