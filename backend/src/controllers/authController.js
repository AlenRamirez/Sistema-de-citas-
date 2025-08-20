const {pool } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendConfirmationcorreo } = require('../utils/mailer');

//register
exports.register = async (req, res) => {
  const { nombre_completo, documento, correo, telefono, password } = req.body;

  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message: 'La contraseña debe tener mínimo 8 caracteres, 1 mayúscula, 1 número y 1 carácter especial.'
    });
  }

  try {

    const [existCorreo] = await pool.query('SELECT * FROM usuarios WHERE correo=?', [correo]);
    if (existCorreo.length > 0) return res.status(400).json({ message: 'Correo ya registrado' });

    const [existDocumento] = await pool.query('SELECT * FROM usuarios WHERE documento=?', [documento]);
    if (existDocumento.length > 0) return res.status(400).json({ message: 'Documento ya registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO usuarios (nombre_completo, documento, correo, telefono, password_hash, id_rol) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre_completo, documento, correo, telefono, hashedPassword, 2] 
    );

    await sendConfirmationcorreo(correo, nombre_completo);

    res.status(201).json({ message: 'Paciente registrado. Se ha enviado un correo de confirmación.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error registrando usuario', error: error.message });
  }
};

//Login

exports.login = async (req, res) => {
  const { correo, password } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT id_usuario, correo, password_hash, intentos_fallidos, bloqueado_hasta FROM usuarios WHERE correo = ?",
      [correo]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Usuario no encontrado" });
    }

    const user = rows[0];

    if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
      return res.status(403).json({
        message: `Cuenta bloqueada hasta ${user.bloqueado_hasta}`,
      });
    }
    
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      let intentos = user.intentos_fallidos + 1;

      if (intentos >= 3) {
        
        const bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000);
        await pool.query(
          "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = ? WHERE id_usuario = ?",
          [bloqueadoHasta, user.id_usuario]
        );
        return res.status(403).json({ message: "Cuenta bloqueada por 15 minutos" });
      } else {
        await pool.query(
          "UPDATE usuarios SET intentos_fallidos = ? WHERE id_usuario = ?",
          [intentos, user.id_usuario]
        );
        return res
          .status(400)
          .json({ message: `Contraseña incorrecta. Intentos: ${intentos}/3` });
      }
    }

    await pool.query(
      "UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL, fecha_ultimo_acceso = NOW() WHERE id_usuario = ?",
      [user.id_usuario]
    );

    const token = jwt.sign(
      { id_usuario: user.id_usuario, correo: user.correo },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Login exitoso", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error en el servidor" });
  }
};
