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

// Rutas existentes del admin
router.get('/dashboard', adminController.getDashboard);
router.get('/usuarios', adminController.getAllUsers);
router.put('/usuarios/:id/estado', adminController.toggleUserStatus);
router.delete('/usuarios/:id', adminController.deleteUser);
router.post('/medicos', adminController.createMedico);

// Rutas de citas - usando adminController
router.get('/citas', adminController.getAllCitas);
router.get('/citas/estados', adminController.getEstadosCita);

// Rutas para cambiar estados
router.put('/citas/:id/status', adminController.updateCitaStatus);     // Para confirmar, realizar, no_asistio
router.put('/citas/:id/cancel', adminController.cancelCita);           // Para cancelar (endpoint específico)

// Rutas de especialidades
router.get('/especialidades', adminController.getEspecialidades);
router.post('/especialidades', adminController.createEspecialidad);

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