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
 *   description: Endpoints para la gestión de pacientes
 */

/**
 * @swagger
 * /pacientes/perfil/{id}:
 *   get:
 *     summary: Obtener perfil de un paciente
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID del paciente
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Perfil obtenido correctamente
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Paciente no encontrado
 */
router.get('/perfil/:id', verificarPaciente, pacienteController.obtenerPerfil);

/**
 * @swagger
 * /pacientes/perfil/{id}:
 *   put:
 *     summary: Actualizar perfil de un paciente
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         description: ID del paciente
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               apellido:
 *                 type: string
 *               telefono:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil actualizado correctamente
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Acceso denegado
 */
router.put('/perfil/:id', verificarPaciente, pacienteController.actualizarPerfil);

/**
 * @swagger
 * /pacientes/citas:
 *   get:
 *     summary: Obtener citas del paciente autenticado
 *     tags: [Pacientes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de citas obtenida correctamente
 */
router.get('/mis-citas', pacienteController.obtenerMisCitas);

router.post('/citas', verificarPaciente, pacienteController.agendarCita);
router.get('/citas/:id', authMiddleware, pacienteController.obtenerCita);
router.delete('/citas/:id', verificarPaciente, pacienteController.cancelarCita);
router.get('/horarios-disponibles', pacienteController.obtenerHorariosDisponibles);
router.get('/medicos-disponibles', pacienteController.obtenerMedicosDisponibles);
router.get('/especialidades', pacienteController.obtenerEspecialidades);
module.exports = router;
