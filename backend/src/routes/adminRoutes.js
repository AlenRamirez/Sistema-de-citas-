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

// GESTIÓN DE USUARIOS (Pacientes y Médicos)
router.get('/usuarios', adminController.getAllUsers);
router.put('/usuarios/:id/estado', adminController.toggleUserStatus);
router.delete('/usuarios/:id', adminController.deleteUser);

// GESTIÓN DE MÉDICOS - HORARIOS Y ESPECIALIDADES
router.get('/medicos', adminController.getAllMedicos);
router.get('/especialidades', adminController.getEspecialidades);
router.delete('/medicos/:medicoId', adminController.deleteMedico);

// Especialidades de médicos - ROUTES MISSING
router.get('/medicos/:medicoId/especialidades', adminController.getMedicoEspecialidades);
router.put('/medicos/:medicoId/especialidades', adminController.updateMedicoEspecialidades);

// Horarios de médicos - FIXED ROUTES
router.get('/medicos/:medicoId/horarios', adminController.getMedicoHorarios);
router.post('/medicos/:medicoId/horarios', adminController.createMedicoHorario); // THIS WAS MISSING
router.put('/horarios/:horarioId', adminController.updateMedicoHorario); // FIXED PATH
router.delete('/horarios/:horarioId', adminController.deleteMedicoHorario); // FIXED PATH

// GESTIÓN DE CITAS
router.get('/citas', adminController.getAllCitas);
router.put('/citas/:id/cancel', adminController.cancelCita);
router.put('/citas/:id/status', adminController.updateCitaStatus);

// CONFIGURACIÓN DEL SISTEMA
router.get('/estados-cita', adminController.getEstadosCita);
router.post('/estados-cita', adminController.createEstadoCita);
router.delete('/estados-cita/:id', adminController.deleteEstadoCita);

// REPORTES
router.get('/reportes', adminController.getReportes);

module.exports = router;