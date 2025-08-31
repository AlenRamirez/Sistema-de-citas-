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

router.get('/perfil/:id', verificarPaciente, pacienteController.obtenerPerfil);


router.put('/perfil/:id', verificarPaciente, pacienteController.actualizarPerfil);

router.get('/mis-citas', pacienteController.obtenerMisCitas);

router.post('/citas', verificarPaciente, pacienteController.agendarCita);
router.get('/citas/:id', authMiddleware, pacienteController.obtenerCita);
router.delete('/citas/:id', verificarPaciente, pacienteController.cancelarCita);
router.get('/horarios-disponibles', pacienteController.obtenerHorariosDisponibles);
router.get('/medicos-disponibles', pacienteController.obtenerMedicosDisponibles);
router.get('/especialidades', pacienteController.obtenerEspecialidades);
module.exports = router;
