const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Registrar paciente
exports.register = async (req, res) => {
  const { nombre_completo, documento, correo, telefono, password } = req.body;

  try {
    // Verificar correo y documento existentes
    const [existCorreo] = await pool.query('SELECT * FROM usuarios WHERE correo=?', [correo]);
    if (existCorreo.length > 0) return res.status(400).json({ message: 'Correo ya registrado' });

    const [existDocumento] = await pool.query('SELECT * FROM usuarios WHERE documento=?', [documento]);
    if (existDocumento.length > 0) return res.status(400).json({ message: 'Documento ya registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO usuarios (nombre_completo, documento, correo, telefono, password_hash, id_rol) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre_completo, documento, correo, telefono, hashedPassword, 2]
    );

    res.status(201).json({ message: 'Paciente registrado' });
  } catch (error) {
    console.error(error); // <-- muestra error real en consola
    res.status(500).json({ message: 'Error registrando usuario', error: error.message });
  }
};


// Login
exports.login = async (req, res) => {
  const { correo, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE correo=?', [correo]);
    if (rows.length === 0) return res.status(400).json({ message: 'Usuario no encontrado' });

    const usuario = rows[0];
    const validPassword = await bcrypt.compare(password, usuario.password_hash);
    if (!validPassword) return res.status(400).json({ message: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { id_usuario: usuario.id_usuario, rol: usuario.id_rol },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ token, usuario });
  } catch (error) {
    res.status(500).json({ message: 'Error en login' });
  }
};
