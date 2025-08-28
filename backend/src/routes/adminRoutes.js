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

 
router.get('/dashboard', adminController.getDashboard);


router.get('/usuarios', adminController.getAllUsers);


router.put('/usuarios/:id/estado', adminController.toggleUserStatus);

router.delete('/usuarios/:id', adminController.deleteUser);

router.post('/medicos', adminController.createMedico);

router.get('/citas', adminController.getAllCitas);

router.put('/citas/:id/cancelar', adminController.cancelCita);

router.get('/especialidades', adminController.getEspecialidades);
router.post('/especialidades', adminController.createEspecialidad);

module.exports = router;
