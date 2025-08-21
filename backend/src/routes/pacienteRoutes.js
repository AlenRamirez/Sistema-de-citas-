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
 * /auth/obtener perfil:
 *   get:
 *     summary: verificar paciente
 */
router.get('/perfil/:id', verificarPaciente, pacienteController.obtenerPerfil);

/**
 * @swagger
 * /auth/actualizar perfil:
 *   put:
 *     summary: verificar paciente
 */
router.put('/perfil/:id', verificarPaciente, pacienteController.actualizarPerfil);

router.get('/citas', verificarPaciente, pacienteController.obtenerMisCitas);
router.post('/citas', verificarPaciente, pacienteController.agendarCita);
router.delete('/citas/:id', verificarPaciente, pacienteController.cancelarCita);

router.get('/medicos-disponibles', verificarPaciente, pacienteController.buscarMedicosDisponibles);

module.exports = router;