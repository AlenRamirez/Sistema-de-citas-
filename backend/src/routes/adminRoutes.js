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

// Aplicar middleware de autenticación y verificación de admin a todas las rutas
router.use(authMiddleware);
router.use(isAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Endpoints para administración del sistema
 */

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Obtener información del dashboard administrativo
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Dashboard cargado correctamente
 */
router.get('/dashboard', adminController.getDashboard);

/**
 * @swagger
 * /admin/usuarios:
 *   get:
 *     summary: Obtener lista de todos los usuarios
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Lista de usuarios obtenida correctamente
 */
router.get('/usuarios', adminController.getAllUsers);

/**
 * @swagger
 * /admin/usuarios/{id}/estado:
 *   put:
 *     summary: Activar o desactivar un usuario
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Estado del usuario actualizado correctamente
 *       404:
 *         description: Usuario no encontrado
 */
router.put('/usuarios/:id/estado', adminController.toggleUserStatus);

/**
 * @swagger
 * /admin/usuarios/{id}:
 *   delete:
 *     summary: Eliminar un usuario
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del usuario a eliminar
 *     responses:
 *       200:
 *         description: Usuario eliminado correctamente
 *       404:
 *         description: Usuario no encontrado
 */
router.delete('/usuarios/:id', adminController.deleteUser);

/**
 * @swagger
 * /admin/medicos:
 *   post:
 *     summary: Crear un nuevo médico
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - especialidad
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Dr. Juan Pérez
 *               especialidad:
 *                 type: string
 *                 example: Cardiología
 *     responses:
 *       201:
 *         description: Médico creado correctamente
 */
router.post('/medicos', adminController.createMedico);

/**
 * @swagger
 * /admin/citas:
 *   get:
 *     summary: Obtener todas las citas
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Lista de citas obtenida correctamente
 */
router.get('/citas', adminController.getAllCitas);

/**
 * @swagger
 * /admin/citas/{id}/cancelar:
 *   put:
 *     summary: Cancelar una cita
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la cita a cancelar
 *     responses:
 *       200:
 *         description: Cita cancelada correctamente
 *       404:
 *         description: Cita no encontrada
 */
router.put('/citas/:id/cancelar', adminController.cancelCita);

/**
 * @swagger
 * /admin/reportes:
 *   get:
 *     summary: Obtener reportes del sistema
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Reportes obtenidos correctamente
 */
router.get('/reportes', adminController.getReportes);

/**
 * @swagger
 * /admin/especialidades:
 *   get:
 *     summary: Obtener todas las especialidades
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Lista de especialidades obtenida correctamente
 *
 *   post:
 *     summary: Crear una nueva especialidad
 *     tags: [Admin]
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
 *                 example: Dermatología
 *     responses:
 *       201:
 *         description: Especialidad creada correctamente
 */
router.get('/especialidades', adminController.getEspecialidades);
router.post('/especialidades', adminController.createEspecialidad);

module.exports = router;
