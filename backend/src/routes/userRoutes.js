const express = require('express');
const { getUsers, updateUserStatus } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Listar todos los usuarios (solo admin)
 */
router.get('/', authMiddleware, getUsers);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Actualizar estado de un usuario (solo admin)
 */
router.put('/:id', authMiddleware, updateUserStatus);

module.exports = router;
