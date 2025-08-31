const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

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

// DASHBOARD
router.get('/dashboard', adminController.getDashboard);

// GESTIÓN DE USUARIOS
router.get('/usuarios', adminController.getAllUsers);
router.put('/usuarios/:id/estado', adminController.toggleUserStatus);
router.delete('/usuarios/:id', adminController.deleteUser);

// CU-04: GESTIÓN DE ESPECIALIDADES DEL MÉDICO
router.get('/medicos/:medicoId/especialidades', adminController.getMedicoEspecialidades);
router.put('/medicos/:medicoId/especialidades', adminController.updateMedicoEspecialidades);

// GESTIÓN DE CITAS
router.get('/citas', adminController.getAllCitas);
router.get('/citas/estados', adminController.getEstadosCita);

// CU-08: Cancelar cita
router.put('/citas/:id/cancel', adminController.cancelCita);

// CU-10: Registrar atención (marcar realizada) / No asistencia
router.put('/citas/:id/status', adminController.updateCitaStatus);

// GESTIÓN DE ESPECIALIDADES
router.get('/especialidades', adminController.getEspecialidades);
router.post('/especialidades', adminController.createEspecialidad);

// GESTIÓN DE ESTADOS DE CITA
router.post('/estados-cita', adminController.createEstadoCita);
router.delete('/estados-cita/:id', adminController.deleteEstadoCita);

// CU-12: REPORTES OPERATIVOS
/**
 * @route GET /api/admin/reportes
 * @desc Obtener reportes según tipo especificado
 * @access Admin
 * @params tipo (required): citas_especialidad, no_asistencia, citas_mensuales, estados_citas, eficiencia_medicos
 * @params fecha_inicio (optional): YYYY-MM-DD
 * @params fecha_fin (optional): YYYY-MM-DD
 */
router.get('/reportes', adminController.getReportes);

module.exports = router;