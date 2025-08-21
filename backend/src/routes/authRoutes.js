const express = require('express');
const { register, login, forgotPassword, resetPassword } = require('../controllers/authController');

const router = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo paciente
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 */
router.post('/login', login);
/**
 * @swagger
 * /auth/forgotPasswor:
 *   post:
 *     summary: recuperar contraseña
 */
router.post("/forgot-password", forgotPassword);
/**
 * @swagger
 * /auth/resetPassword:
 *   post:
 *     summary: reiniciar contraseña
 */
router.post("/reset-password/:token", resetPassword);


module.exports = router;
