const express = require('express');
const { register, login, forgotPassword, resetPassword } = require('../controllers/authController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Autenticación
 *   description: Endpoints relacionados con la autenticación y recuperación de contraseñas
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo paciente
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - documento
 *               - correo
 *               - contraseña
 *             properties:
 *               nombre:
 *                 type: string
 *               documento:
 *                 type: string
 *               correo:
 *                 type: string
 *                 format: email
 *               telefono:
 *                 type: string
 *               contraseña:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - correo
 *               - contraseña
 *             properties:
 *               correo:
 *                 type: string
 *                 format: email
 *               contraseña:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sesión iniciada correctamente, devuelve un token JWT
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Enviar enlace de recuperación de contraseña al correo
 *     tags: [Autenticación]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - correo
 *             properties:
 *               correo:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Correo de recuperación enviado
 *       404:
 *         description: Usuario no encontrado
 */
router.post("/forgot-password", forgotPassword);

/**
 * @swagger
 * /auth/reset-password/{token}:
 *   post:
 *     summary: Restablecer la contraseña usando un token de recuperación
 *     tags: [Autenticación]
 *     parameters:
 *       - name: token
 *         in: path
 *         description: Token de recuperación enviado al correo
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nuevaContraseña
 *             properties:
 *               nuevaContraseña:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contraseña restablecida correctamente
 *       400:
 *         description: Token inválido o expirado
 */
router.post("/reset-password/:token", resetPassword);

module.exports = router;
