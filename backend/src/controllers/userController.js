const { pool } = require('../config/db');

exports.getUsers = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id_usuario, nombre_completo, correo, id_rol, activo FROM usuarios');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error obteniendo usuarios' });
  }
};

exports.updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;
  try {
    await pool.query('UPDATE usuarios SET activo=? WHERE id_usuario=?', [activo, id]);
    res.json({ message: 'Estado de usuario actualizado' });
  } catch (err) {
    res.status(500).json({ message: 'Error actualizando usuario' });
  }
};
