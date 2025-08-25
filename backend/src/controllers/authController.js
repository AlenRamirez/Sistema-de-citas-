const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendConfirmationcorreo, sendRecoveryEmail } = require("../utils/mailer");

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

  const [result] = await pool.query(
      'INSERT INTO usuarios (nombre_completo, documento, correo, telefono, password_hash, id_rol) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre_completo, documento, correo, telefono, hashedPassword, 2] 
    );

    const newUserId = result.insertId;

    await pool.query(
      'INSERT INTO pacientes (id_paciente) VALUES (?)',
      [newUserId]
    );

    await sendConfirmationcorreo(correo, nombre_completo);
    

    res.status(201).json({ message: 'Paciente registrado. Se ha enviado un correo de confirmación.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error registrando usuario', error: error.message });
  }
}; 


function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id_usuario, rol }


    req.userRole = decoded.rol;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    res.status(403).json({ message: 'Token inválido' });
  }
}
// Añadir AL FINAL, después de todas las rutas
app.use((err, req, res, next) => {
  console.error('❌ Error en servidor:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: err.message
  });
});

// Para rutas no encontradas
app.use('*', (req, res) => {
  console.log(`⚠️  Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Ruta ${req.method} ${req.originalUrl} no encontrada`
  });
});

module.exports = authMiddleware;


//Login

exports.login = async (req, res) => {
  const { correo, password } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT id_usuario, correo, password_hash, id_rol, intentos_fallidos, bloqueado_hasta FROM usuarios WHERE correo = ?",
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
      {
        id_usuario: user.id_usuario,
        correo: user.correo,
        rol: user.id_rol === 2 ? 'paciente' : 'admin' 
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Login exitoso", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error en el servidor" });
  }
};
//RESTABLECER PASS
exports.forgotPassword = async (req, res) => {
  const { correo } = req.body;

  try {
    const [user] = await pool.query("SELECT * FROM usuarios WHERE correo = ?", [correo]);
    if (user.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpire = new Date(Date.now() + 60 * 60 * 1000);

    // Guardar token en la tabla de recuperación
    await pool.query(
      "INSERT INTO recuperacion_password (id_usuario, token, expiracion) VALUES (?, ?, ?)",
      [user[0].id_usuario, resetToken, tokenExpire]
    );

    const resetURL = `http://localhost:3000/auth/reset-password/${resetToken}`;

    // Enviar correo usando la función
    await sendRecoveryEmail(correo, user[0].nombre_completo, resetURL);

    res.json({ message: "Se envió un enlace a tu correo para restablecer la contraseña" });
  } catch (error) {
    console.error("Error en forgotPassword:", error);
    res.status(500).json({ message: "Error al procesar la solicitud" });
  }
};

function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token requerido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id_usuario, rol }


    req.userRole = decoded.rol;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    res.status(403).json({ message: 'Token inválido' });
  }
}
// Añadir AL FINAL, después de todas las rutas
app.use((err, req, res, next) => {
  console.error('❌ Error en servidor:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: err.message
  });
});

// Para rutas no encontradas
app.use('*', (req, res) => {
  console.log(`⚠️  Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: `Ruta ${req.method} ${req.originalUrl} no encontrada`
  });
});

module.exports = authMiddleware;


// RESTABLECER CONTRASEÑA usando tabla separada
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { nuevaContrasena } = req.body;

  try {
    const [record] = await pool.query(
      "SELECT * FROM recuperacion_password WHERE token = ? AND expiracion > NOW()",
      [token]
    );

    if (record.length === 0) {
      return res.status(400).json({ message: "Token inválido o expirado" });
    }

    const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);

    // Actualizar contraseña en usuarios
    await pool.query(
      "UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?",
      [hashedPassword, record[0].id_usuario]
    );

    // Borrar token usado
    await pool.query("DELETE FROM recuperacion_password WHERE id = ?", [record[0].id]);

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    console.error("Error en resetPassword:", error);
    res.status(500).json({ message: "Error al restablecer la contraseña" });
  }
};